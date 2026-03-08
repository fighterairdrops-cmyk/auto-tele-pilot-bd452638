import { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Bot, Zap, PanelLeftClose, PanelLeft, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`border-r border-border bg-sidebar flex flex-col shrink-0 transition-all duration-200 ${collapsed ? "w-14" : "w-60"}`}>
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center w-full" : ""}`}>
            <Bot className="w-5 h-5 text-primary shrink-0" />
            {!collapsed && (
              <span className="text-sm font-semibold text-foreground truncate">TG Controller</span>
            )}
          </div>
          {!collapsed && (
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0">
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          )}
        </div>

        {collapsed && (
          <div className="p-1.5 border-b border-border flex justify-center">
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <PanelLeft className="w-4 h-4" />
            </Button>
          </div>
        )}

        <nav className="flex-1 p-1.5">
          <NavLink
            to="/"
            end
            title="Systems"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${collapsed ? "justify-center" : ""} ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`
            }
          >
            <Bot className="w-4 h-4 shrink-0" />
            {!collapsed && "Systems"}
          </NavLink>
        </nav>

        <div className="p-1.5 border-t border-border flex flex-col gap-1">
          <Button variant="ghost" size={collapsed ? "icon" : "sm"} onClick={toggleTheme} className={`text-muted-foreground hover:text-foreground ${collapsed ? "mx-auto" : "justify-start gap-2 w-full"}`}>
            {dark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {!collapsed && (dark ? "Light mode" : "Dark mode")}
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
