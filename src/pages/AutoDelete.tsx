import { useState, useEffect } from "react";
import { Trash2, Clock } from "lucide-react";
import GlowCard from "@/components/GlowCard";
import StatusBadge from "@/components/StatusBadge";

type PendingDelete = {
  id: string;
  messagePreview: string;
  channel: string;
  postedAt: string;
  deleteAt: number; // timestamp
};

const now = Date.now();
const mockPending: PendingDelete[] = [
  { id: "1", messagePreview: "📢 Daily update: Check our latest news!", channel: "@channel_one", postedAt: "10:00", deleteAt: now + 45 * 60 * 1000 },
  { id: "2", messagePreview: "🔥 Flash sale ending soon!", channel: "@main_channel", postedAt: "14:30", deleteAt: now + 12 * 60 * 1000 },
  { id: "3", messagePreview: "Welcome to the community!", channel: "@news_feed", postedAt: "09:15", deleteAt: now + 90 * 60 * 1000 },
  { id: "4", messagePreview: "🎯 New feature announcement", channel: "@updates", postedAt: "16:00", deleteAt: now + 3 * 60 * 1000 },
];

const formatCountdown = (ms: number) => {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const getUrgency = (ms: number): "active" | "warning" | "pending" => {
  if (ms <= 5 * 60 * 1000) return "warning";
  if (ms <= 30 * 60 * 1000) return "pending";
  return "active";
};

const AutoDelete = () => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-heading text-foreground text-glow-primary">Auto-Delete Monitor</h2>
        <p className="text-muted-foreground mt-1">Track posts pending automatic deletion.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {mockPending.map((post) => {
          const remaining = post.deleteAt - Date.now();
          const urgency = getUrgency(remaining);
          const progress = Math.max(0, Math.min(100, (1 - remaining / (120 * 60 * 1000)) * 100));

          return (
            <GlowCard key={post.id} glow={urgency === "warning" ? "destructive" : urgency === "pending" ? "warning" : "none"} className="relative overflow-hidden">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">{post.channel}</span>
                  <StatusBadge status={urgency} label={urgency === "warning" ? "URGENT" : urgency === "pending" ? "SOON" : "OK"} />
                </div>

                <p className="text-sm text-foreground font-mono truncate">{post.messagePreview}</p>

                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${urgency === "warning" ? "text-destructive animate-pulse-glow" : "text-muted-foreground"}`} />
                  <span className={`text-2xl font-mono font-bold ${urgency === "warning" ? "text-destructive" : urgency === "pending" ? "text-warning" : "text-foreground"}`}>
                    {formatCountdown(remaining)}
                  </span>
                </div>

                <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${urgency === "warning" ? "bg-destructive" : urgency === "pending" ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <span>Posted: {post.postedAt}</span>
                  <Trash2 className="w-3 h-3" />
                </div>
              </div>
            </GlowCard>
          );
        })}
      </div>

      <GlowCard title="Deletion Log" subtitle="Recently auto-deleted messages">
        <div className="space-y-2">
          {["Message deleted from @channel_one at 09:45", "Message deleted from @news_feed at 08:30", "Message deleted from @updates at 07:15"].map((log, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded bg-muted/30 border border-border">
              <Trash2 className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-xs font-mono text-muted-foreground">{log}</span>
            </div>
          ))}
        </div>
      </GlowCard>
    </div>
  );
};

export default AutoDelete;
