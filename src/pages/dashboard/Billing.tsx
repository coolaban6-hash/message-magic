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
      toast.success("STK push sent! Check your phone to complete payment.");
      setDialogOpen(false);
      setAmount("");
      setPhone("");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Billing</h1>
          <p className="text-muted-foreground">Manage your wallet and purchase SMS credits</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Buy Credits
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Buy SMS Credits (M-Pesa)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
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
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl gradient-primary flex items-center justify-center">
              <Wallet className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-3xl font-display font-bold">KES {wallet?.balance?.toFixed(2) ?? "0.00"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-display text-lg">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions && transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    {tx.type === "credit" ? (
                      <ArrowDownLeft className="h-4 w-4 text-success" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-destructive" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{tx.description || tx.type}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), "MMM d, yyyy HH:mm")}</p>
                    </div>
                  </div>
                  <span className={`font-medium text-sm ${tx.type === "credit" ? "text-success" : "text-destructive"}`}>
                    {tx.type === "credit" ? "+" : "-"}KES {tx.amount.toFixed(2)}
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
