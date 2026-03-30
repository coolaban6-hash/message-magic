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

    // Check auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Try JWT auth first
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    let userId: string;
    
    if (user) {
      userId = user.id;
    } else {
      // Try API key auth
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
      
      // Update last used
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

    // Calculate cost
    const isGsm = /^[\x20-\x7E\n\r]*$/.test(message);
    const len = message.length;
    const segments = isGsm ? (len <= 160 ? 1 : Math.ceil(len / 153)) : (len <= 70 ? 1 : Math.ceil(len / 67));
    const costPerSegment = 0.50;
    const totalCost = segments * recipients.length * costPerSegment;

    // Check wallet
    const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", userId).single();
    if (!wallet || wallet.balance < totalCost) {
      return new Response(JSON.stringify({ error: "Insufficient balance", required: totalCost, available: wallet?.balance ?? 0 }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct credits
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
      description: `SMS to ${recipients.length} recipients`,
    });

    // Create message record
    const { data: msgRecord } = await supabase.from("messages").insert({
      user_id: userId,
      sender_id_text: sender_id,
      recipients,
      message,
      segment_count: segments,
      total_cost: totalCost,
      status: "sent",
      sent_count: recipients.length,
      api_request: !user, // true if API key was used
    }).select().single();

    // TODO: Integrate with Talksasa API here
    // For now, mark as sent. In production, call Talksasa API and handle delivery reports.

    // Log
    await supabase.from("system_logs").insert({
      user_id: userId,
      action: "sms_sent",
      details: { message_id: msgRecord?.id, recipients: recipients.length, cost: totalCost },
    });

    return new Response(JSON.stringify({
      success: true,
      message_id: msgRecord?.id,
      recipients: recipients.length,
      segments,
      total_cost: totalCost,
      balance_after: newBalance,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
