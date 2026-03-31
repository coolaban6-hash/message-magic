import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  delivered: "default",
  sent: "secondary",
  queued: "outline",
  failed: "destructive",
  refunded: "outline",
};

export default function Messages() {
  const { user } = useAuth();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["all_messages", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-display font-bold">Message History</h1>
        <p className="text-sm text-muted-foreground">View all your sent messages</p>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : messages && messages.length > 0 ? (
          messages.map((msg) => (
            <Card key={msg.id} className="glass">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium flex-1 truncate mr-2">{msg.message.substring(0, 60)}</p>
                  <Badge variant={statusVariant[msg.status] || "outline"} className="capitalize text-[10px] shrink-0">
                    {msg.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{(msg.recipients as string[]).length} recipients • {msg.sender_id_text}</span>
                  <span>KES {msg.total_cost.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(msg.created_at), "MMM d, yyyy HH:mm")}</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">No messages found</div>
        )}
      </div>

      {/* Desktop Table */}
      <Card className="glass hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Message</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Sender</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Recipients</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Cost</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : messages && messages.length > 0 ? (
                  messages.map((msg) => (
                    <tr key={msg.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-4 text-sm max-w-[200px] truncate">{msg.message}</td>
                      <td className="p-4 text-sm font-mono text-xs">{msg.sender_id_text}</td>
                      <td className="p-4 text-sm">{(msg.recipients as string[]).length}</td>
                      <td className="p-4 text-sm font-medium">KES {msg.total_cost.toFixed(2)}</td>
                      <td className="p-4">
                        <Badge variant={statusVariant[msg.status] || "outline"} className="capitalize text-xs">
                          {msg.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(msg.created_at), "MMM d, HH:mm")}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No messages found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
