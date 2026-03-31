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
    const intasendSecretKey = Deno.env.get("INTASEND_SECRET_KEY")!;
    const intasendBaseUrl = Deno.env.get("INTASEND_BASE_URL") || "https://payment.intasend.com";
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
    const { amount, phone_number, purpose = "credits", sender_id, network, business_name } = body;

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

    // Create payment record with unique api_ref
    const apiRef = `${purpose}_${user.id}_${Date.now()}`;
    const { data: payment, error: paymentError } = await supabase.from("payments").insert({
      user_id: user.id,
      amount,
      phone_number,
      status: "pending",
      checkout_request_id: apiRef,
    }).select().single();

    if (paymentError) {
      return new Response(JSON.stringify({ error: "Failed to create payment" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IntaSend STK Push - REAL PRODUCTION
    try {
      const intasendRes = await fetch(`${intasendBaseUrl}/api/v1/payment/mpesa-stk-push/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${intasendSecretKey}`,
        },
        body: JSON.stringify({
          amount: Number(amount),
          phone_number,
          api_ref: apiRef,
          narrative: purpose === "sender_id"
            ? `ABANCOOL Sender ID: ${sender_id} (${network})`
            : "ABANCOOL SMS Credits",
        }),
      });

      const intasendData = await intasendRes.json();
      console.log("IntaSend STK response:", JSON.stringify(intasendData));

      if (intasendData.invoice?.invoice_id) {
        await supabase.from("payments")
          .update({ checkout_request_id: intasendData.invoice.invoice_id })
          .eq("id", payment.id);
      }

      if (!intasendRes.ok) {
        console.error("IntaSend STK failed:", intasendData);
        await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
        return new Response(JSON.stringify({ error: "STK push failed. Please try again." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (intasendErr) {
      console.error("IntaSend STK exception:", intasendErr);
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return new Response(JSON.stringify({ error: "Payment service unavailable. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log
    await supabase.from("system_logs").insert({
      user_id: user.id,
      action: purpose === "sender_id" ? "sender_id_payment_initiated" : "credit_purchase_initiated",
      details: {
        payment_id: payment.id,
        amount,
        phone_number,
        ...(purpose === "sender_id" && { sender_id, network, business_name }),
      },
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
