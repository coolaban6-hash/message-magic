import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function AdminUsers() {
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (!profiles) return [];

      // Get wallets for all users
      const userIds = profiles.map(p => p.user_id);
      const { data: wallets } = await supabase.from("wallets").select("*").in("user_id", userIds);
      const { data: roles } = await supabase.from("user_roles").select("*").in("user_id", userIds);

      return profiles.map(p => ({
        ...p,
        wallet: wallets?.find(w => w.user_id === p.user_id),
        roles: roles?.filter(r => r.user_id === p.user_id).map(r => r.role) ?? [],
      }));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Users</h1>
        <p className="text-muted-foreground">Manage platform users</p>
      </div>

      <Card className="glass">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Company</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Balance</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : users && users.length > 0 ? (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-4 text-sm font-medium">{u.full_name || "—"}</td>
                      <td className="p-4 text-sm">{u.company_name || "—"}</td>
                      <td className="p-4 text-sm font-medium">KES {u.wallet?.balance?.toFixed(2) ?? "0.00"}</td>
                      <td className="p-4">
                        {u.roles.map(r => (
                          <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="capitalize mr-1">{r}</Badge>
                        ))}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{format(new Date(u.created_at), "MMM d, yyyy")}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
