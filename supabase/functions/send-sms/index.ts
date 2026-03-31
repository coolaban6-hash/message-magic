import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const talksasaToken = Deno.env.get("TALKSASA_API_TOKEN")!;
    const talksasaBaseUrl = Deno.env.get("TALKSASA_BASE_URL") || "https://api.talksasa.com";
    const talksasaMaxRecipients = parseInt(Deno.env.get("TALKSASA_MAX_RECIPIENTS") || "500");
    const talksasaDefaultSenderId = Deno.env.get("TALKSASA_DEFAULT_SENDER_ID") || "ABAN_COOL";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = apiKey.user_id;
      await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id);
    }

    // Handle balance check
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "balance") {
      const { data: wallet } = await supabase.from("wallets").select("balance, currency").eq("user_id", userId).single();
      return new Response(JSON.stringify({ balance: wallet?.balance ?? 0, currency: wallet?.currency ?? "KES" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const body = await req.json();
    const { recipients, message, sender_id = "ABAN_COOL" } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "recipients array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!message || typeof message !== "string" || message.length === 0) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate sender ID
    let actualSenderId = sender_id;
    if (sender_id !== "ABAN_COOL") {
      const { data: validSender } = await supabase
        .from("sender_ids")
        .select("id")
        .eq("user_id", userId)
        .eq("sender_id", sender_id)
        .eq("status", "active")
        .single();

      if (!validSender) {
        return new Response(JSON.stringify({ error: "Invalid or inactive sender ID. Use ABAN_COOL or an approved sender ID." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      actualSenderId = talksasaDefaultSenderId;
    }

    // Calculate cost
    const isGsm = /^[\x20-\x7E\n\r]*$/.test(message);
    const len = message.length;
    const segments = isGsm ? (len <= 160 ? 1 : Math.ceil(len / 153)) : (len <= 70 ? 1 : Math.ceil(len / 67));
    const costPerSegment = 0.50;
    const totalCost = segments * recipients.length * costPerSegment;

    // Check wallet - HARD BLOCK if balance is 0
    const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", userId).single();
    if (!wallet || wallet.balance <= 0) {
      return new Response(JSON.stringify({ error: "Your balance is 0. Please buy credits before sending SMS.", required: totalCost, available: wallet?.balance ?? 0 }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (wallet.balance < totalCost) {
      return new Response(JSON.stringify({ error: "Insufficient balance", required: totalCost, available: wallet.balance }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      sender_id_text: sender_id,
      recipients,
      message,
      segment_count: segments,
      total_cost: totalCost,
      status: "queued",
      sent_count: 0,
      api_request: !user,
    }).select().single();

    // Send via Talksasa in batches
    let totalSent = 0;
    let totalFailed = 0;
    const batchSize = talksasaMaxRecipients;
    const batches = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      try {
        const talksasaRes = await fetch(`${talksasaBaseUrl}/v1/sms/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${talksasaToken}`,
          },
          body: JSON.stringify({
            sender_id: actualSenderId,
            message,
            recipients: batch,
          }),
        });

        const talksasaData = await talksasaRes.json();

        if (talksasaRes.ok && (talksasaData.status === "success" || talksasaData.success)) {
          totalSent += batch.length;
        } else {
          console.error("Talksasa batch error:", talksasaData);
          totalFailed += batch.length;
        }
      } catch (batchErr) {
        console.error("Talksasa batch exception:", batchErr);
        totalFailed += batch.length;
      }
    }

    // Update message record with results
    const finalStatus = totalFailed === recipients.length ? "failed" : totalSent > 0 ? "sent" : "failed";
    await supabase.from("messages").update({
      status: finalStatus,
      sent_count: totalSent,
      failed_count: totalFailed,
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
      details: { message_id: msgRecord?.id, recipients: recipients.length, sent: totalSent, failed: totalFailed, cost: totalCost, sender_id },
    });

    return new Response(JSON.stringify({
      success: true,
      message_id: msgRecord?.id,
      recipients: recipients.length,
      sent: totalSent,
      failed: totalFailed,
      segments,
      total_cost: totalCost,
      balance_after: totalFailed > 0 ? newBalance + (segments * totalFailed * costPerSegment) : newBalance,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
