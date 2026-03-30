import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Hash, Plus, Loader2 } from "lucide-react";

const statusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  pending: "outline",
  rejected: "destructive",
  inactive: "secondary",
};

export default function SenderIDs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newSenderId, setNewSenderId] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: senderIds, isLoading } = useQuery({
    queryKey: ["all_sender_ids", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("sender_ids")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const handlePurchase = async () => {
    if (!user || !newSenderId.trim()) { toast.error("Enter a sender ID"); return; }
    if (newSenderId.length > 11) { toast.error("Sender ID must be 11 characters or less"); return; }
    setPurchasing(true);

    const { error } = await supabase.from("sender_ids").insert({
      user_id: user.id,
      sender_id: newSenderId.trim().toUpperCase(),
      cost: 500,
    });

    if (error) {
      toast.error("Failed to request sender ID");
    } else {
      toast.success("Sender ID request submitted! Awaiting admin approval.");
      setNewSenderId("");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["all_sender_ids"] });
    }
    setPurchasing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Sender IDs</h1>
          <p className="text-muted-foreground">Manage your custom sender identities</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Request Sender ID
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Request New Sender ID</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Sender ID Name</Label>
                <Input
                  placeholder="e.g. MY_BRAND"
                  value={newSenderId}
                  onChange={(e) => setNewSenderId(e.target.value)}
                  maxLength={11}
                />
                <p className="text-xs text-muted-foreground">Max 11 characters. Alphanumeric only. Cost: KES 500</p>
              </div>
              <Button onClick={handlePurchase} disabled={purchasing} className="w-full gradient-primary">
                {purchasing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Sender ID</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Cost</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Requested</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : senderIds && senderIds.length > 0 ? (
                  senderIds.map((sid) => (
                    <tr key={sid.id} className="border-b border-border/50">
                      <td className="p-4 font-mono text-sm font-medium">{sid.sender_id}</td>
                      <td className="p-4">
                        <Badge variant={statusColor[sid.status] || "outline"} className="capitalize">{sid.status}</Badge>
                      </td>
                      <td className="p-4 text-sm">KES {sid.cost.toFixed(2)}</td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(sid.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No sender IDs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
