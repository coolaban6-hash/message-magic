import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, MessageSquare, Wallet, CreditCard, Hash, Code, Users,
  Shield, FileText, Settings, LogOut, Menu, X, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const userNav = [
  { label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Send SMS", icon: MessageSquare, href: "/dashboard/sms" },
  { label: "Messages", icon: FileText, href: "/dashboard/messages" },
  { label: "Billing", icon: Wallet, href: "/dashboard/billing" },
  { label: "Sender IDs", icon: Hash, href: "/dashboard/sender-ids" },
  { label: "API Keys", icon: Code, href: "/dashboard/api" },
];

const adminNav = [
  { label: "Admin Overview", icon: Shield, href: "/admin" },
  { label: "Users", icon: Users, href: "/admin/users" },
  { label: "Sender IDs", icon: Hash, href: "/admin/sender-ids" },
  { label: "Payments", icon: CreditCard, href: "/admin/payments" },
  { label: "System Logs", icon: FileText, href: "/admin/logs" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const navItems = location.pathname.startsWith("/admin") ? adminNav : userNav;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="text-lg font-display font-bold">ABAN SMS</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location.pathname === item.href
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          ))}

          {/* Toggle admin/user */}
          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-sidebar-border">
              <p className="px-3 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider mb-2">
                {location.pathname.startsWith("/admin") ? "Switch to" : "Admin"}
              </p>
              <Link
                to={location.pathname.startsWith("/admin") ? "/dashboard" : "/admin"}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
              >
                {location.pathname.startsWith("/admin") ? <LayoutDashboard className="h-4.5 w-4.5" /> : <Shield className="h-4.5 w-4.5" />}
                {location.pathname.startsWith("/admin") ? "User Dashboard" : "Admin Panel"}
              </Link>
            </div>
          )}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
              {(profile?.full_name || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || "User"}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{isAdmin ? "Admin" : "User"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-sidebar-foreground/50 hover:text-sidebar-foreground h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border flex items-center px-4 lg:px-6 gap-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
        </header>

        <div className="p-4 lg:p-6 max-w-7xl animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
