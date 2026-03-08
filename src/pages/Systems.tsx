import { useState, useRef } from "react";
import {
  Bot, User, Plus, Shield, Clock, Trash2, MessageSquare, BarChart3,
  ArrowLeft, Upload, FileText, Wifi, WifiOff, RefreshCw, Unlink,
  Loader2, Zap, Settings, ChevronRight,
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
  token?: string;
}

type View = "list" | "create-choose" | "create-bot" | "create-account" | "manage";

const Systems = () => {
  const [view, setView] = useState<View>("list");
  const [systems, setSystems] = useState<ConnectedSystem[]>([
    { id: "1", type: "bot", label: "Main Bot", username: "@my_bot", status: "online", lastChecked: "16:45:00" },
    { id: "2", type: "account", label: "UserBot", username: "@user_acc", status: "offline", lastChecked: "15:30:00" },
  ]);
  const [managingSystem, setManagingSystem] = useState<ConnectedSystem | null>(null);

  // Create bot form
  const [botToken, setBotToken] = useState("");
  const [checkingBot, setCheckingBot] = useState(false);

  // Create account form
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
      setSystems((prev) => [
        ...prev,
        { id: Date.now().toString(), type: "bot", label: bot.first_name, username: `@${bot.username}`, status: "online", lastChecked: now(), token: botToken },
      ]);
      toast.success(`Bot connected: @${bot.username}`);
      setBotToken("");
      setView("list");
    } catch {
      toast.error("Could not reach Telegram API.");
    } finally {
      setCheckingBot(false);
    }
  };

  const connectAccount = () => {
    if (!apiId.trim() || !apiHash.trim()) { toast.error("API ID and Hash are required."); return; }
    if (!stringSession.trim() && !sessionFile) { toast.error("Provide session string or file."); return; }
    const label = sessionFile ? sessionFile.name : `Account_${apiId}`;
    setSystems((prev) => [
      ...prev,
      { id: Date.now().toString(), type: "account", label, status: "online", lastChecked: now() },
    ]);
    toast.success("Account connected!");
    setApiId(""); setApiHash(""); setStringSession(""); setSessionFile(null);
    setView("list");
  };

  const handleSessionFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB."); return; }
    setSessionFile(file);
    toast.success(`Loaded: ${file.name}`);
  };

  const refreshStatus = (id: string) => {
    setSystems((prev) => prev.map((s) => (s.id === id ? { ...s, lastChecked: now() } : s)));
    toast.info("Status refreshed.");
  };

  const removeSystem = (id: string) => {
    setSystems((prev) => prev.filter((s) => s.id !== id));
    if (managingSystem?.id === id) { setManagingSystem(null); setView("list"); }
    toast.success("System removed.");
  };

  const openManage = (system: ConnectedSystem) => {
    setManagingSystem(system);
    setView("manage");
  };

  // ─── MANAGE VIEW ───
  if (view === "manage" && managingSystem) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setView("list"); setManagingSystem(null); }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${managingSystem.type === "bot" ? "bg-primary/10 border border-primary/30" : "bg-accent/10 border border-accent/30"}`}>
              {managingSystem.type === "bot" ? <Bot className="w-5 h-5 text-primary" /> : <User className="w-5 h-5 text-accent" />}
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading text-foreground text-glow-primary">{managingSystem.label}</h2>
              <p className="text-sm text-muted-foreground font-mono">{managingSystem.username || managingSystem.type}</p>
            </div>
          </div>
          <StatusBadge status={managingSystem.status === "online" ? "active" : "inactive"} label={managingSystem.status} />
        </div>

        <Tabs defaultValue="access" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-muted/50 border border-border">
            <TabsTrigger value="access" className="font-mono text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Shield className="w-3.5 h-3.5" /> Access
            </TabsTrigger>
            <TabsTrigger value="scheduler" className="font-mono text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Clock className="w-3.5 h-3.5" /> Scheduler
            </TabsTrigger>
            <TabsTrigger value="auto-delete" className="font-mono text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Trash2 className="w-3.5 h-3.5" /> Auto-Delete
            </TabsTrigger>
            <TabsTrigger value="live-feed" className="font-mono text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <MessageSquare className="w-3.5 h-3.5" /> Live Feed
            </TabsTrigger>
            <TabsTrigger value="statistics" className="font-mono text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <BarChart3 className="w-3.5 h-3.5" /> Statistics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="access" className="mt-6">
            <GlowCard glow="primary" title="Access Control" subtitle="Manage who can interact with this system">
              <div className="space-y-4">
                <div className="p-4 rounded-md bg-muted/30 border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-mono text-foreground">Allowed Users</span>
                    <Button size="sm" variant="outline" className="text-xs font-mono"><Plus className="w-3 h-3 mr-1" /> Add User</Button>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">No users configured. Add user IDs or usernames to restrict access.</p>
                </div>
                <div className="p-4 rounded-md bg-muted/30 border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-mono text-foreground">Allowed Groups</span>
                    <Button size="sm" variant="outline" className="text-xs font-mono"><Plus className="w-3 h-3 mr-1" /> Add Group</Button>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">No groups configured. Add group/channel IDs to allow.</p>
                </div>
              </div>
            </GlowCard>
          </TabsContent>

          <TabsContent value="scheduler" className="mt-6">
            <GlowCard glow="primary" title="Scheduler" subtitle="Schedule messages and automated tasks">
              <div className="space-y-4">
                <div className="p-4 rounded-md bg-muted/30 border border-border text-center">
                  <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-mono text-muted-foreground">No scheduled tasks yet.</p>
                  <Button size="sm" className="mt-3 font-mono text-xs"><Plus className="w-3 h-3 mr-1" /> Create Task</Button>
                </div>
              </div>
            </GlowCard>
          </TabsContent>

          <TabsContent value="auto-delete" className="mt-6">
            <GlowCard glow="warning" title="Auto-Delete" subtitle="Automatically delete messages after a set time">
              <div className="space-y-4">
                <div className="p-4 rounded-md bg-muted/30 border border-border text-center">
                  <Trash2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-mono text-muted-foreground">No auto-delete rules configured.</p>
                  <Button size="sm" className="mt-3 font-mono text-xs"><Plus className="w-3 h-3 mr-1" /> Add Rule</Button>
                </div>
              </div>
            </GlowCard>
          </TabsContent>

          <TabsContent value="live-feed" className="mt-6">
            <GlowCard glow="accent" title="Live Feed" subtitle="Real-time message stream for this system">
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {[
                  { time: "16:45:12", user: "user_123", text: "Hello bot!" },
                  { time: "16:45:13", user: managingSystem.label, text: "Hi! How can I help?" },
                  { time: "16:46:01", user: "user_456", text: "/start" },
                ].map((msg, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded bg-muted/20 border border-border/50">
                    <span className="text-xs font-mono text-muted-foreground shrink-0">{msg.time}</span>
                    <span className="text-xs font-mono text-primary shrink-0">{msg.user}</span>
                    <span className="text-sm font-mono text-foreground">{msg.text}</span>
                  </div>
                ))}
              </div>
            </GlowCard>
          </TabsContent>

          <TabsContent value="statistics" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Messages Today", value: "1,247", icon: MessageSquare, color: "text-primary" },
                { label: "Active Users", value: "89", icon: User, color: "text-accent" },
                { label: "Uptime", value: "99.8%", icon: Zap, color: "text-primary" },
              ].map((stat) => (
                <GlowCard key={stat.label} glow="none">
                  <div className="flex items-center gap-3">
                    <stat.icon className={`w-8 h-8 ${stat.color}`} />
                    <div>
                      <p className="text-2xl font-bold font-heading text-foreground">{stat.value}</p>
                      <p className="text-xs font-mono text-muted-foreground">{stat.label}</p>
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
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setView("list")}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h2 className="text-2xl font-bold font-heading text-foreground text-glow-primary">Create System</h2>
            <p className="text-muted-foreground mt-1">Choose your connection type</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button onClick={() => setView("create-bot")} className="group text-left">
            <GlowCard glow="primary" className="h-full transition-all duration-300 group-hover:scale-[1.02]">
              <div className="flex flex-col items-center text-center gap-4 py-6">
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 glow-primary">
                  <Bot className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-foreground">Connect Telegram Bot</h3>
                  <p className="text-sm text-muted-foreground mt-1 font-mono">Use a Bot Token from @BotFather</p>
                </div>
                <ChevronRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </GlowCard>
          </button>
          <button onClick={() => setView("create-account")} className="group text-left">
            <GlowCard glow="accent" className="h-full transition-all duration-300 group-hover:scale-[1.02]">
              <div className="flex flex-col items-center text-center gap-4 py-6">
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/30 glow-accent">
                  <User className="w-10 h-10 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-foreground">Connect Telegram Account</h3>
                  <p className="text-sm text-muted-foreground mt-1 font-mono">Use API ID, Hash & Session</p>
                </div>
                <ChevronRight className="w-5 h-5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </GlowCard>
          </button>
        </div>
      </div>
    );
  }

  // ─── CREATE BOT FORM ───
  if (view === "create-bot") {
    return (
      <div className="space-y-8 max-w-lg">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setView("create-choose")}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h2 className="text-2xl font-bold font-heading text-foreground text-glow-primary">Connect Bot</h2>
            <p className="text-muted-foreground mt-1">Enter your bot token from @BotFather</p>
          </div>
        </div>
        <GlowCard glow="primary">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Bot Token</Label>
              <Input type="password" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" value={botToken} onChange={(e) => setBotToken(e.target.value)} className="font-mono text-sm bg-muted/50 border-border focus:border-primary" />
            </div>
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={connectBot} disabled={checkingBot}>
              {checkingBot ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</> : "Connect Bot"}
            </Button>
          </div>
        </GlowCard>
      </div>
    );
  }

  // ─── CREATE ACCOUNT FORM ───
  if (view === "create-account") {
    return (
      <div className="space-y-8 max-w-lg">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setView("create-choose")}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h2 className="text-2xl font-bold font-heading text-foreground text-glow-primary">Connect Account</h2>
            <p className="text-muted-foreground mt-1">Enter your Telegram API credentials</p>
          </div>
        </div>
        <GlowCard glow="accent">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">API ID</Label>
              <Input placeholder="12345678" value={apiId} onChange={(e) => setApiId(e.target.value)} className="font-mono text-sm bg-muted/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">API Hash</Label>
              <Input type="password" placeholder="a1b2c3d4e5f6..." value={apiHash} onChange={(e) => setApiHash(e.target.value)} className="font-mono text-sm bg-muted/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">String Session</Label>
              <Input type="password" placeholder="BQA..." value={stringSession} onChange={(e) => setStringSession(e.target.value)} className="font-mono text-sm bg-muted/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Or Upload Session File</Label>
              <div className="p-3 rounded-md bg-muted/30 border border-dashed border-border hover:border-accent/40 transition-colors">
                <input ref={fileInputRef} type="file" accept=".session,.dat,.bin" onChange={handleSessionFile} className="hidden" id="session-file" />
                {!sessionFile ? (
                  <label htmlFor="session-file" className="flex flex-col items-center gap-2 cursor-pointer py-2">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground">.session, .dat, .bin</span>
                  </label>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-accent" />
                      <span className="text-sm font-mono text-foreground">{sessionFile.name}</span>
                      <span className="text-xs text-muted-foreground">({(sessionFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive text-xs" onClick={() => { setSessionFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>Remove</Button>
                  </div>
                )}
              </div>
            </div>
            <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={connectAccount}>
              Connect Account
            </Button>
          </div>
        </GlowCard>
      </div>
    );
  }

  // ─── SYSTEMS LIST (default) ───
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading text-foreground text-glow-primary">Systems</h2>
          <p className="text-muted-foreground mt-1">Manage your connected bots and accounts</p>
        </div>
        <Button onClick={() => setView("create-choose")} className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono">
          <Plus className="w-4 h-4 mr-2" /> Create System
        </Button>
      </div>

      {systems.length === 0 ? (
        <GlowCard glow="none" className="py-16">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <Bot className="w-12 h-12 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-heading text-foreground">No systems connected</h3>
              <p className="text-sm text-muted-foreground font-mono mt-1">Create a system to get started</p>
            </div>
            <Button onClick={() => setView("create-choose")} className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono">
              <Plus className="w-4 h-4 mr-2" /> Create System
            </Button>
          </div>
        </GlowCard>
      ) : (
        <div className="grid gap-3">
          {systems.map((system) => (
            <div
              key={system.id}
              className={`flex items-center justify-between p-4 rounded-lg border bg-card transition-all hover:bg-card/80 ${
                system.status === "online" ? "border-accent/20" : system.status === "error" ? "border-destructive/20" : "border-border"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-lg ${system.type === "bot" ? "bg-primary/10 border border-primary/30" : "bg-accent/10 border border-accent/30"}`}>
                  {system.type === "bot" ? <Bot className="w-5 h-5 text-primary" /> : <User className="w-5 h-5 text-accent" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-heading text-foreground">{system.label}</span>
                    {system.username && <span className="text-xs font-mono text-muted-foreground">{system.username}</span>}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">Last checked: {system.lastChecked}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={system.status === "online" ? "active" : system.status === "error" ? "warning" : "inactive"} label={system.status} />
                <Button size="sm" variant="outline" className="font-mono text-xs" onClick={() => openManage(system)}>
                  <Settings className="w-3 h-3 mr-1" /> Manage
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => refreshStatus(system.id)}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeSystem(system.id)}>
                  <Unlink className="w-3.5 h-3.5" />
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
