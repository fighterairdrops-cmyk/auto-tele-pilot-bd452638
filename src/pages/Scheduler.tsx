import { useState } from "react";
import { Play, Pause, Trash2, Plus, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import GlowCard from "@/components/GlowCard";
import StatusBadge from "@/components/StatusBadge";

type ScheduledTask = {
  id: string;
  message: string;
  intervalMinutes: number;
  remainingCycles: number;
  deleteAfterMinutes: number;
  status: "active" | "inactive" | "pending";
  createdAt: string;
};

const mockTasks: ScheduledTask[] = [
  { id: "1", message: "📢 Daily update: Check our latest news!", intervalMinutes: 60, remainingCycles: 24, deleteAfterMinutes: 120, status: "active", createdAt: "2026-03-08 10:00" },
  { id: "2", message: "🔥 Flash sale ending soon!", intervalMinutes: 30, remainingCycles: 8, deleteAfterMinutes: 60, status: "active", createdAt: "2026-03-08 14:00" },
  { id: "3", message: "Welcome to the community!", intervalMinutes: 1440, remainingCycles: 0, deleteAfterMinutes: 0, status: "inactive", createdAt: "2026-03-07 09:00" },
];

const Scheduler = () => {
  const [tasks, setTasks] = useState(mockTasks);
  const [newMessage, setNewMessage] = useState("");
  const [interval, setInterval] = useState("60");
  const [cycles, setCycles] = useState("10");
  const [deleteAfter, setDeleteAfter] = useState("120");

  const addTask = () => {
    if (!newMessage.trim()) return;
    const task: ScheduledTask = {
      id: Date.now().toString(),
      message: newMessage,
      intervalMinutes: parseInt(interval) || 60,
      remainingCycles: parseInt(cycles) || 10,
      deleteAfterMinutes: parseInt(deleteAfter) || 0,
      status: "active",
      createdAt: new Date().toLocaleString(),
    };
    setTasks([task, ...tasks]);
    setNewMessage("");
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map((t) => t.id === id ? { ...t, status: t.status === "active" ? "inactive" : "active" as const } : t));
  };

  const removeTask = (id: string) => setTasks(tasks.filter((t) => t.id !== id));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-heading text-foreground text-glow-primary">Post Scheduler</h2>
        <p className="text-muted-foreground mt-1">Manage automated posting jobs from /post commands.</p>
      </div>

      {/* New Task Form */}
      <GlowCard glow="primary" title="Create New Task" subtitle="Add a recurring post job">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-4 space-y-2">
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Message Content</Label>
            <Textarea
              placeholder="Enter message text..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="font-mono text-sm bg-muted/50 min-h-[80px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Interval (min)</Label>
            <Input value={interval} onChange={(e) => setInterval(e.target.value)} className="font-mono text-sm bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Cycles</Label>
            <Input value={cycles} onChange={(e) => setCycles(e.target.value)} className="font-mono text-sm bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Delete After (min)</Label>
            <Input value={deleteAfter} onChange={(e) => setDeleteAfter(e.target.value)} className="font-mono text-sm bg-muted/50" />
          </div>
          <div className="flex items-end">
            <Button onClick={addTask} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Add Task
            </Button>
          </div>
        </div>
      </GlowCard>

      {/* Task Queue */}
      <GlowCard title="Task Queue" subtitle={`${tasks.filter(t => t.status === "active").length} active jobs`}>
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className={`p-4 rounded-md border transition-all ${task.status === "active" ? "bg-muted/30 border-primary/20" : "bg-muted/10 border-border opacity-60"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-mono truncate">{task.message}</p>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                      <Clock className="w-3 h-3" /> Every {task.intervalMinutes}m
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {task.remainingCycles} cycles left
                    </span>
                    {task.deleteAfterMinutes > 0 && (
                      <span className="text-xs text-warning font-mono">
                        🗑️ Delete after {task.deleteAfterMinutes}m
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={task.status} label={task.status} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleTask(task.id)}>
                    {task.status === "active" ? <Pause className="w-4 h-4 text-warning" /> : <Play className="w-4 h-4 text-accent" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeTask(task.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8 font-mono">No scheduled tasks. Create one above.</p>
          )}
        </div>
      </GlowCard>
    </div>
  );
};

export default Scheduler;
