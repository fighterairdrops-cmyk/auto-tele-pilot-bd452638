import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot, User, Plus, Shield, Clock, Trash2, MessageSquare, BarChart3,
  ArrowLeft, Upload, FileText, RefreshCw, Unlink, X,
  Loader2, Settings, ChevronRight, Sun, Moon, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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

interface ScheduledTask {
  id: string;
  chatId: string;
  message: string;
  time: string;
  repeat: string;
  enabled: boolean;
}

interface AutoDeleteRule {
  id: string;
  chatId: string;
  delay: string;
  enabled: boolean;
}

type View = "list" | "create-choose" | "create-bot" | "create-account" | "manage";

// localStorage helpers
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

const Systems = () => {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [view, setView] = useState<View>("list");
  const [systems, setSystems] = useState<ConnectedSystem[]>(() => loadJSON("tg_systems", []));
  const [managingSystem, setManagingSystem] = useState<ConnectedSystem | null>(null);

  const [botToken, setBotToken] = useState("");
  const [checkingBot, setCheckingBot] = useState(false);
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [stringSession, setStringSession] = useState("");
  const [sessionFile, setSessionFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Access control
  const [allowedUsers, setAllowedUsers] = useState<Record<string, string[]>>(() => loadJSON("tg_allowedUsers", {}));
  const [allowedGroups, setAllowedGroups] = useState<Record<string, string[]>>(() => loadJSON("tg_allowedGroups", {}));
  const [addingUser, setAddingUser] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newGroupId, setNewGroupId] = useState("");

  // Channels
  const [channels, setChannels] = useState<Record<string, string[]>>(() => loadJSON("tg_channels", {}));
  const [addingChannel, setAddingChannel] = useState(false);
  const [newChannel, setNewChannel] = useState("");

  // Scheduler
  const [scheduledTasks, setScheduledTasks] = useState<Record<string, ScheduledTask[]>>(() => loadJSON("tg_scheduledTasks", {}));
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskChatId, setNewTaskChatId] = useState("");
  const [newTaskMessage, setNewTaskMessage] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [newTaskRepeat, setNewTaskRepeat] = useState("once");

  // Auto-delete
  const [autoDeleteRules, setAutoDeleteRules] = useState<Record<string, AutoDeleteRule[]>>(() => loadJSON("tg_autoDeleteRules", {}));
  const [addingRule, setAddingRule] = useState(false);
  const [newRuleChatId, setNewRuleChatId] = useState("");
  const [newRuleDelay, setNewRuleDelay] = useState("5m");

  // Persist to localStorage
  useEffect(() => { saveJSON("tg_systems", systems); }, [systems]);
  useEffect(() => { saveJSON("tg_allowedUsers", allowedUsers); }, [allowedUsers]);
  useEffect(() => { saveJSON("tg_allowedGroups", allowedGroups); }, [allowedGroups]);
  useEffect(() => { saveJSON("tg_channels", channels); }, [channels]);
  useEffect(() => { saveJSON("tg_scheduledTasks", scheduledTasks); }, [scheduledTasks]);
  useEffect(() => { saveJSON("tg_autoDeleteRules", autoDeleteRules); }, [autoDeleteRules]);

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

  const sysId = managingSystem?.id || "";

  const addUser = () => {
    if (!newUserId.trim()) return;
    setAllowedUsers((prev) => ({ ...prev, [sysId]: [...(prev[sysId] || []), newUserId.trim()] }));
    setNewUserId(""); setAddingUser(false);
    toast.success("User added.");
  };

  const addGroup = () => {
    if (!newGroupId.trim()) return;
    setAllowedGroups((prev) => ({ ...prev, [sysId]: [...(prev[sysId] || []), newGroupId.trim()] }));
    setNewGroupId(""); setAddingGroup(false);
    toast.success("Group added.");
  };

  const addChannelEntry = () => {
    if (!newChannel.trim()) return;
    const val = newChannel.trim().toUpperCase().replace(/^@/, "");
    setChannels((prev) => ({ ...prev, [sysId]: [...(prev[sysId] || []), val] }));
    setNewChannel(""); setAddingChannel(false);
    toast.success("Channel added.");
  };

  const addScheduledTask = () => {
    if (!newTaskChatId.trim() || !newTaskMessage.trim() || !newTaskTime.trim()) {
      toast.error("Fill all fields."); return;
    }
    const task: ScheduledTask = { id: Date.now().toString(), chatId: newTaskChatId.trim(), message: newTaskMessage.trim(), time: newTaskTime, repeat: newTaskRepeat, enabled: true };
    setScheduledTasks((prev) => ({ ...prev, [sysId]: [...(prev[sysId] || []), task] }));
    setNewTaskChatId(""); setNewTaskMessage(""); setNewTaskTime(""); setNewTaskRepeat("once");
    setAddingTask(false);
    toast.success("Task scheduled.");
  };

  const removeTask = (taskId: string) => {
    setScheduledTasks((prev) => ({ ...prev, [sysId]: (prev[sysId] || []).filter((t) => t.id !== taskId) }));
    toast.success("Task removed.");
  };

  const toggleTask = (taskId: string) => {
    setScheduledTasks((prev) => ({
      ...prev,
      [sysId]: (prev[sysId] || []).map((t) => t.id === taskId ? { ...t, enabled: !t.enabled } : t),
    }));
  };

  const addAutoDeleteRule = () => {
    if (!newRuleChatId.trim()) { toast.error("Chat ID required."); return; }
    const rule: AutoDeleteRule = { id: Date.now().toString(), chatId: newRuleChatId.trim(), delay: newRuleDelay, enabled: true };
    setAutoDeleteRules((prev) => ({ ...prev, [sysId]: [...(prev[sysId] || []), rule] }));
    setNewRuleChatId(""); setNewRuleDelay("5m"); setAddingRule(false);
    toast.success("Rule added.");
  };

  const removeRule = (ruleId: string) => {
    setAutoDeleteRules((prev) => ({ ...prev, [sysId]: (prev[sysId] || []).filter((r) => r.id !== ruleId) }));
    toast.success("Rule removed.");
  };

  const toggleRule = (ruleId: string) => {
    setAutoDeleteRules((prev) => ({
      ...prev,
      [sysId]: (prev[sysId] || []).map((r) => r.id === ruleId ? { ...r, enabled: !r.enabled } : r),
    }));
  };

  const header = (
    <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-card">
      <div className="flex items-center gap-2">
        <Bot className="w-5 h-5 text-primary" />
        <span className="font-semibold text-foreground text-sm">TG Controller</span>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={toggleTheme}>
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>
    </div>
  );

  // ─── MANAGE VIEW ───
  if (view === "manage" && managingSystem) {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <div className="max-w-3xl mx-auto p-5 space-y-5">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setView("list"); setManagingSystem(null); setAddingUser(false); setAddingGroup(false); setAddingTask(false); setAddingRule(false); setAddingChannel(false); }}>
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
              <GlowCard title="Access Control" subtitle="Manage who can interact with this system">
                <div className="space-y-4">
                  {/* Users */}
                  <div className="p-3 rounded-md bg-muted/50 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-foreground">Allowed Users</span>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setAddingUser(true)}>
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    </div>
                    {addingUser && (
                      <div className="flex items-center gap-2 mb-2">
                        <Input placeholder="Telegram User ID (e.g. 123456789)" value={newUserId} onChange={(e) => setNewUserId(e.target.value)} className="text-sm h-8 font-mono" autoFocus onKeyDown={(e) => { if (e.key === "Enter") addUser(); }} />
                        <Button size="sm" className="h-8 text-xs" onClick={addUser}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingUser(false); setNewUserId(""); }}>Cancel</Button>
                      </div>
                    )}
                    {(allowedUsers[sysId] || []).length === 0 && !addingUser ? (
                      <p className="text-xs text-muted-foreground">No users configured yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {(allowedUsers[sysId] || []).map((uid, i) => (
                          <div key={i} className="flex items-center justify-between py-1 px-2 rounded bg-background border border-border">
                            <span className="text-xs font-mono text-foreground">{uid}</span>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => {
                              setAllowedUsers((prev) => ({ ...prev, [sysId]: (prev[sysId] || []).filter((_, idx) => idx !== i) }));
                              toast.success("User removed.");
                            }}><X className="w-3 h-3" /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Groups */}
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
                    {(allowedGroups[sysId] || []).length === 0 && !addingGroup ? (
                      <p className="text-xs text-muted-foreground">No groups configured yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {(allowedGroups[sysId] || []).map((gid, i) => (
                          <div key={i} className="flex items-center justify-between py-1 px-2 rounded bg-background border border-border">
                            <span className="text-xs font-mono text-foreground">{gid}</span>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => {
                              setAllowedGroups((prev) => ({ ...prev, [sysId]: (prev[sysId] || []).filter((_, idx) => idx !== i) }));
                              toast.success("Group removed.");
                            }}><X className="w-3 h-3" /></Button>
                          </div>
                        ))}
                      </div>
                    )}
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
                        <Input
                          placeholder="e.g. @MyChannel or MYCHANNEL"
                          value={newChannel}
                          onChange={(e) => setNewChannel(e.target.value)}
                          className="text-sm h-8 font-mono uppercase"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") addChannelEntry(); }}
                        />
                        <p className="text-xs text-muted-foreground">Enter the channel username (short name). It will be stored in uppercase.</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="text-xs" onClick={addChannelEntry}>Save</Button>
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setAddingChannel(false); setNewChannel(""); }}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  {(channels[sysId] || []).length === 0 && !addingChannel ? (
                    <div className="p-6 text-center">
                      <Hash className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No channels added yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {(channels[sysId] || []).map((ch, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-background border border-border">
                          <div className="flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-mono font-semibold text-foreground">@{ch}</span>
                          </div>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => {
                            setChannels((prev) => ({ ...prev, [sysId]: (prev[sysId] || []).filter((_, idx) => idx !== i) }));
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
                  {(scheduledTasks[sysId] || []).length === 0 && !addingTask ? (
                    <div className="p-6 text-center">
                      <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No scheduled tasks.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(scheduledTasks[sysId] || []).map((task) => (
                        <div key={task.id} className={`flex items-center justify-between p-3 rounded-md border border-border ${task.enabled ? "bg-background" : "bg-muted/30 opacity-60"}`}>
                          <div className="space-y-0.5">
                            <p className="text-sm text-foreground">{task.message}</p>
                            <p className="text-xs text-muted-foreground font-mono">Chat: {task.chatId} · {task.time} · {task.repeat}</p>
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
                          <Label className="text-xs text-muted-foreground">Chat ID</Label>
                          <Input placeholder="-1001234567890" value={newRuleChatId} onChange={(e) => setNewRuleChatId(e.target.value)} className="text-sm h-8 font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Delete after</Label>
                          <Select value={newRuleDelay} onValueChange={setNewRuleDelay}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1m">1 minute</SelectItem>
                              <SelectItem value="5m">5 minutes</SelectItem>
                              <SelectItem value="15m">15 minutes</SelectItem>
                              <SelectItem value="1h">1 hour</SelectItem>
                              <SelectItem value="6h">6 hours</SelectItem>
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
                  {(autoDeleteRules[sysId] || []).length === 0 && !addingRule ? (
                    <div className="p-6 text-center">
                      <Trash2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No auto-delete rules.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(autoDeleteRules[sysId] || []).map((rule) => (
                        <div key={rule.id} className={`flex items-center justify-between p-3 rounded-md border border-border ${rule.enabled ? "bg-background" : "bg-muted/30 opacity-60"}`}>
                          <div className="space-y-0.5">
                            <p className="text-sm font-mono text-foreground">Chat: {rule.chatId}</p>
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
    </div>
  );
};

export default Systems;
