import { useState } from "react";
import { Bot, User, Zap, CheckCircle, XCircle, Loader2, Link, Unlink } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import GlowCard from "@/components/GlowCard";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";

type WebhookStatus = "idle" | "connecting" | "connected" | "error";

const WEBHOOK_BASE_URL = `${window.location.origin}/api/telegram/webhook`;

const EngineConfig = () => {
  const [activeEngine, setActiveEngine] = useState<"bot" | "account">("bot");
  const [botToken, setBotToken] = useState("");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [stringSession, setStringSession] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus>("idle");
  const [webhookInfo, setWebhookInfo] = useState<{ url: string; pendingUpdates: number } | null>(null);

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
    } catch {
      // silent
    }
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
    // Validate token by calling getMe
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await response.json();
      if (!data.ok) {
        toast.error("Invalid bot token.");
        return;
      }
      toast.success(`Bot verified: @${data.result.username}`);
      // Auto-setup webhook
      await setupWebhook();
    } catch {
      toast.error("Could not validate bot token.");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-heading text-foreground text-glow-primary">Engine Configuration</h2>
        <p className="text-muted-foreground mt-1">Configure and switch between Bot Mode and Account Mode.</p>
      </div>

      {/* Engine Toggle */}
      <GlowCard glow="primary" title="Active Engine" headerRight={
        <StatusBadge status="active" label={activeEngine === "bot" ? "Bot Mode" : "Account Mode"} />
      }>
        <div className="flex items-center justify-between p-4 rounded-md bg-muted/50 border border-border">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-primary" />
            <span className="font-mono text-sm text-foreground">Bot Mode (Webhook)</span>
          </div>
          <Switch
            checked={activeEngine === "account"}
            onCheckedChange={(checked) => setActiveEngine(checked ? "account" : "bot")}
          />
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-foreground">Account Mode (MTProto)</span>
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

            {/* Webhook Status Panel */}
            <div className="p-3 rounded-md bg-muted/30 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Webhook Status</span>
                <div className="flex items-center gap-2">
                  {webhookStatus === "idle" && <StatusBadge status="inactive" label="Not Set" />}
                  {webhookStatus === "connecting" && (
                    <span className="flex items-center gap-1.5 text-xs font-mono text-warning">
                      <Loader2 className="w-3 h-3 animate-spin" /> Connecting...
                    </span>
                  )}
                  {webhookStatus === "connected" && <StatusBadge status="active" label="Connected" />}
                  {webhookStatus === "error" && <StatusBadge status="warning" label="Error" />}
                </div>
              </div>

              {webhookInfo && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Link className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-xs font-mono text-foreground truncate">{webhookInfo.url}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    Pending updates: {webhookInfo.pendingUpdates}
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs font-mono text-muted-foreground hover:text-foreground"
                  onClick={checkWebhook}
                  disabled={!botToken.trim()}
                >
                  <CheckCircle className="w-3 h-3 mr-1" /> Check
                </Button>
                {webhookStatus === "connected" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs font-mono text-destructive hover:text-destructive"
                    onClick={removeWebhook}
                  >
                    <Unlink className="w-3 h-3 mr-1" /> Remove
                  </Button>
                )}
              </div>
            </div>

            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={saveBotConfig}
              disabled={webhookStatus === "connecting"}
            >
              {webhookStatus === "connecting" ? (
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
              <Input
                placeholder="12345678"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                className="font-mono text-sm bg-muted/50 border-border focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">API Hash</Label>
              <Input
                type="password"
                placeholder="a1b2c3d4e5f6g7h8i9j0..."
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                className="font-mono text-sm bg-muted/50 border-border focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">String Session</Label>
              <Input
                type="password"
                placeholder="BQA..."
                value={stringSession}
                onChange={(e) => setStringSession(e.target.value)}
                className="font-mono text-sm bg-muted/50 border-border focus:border-primary"
              />
            </div>
            <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              Save Account Config
            </Button>
          </div>
        </GlowCard>
      </div>
    </div>
  );
};

export default EngineConfig;
