import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">System Logs</h1>
        <p className="text-muted-foreground">Monitor system activity and events</p>
      </div>

      <Card className="glass">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Action</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">User</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Details</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">IP</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : logs && logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/50">
                      <td className="p-4 text-sm font-medium">{log.action}</td>
                      <td className="p-4 text-sm text-muted-foreground">{log.user_id?.substring(0, 8) || "System"}...</td>
                      <td className="p-4 text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.details ? JSON.stringify(log.details).substring(0, 50) : "—"}
                      </td>
                      <td className="p-4 text-sm font-mono text-xs">{log.ip_address || "—"}</td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(log.created_at), "MMM d, HH:mm:ss")}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No logs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
