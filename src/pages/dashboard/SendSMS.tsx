import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { calculateSegments, calculateCost, parseRecipients } from "@/lib/sms-utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Loader2, Upload } from "lucide-react";

export default function SendSMS() {
  const { user } = useAuth();
  const { data: wallet } = useWallet();
  const queryClient = useQueryClient();

  const [recipientsInput, setRecipientsInput] = useState("");
  const [message, setMessage] = useState("");
  const [senderId, setSenderId] = useState("ABAN_COOL");
  const [sending, setSending] = useState(false);

  const { data: senderIds } = useQuery({
    queryKey: ["sender_ids", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("sender_ids")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active");
      return data ?? [];
    },
    enabled: !!user,
  });

  const recipients = parseRecipients(recipientsInput);
  const segments = calculateSegments(message);
  const cost = calculateCost(message, recipients.length);
  const canSend = recipients.length > 0 && message.length > 0 && (wallet?.balance ?? 0) >= cost;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      // Find phone column
      const phones = lines.slice(1).map((line) => {
        const cols = line.split(",");
        return cols[0]?.trim().replace(/[^0-9+]/g, "");
      }).filter((p) => p && p.length >= 10);
      setRecipientsInput(phones.join("\n"));
      toast.success(`Loaded ${phones.length} phone numbers`);
    };
    reader.readAsText(file);
  };

  const handleSend = async () => {
    if (!user || !canSend) return;
    setSending(true);

    const { error } = await supabase.from("messages").insert({
      user_id: user.id,
      sender_id_text: senderId,
      recipients,
      message,
      segment_count: segments,
      total_cost: cost,
      status: "queued",
    });

    if (error) {
      toast.error("Failed to queue message");
      setSending(false);
      return;
    }

    // Invoke edge function to process
    try {
      await supabase.functions.invoke("send-sms", {
        body: { recipients, message, sender_id: senderId },
      });
    } catch (err) {
      // Message is queued even if edge function fails
      console.error("Edge function error:", err);
    }

    toast.success(`SMS queued to ${recipients.length} recipients!`);
    setRecipientsInput("");
    setMessage("");
    setSending(false);
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
    queryClient.invalidateQueries({ queryKey: ["recent_messages"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Send SMS</h1>
        <p className="text-muted-foreground">Compose and send bulk messages</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="font-display text-lg">Compose Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Sender ID</Label>
                <Select value={senderId} onValueChange={setSenderId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABAN_COOL">ABAN_COOL (Default)</SelectItem>
                    {senderIds?.map((s) => (
                      <SelectItem key={s.id} value={s.sender_id}>{s.sender_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Recipients</Label>
                  <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                    <Upload className="h-3 w-3" />
                    Upload CSV
                    <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
                <Textarea
                  placeholder="Enter phone numbers (one per line or comma-separated)&#10;e.g. 254712345678, 254798765432"
                  value={recipientsInput}
                  onChange={(e) => setRecipientsInput(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">{recipients.length} valid recipient(s) detected</p>
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{message.length} characters • {segments} segment(s)</span>
                  <span>{message.length > 0 && !message.match(/^[\x20-\x7E\n\r]*$/) ? "Unicode" : "GSM"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="font-display text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Recipients</span>
                <span className="font-medium">{recipients.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Segments</span>
                <span className="font-medium">{segments}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cost per SMS</span>
                <span className="font-medium">KES {(segments * 0.5).toFixed(2)}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-medium">Total Cost</span>
                <span className="font-display font-bold text-lg">KES {cost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Wallet Balance</span>
                <span className={`font-medium ${(wallet?.balance ?? 0) < cost ? "text-destructive" : "text-success"}`}>
                  KES {wallet?.balance?.toFixed(2) ?? "0.00"}
                </span>
              </div>

              <Button
                onClick={handleSend}
                disabled={!canSend || sending}
                className="w-full gradient-primary mt-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send SMS
              </Button>

              {(wallet?.balance ?? 0) < cost && recipients.length > 0 && message.length > 0 && (
                <p className="text-xs text-destructive text-center">Insufficient balance</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
