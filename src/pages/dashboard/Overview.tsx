import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, MessageSquare, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function Overview() {
  const { user } = useAuth();
  const { data: wallet } = useWallet();

  const { data: stats } = useQuery({
    queryKey: ["dashboard_stats", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [messagesRes, todayRes] = await Promise.all([
        supabase.from("messages").select("id, status, total_cost, recipients, created_at", { count: "exact" }).eq("user_id", user.id),
        supabase.from("messages").select("id, recipients", { count: "exact" }).eq("user_id", user.id).gte("created_at", today.toISOString()),
      ]);

      const messages = messagesRes.data ?? [];
      const totalSent = messages.reduce((sum, m) => sum + (m.recipients?.length || 0), 0);
      const delivered = messages.filter((m) => m.status === "delivered").reduce((sum, m) => sum + (m.recipients?.length || 0), 0);
      const todayCount = (todayRes.data ?? []).reduce((sum, m) => sum + (m.recipients?.length || 0), 0);

      return {
        totalMessages: messagesRes.count ?? 0,
        totalSent,
        delivered,
        deliveryRate: totalSent > 0 ? Math.round((delivered / totalSent) * 100) : 0,
        todaySent: todayCount,
        totalSpent: messages.reduce((sum, m) => sum + (m.total_cost || 0), 0),
      };
    },
    enabled: !!user,
  });

  const { data: recentMessages } = useQuery({
    queryKey: ["recent_messages", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!user,
  });

  const statCards = [
    { label: "Wallet Balance", value: `KES ${wallet?.balance?.toFixed(2) ?? "0.00"}`, icon: Wallet, color: "text-primary" },
    { label: "SMS Sent Today", value: stats?.todaySent ?? 0, icon: MessageSquare, color: "text-accent" },
    { label: "Delivery Rate", value: `${stats?.deliveryRate ?? 0}%`, icon: CheckCircle, color: "text-success" },
    { label: "Total Spent", value: `KES ${stats?.totalSpent?.toFixed(2) ?? "0.00"}`, icon: TrendingUp, color: "text-warning" },
  ];

  const statusColor: Record<string, string> = {
    delivered: "text-success",
    sent: "text-primary",
    queued: "text-warning",
    failed: "text-destructive",
    refunded: "text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your SMS activity overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
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

      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-display text-lg">Recent Messages</CardTitle>
        </CardHeader>
        <CardContent>
          {recentMessages && recentMessages.length > 0 ? (
            <div className="space-y-3">
              {recentMessages.map((msg) => (
                <div key={msg.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{msg.message.substring(0, 50)}...</p>
                    <p className="text-xs text-muted-foreground">
                      {msg.recipients.length} recipients • {msg.sender_id_text} • {format(new Date(msg.created_at), "MMM d, HH:mm")}
                    </p>
                  </div>
                  <span className={`text-xs font-medium capitalize ${statusColor[msg.status] || ""}`}>
                    {msg.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">No messages yet. Send your first SMS!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
