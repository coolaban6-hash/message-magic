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
    const intasendApiKey = Deno.env.get("INTASEND_API_KEY");
    const intasendPublishableKey = Deno.env.get("INTASEND_PUBLISHABLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { amount, phone_number } = body;

    if (!amount || amount < 10) {
      return new Response(JSON.stringify({ error: "Minimum amount is KES 10" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!phone_number || phone_number.length < 10) {
      return new Response(JSON.stringify({ error: "Valid phone number required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase.from("payments").insert({
      user_id: user.id,
      amount,
      phone_number,
      status: "pending",
    }).select().single();

    if (paymentError) {
      return new Response(JSON.stringify({ error: "Failed to create payment" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IntaSend STK Push
    if (intasendApiKey) {
      const intasendRes = await fetch("https://payment.intasend.com/api/v1/payment/mpesa-stk-push/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${intasendApiKey}`,
        },
        body: JSON.stringify({
          amount: amount,
          phone_number: phone_number,
          api_ref: payment.id,
          narrative: "ABAN SMS Credits",
        }),
      });

      const intasendData = await intasendRes.json();

      if (intasendData.invoice?.invoice_id) {
        await supabase.from("payments")
          .update({ checkout_request_id: intasendData.invoice.invoice_id })
          .eq("id", payment.id);
      }
    }

    // Log
    await supabase.from("system_logs").insert({
      user_id: user.id,
      action: "payment_initiated",
      details: { payment_id: payment.id, amount, phone_number, provider: "intasend" },
    });

    return new Response(JSON.stringify({
      success: true,
      payment_id: payment.id,
      message: "STK push sent! Complete payment on your phone.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
