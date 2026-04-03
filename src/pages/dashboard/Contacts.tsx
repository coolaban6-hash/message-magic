import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Search, Plus, Send, Trash2, Loader2, Users, UserPlus, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Contacts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [importing, setImporting] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });
      return data ?? [];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone_number.includes(q) ||
        (c.group_name && c.group_name.toLowerCase().includes(q))
    );
  }, [contacts, search]);

  const groups = useMemo(() => {
    const g = new Set<string>();
    contacts.forEach((c) => c.group_name && g.add(c.group_name));
    return Array.from(g).sort();
  }, [contacts]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const addContact = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const phone = newPhone.trim().replace(/[^\d+]/g, "");
      if (!phone || phone.length < 10) throw new Error("Invalid phone number");
      const { error } = await supabase.from("contacts").insert({
        user_id: user.id,
        name: newName.trim() || phone,
        phone_number: phone,
        group_name: newGroup.trim() || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Contact already exists");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Contact added");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setNewName("");
      setNewPhone("");
      setNewGroup("");
      setAddOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteSelected = useMutation({
    mutationFn: async () => {
      if (!user || selected.size === 0) return;
      const { error } = await supabase
        .from("contacts")
        .delete()
        .in("id", Array.from(selected));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Deleted ${selected.size} contact(s)`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImporting(true);

    try {
      const text = await file.text();
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        toast.error("CSV must have a header row and at least one data row");
        setImporting(false);
        return;
      }

      const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));
      const phoneIdx = header.findIndex((h) => h.includes("phone") || h.includes("number") || h.includes("mobile") || h.includes("msisdn"));
      const nameIdx = header.findIndex((h) => h.includes("name") || h.includes("contact"));
      const groupIdx = header.findIndex((h) => h.includes("group") || h.includes("tag") || h.includes("label"));

      const colIdx = phoneIdx >= 0 ? phoneIdx : 0;

      const rows = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
        const phone = cols[colIdx]?.replace(/[^\d+]/g, "") || "";
        const name = nameIdx >= 0 ? cols[nameIdx] || "" : "";
        const group = groupIdx >= 0 ? cols[groupIdx] || "" : "";
        return { phone, name, group };
      }).filter((r) => r.phone.length >= 10);

      if (rows.length === 0) {
        toast.error("No valid phone numbers found in CSV");
        setImporting(false);
        return;
      }

      // Insert in batches of 100
      let added = 0;
      let skipped = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100).map((r) => ({
          user_id: user.id,
          name: r.name || r.phone,
          phone_number: r.phone,
          group_name: r.group || null,
        }));

        const { error, data } = await supabase
          .from("contacts")
          .upsert(batch, { onConflict: "user_id,phone_number", ignoreDuplicates: true })
          .select();

        if (error) {
          console.error("CSV import batch error:", error);
          skipped += batch.length;
        } else {
          added += data?.length ?? 0;
        }
      }

      toast.success(`Imported ${added} contacts${skipped > 0 ? `, ${skipped} skipped (duplicates)` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to import CSV");
    }

    setImporting(false);
    e.target.value = "";
  };

  const handleSendToSelected = () => {
    const phones = contacts
      .filter((c) => selected.has(c.id))
      .map((c) => c.phone_number);
    // Navigate to SendSMS with pre-filled recipients
    navigate("/dashboard/sms", { state: { prefillRecipients: phones.join("\n") } });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold">Contacts</h1>
          <p className="text-sm text-muted-foreground">{contacts.length} contacts • {groups.length} groups</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" className="gap-1.5" asChild disabled={importing}>
              <span>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Import CSV
              </span>
            </Button>
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvUpload} />
          </label>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 gradient-primary">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Contact</DialogTitle>
                <DialogDescription>Add a new contact to your phonebook</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input placeholder="John Doe" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number *</Label>
                  <Input placeholder="254712345678" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Group (optional)</Label>
                  <Input placeholder="e.g. Customers, Staff" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
                </div>
                <Button onClick={() => addContact.mutate()} disabled={addContact.isPending} className="w-full gradient-primary">
                  {addContact.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Add Contact
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or group..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{selected.size} selected</Badge>
            <Button size="sm" variant="default" className="gap-1.5 gradient-primary" onClick={handleSendToSelected}>
              <Send className="h-3.5 w-3.5" /> Send SMS
            </Button>
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => deleteSelected.mutate()}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        )}
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Badge
            variant={search === "" ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setSearch("")}
          >
            All ({contacts.length})
          </Badge>
          {groups.map((g) => (
            <Badge
              key={g}
              variant={search === g ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setSearch(search === g ? "" : g)}
            >
              {g} ({contacts.filter((c) => c.group_name === g).length})
            </Badge>
          ))}
        </div>
      )}

      {/* Contact List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading contacts...</div>
      ) : filtered.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">
              {contacts.length === 0 ? "No contacts yet" : "No contacts match your search"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {contacts.length === 0 ? "Add contacts manually or import from CSV" : "Try a different search term"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Select All */}
          <div className="flex items-center gap-3 px-1">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            <span className="text-xs text-muted-foreground">Select all ({filtered.length})</span>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((c) => (
              <Card key={c.id} className="glass">
                <CardContent className="p-3 flex items-center gap-3">
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{(c.name || "?")[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {c.phone_number}
                    </p>
                  </div>
                  {c.group_name && (
                    <Badge variant="outline" className="text-[10px] shrink-0">{c.group_name}</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table */}
          <Card className="glass hidden md:block">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-4 w-10"></th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Phone</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Group</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">{(c.name || "?")[0].toUpperCase()}</span>
                          </div>
                          <span className="text-sm font-medium">{c.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm font-mono text-xs">{c.phone_number}</td>
                      <td className="p-4">
                        {c.group_name ? (
                          <Badge variant="outline" className="text-xs">{c.group_name}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
