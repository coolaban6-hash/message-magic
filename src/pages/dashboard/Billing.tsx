import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet, useWalletTransactions } from "@/hooks/useWallet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Billing() {
  const { user } = useAuth();
  const { data: wallet } = useWallet();
  const { data: transactions } = useWalletTransactions();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [buying, setBuying] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const pollPaymentStatus = async (paymentId: string) => {
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const { data } = await supabase.functions.invoke("buy-credits", {
          body: { action: "check-payment", payment_id: paymentId },
        });
        if (data?.status === "completed") {
          toast.success(`KES ${data.amount} credited to your wallet!`);
          queryClient.invalidateQueries({ queryKey: ["wallet"] });
          queryClient.invalidateQueries({ queryKey: ["payments"] });
          queryClient.invalidateQueries({ queryKey: ["wallet_transactions"] });
          return;
        }
        if (data?.status === "failed") {
          toast.error("Payment failed or was cancelled.");
          queryClient.invalidateQueries({ queryKey: ["payments"] });
          return;
        }
      } catch { /* continue polling */ }
    }
    toast.info("Payment is still processing. Your balance will update shortly.");
    queryClient.invalidateQueries({ queryKey: ["payments"] });
  };

  const handleBuyCredits = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 10) { toast.error("Minimum amount is KES 10"); return; }
    if (!phone || phone.length < 10) { toast.error("Enter a valid M-Pesa phone number"); return; }
    setBuying(true);

    try {
      const { data, error } = await supabase.functions.invoke("buy-credits", {
        body: { amount: numAmount, phone_number: phone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("STK push sent! Check your phone to complete payment.");
      setDialogOpen(false);
      setAmount("");
      setPhone("");
      // Start polling for payment completion in background
      if (data?.payment_id) {
        pollPaymentStatus(data.payment_id);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate payment");
    }
    setBuying(false);
  };

  const { data: payments } = useQuery({
    queryKey: ["payments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!user,
  });

  const quickAmounts = [100, 500, 1000, 5000];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold">Billing</h1>
          <p className="text-sm text-muted-foreground">Manage wallet & credits</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary" size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Buy Credits
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Buy SMS Credits (M-Pesa)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-4 gap-2">
                {quickAmounts.map((qa) => (
                  <Button
                    key={qa}
                    variant={amount === String(qa) ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAmount(String(qa))}
                    className="text-xs"
                  >
                    KES {qa}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Amount (KES)</Label>
                <Input type="number" placeholder="e.g. 1000" value={amount} onChange={(e) => setAmount(e.target.value)} min={10} />
                <p className="text-xs text-muted-foreground">≈ {Math.floor(parseFloat(amount || "0") / 0.5)} SMS credits</p>
              </div>
              <div className="space-y-2">
                <Label>M-Pesa Phone Number</Label>
                <Input placeholder="254712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <Button onClick={handleBuyCredits} disabled={buying} className="w-full gradient-primary">
                {buying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Pay with M-Pesa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Wallet Card */}
      <Card className="glass border-primary/20">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl gradient-primary flex items-center justify-center shrink-0">
              <Wallet className="h-6 w-6 md:h-7 md:w-7 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Available Balance</p>
              <p className="text-2xl md:text-3xl font-display font-bold">KES {wallet?.balance?.toFixed(2) ?? "0.00"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Info */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { tier: "Standard", rate: "0.50", min: "0" },
          { tier: "Bulk 10k+", rate: "0.40", min: "10,000" },
          { tier: "Bulk 100k+", rate: "0.35", min: "100,000" },
        ].map((p) => (
          <Card key={p.tier} className="glass">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] md:text-xs text-muted-foreground">{p.tier}</p>
              <p className="text-lg md:text-xl font-display font-bold">KES {p.rate}</p>
              <p className="text-[10px] text-muted-foreground">/SMS</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transactions */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base md:text-lg">Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions && transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    {tx.type === "credit" ? (
                      <ArrowDownLeft className="h-4 w-4 text-success shrink-0" />
                    ) : tx.type === "refund" ? (
                      <ArrowDownLeft className="h-4 w-4 text-warning shrink-0" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium truncate">{tx.description || tx.type}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">{format(new Date(tx.created_at), "MMM d, HH:mm")}</p>
                    </div>
                  </div>
                  <span className={`font-medium text-xs md:text-sm shrink-0 ml-2 ${tx.type === "credit" || tx.type === "refund" ? "text-success" : "text-destructive"}`}>
                    {tx.type === "credit" || tx.type === "refund" ? "+" : "-"}KES {tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No transactions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
