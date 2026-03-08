import { useState } from "react";
import { Bot, User, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import GlowCard from "@/components/GlowCard";
import StatusBadge from "@/components/StatusBadge";

const EngineConfig = () => {
  const [activeEngine, setActiveEngine] = useState<"bot" | "account">("bot");
  const [botToken, setBotToken] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [stringSession, setStringSession] = useState("");

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
          subtitle="Webhook-based automation"
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
            <div className="space-y-2">
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Webhook URL</Label>
              <Input
                placeholder="https://your-server.com/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="font-mono text-sm bg-muted/50 border-border focus:border-primary"
              />
            </div>
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Save Bot Config
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
