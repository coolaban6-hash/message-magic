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
    return cleaned.slice(1);
  }

  if (cleaned.startsWith("254") && cleaned.length === 12) {
    return cleaned;
  }

  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return `254${cleaned.slice(1)}`;
  }

  if ((cleaned.startsWith("7") || cleaned.startsWith("1")) && cleaned.length === 9) {
    return `254${cleaned}`;
  }

  return null;
};

const resolveIntaSendBaseUrl = (configuredBaseUrl?: string | null) => {
  const fallback = "https://api.intasend.com";
  const trimmed = configuredBaseUrl?.trim().replace(/\/+$/, "") || fallback;

  if (trimmed.includes("payment.intasend.com")) {
    return fallback;
  }

  return trimmed;
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const intasendSecretKey = Deno.env.get("INTASEND_SECRET_KEY");
    const intasendBaseUrl = resolveIntaSendBaseUrl(Deno.env.get("INTASEND_BASE_URL"));
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!intasendSecretKey) {
      return jsonResponse({ error: "Payment service is not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

    const { amount, phone_number, purpose = "credits", sender_id, network, business_name } = body;
    const amountValue = Number(amount);
    const normalizedPhone = normalizeKenyanPhone(phone_number);

    if (!Number.isFinite(amountValue) || amountValue < 10) {
      return jsonResponse({ error: "Minimum amount is KES 10" }, 400);
    }

    if (!normalizedPhone) {
      return jsonResponse({ error: "Enter a valid Kenyan phone number" }, 400);
    }

    const apiRef = `${purpose}_${user.id}_${Date.now()}`;
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        amount: amountValue,
        phone_number: normalizedPhone,
        status: "pending",
        checkout_request_id: apiRef,
      })
      .select()
      .single();

    if (paymentError || !payment) {
      return jsonResponse({ error: "Failed to create payment" }, 500);
    }

    try {
      const narrative = purpose === "sender_id"
        ? `ABANCOOL Sender ID: ${String(sender_id ?? "").toUpperCase()}${network ? ` (${network})` : ""}`
        : "ABANCOOL Bulk SMS Credits";

      const intasendRes = await fetch(`${intasendBaseUrl}/api/v1/payment/mpesa-stk-push/`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${intasendSecretKey}`,
        },
        body: JSON.stringify({
          amount: amountValue.toFixed(2),
          phone_number: normalizedPhone,
          api_ref: apiRef,
          narrative,
          ...(user.email ? { email: user.email } : {}),
        }),
      });

      const { data: intasendData, text: intasendText } = await readProviderResponse(intasendRes);
      console.log("IntaSend STK response", JSON.stringify({
        status: intasendRes.status,
        ok: intasendRes.ok,
        body: intasendData ?? intasendText,
      }));

      if (!intasendRes.ok) {
        await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
        console.error("IntaSend STK failed", intasendRes.status, intasendText);
        return jsonResponse({ error: "STK push failed. Please confirm your number and try again." }, 500);
      }

      const invoiceId = intasendData?.invoice?.invoice_id ?? intasendData?.invoice_id ?? null;
      if (invoiceId) {
        await supabase.from("payments").update({ checkout_request_id: invoiceId }).eq("id", payment.id);
      }
    } catch (intasendErr) {
      console.error("IntaSend STK exception:", intasendErr);
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return jsonResponse({ error: "Payment service unavailable. Please try again." }, 500);
    }

    await supabase.from("system_logs").insert({
      user_id: user.id,
      action: purpose === "sender_id" ? "sender_id_payment_initiated" : "credit_purchase_initiated",
      details: {
        payment_id: payment.id,
        amount: amountValue,
        phone_number: normalizedPhone,
        ...(purpose === "sender_id" && { sender_id, network, business_name }),
      },
    });

    return jsonResponse({
      success: true,
      payment_id: payment.id,
      message: "STK push sent! Complete payment on your phone.",
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
