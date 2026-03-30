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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { invoice_id, state, api_ref } = body;

    if (!invoice_id || !state) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the payment by checkout_request_id (which stores invoice_id or api_ref)
    let payment;
    const { data: paymentByInvoice } = await supabase
      .from("payments")
      .select("*")
      .eq("checkout_request_id", invoice_id)
      .single();

    if (paymentByInvoice) {
      payment = paymentByInvoice;
    } else if (api_ref) {
      const { data: paymentByRef } = await supabase
        .from("payments")
        .select("*")
        .eq("checkout_request_id", api_ref)
        .single();
      payment = paymentByRef;
    }

    if (!payment) {
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IDEMPOTENCY: If already processed, ignore
    if (payment.status === "completed" || payment.status === "failed") {
      return new Response(JSON.stringify({ success: true, message: "Already processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (state === "COMPLETE" || state === "SUCCESSFUL") {
      // Update payment status
      await supabase.from("payments").update({
        status: "completed",
        mpesa_receipt: body.mpesa_reference || body.receipt_number || invoice_id,
      }).eq("id", payment.id);

      // Credit wallet - check if this is a sender_id payment or credits
      const isSenderIdPayment = api_ref?.startsWith("sender_id_");

      if (!isSenderIdPayment) {
        // Credit the user's wallet
        const { data: wallet } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", payment.user_id)
          .single();

        if (wallet) {
          const newBalance = wallet.balance + payment.amount;
          await supabase.from("wallets").update({ balance: newBalance }).eq("id", wallet.id);

          await supabase.from("wallet_transactions").insert({
            user_id: payment.user_id,
            wallet_id: wallet.id,
            type: "credit",
            amount: payment.amount,
            balance_before: wallet.balance,
            balance_after: newBalance,
            description: `M-Pesa top-up`,
            reference: payment.mpesa_receipt || invoice_id,
          });
        }
      }

      // Log
      await supabase.from("system_logs").insert({
        user_id: payment.user_id,
        action: isSenderIdPayment ? "sender_id_payment_completed" : "credit_purchase_completed",
        details: { payment_id: payment.id, amount: payment.amount, invoice_id },
      });

    } else if (state === "FAILED" || state === "CANCELLED") {
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);

      await supabase.from("system_logs").insert({
        user_id: payment.user_id,
        action: "payment_failed",
        details: { payment_id: payment.id, state, invoice_id },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
