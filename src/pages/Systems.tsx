import { useState, useRef } from "react";
import {
  Bot, User, Plus, Shield, Clock, Trash2, MessageSquare, BarChart3,
  ArrowLeft, Upload, FileText, RefreshCw, Unlink,
  Loader2, Settings, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GlowCard from "@/components/GlowCard";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";

type SystemType = "bot" | "account";
type SystemStatus = "online" | "offline" | "error";

interface ConnectedSystem {
  id: string;
  type: SystemType;
  label: string;
  username?: string;
  status: SystemStatus;
  lastChecked: string;
}

type View = "list" | "create-choose" | "create-bot" | "create-account" | "manage";

const Systems = () => {
  const [view, setView] = useState<View>("list");
  const [systems, setSystems] = useState<ConnectedSystem[]>([
    { id: "1", type: "bot", label: "Main Bot", username: "@my_bot", status: "online", lastChecked: "16:45:00" },
    { id: "2", type: "account", label: "UserBot", username: "@user_acc", status: "offline", lastChecked: "15:30:00" },
  ]);
  const [managingSystem, setManagingSystem] = useState<ConnectedSystem | null>(null);

  const [botToken, setBotToken] = useState("");
  const [checkingBot, setCheckingBot] = useState(false);
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [stringSession, setStringSession] = useState("");
  const [sessionFile, setSessionFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const now = () => new Date().toLocaleTimeString("en-US", { hour12: false });

  const connectBot = async () => {
    if (!botToken.trim()) { toast.error("Bot token is required."); return; }
    setCheckingBot(true);
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await res.json();
      if (!data.ok) { toast.error("Invalid bot token."); return; }
      const bot = data.result;
      setSystems((prev) => [...prev, { id: Date.now().toString(), type: "bot", label: bot.first_name, username: `@${bot.username}`, status: "online", lastChecked: now() }]);
      toast.success(`Connected: @${bot.username}`);
      setBotToken("");
      setView("list");
    } catch { toast.error("Network error."); } finally { setCheckingBot(false); }
  };

  const connectAccount = () => {
    if (!apiId.trim() || !apiHash.trim()) { toast.error("API ID and Hash required."); return; }
    if (!stringSession.trim() && !sessionFile) { toast.error("Provide session string or file."); return; }
    setSystems((prev) => [...prev, { id: Date.now().toString(), type: "account", label: sessionFile ? sessionFile.name : `Account_${apiId}`, status: "online", lastChecked: now() }]);
    toast.success("Account connected!");
    setApiId(""); setApiHash(""); setStringSession(""); setSessionFile(null);
    setView("list");
  };

  const handleSessionFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB."); return; }
    setSessionFile(file);
  };

  const removeSystem = (id: string) => {
    setSystems((prev) => prev.filter((s) => s.id !== id));
    if (managingSystem?.id === id) { setManagingSystem(null); setView("list"); }
    toast.success("Removed.");
  };

  const refreshStatus = (id: string) => {
    setSystems((prev) => prev.map((s) => s.id === id ? { ...s, lastChecked: now() } : s));
  };

  // ─── MANAGE VIEW ───
  if (view === "manage" && managingSystem) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setView("list"); setManagingSystem(null); }}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2.5">
            {managingSystem.type === "bot" ? <Bot className="w-5 h-5 text-primary" /> : <User className="w-5 h-5 text-accent" />}
            <h2 className="text-lg font-semibold text-foreground">{managingSystem.label}</h2>
            {managingSystem.username && <span className="text-sm text-muted-foreground font-mono">{managingSystem.username}</span>}
          </div>
          <StatusBadge status={managingSystem.status === "online" ? "active" : "inactive"} label={managingSystem.status} />
        </div>

        <Tabs defaultValue="access" className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 border border-border h-auto p-1 flex-wrap">
            {[
              { value: "access", icon: Shield, label: "Access Control" },
              { value: "scheduler", icon: Clock, label: "Scheduler" },
              { value: "auto-delete", icon: Trash2, label: "Auto-Delete" },
              { value: "live-feed", icon: MessageSquare, label: "Live Feed" },
              { value: "statistics", icon: BarChart3, label: "Statistics" },
            ].map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <tab.icon className="w-3.5 h-3.5" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="access" className="mt-5">
            <GlowCard title="Access Control" subtitle="Manage who can interact with this system">
              <div className="space-y-3">
                <div className="p-3 rounded-md bg-muted/50 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground">Allowed Users</span>
                    <Button size="sm" variant="outline" className="text-xs h-7"><Plus className="w-3 h-3 mr-1" /> Add</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">No users configured yet.</p>
                </div>
                <div className="p-3 rounded-md bg-muted/50 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground">Allowed Groups</span>
                    <Button size="sm" variant="outline" className="text-xs h-7"><Plus className="w-3 h-3 mr-1" /> Add</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">No groups configured yet.</p>
                </div>
              </div>
            </GlowCard>
          </TabsContent>

          <TabsContent value="scheduler" className="mt-5">
            <GlowCard title="Scheduler" subtitle="Schedule messages and tasks">
              <div className="p-6 text-center">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No scheduled tasks.</p>
                <Button size="sm" variant="outline" className="mt-3 text-xs"><Plus className="w-3 h-3 mr-1" /> Create Task</Button>
              </div>
            </GlowCard>
          </TabsContent>

          <TabsContent value="auto-delete" className="mt-5">
            <GlowCard title="Auto-Delete" subtitle="Auto-remove messages after a set time">
              <div className="p-6 text-center">
                <Trash2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No auto-delete rules.</p>
                <Button size="sm" variant="outline" className="mt-3 text-xs"><Plus className="w-3 h-3 mr-1" /> Add Rule</Button>
              </div>
            </GlowCard>
          </TabsContent>

          <TabsContent value="live-feed" className="mt-5">
            <GlowCard title="Live Feed" subtitle="Real-time messages">
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {[
                  { time: "16:45:12", user: "user_123", text: "Hello bot!" },
                  { time: "16:45:13", user: managingSystem.label, text: "Hi! How can I help?" },
                  { time: "16:46:01", user: "user_456", text: "/start" },
                ].map((msg, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded bg-muted/30 text-sm">
                    <span className="text-xs font-mono text-muted-foreground shrink-0 pt-0.5">{msg.time}</span>
                    <span className="text-xs font-mono text-primary shrink-0 pt-0.5">{msg.user}</span>
                    <span className="text-sm text-foreground">{msg.text}</span>
                  </div>
                ))}
              </div>
            </GlowCard>
          </TabsContent>

          <TabsContent value="statistics" className="mt-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Messages Today", value: "1,247", icon: MessageSquare },
                { label: "Active Users", value: "89", icon: User },
                { label: "Uptime", value: "99.8%", icon: BarChart3 },
              ].map((stat) => (
                <GlowCard key={stat.label}>
                  <div className="flex items-center gap-3">
                    <stat.icon className="w-6 h-6 text-muted-foreground" />
                    <div>
                      <p className="text-xl font-semibold text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </GlowCard>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ─── CREATE CHOOSE ───
  if (view === "create-choose") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView("list")}><ArrowLeft className="w-4 h-4" /></Button>
          <h2 className="text-lg font-semibold text-foreground">Create System</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => setView("create-bot")} className="group text-left">
            <GlowCard className="h-full transition-colors hover:border-primary/40">
              <div className="flex items-center gap-4 py-2">
                <Bot className="w-8 h-8 text-primary shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Telegram Bot</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Connect using a Bot Token</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </GlowCard>
          </button>
          <button onClick={() => setView("create-account")} className="group text-left">
            <GlowCard className="h-full transition-colors hover:border-accent/40">
              <div className="flex items-center gap-4 py-2">
                <User className="w-8 h-8 text-accent shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Telegram Account</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Connect using API credentials</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </GlowCard>
          </button>
        </div>
      </div>
    );
  }

  // ─── CREATE BOT ───
  if (view === "create-bot") {
    return (
      <div className="space-y-6 max-w-md">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView("create-choose")}><ArrowLeft className="w-4 h-4" /></Button>
          <h2 className="text-lg font-semibold text-foreground">Connect Bot</h2>
        </div>
        <GlowCard>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Bot Token</Label>
              <Input type="password" placeholder="123456:ABC-DEF1234..." value={botToken} onChange={(e) => setBotToken(e.target.value)} className="font-mono text-sm" />
            </div>
            <Button className="w-full" onClick={connectBot} disabled={checkingBot}>
              {checkingBot ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</> : "Connect"}
            </Button>
          </div>
        </GlowCard>
      </div>
    );
  }

  // ─── CREATE ACCOUNT ───
  if (view === "create-account") {
    return (
      <div className="space-y-6 max-w-md">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView("create-choose")}><ArrowLeft className="w-4 h-4" /></Button>
          <h2 className="text-lg font-semibold text-foreground">Connect Account</h2>
        </div>
        <GlowCard>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">API ID</Label>
              <Input placeholder="12345678" value={apiId} onChange={(e) => setApiId(e.target.value)} className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">API Hash</Label>
              <Input type="password" placeholder="a1b2c3d4e5f6..." value={apiHash} onChange={(e) => setApiHash(e.target.value)} className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">String Session</Label>
              <Input type="password" placeholder="BQA..." value={stringSession} onChange={(e) => setStringSession(e.target.value)} className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Or upload session file</Label>
              <div className="p-3 rounded-md border border-dashed border-border hover:border-muted-foreground/40 transition-colors">
                <input ref={fileInputRef} type="file" accept=".session,.dat,.bin" onChange={handleSessionFile} className="hidden" id="session-file" />
                {!sessionFile ? (
                  <label htmlFor="session-file" className="flex items-center gap-3 cursor-pointer">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">.session, .dat, .bin files</span>
                  </label>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-accent" />
                      <span className="text-sm font-mono text-foreground">{sessionFile.name}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive text-xs h-7" onClick={() => { setSessionFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>Remove</Button>
                  </div>
                )}
              </div>
            </div>
            <Button className="w-full" onClick={connectAccount}>Connect</Button>
          </div>
        </GlowCard>
      </div>
    );
  }

  // ─── SYSTEMS LIST ───
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Systems</h2>
        <Button size="sm" onClick={() => setView("create-choose")}>
          <Plus className="w-4 h-4 mr-1.5" /> Create System
        </Button>
      </div>

      {systems.length === 0 ? (
        <GlowCard className="py-12">
          <div className="text-center">
            <Bot className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No systems connected yet.</p>
            <Button size="sm" className="mt-3" onClick={() => setView("create-choose")}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Create System
            </Button>
          </div>
        </GlowCard>
      ) : (
        <div className="space-y-2">
          {systems.map((system) => (
            <div key={system.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                {system.type === "bot" ? <Bot className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-accent" />}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{system.label}</span>
                    {system.username && <span className="text-xs font-mono text-muted-foreground">{system.username}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">Checked: {system.lastChecked}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={system.status === "online" ? "active" : system.status === "error" ? "warning" : "inactive"} label={system.status} />
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setManagingSystem(system); setView("manage"); }}>
                  <Settings className="w-3 h-3 mr-1" /> Manage
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => refreshStatus(system.id)}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeSystem(system.id)}>
                  <Unlink className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Systems;
