import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TicketCheck, Clock, CheckCircle, AlertCircle, MessageCircle, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", variant: "destructive" },
  in_progress: { label: "In Progress", variant: "default" },
  resolved: { label: "Resolved", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "text-muted-foreground" },
  normal: { label: "Normal", color: "text-foreground" },
  high: { label: "High", color: "text-orange-500" },
  urgent: { label: "Urgent", color: "text-destructive" },
};

export default function AdminTickets() {
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("all");

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ["admin_tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch user profiles for display
      const userIds = [...new Set(data.map((t: any) => t.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      return data.map((t: any) => ({ ...t, profile: profileMap[t.user_id] }));
    },
  });

  const handleReply = async () => {
    if (!selectedTicket) return;
    setSubmitting(true);
    try {
      const updates: any = { updated_at: new Date().toISOString() };
      if (reply.trim()) updates.admin_reply = reply.trim();
      if (newStatus) updates.status = newStatus;
      
      const { error } = await supabase
        .from("support_tickets")
        .update(updates)
        .eq("id", selectedTicket.id);
      if (error) throw error;
      toast.success("Ticket updated");
      setReply("");
      setNewStatus("");
      setSelectedTicket(null);
      queryClient.invalidateQueries({ queryKey: ["admin_tickets"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = filter === "all" ? tickets : tickets.filter((t: any) => t.status === filter);
  const openCount = tickets.filter((t: any) => t.status === "open").length;
  const inProgressCount = tickets.filter((t: any) => t.status === "in_progress").length;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">
            {openCount} open · {inProgressCount} in progress · {tickets.length} total
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Open", value: openCount, status: "open", icon: AlertCircle, color: "text-destructive" },
          { label: "In Progress", value: inProgressCount, status: "in_progress", icon: Clock, color: "text-primary" },
          { label: "Resolved", value: tickets.filter((t: any) => t.status === "resolved").length, status: "resolved", icon: CheckCircle, color: "text-green-500" },
          { label: "Closed", value: tickets.filter((t: any) => t.status === "closed").length, status: "closed", icon: TicketCheck, color: "text-muted-foreground" },
        ].map((s) => (
          <Card
            key={s.status}
            className={`glass cursor-pointer transition-colors ${filter === s.status ? "border-primary" : "hover:border-primary/30"}`}
            onClick={() => setFilter(filter === s.status ? "all" : s.status)}
          >
            <CardContent className="p-3 text-center">
              <s.icon className={`h-5 w-5 mx-auto ${s.color} mb-1`} />
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ticket List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center text-muted-foreground">No tickets found</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket: any) => {
            const sc = statusConfig[ticket.status] || statusConfig.open;
            const pc = priorityConfig[ticket.priority] || priorityConfig.normal;
            return (
              <Card key={ticket.id} className="glass cursor-pointer hover:border-primary/30 transition-colors" onClick={() => { setSelectedTicket(ticket); setNewStatus(ticket.status); setReply(ticket.admin_reply || ""); }}>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={sc.variant} className="text-xs capitalize">{sc.label}</Badge>
                        <span className={`text-xs font-medium ${pc.color}`}>{pc.label}</span>
                        <span className="text-xs text-muted-foreground">by {ticket.profile?.full_name || "Unknown"}</span>
                      </div>
                      <p className="font-medium text-sm truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ticket.message}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{format(new Date(ticket.created_at), "MMM d, HH:mm")}</p>
                      {ticket.admin_reply && <MessageCircle className="h-3.5 w-3.5 text-primary ml-auto mt-1" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reply Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(o) => { if (!o) { setSelectedTicket(null); setReply(""); setNewStatus(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{selectedTicket?.subject}</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={statusConfig[selectedTicket.status]?.variant || "outline"} className="capitalize">
                  {statusConfig[selectedTicket.status]?.label}
                </Badge>
                <span className={`text-xs font-medium ${priorityConfig[selectedTicket.priority]?.color}`}>
                  {priorityConfig[selectedTicket.priority]?.label}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {selectedTicket.profile?.full_name} · {format(new Date(selectedTicket.created_at), "MMM d, yyyy HH:mm")}
                </span>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Client Message</p>
                <p className="text-sm whitespace-pre-wrap">{selectedTicket.message}</p>
              </div>

              <div>
                <Label>Update Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Reply</Label>
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write your reply to the client..." rows={4} />
              </div>

              <Button onClick={handleReply} disabled={submitting} className="w-full">
                <Send className="h-4 w-4 mr-1.5" />
                {submitting ? "Updating..." : "Update & Reply"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
