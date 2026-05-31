import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import {
  Bot, User, Plus, Shield, Clock, Trash2, MessageSquare, BarChart3,
  ArrowLeft, Upload, FileText, RefreshCw, Unlink, X,
  Loader2, Settings, ChevronRight, Sun, Moon, Hash, LogOut, Copy, Send,
} from "lucide-react";
import PostComposer from "@/components/PostComposer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import GlowCard from "@/components/GlowCard";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

interface AllowedUser { id: string; telegram_user_id: string; is_admin: boolean; }
interface AllowedGroup { id: string; telegram_chat_id: string; }
interface Channel { id: string; username: string; }
interface ScheduledTask { id: string; chat_id: string; message: string; scheduled_time: string; repeat_interval: string; enabled: boolean; }
interface AutoDeleteRule { id: string; chat_id: string; delay: string; enabled: boolean; }

type View = "list" | "create-choose" | "create-bot" | "create-account" | "manage";

const Systems = ({ session }: { session: Session | null }) => {
  const navigate = useNavigate();
  const userId = session?.user?.id;
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [view, setView] = useState<View>("list");
  const [systems, setSystems] = useState<ConnectedSystem[]>([]);
  const [managingSystem, setManagingSystem] = useState<ConnectedSystem | null>(null);
  const [loading, setLoading] = useState(true);

  const [botToken, setBotToken] = useState("");
  const [checkingBot, setCheckingBot] = useState(false);
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [stringSession, setStringSession] = useState("");
  const [sessionFile, setSessionFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Access control
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [allowedGroups, setAllowedGroups] = useState<AllowedGroup[]>([]);
  const [addingUser, setAddingUser] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newUserIsMainAdmin, setNewUserIsMainAdmin] = useState(false);
  const [newGroupId, setNewGroupId] = useState("");

  // Channels
  const [channels, setChannels] = useState<Channel[]>([]);
  const [addingChannel, setAddingChannel] = useState(false);
  const [newChannel, setNewChannel] = useState("");

  // Scheduler
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskChatId, setNewTaskChatId] = useState("");
  const [newTaskMessage, setNewTaskMessage] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [newTaskRepeat, setNewTaskRepeat] = useState("once");

  // Auto-delete
  const [autoDeleteRules, setAutoDeleteRules] = useState<AutoDeleteRule[]>([]);
  const [addingRule, setAddingRule] = useState(false);
  const [newRuleChatId, setNewRuleChatId] = useState("");
  const [newRuleDelay, setNewRuleDelay] = useState("5m");

  // Copy settings
  const [copyTargetSystemId, setCopyTargetSystemId] = useState("");
  const [copyingSettings, setCopyingSettings] = useState(false);

  // Load systems from DB
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("systems").select("*").order("created_at");
      if (data) {
        setSystems(data.map((s) => ({
          id: s.id, type: s.type as SystemType, label: s.label,
          username: s.username ?? undefined, status: (s.status as SystemStatus) || "offline",
          lastChecked: s.last_checked ? new Date(s.last_checked).toLocaleTimeString("en-US", { hour12: false }) : "",
        })));
      }
      setLoading(false);
    };
    load();
  }, []);

  // Load related data when managing a system
  const sysId = managingSystem?.id || "";

  const loadSystemData = useCallback(async (id: string) => {
    const [u, g, c, t, r] = await Promise.all([
      supabase.from("allowed_users").select("id, telegram_user_id, is_admin").eq("system_id", id),
      supabase.from("allowed_groups").select("id, telegram_chat_id").eq("system_id", id),
      supabase.from("channels").select("id, username").eq("system_id", id),
      supabase.from("scheduled_tasks").select("id, chat_id, message, scheduled_time, repeat_interval, enabled").eq("system_id", id),
      supabase.from("auto_delete_rules").select("id, chat_id, delay, enabled").eq("system_id", id),
    ]);
    if (u.data) setAllowedUsers(u.data);
    if (g.data) setAllowedGroups(g.data);
    if (c.data) setChannels(c.data);
    if (t.data) setScheduledTasks(t.data);
    if (r.data) setAutoDeleteRules(r.data);
  }, []);

  useEffect(() => {
    if (sysId) loadSystemData(sysId);
  }, [sysId, loadSystemData]);

  const now = () => new Date().toLocaleTimeString("en-US", { hour12: false });

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
  };

  const connectBot = async () => {
    if (!botToken.trim()) { toast.error("Bot token is required."); return; }
    setCheckingBot(true);
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await res.json();
      if (!data.ok) { toast.error("Invalid bot token."); return; }
      const bot = data.result;
      const { data: inserted, error } = await supabase.from("systems").insert({
        type: "bot", label: bot.first_name, username: `@${bot.username}`, status: "online", bot_token: botToken, user_id: userId,
      }).select().single();
      if (error) { toast.error("DB error."); return; }

      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook/${botToken}`;
      const whRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const whData = await whRes.json();
      if (whData.ok) {
        toast.success(`Webhook set for @${bot.username}`);
      } else {
        toast.error("Bot connected but webhook setup failed.");
      }

      setSystems((prev) => [...prev, { id: inserted.id, type: "bot", label: bot.first_name, username: `@${bot.username}`, status: "online", lastChecked: now() }]);
      toast.success(`Connected: @${bot.username}`);
      setBotToken("");
      setView("list");
    } catch {
      toast.error("Network error.");
    } finally {
      setCheckingBot(false);
    }
  };

  const connectAccount = async () => {
    if (!apiId.trim() || !apiHash.trim()) { toast.error("API ID and Hash required."); return; }
    if (!stringSession.trim() && !sessionFile) { toast.error("Provide session string or file."); return; }

    const label = sessionFile ? sessionFile.name : `Account_${apiId}`;
    const { data: inserted, error } = await supabase.from("systems").insert({
      type: "account", label, status: "online", api_id: apiId, api_hash: apiHash, string_session: stringSession || null, user_id: userId,
    }).select().single();

    if (error) { toast.error("DB error."); return; }

    setSystems((prev) => [...prev, { id: inserted.id, type: "account", label, status: "online", lastChecked: now() }]);
    toast.success("Account connected! (Use bot systems for command/webhook mode)");
    setApiId("");
    setApiHash("");
    setStringSession("");
    setSessionFile(null);
    setView("list");
  };

  const handleSessionFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB."); return; }
    setSessionFile(file);
  };

  const removeSystem = async (id: string) => {
    await supabase.from("systems").delete().eq("id", id);
    setSystems((prev) => prev.filter((s) => s.id !== id));
    if (managingSystem?.id === id) {
      setManagingSystem(null);
      setView("list");
    }
    toast.success("Removed.");
  };

  const refreshStatus = async (id: string) => {
    await supabase.from("systems").update({ last_checked: new Date().toISOString() }).eq("id", id);
    setSystems((prev) => prev.map((s) => s.id === id ? { ...s, lastChecked: now() } : s));
  };

  // ─── CRUD helpers ───
  const addUser = async () => {
    if (!newUserId.trim()) return;
    const { data, error } = await supabase
      .from("allowed_users")
      .insert({ system_id: sysId, telegram_user_id: newUserId.trim(), is_admin: newUserIsMainAdmin })
      .select("id, telegram_user_id, is_admin")
      .single();

    if (error) { toast.error("Error adding user."); return; }

    setAllowedUsers((prev) => [...prev, data]);
    setNewUserId("");
    setNewUserIsMainAdmin(false);
    setAddingUser(false);
    toast.success(newUserIsMainAdmin ? "Main admin added." : "User added.");
  };

  const toggleMainAdmin = async (row: AllowedUser) => {
    const next = !row.is_admin;
    const { error } = await supabase
      .from("allowed_users")
      .update({ is_admin: next })
      .eq("id", row.id);

    if (error) {
      toast.error("Failed to update role.");
      return;
    }

    setAllowedUsers((prev) => prev.map((u) => (u.id === row.id ? { ...u, is_admin: next } : u)));
    toast.success(next ? "Main admin enabled." : "Main admin removed.");
  };

  const addGroup = async () => {
    if (!newGroupId.trim()) return;
    const { data, error } = await supabase.from("allowed_groups").insert({ system_id: sysId, telegram_chat_id: newGroupId.trim() }).select().single();
    if (error) { toast.error("Error adding group."); return; }
    setAllowedGroups((prev) => [...prev, data]);
    setNewGroupId("");
    setAddingGroup(false);
    toast.success("Group added.");
  };

  const addChannelEntry = async () => {
    if (!newChannel.trim()) return;
    const val = newChannel.trim().toUpperCase().replace(/^@/, "");
    const { data, error } = await supabase.from("channels").insert({ system_id: sysId, username: val }).select().single();
    if (error) { toast.error("Error adding channel."); return; }
    setChannels((prev) => [...prev, data]);
    setNewChannel("");
    setAddingChannel(false);
    toast.success("Channel added.");
  };

  const addScheduledTask = async () => {
    if (!newTaskChatId.trim() || !newTaskMessage.trim() || !newTaskTime.trim()) { toast.error("Fill all fields."); return; }
    const { data, error } = await supabase.from("scheduled_tasks").insert({
      system_id: sysId, chat_id: newTaskChatId.trim(), message: newTaskMessage.trim(),
      scheduled_time: newTaskTime, repeat_interval: newTaskRepeat,
    }).select().single();
    if (error) { toast.error("Error creating task."); return; }
    setScheduledTasks((prev) => [...prev, data]);
    setNewTaskChatId("");
    setNewTaskMessage("");
    setNewTaskTime("");
    setNewTaskRepeat("once");
    setAddingTask(false);
    toast.success("Task scheduled.");
  };

  const removeTask = async (taskId: string) => {
    await supabase.from("scheduled_tasks").delete().eq("id", taskId);
    setScheduledTasks((prev) => prev.filter((t) => t.id !== taskId));
    toast.success("Task removed.");
  };

  const toggleTask = async (taskId: string) => {
    const task = scheduledTasks.find((t) => t.id === taskId);
    if (!task) return;
    await supabase.from("scheduled_tasks").update({ enabled: !task.enabled }).eq("id", taskId);
    setScheduledTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, enabled: !t.enabled } : t));
  };

  const addAutoDeleteRule = async () => {
    if (!newRuleChatId.trim()) { toast.error("Chat ID required."); return; }
    const { data, error } = await supabase.from("auto_delete_rules").insert({
      system_id: sysId,
      chat_id: newRuleChatId.trim(),
      delay: newRuleDelay,
    }).select().single();
    if (error) { toast.error("Error adding rule."); return; }
    setAutoDeleteRules((prev) => [...prev, data]);
    setNewRuleChatId("");
    setNewRuleDelay("5m");
    setAddingRule(false);
    toast.success("Rule added.");
  };

  const removeRule = async (ruleId: string) => {
    await supabase.from("auto_delete_rules").delete().eq("id", ruleId);
    setAutoDeleteRules((prev) => prev.filter((r) => r.id !== ruleId));
    toast.success("Rule removed.");
  };

  const toggleRule = async (ruleId: string) => {
    const rule = autoDeleteRules.find((r) => r.id === ruleId);
    if (!rule) return;
    await supabase.from("auto_delete_rules").update({ enabled: !rule.enabled }).eq("id", ruleId);
    setAutoDeleteRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
  };

  const copySystemSettings = async () => {
    if (!sysId || !copyTargetSystemId) {
      toast.error("Choose a target bot/account first.");
      return;
    }

    if (copyTargetSystemId === sysId) {
      toast.error("Pick a different target system.");
      return;
    }

    setCopyingSettings(true);

    try {
      const [srcUsers, srcGroups, srcChannels, srcRules, srcUserAccess] = await Promise.all([
        supabase.from("allowed_users").select("telegram_user_id, is_admin").eq("system_id", sysId),
        supabase.from("allowed_groups").select("telegram_chat_id").eq("system_id", sysId),
        supabase.from("channels").select("username").eq("system_id", sysId),
        supabase.from("auto_delete_rules").select("chat_id, delay, enabled").eq("system_id", sysId),
        supabase.from("user_channel_access").select("telegram_user_id, channel_username, granted_by").eq("system_id", sysId),
      ]);

      if (srcUsers.error || srcGroups.error || srcChannels.error || srcRules.error || srcUserAccess.error) {
        throw new Error("Failed loading source settings");
      }

      await Promise.all([
        supabase.from("allowed_users").delete().eq("system_id", copyTargetSystemId),
        supabase.from("allowed_groups").delete().eq("system_id", copyTargetSystemId),
        supabase.from("channels").delete().eq("system_id", copyTargetSystemId),
        supabase.from("auto_delete_rules").delete().eq("system_id", copyTargetSystemId),
        supabase.from("user_channel_access").delete().eq("system_id", copyTargetSystemId),
      ]);

      const inserts = [
        srcUsers.data && srcUsers.data.length > 0
          ? supabase.from("allowed_users").insert(srcUsers.data.map((u) => ({
              system_id: copyTargetSystemId,
              telegram_user_id: u.telegram_user_id,
              is_admin: u.is_admin,
            })))
          : Promise.resolve({ error: null }),
        srcGroups.data && srcGroups.data.length > 0
          ? supabase.from("allowed_groups").insert(srcGroups.data.map((g) => ({
              system_id: copyTargetSystemId,
              telegram_chat_id: g.telegram_chat_id,
            })))
          : Promise.resolve({ error: null }),
        srcChannels.data && srcChannels.data.length > 0
          ? supabase.from("channels").insert(srcChannels.data.map((c) => ({
              system_id: copyTargetSystemId,
              username: c.username,
            })))
          : Promise.resolve({ error: null }),
        srcRules.data && srcRules.data.length > 0
          ? supabase.from("auto_delete_rules").insert(srcRules.data.map((r) => ({
              system_id: copyTargetSystemId,
              chat_id: r.chat_id,
              delay: r.delay,
              enabled: r.enabled,
            })))
          : Promise.resolve({ error: null }),
        srcUserAccess.data && srcUserAccess.data.length > 0
          ? supabase.from("user_channel_access").insert(srcUserAccess.data.map((a) => ({
              system_id: copyTargetSystemId,
              telegram_user_id: a.telegram_user_id,
              channel_username: a.channel_username,
              granted_by: a.granted_by,
            })))
          : Promise.resolve({ error: null }),
      ];

      const results = await Promise.all(inserts);
      const failed = results.find((res: any) => res?.error);
      if (failed) {
        throw new Error(failed.error?.message || "Copy failed");
      }

      toast.success("Copied channels, access control, and auto-delete to target system.");
      setCopyTargetSystemId("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy settings.");
    } finally {
      setCopyingSettings(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const header = (
    <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-card">
      <div className="flex items-center gap-2">
        <Bot className="w-5 h-5 text-primary" />
        <span className="font-semibold text-foreground text-sm">TG Controller</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-2 hidden sm:inline">{session?.user?.email}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={toggleTheme}>
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  // ─── MANAGE VIEW ───
  if (view === "manage" && managingSystem) {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <div className="max-w-3xl mx-auto p-5 space-y-5">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setView("list"); setManagingSystem(null); setAddingUser(false); setAddingGroup(false); setAddingTask(false); setAddingRule(false); setAddingChannel(false); setNewUserIsMainAdmin(false); setCopyTargetSystemId(""); }}>
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
                { value: "channels", icon: Hash, label: "Channels" },
                { value: "composer", icon: Send, label: "Composer" },
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

            {/* ACCESS CONTROL */}
            <TabsContent value="access" className="mt-5">
              <GlowCard title="Access Control" subtitle="Main admins can use /access /remove /addadmin. Others can use /post and /stop their own posts.">
                <div className="space-y-4">
                  <div className="p-3 rounded-md bg-muted/50 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-foreground">Allowed Users + Main Admins</span>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setAddingUser(true)}>
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    </div>
                    {addingUser && (
                      <div className="space-y-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Telegram User ID (e.g. 123456789)"
                            value={newUserId}
                            onChange={(e) => setNewUserId(e.target.value)}
                            className="text-sm h-8 font-mono"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") addUser(); }}
                          />
                          <Button size="sm" className="h-8 text-xs" onClick={addUser}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingUser(false); setNewUserId(""); setNewUserIsMainAdmin(false); }}>Cancel</Button>
                        </div>
                        <div className="flex items-center justify-between rounded border border-border bg-background px-2 py-1.5">
                          <span className="text-xs text-muted-foreground">Set as Main Admin</span>
                          <Switch checked={newUserIsMainAdmin} onCheckedChange={setNewUserIsMainAdmin} />
                        </div>
                      </div>
                    )}
                    {allowedUsers.length === 0 && !addingUser ? (
                      <p className="text-xs text-muted-foreground">No users configured yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {allowedUsers.map((u) => (
                          <div key={u.id} className="flex items-center justify-between py-1 px-2 rounded bg-background border border-border">
                            <span className="text-xs font-mono text-foreground">{u.telegram_user_id}</span>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground">Main Admin</span>
                                <Switch checked={u.is_admin} onCheckedChange={() => toggleMainAdmin(u)} />
                              </div>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={async () => {
                                await supabase.from("allowed_users").delete().eq("id", u.id);
                                setAllowedUsers((prev) => prev.filter((x) => x.id !== u.id));
                                toast.success("User removed.");
                              }}><X className="w-3 h-3" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-3 rounded-md bg-muted/50 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-foreground">Allowed Groups / Channels</span>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setAddingGroup(true)}>
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    </div>
                    {addingGroup && (
                      <div className="flex items-center gap-2 mb-2">
                        <Input placeholder="Chat ID (e.g. -1001234567890)" value={newGroupId} onChange={(e) => setNewGroupId(e.target.value)} className="text-sm h-8 font-mono" autoFocus onKeyDown={(e) => { if (e.key === "Enter") addGroup(); }} />
                        <Button size="sm" className="h-8 text-xs" onClick={addGroup}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingGroup(false); setNewGroupId(""); }}>Cancel</Button>
                      </div>
                    )}
                    {allowedGroups.length === 0 && !addingGroup ? (
                      <p className="text-xs text-muted-foreground">No groups configured yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {allowedGroups.map((g) => (
                          <div key={g.id} className="flex items-center justify-between py-1 px-2 rounded bg-background border border-border">
                            <span className="text-xs font-mono text-foreground">{g.telegram_chat_id}</span>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={async () => {
                              await supabase.from("allowed_groups").delete().eq("id", g.id);
                              setAllowedGroups((prev) => prev.filter((x) => x.id !== g.id));
                              toast.success("Group removed.");
                            }}><X className="w-3 h-3" /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-md bg-muted/50 border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <Copy className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">Copy channels + access + auto-delete to another system</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Select value={copyTargetSystemId} onValueChange={setCopyTargetSystemId}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select target bot/account" />
                        </SelectTrigger>
                        <SelectContent>
                          {systems
                            .filter((s) => s.id !== sysId)
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.type === "bot" ? "Bot" : "Account"} • {s.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" className="h-8 text-xs" onClick={copySystemSettings} disabled={copyingSettings || !copyTargetSystemId}>
                        {copyingSettings ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Copying...</> : "Copy Settings"}
                      </Button>
                    </div>
                  </div>
                </div>
              </GlowCard>
            </TabsContent>

            {/* CHANNELS */}
            <TabsContent value="channels" className="mt-5">
              <GlowCard title="Channels" subtitle="Channels where the bot has admin + post permission">
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setAddingChannel(true)}>
                      <Plus className="w-3 h-3 mr-1" /> Add Channel
                    </Button>
                  </div>
                  {addingChannel && (
                    <div className="p-3 rounded-md bg-muted/50 border border-border space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Channel Username</Label>
                        <Input placeholder="e.g. @MyChannel or MYCHANNEL" value={newChannel} onChange={(e) => setNewChannel(e.target.value)} className="text-sm h-8 font-mono uppercase" autoFocus onKeyDown={(e) => { if (e.key === "Enter") addChannelEntry(); }} />
                        <p className="text-xs text-muted-foreground">Enter the channel username. Stored in uppercase.</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="text-xs" onClick={addChannelEntry}>Save</Button>
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setAddingChannel(false); setNewChannel(""); }}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  {channels.length === 0 && !addingChannel ? (
                    <div className="p-6 text-center">
                      <Hash className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No channels added yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {channels.map((ch) => (
                        <div key={ch.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-background border border-border">
                          <div className="flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-mono font-semibold text-foreground">@{ch.username}</span>
                          </div>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={async () => {
                            await supabase.from("channels").delete().eq("id", ch.id);
                            setChannels((prev) => prev.filter((x) => x.id !== ch.id));
                            toast.success("Channel removed.");
                          }}><X className="w-3 h-3" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlowCard>
            </TabsContent>

            {/* SCHEDULER */}
            <TabsContent value="scheduler" className="mt-5">
              <GlowCard title="Scheduler" subtitle="Schedule messages and tasks">
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setAddingTask(true)}>
                      <Plus className="w-3 h-3 mr-1" /> Create Task
                    </Button>
                  </div>
                  {addingTask && (
                    <div className="p-3 rounded-md bg-muted/50 border border-border space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Chat ID</Label>
                          <Input placeholder="-1001234567890" value={newTaskChatId} onChange={(e) => setNewTaskChatId(e.target.value)} className="text-sm h-8 font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Time</Label>
                          <Input type="datetime-local" value={newTaskTime} onChange={(e) => setNewTaskTime(e.target.value)} className="text-sm h-8" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Message</Label>
                        <Input placeholder="Message to send..." value={newTaskMessage} onChange={(e) => setNewTaskMessage(e.target.value)} className="text-sm h-8" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Repeat</Label>
                        <Select value={newTaskRepeat} onValueChange={setNewTaskRepeat}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="once">Once</SelectItem>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="text-xs" onClick={addScheduledTask}>Save</Button>
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setAddingTask(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  {scheduledTasks.length === 0 && !addingTask ? (
                    <div className="p-6 text-center">
                      <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No scheduled tasks.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {scheduledTasks.map((task) => (
                        <div key={task.id} className={`flex items-center justify-between p-3 rounded-md border border-border ${task.enabled ? "bg-background" : "bg-muted/30 opacity-60"}`}>
                          <div className="space-y-0.5">
                            <p className="text-sm text-foreground">{task.message}</p>
                            <p className="text-xs text-muted-foreground font-mono">Chat: {task.chat_id} · {task.scheduled_time} · {task.repeat_interval}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={task.enabled} onCheckedChange={() => toggleTask(task.id)} />
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeTask(task.id)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlowCard>
            </TabsContent>

            {/* AUTO-DELETE */}
            <TabsContent value="auto-delete" className="mt-5">
              <GlowCard title="Auto-Delete" subtitle="Auto-remove messages after a set time">
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setAddingRule(true)}>
                      <Plus className="w-3 h-3 mr-1" /> Add Rule
                    </Button>
                  </div>
                  {addingRule && (
                    <div className="p-3 rounded-md bg-muted/50 border border-border space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Chat ID or *</Label>
                          <Input placeholder="-1001234567890 or *" value={newRuleChatId} onChange={(e) => setNewRuleChatId(e.target.value)} className="text-sm h-8 font-mono" />
                          <p className="text-[10px] text-muted-foreground">Use <span className="font-mono">*</span> to apply to all channels/groups this system posts in.</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Delete after</Label>
                          <Select value={newRuleDelay} onValueChange={setNewRuleDelay}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1m">1 minute</SelectItem>
                              <SelectItem value="5m">5 minutes</SelectItem>
                              <SelectItem value="15m">15 minutes</SelectItem>
                              <SelectItem value="30m">30 minutes</SelectItem>
                              <SelectItem value="1h">1 hour</SelectItem>
                              <SelectItem value="2h">2 hours</SelectItem>
                              <SelectItem value="3h">3 hours</SelectItem>
                              <SelectItem value="4h">4 hours</SelectItem>
                              <SelectItem value="6h">6 hours</SelectItem>
                              <SelectItem value="12h">12 hours</SelectItem>
                              <SelectItem value="24h">24 hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="text-xs" onClick={addAutoDeleteRule}>Save</Button>
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setAddingRule(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  {autoDeleteRules.length === 0 && !addingRule ? (
                    <div className="p-6 text-center">
                      <Trash2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No auto-delete rules.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {autoDeleteRules.map((rule) => (
                        <div key={rule.id} className={`flex items-center justify-between p-3 rounded-md border border-border ${rule.enabled ? "bg-background" : "bg-muted/30 opacity-60"}`}>
                          <div className="space-y-0.5">
                            <p className="text-sm font-mono text-foreground">Chat: {rule.chat_id}</p>
                            <p className="text-xs text-muted-foreground">Delete after {rule.delay}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeRule(rule.id)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlowCard>
            </TabsContent>

            {/* LIVE FEED */}
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

            {/* STATISTICS */}
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
      </div>
    );
  }

  // ─── CREATE CHOOSE ───
  if (view === "create-choose") {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <div className="max-w-lg mx-auto p-5 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView("list")}><ArrowLeft className="w-4 h-4" /></Button>
            <h2 className="text-lg font-semibold text-foreground">Create System</h2>
          </div>
          <div className="space-y-3">
            <button onClick={() => setView("create-bot")} className="group text-left w-full">
              <GlowCard className="transition-colors hover:border-primary/40">
                <div className="flex items-center gap-4">
                  <Bot className="w-7 h-7 text-primary shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-sm">Telegram Bot</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Connect using a Bot Token</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                </div>
              </GlowCard>
            </button>
            <button onClick={() => setView("create-account")} className="group text-left w-full">
              <GlowCard className="transition-colors hover:border-accent/40">
                <div className="flex items-center gap-4">
                  <User className="w-7 h-7 text-accent shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-sm">Telegram Account</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Connect using API credentials</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                </div>
              </GlowCard>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── CREATE BOT ───
  if (view === "create-bot") {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <div className="max-w-md mx-auto p-5 space-y-6">
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
      </div>
    );
  }

  // ─── CREATE ACCOUNT ───
  if (view === "create-account") {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <div className="max-w-md mx-auto p-5 space-y-6">
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
      </div>
    );
  }

  // ─── SYSTEMS LIST ───
  return (
    <div className="min-h-screen bg-background">
      {header}
      <div className="max-w-3xl mx-auto p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Connected Systems</h2>
          <Button size="sm" onClick={() => setView("create-choose")}>
            <Plus className="w-4 h-4 mr-1.5" /> Create System
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : systems.length === 0 ? (
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
    </div>
  );
};

export default Systems;
