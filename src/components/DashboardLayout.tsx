import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Bot, Shield, Clock, Trash2, MessageSquare, Settings, Zap, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", icon: Settings, label: "Engine Config" },
  { to: "/access", icon: Shield, label: "Access Control" },
  { to: "/scheduler", icon: Clock, label: "Scheduler" },
  { to: "/auto-delete", icon: Trash2, label: "Auto-Delete" },
  { to: "/live-feed", icon: MessageSquare, label: "Live Feed" },
];

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background grid-bg">
      {/* Sidebar */}
      <aside className={`border-r border-border bg-sidebar flex flex-col shrink-0 transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center w-full" : ""}`}>
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/30 glow-primary shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-sm font-bold text-foreground font-heading tracking-tight">TG Controller</h1>
                <p className="text-xs text-muted-foreground font-mono">v1.0.0</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              title={label}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 ${collapsed ? "justify-center px-0" : ""} ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20 glow-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-border space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono px-2">
              <Zap className="w-3 h-3 text-accent animate-pulse-glow" />
              <span>System Online</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full h-8 text-muted-foreground hover:text-foreground"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </Button>
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
