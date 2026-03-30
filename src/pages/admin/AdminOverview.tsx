import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, Wallet, AlertCircle, TrendingUp, Hash } from "lucide-react";

export default function AdminOverview() {
  const { data: stats } = useQuery({
    queryKey: ["admin_stats"],
    queryFn: async () => {
      const [usersRes, messagesRes, walletsRes, failedRes, senderRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("messages").select("*", { count: "exact", head: true }),
        supabase.from("wallets").select("balance"),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("sender_ids").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      const totalBalance = (walletsRes.data ?? []).reduce((sum, w) => sum + (w.balance || 0), 0);

      return {
        totalUsers: usersRes.count ?? 0,
        totalMessages: messagesRes.count ?? 0,
        systemBalance: totalBalance,
        failedMessages: failedRes.count ?? 0,
        pendingSenderIds: senderRes.count ?? 0,
      };
    },
  });

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-primary" },
    { label: "Total SMS Sent", value: stats?.totalMessages ?? 0, icon: MessageSquare, color: "text-accent" },
    { label: "System Balance", value: `KES ${stats?.systemBalance?.toFixed(2) ?? "0.00"}`, icon: Wallet, color: "text-success" },
    { label: "Failed Messages", value: stats?.failedMessages ?? 0, icon: AlertCircle, color: "text-destructive" },
    { label: "Pending Sender IDs", value: stats?.pendingSenderIds ?? 0, icon: Hash, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((s) => (
          <Card key={s.label} className="glass">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-display font-bold mt-1">{s.value}</p>
                </div>
                <s.icon className={`h-8 w-8 ${s.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
