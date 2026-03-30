import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function AdminPayments() {
  const { data: payments, isLoading } = useQuery({
    queryKey: ["admin_payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const statusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    completed: "default",
    pending: "outline",
    failed: "destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Payments</h1>
        <p className="text-muted-foreground">Track all platform payments</p>
      </div>

      <Card className="glass">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">User</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Phone</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Receipt</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : payments && payments.length > 0 ? (
                  payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="p-4 text-sm">{p.user_id.substring(0, 8)}...</td>
                      <td className="p-4 text-sm font-medium">KES {p.amount.toFixed(2)}</td>
                      <td className="p-4 text-sm">{p.phone_number || "—"}</td>
                      <td className="p-4 text-sm font-mono text-xs">{p.mpesa_receipt || "—"}</td>
                      <td className="p-4">
                        <Badge variant={statusColor[p.status]} className="capitalize">{p.status}</Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(p.created_at), "MMM d, HH:mm")}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No payments yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
