import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { format } from "date-fns";

export default function AdminSenderIDs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: senderIds, isLoading } = useQuery({
    queryKey: ["admin_sender_ids"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sender_ids")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const updateStatus = async (id: string, status: "active" | "rejected") => {
    const { error } = await supabase
      .from("sender_ids")
      .update({ status, approved_by: user?.id })
      .eq("id", id);

    if (error) toast.error("Failed to update");
    else {
      toast.success(`Sender ID ${status}`);
      queryClient.invalidateQueries({ queryKey: ["admin_sender_ids"] });
    }
  };

  const statusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: "default",
    pending: "outline",
    rejected: "destructive",
    inactive: "secondary",
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-display font-bold">Sender ID Management</h1>
        <p className="text-sm text-muted-foreground">Approve or reject sender ID requests</p>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : senderIds && senderIds.length > 0 ? (
          senderIds.map((sid) => (
            <Card key={sid.id} className="glass">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-sm font-bold">{sid.sender_id}</span>
                  <Badge variant={statusColor[sid.status]} className="capitalize">{sid.status}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span>KES {sid.cost.toFixed(2)}</span>
                  <span>{format(new Date(sid.created_at), "MMM d, yyyy")}</span>
                </div>
                {sid.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateStatus(sid.id, "active")} className="flex-1 text-success border-success/20">
                      <Check className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(sid.id, "rejected")} className="flex-1 text-destructive border-destructive/20">
                      <X className="h-3 w-3 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">No sender IDs</div>
        )}
      </div>

      {/* Desktop Table */}
      <Card className="glass hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Sender ID</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Cost</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : senderIds && senderIds.length > 0 ? (
                  senderIds.map((sid) => (
                    <tr key={sid.id} className="border-b border-border/50">
                      <td className="p-4 font-mono text-sm font-medium">{sid.sender_id}</td>
                      <td className="p-4 text-sm">KES {sid.cost.toFixed(2)}</td>
                      <td className="p-4">
                        <Badge variant={statusColor[sid.status]} className="capitalize">{sid.status}</Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(sid.created_at), "MMM d, yyyy")}</td>
                      <td className="p-4">
                        {sid.status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => updateStatus(sid.id, "active")} className="text-success border-success/20">
                              <Check className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => updateStatus(sid.id, "rejected")} className="text-destructive border-destructive/20">
                              <X className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No sender IDs</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
