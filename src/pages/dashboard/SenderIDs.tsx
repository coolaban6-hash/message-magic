import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Hash, Plus, Loader2 } from "lucide-react";

const NETWORKS = [
  { value: "safaricom", label: "Safaricom", price: 7500 },
  { value: "airtel", label: "Airtel", price: 7500 },
  { value: "telkom", label: "Telkom", price: 7500 },
];

const statusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  pending: "outline",
  rejected: "destructive",
  inactive: "secondary",
};

export default function SenderIDs() {
  const { user } = useAuth();
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();
  const [newSenderId, setNewSenderId] = useState("");
  const [network, setNetwork] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessReg, setBusinessReg] = useState("");
  const [phone, setPhone] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

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

  const validateSenderId = (id: string): string | null => {
    if (!id.trim()) return "Enter a sender ID";
    if (id.length > 11) return "Max 11 characters";
    if (!/^[A-Z0-9_]+$/.test(id)) return "Uppercase letters, numbers, and underscores only";
    return null;
  };

  const handleNextStep = () => {
    const formatted = newSenderId.trim().toUpperCase();
    setNewSenderId(formatted);
    const err = validateSenderId(formatted);
    if (err) { toast.error(err); return; }
    if (!network) { toast.error("Select a network"); return; }
    setStep(2);
  };

  const handlePurchase = async () => {
    if (!user) return;
    if (!businessName.trim()) { toast.error("Enter business name"); return; }
    if (!phone || phone.length < 10) { toast.error("Enter a valid M-Pesa phone number"); return; }

    setPurchasing(true);

    try {
      // Initiate STK push for sender ID payment
      const { data, error } = await supabase.functions.invoke("buy-credits", {
        body: {
          amount: 7500,
          phone_number: phone,
          purpose: "sender_id",
          sender_id: newSenderId.trim().toUpperCase(),
          network,
          business_name: businessName.trim(),
          business_reg: businessReg.trim(),
        },
      });

      if (error) throw error;

      // Create sender ID record as pending
      const { error: insertError } = await supabase.from("sender_ids").insert({
        user_id: user.id,
        sender_id: newSenderId.trim().toUpperCase(),
        cost: 7500,
        status: "pending",
      });

      if (insertError) {
        toast.error("Failed to submit sender ID request");
      } else {
        toast.success("STK push sent! Your sender ID request will be processed within 24-48 hours after payment confirmation.");
        resetDialog();
        queryClient.invalidateQueries({ queryKey: ["all_sender_ids"] });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate payment");
    }

    setPurchasing(false);
  };

  const resetDialog = () => {
    setNewSenderId("");
    setNetwork("");
    setBusinessName("");
    setBusinessReg("");
    setPhone("");
    setStep(1);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Sender IDs</h1>
          <p className="text-muted-foreground">Manage your custom sender identities</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Purchase Sender ID
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">
                {step === 1 ? "Purchase Sender ID" : "Business Details & Payment"}
              </DialogTitle>
            </DialogHeader>

            {step === 1 ? (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Sender ID Name</Label>
                  <Input
                    placeholder="e.g. MY_BRAND"
                    value={newSenderId}
                    onChange={(e) => setNewSenderId(e.target.value.toUpperCase())}
                    maxLength={11}
                  />
                  <p className="text-xs text-muted-foreground">Max 11 characters. Uppercase letters, numbers, underscores.</p>
                </div>
                <div className="space-y-2">
                  <Label>Network</Label>
                  <Select value={network} onValueChange={setNetwork}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      {NETWORKS.map((n) => (
                        <SelectItem key={n.value} value={n.value}>
                          {n.label} — KES {n.price.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm font-medium">Price: KES 7,500</p>
                  <p className="text-xs text-muted-foreground mt-1">Per network. Processing takes 24–48 hours after payment.</p>
                </div>
                <Button onClick={handleNextStep} className="w-full gradient-primary">
                  Continue to Payment
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sender ID:</span>
                    <span className="font-mono font-medium">{newSenderId}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Network:</span>
                    <span className="capitalize">{network}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-bold">KES 7,500</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input placeholder="Your company name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Business Registration Number (Optional)</Label>
                  <Input placeholder="e.g. PVT-ABC123" value={businessReg} onChange={(e) => setBusinessReg(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>M-Pesa Phone Number</Label>
                  <Input placeholder="254712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handlePurchase} disabled={purchasing} className="flex-1 gradient-primary">
                    {purchasing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Pay KES 7,500
                  </Button>
                </div>
              </div>
            )}
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
                      <td className="p-4 text-sm">KES {Number(sid.cost).toLocaleString()}</td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(sid.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No sender IDs yet. Purchase one to customize your SMS branding.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
