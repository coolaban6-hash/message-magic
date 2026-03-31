import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function AdminLogs() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin_logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const actionColors: Record<string, string> = {
    sms_sent: "bg-success/10 text-success",
    credit_purchase_initiated: "bg-primary/10 text-primary",
    credit_purchase_completed: "bg-success/10 text-success",
    payment_failed: "bg-destructive/10 text-destructive",
    admin_credit_adjustment: "bg-warning/10 text-warning",
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-display font-bold">System Logs</h1>
        <p className="text-sm text-muted-foreground">Monitor system activity</p>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : logs && logs.length > 0 ? (
          logs.map((log) => (
            <Card key={log.id} className="glass">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionColors[log.action] || "bg-muted text-muted-foreground"}`}>
                    {log.action.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(log.created_at), "HH:mm:ss")}</span>
                </div>
                {log.details && (
                  <p className="text-[10px] text-muted-foreground truncate mt-1">
                    {JSON.stringify(log.details).substring(0, 80)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">No logs yet</div>
        )}
      </div>

      {/* Desktop Table */}
      <Card className="glass hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Action</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Details</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">IP</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : logs && logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/50">
                      <td className="p-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${actionColors[log.action] || "bg-muted text-muted-foreground"}`}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground max-w-[300px] truncate">
                        {log.details ? JSON.stringify(log.details).substring(0, 80) : "—"}
                      </td>
                      <td className="p-4 text-sm font-mono text-xs">{log.ip_address || "—"}</td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(log.created_at), "MMM d, HH:mm:ss")}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No logs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
