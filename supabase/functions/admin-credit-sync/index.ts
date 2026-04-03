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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check - must be admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "balance";

    if (action === "balance") {
      // Talksasa v3 balance endpoint
      const balanceUrl = `${talksasaBaseUrl}/balance`;
      let providerBalance = 0;
      let providerCurrency = "KES";

      try {
        const res = await fetch(balanceUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${talksasaToken}`,
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
        });
        const rawText = await res.text();
        console.log("Balance response:", res.status, rawText.substring(0, 300));

        if (res.ok) {
          const data = JSON.parse(rawText);
          // Response: {"status":"success","data":{"remaining_balance":"Ksh1,092"}}
          const rawBalance = data?.data?.remaining_balance ?? data?.balance ?? data?.credits ?? "0";
          // Parse "Ksh1,092" -> 1092
          providerBalance = parseFloat(String(rawBalance).replace(/[^0-9.]/g, "")) || 0;
        }
      } catch (e) {
        console.error("Balance fetch failed:", e.message);
      }

      // Get total system balance (all user wallets)
      const { data: wallets } = await supabase.from("wallets").select("balance");
      const totalSystemBalance = (wallets ?? []).reduce((s, w) => s + (w.balance || 0), 0);

      return new Response(JSON.stringify({
        provider_balance: providerBalance,
        provider_currency: providerCurrency,
        system_balance: totalSystemBalance,
        synced_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "adjust") {
      const body = await req.json();
      const { user_id, amount, type, reason } = body;

      if (!user_id || !amount || !type) {
        return new Response(JSON.stringify({ error: "user_id, amount, type required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user_id).single();
      if (!wallet) {
        return new Response(JSON.stringify({ error: "User wallet not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newBalance = type === "credit" ? wallet.balance + amount : wallet.balance - amount;
      if (newBalance < 0) {
        return new Response(JSON.stringify({ error: "Cannot reduce balance below 0" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("wallets").update({ balance: newBalance }).eq("id", wallet.id);
      await supabase.from("wallet_transactions").insert({
        user_id,
        wallet_id: wallet.id,
        type,
        amount,
        balance_before: wallet.balance,
        balance_after: newBalance,
        description: reason || `Admin ${type}: ${amount}`,
      });

      await supabase.from("system_logs").insert({
        user_id: user.id,
        action: "admin_credit_adjustment",
        details: { target_user: user_id, type, amount, reason, balance_before: wallet.balance, balance_after: newBalance },
      });

      return new Response(JSON.stringify({ success: true, new_balance: newBalance }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
