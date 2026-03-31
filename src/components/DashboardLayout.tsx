import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  LayoutDashboard, MessageSquare, Wallet, CreditCard, Hash, Code, Users,
  Shield, FileText, LogOut, Menu, X, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const userNav = [
  { label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Send SMS", icon: Send, href: "/dashboard/sms" },
  { label: "Messages", icon: MessageSquare, href: "/dashboard/messages" },
  { label: "Billing", icon: Wallet, href: "/dashboard/billing" },
  { label: "Sender IDs", icon: Hash, href: "/dashboard/sender-ids" },
  { label: "API Keys", icon: Code, href: "/dashboard/api" },
];

const adminNav = [
  { label: "Overview", icon: Shield, href: "/admin" },
  { label: "Users", icon: Users, href: "/admin/users" },
  { label: "Sender IDs", icon: Hash, href: "/admin/sender-ids" },
  { label: "Payments", icon: CreditCard, href: "/admin/payments" },
  { label: "Logs", icon: FileText, href: "/admin/logs" },
];

const userBottomNav = [
  { label: "Home", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Send", icon: Send, href: "/dashboard/sms" },
  { label: "Messages", icon: MessageSquare, href: "/dashboard/messages" },
  { label: "Billing", icon: Wallet, href: "/dashboard/billing" },
  { label: "More", icon: Menu, href: "" },
];

const adminBottomNav = [
  { label: "Home", icon: Shield, href: "/admin" },
  { label: "Users", icon: Users, href: "/admin/users" },
  { label: "Sender IDs", icon: Hash, href: "/admin/sender-ids" },
  { label: "Payments", icon: CreditCard, href: "/admin/payments" },
  { label: "Logs", icon: FileText, href: "/admin/logs" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const isAdminSection = location.pathname.startsWith("/admin");
  const navItems = isAdminSection ? adminNav : userNav;
  const bottomNav = isAdminSection ? adminBottomNav : userBottomNav;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* More menu overlay (mobile) */}
      {moreMenuOpen && isMobile && (
        <>
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" onClick={() => setMoreMenuOpen(false)} />
          <div className="fixed bottom-16 left-0 right-0 z-50 p-3 animate-fade-in">
            <div className="bg-card border border-border rounded-2xl p-2 shadow-2xl mx-2">
              <Link
                to="/dashboard/sender-ids"
                onClick={() => setMoreMenuOpen(false)}
                className={cn("flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  location.pathname === "/dashboard/sender-ids" ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted"
                )}
              >
                <Hash className="h-5 w-5" /> Sender IDs
              </Link>
              <Link
                to="/dashboard/api"
                onClick={() => setMoreMenuOpen(false)}
                className={cn("flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  location.pathname === "/dashboard/api" ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted"
                )}
              >
                <Code className="h-5 w-5" /> API Keys
              </Link>
              {isAdmin && (
                <Link
                  to={isAdminSection ? "/dashboard" : "/admin"}
                  onClick={() => setMoreMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-foreground/70 hover:bg-muted transition-colors"
                >
                  {isAdminSection ? <LayoutDashboard className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
                  {isAdminSection ? "User Dashboard" : "Admin Panel"}
                </Link>
              )}
              <button
                onClick={() => { setMoreMenuOpen(false); handleSignOut(); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive w-full hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-5 w-5" /> Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sidebar - Desktop only */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-5 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <img src="/favicon.png" alt="ABANCOOL" className="h-9 w-9 rounded-lg" />
            <span className="text-lg font-display font-bold">ABANCOOL SMS</span>
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

          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-sidebar-border">
              <p className="px-3 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider mb-2">
                {isAdminSection ? "Switch to" : "Admin"}
              </p>
              <Link
                to={isAdminSection ? "/dashboard" : "/admin"}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
              >
                {isAdminSection ? <LayoutDashboard className="h-4.5 w-4.5" /> : <Shield className="h-4.5 w-4.5" />}
                {isAdminSection ? "User Dashboard" : "Admin Panel"}
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
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        {/* Top bar - Desktop only */}
        <header className="h-14 border-b border-border flex items-center px-4 lg:px-6 gap-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="lg:hidden flex items-center gap-2">
            <img src="/favicon.png" alt="ABANCOOL" className="h-7 w-7 rounded" />
            <span className="font-display font-bold text-sm">ABANCOOL SMS</span>
          </div>
          <div className="flex-1" />
        </header>

        <div className="p-4 lg:p-6 max-w-7xl animate-fade-in">
          {children}
        </div>
      </main>

      {/* Bottom Navigation - Mobile only */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
          <div className="flex items-center justify-around py-1.5">
            {bottomNav.map((item) => {
              const isMore = item.href === "";
              const isActive = !isMore && location.pathname === item.href;

              return (
                <button
                  key={item.label}
                  onClick={() => {
                    if (isMore) {
                      setMoreMenuOpen(!moreMenuOpen);
                    } else {
                      setMoreMenuOpen(false);
                      navigate(item.href);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-[56px]",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
