import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Key, Plus, Copy, Trash2, Loader2, Code } from "lucide-react";

function generateKey(prefix: string) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = prefix;
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export default function APIKeys() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKeyData, setNewKeyData] = useState<{ api_key: string; api_secret: string } | null>(null);

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ["api_keys", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("api_keys")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const handleCreate = async () => {
    if (!user || !keyName.trim()) { toast.error("Enter a name for this key"); return; }
    setCreating(true);

    const apiKey = generateKey("ak_");
    const apiSecret = generateKey("sk_");

    const { error } = await supabase.from("api_keys").insert({
      user_id: user.id,
      api_key: apiKey,
      api_secret_hash: apiSecret,
      name: keyName.trim(),
    });

    if (error) {
      toast.error("Failed to create API key");
    } else {
      setNewKeyData({ api_key: apiKey, api_secret: apiSecret });
      queryClient.invalidateQueries({ queryKey: ["api_keys"] });
      setKeyName("");
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("API key deleted");
      queryClient.invalidateQueries({ queryKey: ["api_keys"] });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "your-project-id";
  const baseUrl = `https://${projectId}.supabase.co/functions/v1`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Developer API</h1>
          <p className="text-muted-foreground">Integrate SMS into your applications</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setNewKeyData(null); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">
                {newKeyData ? "API Key Created!" : "Create API Key"}
              </DialogTitle>
            </DialogHeader>
            {newKeyData ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-sm font-medium text-warning">⚠️ Save your API secret now. You won't be able to see it again!</p>
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex gap-2">
                    <Input value={newKeyData.api_key} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(newKeyData.api_key)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>API Secret</Label>
                  <div className="flex gap-2">
                    <Input value={newKeyData.api_secret} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(newKeyData.api_secret)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button onClick={() => { setDialogOpen(false); setNewKeyData(null); }} className="w-full">
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Key Name</Label>
                  <Input placeholder="e.g. Production, My App" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full gradient-primary">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Generate Key
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* API Keys List */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-display text-lg">Your API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-6">Loading...</p>
          ) : apiKeys && apiKeys.length > 0 ? (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{key.api_key}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at && ` • Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={key.is_active ? "default" : "secondary"}>
                      {key.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(key.api_key)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(key.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6">No API keys yet. Create one to get started.</p>
          )}
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Code className="h-5 w-5" />
            Quick Start Guide
          </CardTitle>
          <CardDescription>Use these examples to integrate SMS into your app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Send SMS</h3>
            <pre className="p-4 rounded-lg bg-muted text-xs font-mono overflow-x-auto">
{`curl -X POST ${baseUrl}/send-sms \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipients": ["254712345678"],
    "message": "Hello from ABANCOOL SMS!",
    "sender_id": "ABAN_COOL"
  }'`}
            </pre>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Check Balance</h3>
            <pre className="p-4 rounded-lg bg-muted text-xs font-mono overflow-x-auto">
{`curl ${baseUrl}/send-sms?action=balance \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
