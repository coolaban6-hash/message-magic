import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, Wallet, AlertCircle, Hash, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function AdminOverview() {
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["admin_stats"],
    queryFn: async () => {
      const [usersRes, messagesRes, walletsRes, failedRes, senderRes, recentMsgsRes, paymentsRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("messages").select("recipients, total_cost, status"),
        supabase.from("wallets").select("balance"),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("sender_ids").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("payments").select("amount, status").eq("status", "completed"),
      ]);

      const msgs = messagesRes.data ?? [];
      const totalSms = msgs.reduce((s, m) => s + ((m.recipients as string[])?.length || 0), 0);
      const totalRevenue = (paymentsRes.data ?? []).reduce((s, p) => s + (p.amount || 0), 0);
      const totalBalance = (walletsRes.data ?? []).reduce((sum, w) => sum + (w.balance || 0), 0);

      return {
        totalUsers: usersRes.count ?? 0,
        totalSms,
        systemBalance: totalBalance,
        failedMessages: failedRes.count ?? 0,
        pendingSenderIds: senderRes.count ?? 0,
        totalRevenue,
        recentMessages: recentMsgsRes.data ?? [],
      };
    },
  });

  const { data: providerBalance, refetch: refetchProvider } = useQuery({
    queryKey: ["provider_balance"],
    queryFn: async () => {
      const session = (await supabase.auth.getSession()).data.session;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-credit-sync?action=balance`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 60000,
  });

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-primary" },
    { label: "Total SMS Sent", value: (stats?.totalSms ?? 0).toLocaleString(), icon: MessageSquare, color: "text-accent" },
    { label: "System Balance", value: `KES ${stats?.systemBalance?.toFixed(2) ?? "0.00"}`, icon: Wallet, color: "text-success" },
    { label: "Total Revenue", value: `KES ${stats?.totalRevenue?.toFixed(2) ?? "0.00"}`, icon: TrendingUp, color: "text-warning" },
    { label: "Failed SMS", value: stats?.failedMessages ?? 0, icon: AlertCircle, color: "text-destructive" },
    { label: "Pending Sender IDs", value: stats?.pendingSenderIds ?? 0, icon: Hash, color: "text-primary" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">System overview and management</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchStats(); refetchProvider(); }}>
          <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Provider Balance Card */}
      {providerBalance && (
        <Card className="glass border-primary/30">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">SMS Provider Credit Balance</p>
                <p className="text-2xl md:text-3xl font-display font-bold text-primary">
                  KES {(providerBalance.provider_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Platform Users Balance</p>
                <p className="text-lg md:text-xl font-display font-bold">
                  KES {(providerBalance.system_balance ?? 0).toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Synced: {providerBalance.synced_at ? format(new Date(providerBalance.synced_at), "HH:mm:ss") : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((s) => (
          <Card key={s.label} className="glass">
            <CardContent className="p-3 md:p-5">
              <div className="flex items-center gap-2 md:gap-3">
                <s.icon className={`h-5 w-5 md:h-8 md:w-8 ${s.color} opacity-80 shrink-0`} />
                <div className="min-w-0">
                  <p className="text-[10px] md:text-sm text-muted-foreground truncate">{s.label}</p>
                  <p className="text-base md:text-2xl font-display font-bold">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Messages */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base md:text-lg">Recent Messages</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentMessages && stats.recentMessages.length > 0 ? (
            <div className="space-y-2">
              {stats.recentMessages.map((msg: any) => (
                <div key={msg.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{msg.message?.substring(0, 40)}...</p>
                    <p className="text-xs text-muted-foreground">
                      {msg.recipients?.length} recipients • {msg.sender_id_text} • {format(new Date(msg.created_at), "MMM d, HH:mm")}
                    </p>
                  </div>
                  <Badge
                    variant={msg.status === "sent" || msg.status === "delivered" ? "default" : msg.status === "failed" ? "destructive" : "outline"}
                    className="capitalize text-xs ml-2"
                  >
                    {msg.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-6">No messages yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
