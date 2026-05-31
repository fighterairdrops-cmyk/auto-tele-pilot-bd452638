import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SUPER_ADMIN_ID = "8097688741";

type Channel = { id: string; username: string };

interface Props {
  systemId: string;
  channels: Channel[];
}

const INTERVALS: { label: string; seconds: number }[] = [
  { label: "1 min", seconds: 60 },
  { label: "5 min", seconds: 300 },
  { label: "15 min", seconds: 900 },
  { label: "30 min", seconds: 1800 },
  { label: "1 hour", seconds: 3600 },
  { label: "2 hours", seconds: 7200 },
  { label: "4 hours", seconds: 14400 },
  { label: "6 hours", seconds: 21600 },
  { label: "12 hours", seconds: 43200 },
  { label: "24 hours", seconds: 86400 },
];

export default function PostComposer({ systemId, channels }: Props) {
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"post" | "rpost">("post");
  const [intervalSec, setIntervalSec] = useState(3600);
  const [totalTimes, setTotalTimes] = useState(5);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [useWindow, setUseWindow] = useState(false);
  const [winStart, setWinStart] = useState(9);
  const [winEnd, setWinEnd] = useState(23);
  const [telegramUserId, setTelegramUserId] = useState(SUPER_ADMIN_ID);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (u: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(u) ? next.delete(u) : next.add(u);
      return next;
    });
  };

  const submit = async () => {
    if (!message.trim()) return toast.error("Message is required");
    if (selected.size === 0) return toast.error("Select at least one channel");
    if (totalTimes < 1 || totalTimes > 200) return toast.error("Total times must be 1–200");
    if (!telegramUserId.trim()) return toast.error("Telegram user ID required");

    setSubmitting(true);
    try {
      const targetChannels = Array.from(selected).map((c) => c.toUpperCase());

      let rotation_messages: any = null;
      let messageText = message.trim();

      if (kind === "rpost") {
        const variants = messageText.split(/\n\s*---+\s*\n/).map((v) => v.trim()).filter(Boolean);
        if (variants.length < 2) {
          toast.error("Rotation needs ≥2 variants separated by --- on its own line");
          setSubmitting(false);
          return;
        }
        // shuffle
        for (let i = variants.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [variants[i], variants[j]] = [variants[j], variants[i]];
        }
        rotation_messages = variants.map((v) => ({ text: v }));
        messageText = variants[0];
      }

      const { error } = await supabase.from("scheduled_posts").insert({
        system_id: systemId,
        chat_id: telegramUserId,
        telegram_user_id: telegramUserId,
        message_text: messageText,
        interval_seconds: intervalSec,
        total_times: totalTimes,
        times_sent: 0,
        next_run_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
        active: true,
        target_channels: targetChannels,
        window_start_hour: useWindow ? winStart : null,
        window_end_hour: useWindow ? winEnd : null,
        post_kind: kind,
        rotation_messages,
        rotation_index: 0,
      });

      if (error) throw error;
      toast.success(`✅ Scheduled — first post in ~3 min`);
      setMessage("");
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e.message || "Failed to schedule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Post Type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as any)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="post">Standard /post</SelectItem>
              <SelectItem value="rpost">Random rotation /rpost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Telegram User ID (notify)</Label>
          <Input value={telegramUserId} onChange={(e) => setTelegramUserId(e.target.value)} className="h-8 text-sm font-mono" />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          {kind === "rpost" ? "Variants (separate with --- on its own line)" : "Message (HTML allowed)"}
        </Label>
        <Textarea
          rows={6}
          placeholder={kind === "rpost"
            ? "Variant 1\n---\nVariant 2\n---\nVariant 3"
            : "Hello <b>world</b> 🚀"}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="text-sm font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Every</Label>
          <Select value={String(intervalSec)} onValueChange={(v) => setIntervalSec(parseInt(v))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INTERVALS.map((i) => (
                <SelectItem key={i.seconds} value={String(i.seconds)}>{i.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Total times</Label>
          <Input type="number" min={1} max={200} value={totalTimes}
            onChange={(e) => setTotalTimes(parseInt(e.target.value || "1"))}
            className="h-8 text-sm" />
        </div>
      </div>

      <div className="rounded-md border border-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Time-of-day window (UTC)</Label>
          <Switch checked={useWindow} onCheckedChange={setUseWindow} />
        </div>
        {useWindow && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Start hour (0-23)</Label>
              <Input type="number" min={0} max={23} value={winStart}
                onChange={(e) => setWinStart(parseInt(e.target.value || "0"))}
                className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">End hour (0-23)</Label>
              <Input type="number" min={0} max={23} value={winEnd}
                onChange={(e) => setWinEnd(parseInt(e.target.value || "0"))}
                className="h-8 text-sm" />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Target channels ({selected.size}/{channels.length})</Label>
        {channels.length === 0 ? (
          <p className="text-xs text-muted-foreground">No channels — add some in the Channels tab.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {channels.map((c) => {
              const on = selected.has(c.username);
              return (
                <button key={c.id} type="button" onClick={() => toggle(c.username)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono border transition ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 text-foreground border-border hover:border-primary/40"
                  }`}>
                  @{c.username}
                </button>
              );
            })}
            <button type="button"
              onClick={() => setSelected(new Set(channels.map((c) => c.username)))}
              className="px-2.5 py-1 rounded-md text-xs border border-border bg-background hover:bg-muted/30">
              Select all
            </button>
          </div>
        )}
      </div>

      <Button onClick={submit} disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
        Schedule Post
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        First post in ~3 minutes · Notifications + auto-delete sent to the Telegram User ID above
      </p>
    </div>
  );
}
