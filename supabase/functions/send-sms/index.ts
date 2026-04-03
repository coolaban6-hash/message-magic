import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const normalizeKenyanPhone = (value: string | null | undefined) => {
  if (!value) return null;

  const cleaned = value.trim().replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+254") && cleaned.length === 13) {
    return cleaned;
  }

  if (cleaned.startsWith("254") && cleaned.length === 12) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return `+254${cleaned.slice(1)}`;
  }

  if ((cleaned.startsWith("7") || cleaned.startsWith("1")) && cleaned.length === 9) {
    return `+254${cleaned}`;
  }

  return null;
};

const resolveTalksasaBaseUrl = (configuredBaseUrl?: string | null) => {
  const fallback = "https://bulksms.talksasa.com/api/v3";
  const trimmed = configuredBaseUrl?.trim().replace(/\/+$/, "") || fallback;

  if (trimmed.includes("api.talksasa.com")) {
    return fallback;
  }

  return trimmed;
};

const buildTalksasaSendUrl = (baseUrl: string) => {
  if (baseUrl.includes("/api/v3")) {
    return `${baseUrl}/sms/send`;
  }

  return `${baseUrl}/v1/sms/send`;
};

const readProviderResponse = async (response: Response) => {
  const text = await response.text();

  if (!text) {
    return { text: "", data: null };
  }

  try {
    return { text, data: JSON.parse(text) };
  } catch {
    return { text, data: null };
  }
};

const toNumberOrNull = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractProviderMessageId = (payload: any): string | null => {
  const candidates = [
    payload?.provider_message_id,
    payload?.message_id,
    payload?.uid,
    payload?.tracking_id,
    payload?.reference,
    payload?.data?.provider_message_id,
    payload?.data?.message_id,
    payload?.data?.uid,
    payload?.data?.tracking_id,
    payload?.data?.reference,
    Array.isArray(payload?.messages) ? payload.messages[0]?.provider_message_id : null,
    Array.isArray(payload?.messages) ? payload.messages[0]?.message_id : null,
    Array.isArray(payload?.messages) ? payload.messages[0]?.uid : null,
    Array.isArray(payload?.data) ? payload.data[0]?.provider_message_id : null,
    Array.isArray(payload?.data) ? payload.data[0]?.message_id : null,
    Array.isArray(payload?.data) ? payload.data[0]?.uid : null,
  ];

  const match = candidates.find((value) => value !== null && value !== undefined && value !== "");
  return match === undefined ? null : String(match);
};

const extractDeliveryPayload = (payload: any) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const providerMessageId = extractProviderMessageId(payload);
  const status = payload?.delivery_status
    ?? payload?.message_status
    ?? payload?.status
    ?? payload?.state
    ?? payload?.data?.delivery_status
    ?? payload?.data?.message_status
    ?? payload?.data?.status
    ?? payload?.data?.state;

  if (!providerMessageId || !status) {
    return null;
  }

  return {
    providerMessageId,
    status: String(status),
    deliveredCount: toNumberOrNull(
      payload?.delivered_count
      ?? payload?.delivered
      ?? payload?.success_count
      ?? payload?.data?.delivered_count
      ?? payload?.data?.delivered
      ?? payload?.data?.success_count,
    ),
    failedCount: toNumberOrNull(
      payload?.failed_count
      ?? payload?.failed
      ?? payload?.error_count
      ?? payload?.data?.failed_count
      ?? payload?.data?.failed
      ?? payload?.data?.error_count,
    ),
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const talksasaToken = Deno.env.get("TALKSASA_API_TOKEN") || Deno.env.get("TALKSASA_API_KEY");
    const talksasaBaseUrl = resolveTalksasaBaseUrl(Deno.env.get("TALKSASA_BASE_URL"));
    const talksasaMaxRecipients = parseInt(Deno.env.get("TALKSASA_MAX_RECIPIENTS") || "500");
    const talksasaDefaultSenderId = Deno.env.get("TALKSASA_DEFAULT_SENDER_ID") || "ABAN_COOL";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);
    const authHeader = req.headers.get("Authorization");
    const body = req.method === "GET" ? null : await req.json().catch(() => null);

    if (!talksasaToken) {
      return jsonResponse({ error: "SMS provider is not configured" }, 500);
    }

    const deliveryPayload = extractDeliveryPayload(body);
    if ((!authHeader || url.searchParams.get("action") === "delivery-report") && deliveryPayload) {
      const { data: updatedMessage, error: deliveryError } = await supabase.rpc("record_message_delivery", {
        _provider_message_id: deliveryPayload.providerMessageId,
        _status: deliveryPayload.status,
        _delivered_count: deliveryPayload.deliveredCount,
        _failed_count: deliveryPayload.failedCount,
      });

      if (deliveryError) {
        console.error("Delivery report update failed:", deliveryError, body);
        return jsonResponse({ error: "Failed to process delivery report" }, 400);
      }

      await supabase.from("system_logs").insert({
        user_id: updatedMessage?.user_id ?? null,
        action: "sms_delivery_report_received",
        details: {
          provider_message_id: deliveryPayload.providerMessageId,
          status: deliveryPayload.status,
          delivered_count: deliveryPayload.deliveredCount,
          failed_count: deliveryPayload.failedCount,
        },
      });

      return jsonResponse({ success: true });
    }

    // Check auth
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    let userId: string;

    if (user) {
      userId = user.id;
    } else {
      // API key auth
      const { data: apiKey } = await supabase
        .from("api_keys")
        .select("*")
        .eq("api_key", token)
        .eq("is_active", true)
        .single();

      if (!apiKey) {
        return jsonResponse({ error: "Invalid credentials" }, 401);
      }
      userId = apiKey.user_id;
      await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id);
    }

    // Handle balance check
    if (url.searchParams.get("action") === "balance") {
      const { data: wallet } = await supabase.from("wallets").select("balance, currency").eq("user_id", userId).single();
      return jsonResponse({ balance: wallet?.balance ?? 0, currency: wallet?.currency ?? "KES" });
    }

    // Parse body
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

    const { recipients, message, sender_id = "ABAN_COOL" } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return jsonResponse({ error: "recipients array is required" }, 400);
    }
    if (!message || typeof message !== "string" || message.length === 0) {
      return jsonResponse({ error: "message is required" }, 400);
    }

    const normalizedRecipients = recipients.map((recipient) => normalizeKenyanPhone(String(recipient)));
    const invalidRecipients = normalizedRecipients.filter((recipient) => !recipient);

    if (invalidRecipients.length > 0) {
      return jsonResponse({ error: "One or more recipient phone numbers are invalid. Use Kenyan format like 0712345678 or 254712345678." }, 400);
    }

    const safeRecipients = normalizedRecipients as string[];
    const requestedSenderId = String(sender_id || talksasaDefaultSenderId).trim().toUpperCase();

    // Validate sender ID
    let actualSenderId = requestedSenderId;
    if (requestedSenderId !== "ABAN_COOL" && requestedSenderId !== talksasaDefaultSenderId.toUpperCase()) {
      const { data: validSender } = await supabase
        .from("sender_ids")
        .select("id")
        .eq("user_id", userId)
        .eq("sender_id", requestedSenderId)
        .eq("status", "active")
        .single();

      if (!validSender) {
        return jsonResponse({ error: "Invalid or inactive sender ID. Use ABAN_COOL or an approved sender ID." }, 400);
      }
    } else {
      actualSenderId = talksasaDefaultSenderId;
    }

    // Calculate cost
    const isGsm = /^[\x20-\x7E\n\r]*$/.test(message);
    const len = message.length;
    const segments = isGsm ? (len <= 160 ? 1 : Math.ceil(len / 153)) : (len <= 70 ? 1 : Math.ceil(len / 67));
    const costPerSegment = 0.50;
    const totalCost = segments * safeRecipients.length * costPerSegment;

    // Check wallet - HARD BLOCK if balance is 0
    const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", userId).single();
    if (!wallet || wallet.balance <= 0) {
      return jsonResponse({ error: "Your balance is 0. Please buy credits before sending SMS.", required: totalCost, available: wallet?.balance ?? 0 }, 402);
    }
    if (wallet.balance < totalCost) {
      return jsonResponse({ error: "Insufficient balance", required: totalCost, available: wallet.balance }, 402);
    }

    // Deduct credits FIRST (before sending)
    const newBalance = wallet.balance - totalCost;
    await supabase.from("wallets").update({ balance: newBalance }).eq("id", wallet.id);

    // Log transaction
    await supabase.from("wallet_transactions").insert({
      user_id: userId,
      wallet_id: wallet.id,
      type: "debit",
      amount: totalCost,
      balance_before: wallet.balance,
      balance_after: newBalance,
      description: `SMS to ${recipients.length} recipients (${segments} seg)`,
    });

    // Create message record
    const { data: msgRecord } = await supabase.from("messages").insert({
      user_id: userId,
      sender_id_text: requestedSenderId,
      recipients: safeRecipients,
      message,
      segment_count: segments,
      total_cost: totalCost,
      status: "queued",
      sent_count: 0,
      delivered_count: 0,
      failed_count: 0,
      api_request: !user,
    }).select().single();

    // Send via Talksasa in batches
    let totalSent = 0;
    let totalFailed = 0;
    let providerMessageId: string | null = null;
    const batchSize = talksasaMaxRecipients;
    const batches = [];

    for (let i = 0; i < safeRecipients.length; i += batchSize) {
      batches.push(safeRecipients.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      try {
        const talksasaRes = await fetch(buildTalksasaSendUrl(talksasaBaseUrl), {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${talksasaToken}`,
          },
          body: JSON.stringify({
            recipient: batch.length === 1 ? batch[0] : batch,
            recipients: batch,
            sender_id: actualSenderId,
            type: "plain",
            message,
          }),
        });

        const { data: talksasaData, text: talksasaText } = await readProviderResponse(talksasaRes);

        if (talksasaRes.ok && (
          talksasaData?.status === "success" ||
          talksasaData?.success ||
          talksasaData?.uid ||
          talksasaData?.message_id ||
          talksasaData?.data?.uid
        )) {
          const batchProviderMessageId = extractProviderMessageId(talksasaData);
          if (!providerMessageId && batchProviderMessageId) {
            providerMessageId = batchProviderMessageId;
          }
          totalSent += batch.length;
        } else {
          console.error("Talksasa batch error:", talksasaRes.status, talksasaData ?? talksasaText);
          totalFailed += batch.length;
        }
      } catch (batchErr) {
        console.error("Talksasa batch exception:", batchErr);
        totalFailed += batch.length;
      }
    }

    // Update message record with results
    // Mark as "delivered" when sent succeeds — Talksasa doesn't send DLR webhooks
    const finalStatus = totalFailed === recipients.length ? "failed" : totalSent > 0 ? "delivered" : "failed";
    await supabase.from("messages").update({
      status: finalStatus,
      sent_count: totalSent,
      delivered_count: totalSent,
      failed_count: totalFailed,
      provider_message_id: providerMessageId,
    }).eq("id", msgRecord?.id);

    // If ALL failed, refund credits
    if (totalFailed === recipients.length) {
      await supabase.from("wallets").update({ balance: wallet.balance }).eq("id", wallet.id);
      await supabase.from("wallet_transactions").insert({
        user_id: userId,
        wallet_id: wallet.id,
        type: "refund",
        amount: totalCost,
        balance_before: newBalance,
        balance_after: wallet.balance,
        description: `Refund: SMS delivery failed`,
      });

      // Update message status
      await supabase.from("messages").update({ status: "refunded" }).eq("id", msgRecord?.id);
    } else if (totalFailed > 0) {
      // Partial refund for failed messages
      const refundAmount = segments * totalFailed * costPerSegment;
      const refundedBalance = newBalance + refundAmount;
      await supabase.from("wallets").update({ balance: refundedBalance }).eq("id", wallet.id);
      await supabase.from("wallet_transactions").insert({
        user_id: userId,
        wallet_id: wallet.id,
        type: "refund",
        amount: refundAmount,
        balance_before: newBalance,
        balance_after: refundedBalance,
        description: `Partial refund: ${totalFailed} SMS failed`,
      });
    }

    // Log
    await supabase.from("system_logs").insert({
      user_id: userId,
      action: "sms_sent",
      details: {
        message_id: msgRecord?.id,
        provider_message_id: providerMessageId,
        recipients: safeRecipients.length,
        sent: totalSent,
        failed: totalFailed,
        cost: totalCost,
        sender_id: requestedSenderId,
      },
    });

    return jsonResponse({
      success: true,
      message_id: msgRecord?.id,
      recipients: safeRecipients.length,
      sent: totalSent,
      failed: totalFailed,
      segments,
      total_cost: totalCost,
      balance_after: totalFailed > 0 ? newBalance + (segments * totalFailed * costPerSegment) : newBalance,
    });

  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
