import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Users, Search, Wallet, Plus, Minus, Loader2, RefreshCw, TrendingUp, MessageSquare } from "lucide-react";

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [adjustDialog, setAdjustDialog] = useState<{ open: boolean; userId: string; name: string }>({ open: false, userId: "", name: "" });
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"credit" | "debit">("credit");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (!profiles) return [];

      const userIds = profiles.map(p => p.user_id);
      const [walletsRes, rolesRes, messagesRes] = await Promise.all([
        supabase.from("wallets").select("*").in("user_id", userIds),
        supabase.from("user_roles").select("*").in("user_id", userIds),
        supabase.from("messages").select("user_id, recipients").in("user_id", userIds),
      ]);

      return profiles.map(p => {
        const userMsgs = (messagesRes.data ?? []).filter(m => m.user_id === p.user_id);
        const totalSms = userMsgs.reduce((sum, m) => sum + ((m.recipients as string[])?.length || 0), 0);
        return {
          ...p,
          wallet: walletsRes.data?.find(w => w.user_id === p.user_id),
          roles: rolesRes.data?.filter(r => r.user_id === p.user_id).map(r => r.role) ?? [],
          totalSms,
        };
      });
    },
  });

  const filtered = users?.filter(u =>
    !search || (u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.company_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAdjust = async () => {
    const num = parseFloat(adjustAmount);
    if (!num || num <= 0) { toast.error("Enter a valid amount"); return; }
    setAdjusting(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-credit-sync?action=adjust`;
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ user_id: adjustDialog.userId, amount: num, type: adjustType, reason: adjustReason }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Failed");

      toast.success(`${adjustType === "credit" ? "Added" : "Deducted"} KES ${num.toFixed(2)} for ${adjustDialog.name}`);
      setAdjustDialog({ open: false, userId: "", name: "" });
      setAdjustAmount("");
      setAdjustReason("");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust credits");
    }
    setAdjusting(false);
  };

  const totalUsers = users?.length ?? 0;
  const totalBalance = users?.reduce((s, u) => s + (u.wallet?.balance || 0), 0) ?? 0;
  const totalSms = users?.reduce((s, u) => s + u.totalSms, 0) ?? 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-display font-bold">User Management</h1>
        <p className="text-sm text-muted-foreground">Manage users, view balances, and adjust credits</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="glass">
          <CardContent className="p-3 md:p-5">
            <div className="flex items-center gap-2 md:gap-3">
              <Users className="h-5 w-5 md:h-8 md:w-8 text-primary opacity-80 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-muted-foreground truncate">Users</p>
                <p className="text-lg md:text-2xl font-display font-bold">{totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-3 md:p-5">
            <div className="flex items-center gap-2 md:gap-3">
              <Wallet className="h-5 w-5 md:h-8 md:w-8 text-success opacity-80 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-muted-foreground truncate">Total Bal</p>
                <p className="text-lg md:text-2xl font-display font-bold">KES {totalBalance.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-3 md:p-5">
            <div className="flex items-center gap-2 md:gap-3">
              <MessageSquare className="h-5 w-5 md:h-8 md:w-8 text-accent opacity-80 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-muted-foreground truncate">SMS Sent</p>
                <p className="text-lg md:text-2xl font-display font-bold">{totalSms.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Actions */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* User Cards (mobile) / Table (desktop) */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filtered && filtered.length > 0 ? (
          filtered.map((u) => (
            <Card key={u.id} className="glass">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{u.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.company_name || "No company"}</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    {u.roles.map(r => (
                      <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="capitalize text-[10px]">{r}</Badge>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">Balance</p>
                    <p className="text-xs font-bold">KES {u.wallet?.balance?.toFixed(2) ?? "0.00"}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">SMS</p>
                    <p className="text-xs font-bold">{u.totalSms}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">Joined</p>
                    <p className="text-xs font-bold">{format(new Date(u.created_at), "MMM d")}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setAdjustDialog({ open: true, userId: u.user_id, name: u.full_name || "User" })}
                >
                  <Wallet className="h-3 w-3 mr-1.5" /> Adjust Credits
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">No users found</div>
        )}
      </div>

      {/* Desktop Table */}
      <Card className="glass hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Company</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Balance</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">SMS Sent</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Joined</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filtered && filtered.length > 0 ? (
                  filtered.map((u) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-4 text-sm font-medium">{u.full_name || "—"}</td>
                      <td className="p-4 text-sm">{u.company_name || "—"}</td>
                      <td className="p-4 text-sm font-medium">KES {u.wallet?.balance?.toFixed(2) ?? "0.00"}</td>
                      <td className="p-4 text-sm">{u.totalSms.toLocaleString()}</td>
                      <td className="p-4">
                        {u.roles.map(r => (
                          <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="capitalize mr-1">{r}</Badge>
                        ))}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(u.created_at), "MMM d, yyyy")}</td>
                      <td className="p-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAdjustDialog({ open: true, userId: u.user_id, name: u.full_name || "User" })}
                        >
                          <Wallet className="h-3 w-3 mr-1.5" /> Adjust
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Adjust Credits Dialog */}
      <Dialog open={adjustDialog.open} onOpenChange={(open) => setAdjustDialog(v => ({ ...v, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Adjust Credits — {adjustDialog.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as "credit" | "debit")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Add Credits</SelectItem>
                  <SelectItem value="debit">Deduct Credits</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (KES)</Label>
              <Input type="number" placeholder="e.g. 100" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} min={1} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input placeholder="e.g. Manual top-up" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
            </div>
            <Button onClick={handleAdjust} disabled={adjusting} className="w-full gradient-primary">
              {adjusting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : adjustType === "credit" ? <Plus className="h-4 w-4 mr-2" /> : <Minus className="h-4 w-4 mr-2" />}
              {adjustType === "credit" ? "Add Credits" : "Deduct Credits"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
