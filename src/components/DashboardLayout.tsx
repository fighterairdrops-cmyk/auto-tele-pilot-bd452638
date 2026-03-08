import { NavLink, Outlet } from "react-router-dom";
import { Bot, Shield, Clock, Trash2, MessageSquare, Settings, Zap } from "lucide-react";

const navItems = [
  { to: "/", icon: Settings, label: "Engine Config" },
  { to: "/access", icon: Shield, label: "Access Control" },
  { to: "/scheduler", icon: Clock, label: "Scheduler" },
  { to: "/auto-delete", icon: Trash2, label: "Auto-Delete" },
  { to: "/live-feed", icon: MessageSquare, label: "Live Feed" },
];

const DashboardLayout = () => {
  return (
    <div className="flex min-h-screen bg-background grid-bg">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/30 glow-primary">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground font-heading tracking-tight">TG Controller</h1>
              <p className="text-xs text-muted-foreground font-mono">v1.0.0</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20 glow-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <Zap className="w-3 h-3 text-accent animate-pulse-glow" />
            <span>System Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="scanline pointer-events-none fixed inset-0 z-50" />
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
