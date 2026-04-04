import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, TicketCheck, Clock, CheckCircle, AlertCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  open: { label: "Open", variant: "destructive", icon: AlertCircle },
  in_progress: { label: "In Progress", variant: "default", icon: Clock },
  resolved: { label: "Resolved", variant: "secondary", icon: CheckCircle },
  closed: { label: "Closed", variant: "outline", icon: TicketCheck },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "text-muted-foreground" },
  normal: { label: "Normal", color: "text-foreground" },
  high: { label: "High", color: "text-orange-500" },
  urgent: { label: "Urgent", color: "text-destructive" },
};

export default function SupportTickets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState<any>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const [submitting, setSubmitting] = useState(false);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support_tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleCreate = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user!.id,
        subject: subject.trim(),
        message: message.trim(),
        priority: priority as any,
      });
      if (error) throw error;
      toast.success("Ticket submitted successfully");
      setSubject("");
      setMessage("");
      setPriority("normal");
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["support_tickets"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = tickets.filter((t: any) => t.status === "open" || t.status === "in_progress").length;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold">Support</h1>
          <p className="text-sm text-muted-foreground">{openCount} open ticket{openCount !== 1 ? "s" : ""}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> New Ticket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of your issue" />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Message</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue in detail..." rows={5} />
              </div>
              <Button onClick={handleCreate} disabled={submitting} className="w-full">
                {submitting ? "Submitting..." : "Submit Ticket"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center">
            <TicketCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No support tickets yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Create a ticket if you need help</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket: any) => {
            const sc = statusConfig[ticket.status] || statusConfig.open;
            const pc = priorityConfig[ticket.priority] || priorityConfig.normal;
            return (
              <Card key={ticket.id} className="glass cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setViewTicket(ticket)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={sc.variant} className="text-xs capitalize">{sc.label}</Badge>
                        <span className={`text-xs font-medium ${pc.color}`}>{pc.label}</span>
                      </div>
                      <p className="font-medium text-sm truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{ticket.message}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{format(new Date(ticket.created_at), "MMM d, HH:mm")}</p>
                      {ticket.admin_reply && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                          <MessageCircle className="h-3 w-3" /> Replied
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* View Ticket Dialog */}
      <Dialog open={!!viewTicket} onOpenChange={(o) => !o && setViewTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{viewTicket?.subject}</DialogTitle>
          </DialogHeader>
          {viewTicket && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={statusConfig[viewTicket.status]?.variant || "outline"} className="capitalize">
                  {statusConfig[viewTicket.status]?.label || viewTicket.status}
                </Badge>
                <span className={`text-xs font-medium ${priorityConfig[viewTicket.priority]?.color}`}>
                  {priorityConfig[viewTicket.priority]?.label} Priority
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {format(new Date(viewTicket.created_at), "MMM d, yyyy HH:mm")}
                </span>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Your message</p>
                <p className="text-sm whitespace-pre-wrap">{viewTicket.message}</p>
              </div>
              {viewTicket.admin_reply && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <p className="text-xs text-primary mb-1 font-medium">Admin Reply</p>
                  <p className="text-sm whitespace-pre-wrap">{viewTicket.admin_reply}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {viewTicket.updated_at && format(new Date(viewTicket.updated_at), "MMM d, yyyy HH:mm")}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
