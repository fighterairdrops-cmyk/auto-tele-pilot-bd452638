import { useState, useRef } from "react";
import { Bot, User, Zap, CheckCircle, Loader2, Link, Unlink, Upload, FileText, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import GlowCard from "@/components/GlowCard";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";

type WebhookStatus = "idle" | "connecting" | "connected" | "error";
type BotInfo = { id: number; username: string; firstName: string; isBot: boolean };
type ConnectedEngine = {
  id: string;
  type: "bot" | "account";
  label: string;
  username?: string;
  status: "online" | "offline" | "error";
  lastChecked: string;
};

const WEBHOOK_BASE_URL = `${window.location.origin}/api/telegram/webhook`;

const EngineConfig = () => {
  const [activeEngine, setActiveEngine] = useState<"bot" | "account">("bot");
  const [botToken, setBotToken] = useState("");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [stringSession, setStringSession] = useState("");
  const [sessionFile, setSessionFile] = useState<File | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus>("idle");
  const [webhookInfo, setWebhookInfo] = useState<{ url: string; pendingUpdates: number } | null>(null);
  const [checkingBot, setCheckingBot] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [connectedEngines, setConnectedEngines] = useState<ConnectedEngine[]>([
    { id: "1", type: "bot", label: "Main Bot", username: "@my_automation_bot", status: "online", lastChecked: "16:45:00" },
    { id: "2", type: "account", label: "UserBot Account", username: "@user_account", status: "offline", lastChecked: "15:30:00" },
  ]);

  const getWebhookUrl = (token: string) => `${WEBHOOK_BASE_URL}/${token.split(":")[0]}`;

  const setupWebhook = async () => {
    if (!botToken.trim()) {
      toast.error("Please enter a Bot Token first.");
      return;
    }
    setWebhookStatus("connecting");
    const webhookUrl = getWebhookUrl(botToken);
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`
      );
      const data = await response.json();
      if (data.ok) {
        setWebhookStatus("connected");
        setWebhookInfo({ url: webhookUrl, pendingUpdates: 0 });
        toast.success("Webhook registered successfully!");
      } else {
        setWebhookStatus("error");
        toast.error(`Webhook failed: ${data.description}`);
      }
    } catch {
      setWebhookStatus("error");
      toast.error("Network error — could not reach Telegram API.");
    }
  };

  const checkWebhook = async () => {
    if (!botToken.trim()) return;
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const data = await response.json();
      if (data.ok) {
        const info = data.result;
        if (info.url) {
          setWebhookStatus("connected");
          setWebhookInfo({ url: info.url, pendingUpdates: info.pending_update_count || 0 });
        } else {
          setWebhookStatus("idle");
          setWebhookInfo(null);
        }
      }
    } catch { /* silent */ }
  };

  const removeWebhook = async () => {
    if (!botToken.trim()) return;
    setWebhookStatus("connecting");
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=true`);
      const data = await response.json();
      if (data.ok) {
        setWebhookStatus("idle");
        setWebhookInfo(null);
        toast.success("Webhook removed.");
      }
    } catch {
      toast.error("Failed to remove webhook.");
      setWebhookStatus("error");
    }
  };

  const saveBotConfig = async () => {
    if (!botToken.trim()) {
      toast.error("Bot token is required.");
      return;
    }
    setCheckingBot(true);
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await response.json();
      if (!data.ok) {
        toast.error("Invalid bot token.");
        setCheckingBot(false);
        return;
      }
      const bot: BotInfo = data.result;
      toast.success(`Bot verified: @${bot.username}`);

      // Add to connected engines
      const exists = connectedEngines.find((e) => e.label === `@${bot.username}`);
      if (!exists) {
        setConnectedEngines((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "bot",
            label: bot.firstName,
            username: `@${bot.username}`,
            status: "online",
            lastChecked: new Date().toLocaleTimeString("en-US", { hour12: false }),
          },
        ]);
      }

      await setupWebhook();
    } catch {
      toast.error("Could not validate bot token.");
    } finally {
      setCheckingBot(false);
    }
  };

  const handleSessionFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validExtensions = [".session", ".session-journal", ".dat", ".bin"];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt && file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Max 10MB.");
      return;
    }
    setSessionFile(file);
    toast.success(`Session file loaded: ${file.name}`);
  };

  const removeSessionFile = () => {
    setSessionFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveAccountConfig = () => {
    if (!apiId.trim() || !apiHash.trim()) {
      toast.error("API ID and API Hash are required.");
      return;
    }
    if (!stringSession.trim() && !sessionFile) {
      toast.error("Provide a String Session or upload a Session File.");
      return;
    }

    const label = sessionFile ? sessionFile.name : `Account_${apiId}`;
    const exists = connectedEngines.find((e) => e.label === label);
    if (!exists) {
      setConnectedEngines((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: "account",
          label,
          status: "online",
          lastChecked: new Date().toLocaleTimeString("en-US", { hour12: false }),
        },
      ]);
    }

    toast.success("Account config saved!");
  };

  const refreshEngineStatus = (id: string) => {
    setConnectedEngines((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, lastChecked: new Date().toLocaleTimeString("en-US", { hour12: false }) } : e
      )
    );
    toast.info("Status refreshed.");
  };

  const removeEngine = (id: string) => {
    setConnectedEngines((prev) => prev.filter((e) => e.id !== id));
    toast.success("Engine removed.");
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-heading text-foreground text-glow-primary">Engine Configuration</h2>
        <p className="text-muted-foreground mt-1">Configure and switch between Bot Mode and Account Mode.</p>
      </div>

      {/* Connected Engines Status */}
      <GlowCard glow="accent" title="Connected Engines" subtitle="All registered bots & userbot accounts">
        {connectedEngines.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono py-4 text-center">No engines connected yet. Save a config below to register one.</p>
        ) : (
          <div className="space-y-2">
            {connectedEngines.map((engine) => (
              <div key={engine.id} className={`flex items-center justify-between p-3 rounded-md border transition-all ${
                engine.status === "online" ? "bg-accent/5 border-accent/20" : engine.status === "error" ? "bg-destructive/5 border-destructive/20" : "bg-muted/30 border-border"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded ${engine.type === "bot" ? "bg-primary/10" : "bg-accent/10"}`}>
                    {engine.type === "bot" ? <Bot className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-accent" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-foreground">{engine.label}</span>
                      {engine.username && <span className="text-xs font-mono text-muted-foreground">{engine.username}</span>}
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      Last checked: {engine.lastChecked}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    status={engine.status === "online" ? "active" : engine.status === "error" ? "warning" : "inactive"}
                    label={engine.status}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => refreshEngineStatus(engine.id)}>
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeEngine(engine.id)}>
                    <Unlink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlowCard>

      {/* Engine Toggle */}
      <GlowCard glow="primary" title="Active Engine" headerRight={
        <StatusBadge status="active" label={activeEngine === "bot" ? "Bot Mode" : "Account Mode"} />
      }>
        <div className="flex items-center justify-between p-4 rounded-md bg-muted/50 border border-border">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-primary" />
            <span className="font-mono text-sm text-foreground">Bot Mode</span>
          </div>
          <Switch
            checked={activeEngine === "account"}
            onCheckedChange={(checked) => setActiveEngine(checked ? "account" : "bot")}
          />
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-foreground">Account Mode</span>
            <User className="w-5 h-5 text-accent" />
          </div>
        </div>
      </GlowCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bot Settings */}
        <GlowCard
          glow={activeEngine === "bot" ? "primary" : "none"}
          title="Bot Settings"
          subtitle="Auto-webhook on save"
          headerRight={activeEngine === "bot" && <Zap className="w-4 h-4 text-primary animate-pulse-glow" />}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Bot Token</Label>
              <Input
                type="password"
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="font-mono text-sm bg-muted/50 border-border focus:border-primary"
              />
            </div>

            {/* Webhook Status */}
            <div className="p-3 rounded-md bg-muted/30 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Webhook Status</span>
                {webhookStatus === "idle" && <StatusBadge status="inactive" label="Not Set" />}
                {webhookStatus === "connecting" && (
                  <span className="flex items-center gap-1.5 text-xs font-mono text-warning">
                    <Loader2 className="w-3 h-3 animate-spin" /> Connecting...
                  </span>
                )}
                {webhookStatus === "connected" && <StatusBadge status="active" label="Connected" />}
                {webhookStatus === "error" && <StatusBadge status="warning" label="Error" />}
              </div>
              {webhookInfo && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Link className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-xs font-mono text-foreground truncate">{webhookInfo.url}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">Pending: {webhookInfo.pendingUpdates}</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="text-xs font-mono text-muted-foreground hover:text-foreground" onClick={checkWebhook} disabled={!botToken.trim()}>
                  <CheckCircle className="w-3 h-3 mr-1" /> Check
                </Button>
                {webhookStatus === "connected" && (
                  <Button size="sm" variant="ghost" className="text-xs font-mono text-destructive hover:text-destructive" onClick={removeWebhook}>
                    <Unlink className="w-3 h-3 mr-1" /> Remove
                  </Button>
                )}
              </div>
            </div>

            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveBotConfig} disabled={webhookStatus === "connecting" || checkingBot}>
              {checkingBot || webhookStatus === "connecting" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting up...</>
              ) : (
                "Save & Connect Webhook"
              )}
            </Button>
          </div>
        </GlowCard>

        {/* Account Settings */}
        <GlowCard
          glow={activeEngine === "account" ? "accent" : "none"}
          title="Account Settings"
          subtitle="MTProto-based automation"
          headerRight={activeEngine === "account" && <Zap className="w-4 h-4 text-accent animate-pulse-glow" />}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">API ID</Label>
              <Input placeholder="12345678" value={apiId} onChange={(e) => setApiId(e.target.value)} className="font-mono text-sm bg-muted/50 border-border focus:border-primary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">API Hash</Label>
              <Input type="password" placeholder="a1b2c3d4e5f6g7h8i9j0..." value={apiHash} onChange={(e) => setApiHash(e.target.value)} className="font-mono text-sm bg-muted/50 border-border focus:border-primary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">String Session</Label>
              <Input type="password" placeholder="BQA..." value={stringSession} onChange={(e) => setStringSession(e.target.value)} className="font-mono text-sm bg-muted/50 border-border focus:border-primary" />
            </div>

            {/* Session File Upload */}
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Or Upload Session File</Label>
              <div className="p-3 rounded-md bg-muted/30 border border-dashed border-border hover:border-primary/40 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".session,.session-journal,.dat,.bin"
                  onChange={handleSessionFileUpload}
                  className="hidden"
                  id="session-file"
                />
                {!sessionFile ? (
                  <label htmlFor="session-file" className="flex flex-col items-center gap-2 cursor-pointer py-2">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground">.session, .dat, .bin files</span>
                    <span className="text-xs text-muted-foreground">Click to browse</span>
                  </label>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-accent" />
                      <div>
                        <span className="text-sm font-mono text-foreground">{sessionFile.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({(sessionFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 text-xs" onClick={removeSessionFile}>
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={saveAccountConfig}>
              Save Account Config
            </Button>
          </div>
        </GlowCard>
      </div>
    </div>
  );
};

export default EngineConfig;
