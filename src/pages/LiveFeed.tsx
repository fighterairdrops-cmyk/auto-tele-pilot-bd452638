import { useState } from "react";
import { MessageSquare, Shield, Settings, Plus, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import GlowCard from "@/components/GlowCard";
import StatusBadge from "@/components/StatusBadge";
import { motion, AnimatePresence } from "framer-motion";

type CommandLog = {
  id: string;
  timestamp: string;
  userId: string;
  groupId: string;
  command: string;
  status: "accepted" | "rejected" | "processed";
};

const mockLogs: CommandLog[] = [
  { id: "1", timestamp: "16:45:23", userId: "123456789", groupId: "-1001234567890", command: "/post every5 min10", status: "processed" },
  { id: "2", timestamp: "16:42:11", userId: "987654321", groupId: "-1001234567890", command: "/access @user123 @channel_one 24h", status: "accepted" },
  { id: "3", timestamp: "16:40:05", userId: "555666777", groupId: "-1009876543210", command: "/post every30 min2", status: "rejected" },
  { id: "4", timestamp: "16:38:50", userId: "123456789", groupId: "-1001234567890", command: "/stop task_2", status: "processed" },
  { id: "5", timestamp: "16:35:18", userId: "444555666", groupId: "-1001234567890", command: "/access @user456 @news_feed 48h", status: "accepted" },
  { id: "6", timestamp: "16:30:00", userId: "999000111", groupId: "-1005555555555", command: "/post every60 min24", status: "rejected" },
];

const statusColors = {
  accepted: "text-accent",
  rejected: "text-destructive",
  processed: "text-primary",
};

const LiveFeed = () => {
  const [authorizedGroups, setAuthorizedGroups] = useState(["-1001234567890"]);
  const [newGroup, setNewGroup] = useState("");

  const addGroup = () => {
    if (!newGroup.trim() || authorizedGroups.includes(newGroup)) return;
    setAuthorizedGroups([...authorizedGroups, newGroup]);
    setNewGroup("");
  };

  const removeGroup = (g: string) => setAuthorizedGroups(authorizedGroups.filter((x) => x !== g));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-heading text-foreground text-glow-primary">Live Feed</h2>
        <p className="text-muted-foreground mt-1">Real-time command log and group authorization.</p>
      </div>

      {/* Authorized Groups */}
      <GlowCard glow="primary" title="Authorized Groups" subtitle="Only accept commands from these groups">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Group Chat ID..."
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              className="font-mono text-sm bg-muted/50"
              onKeyDown={(e) => e.key === "Enter" && addGroup()}
            />
            <Button size="icon" onClick={addGroup} className="bg-primary text-primary-foreground shrink-0">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {authorizedGroups.map((g) => (
              <div key={g} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-primary/20 font-mono text-sm">
                <Shield className="w-3 h-3 text-primary" />
                {g}
                <button onClick={() => removeGroup(g)} className="text-muted-foreground hover:text-destructive">
                  <Minus className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </GlowCard>

      {/* Command Feed */}
      <GlowCard title="Command Log" subtitle="Live incoming commands">
        <div className="space-y-2">
          <AnimatePresence>
            {mockLogs.map((log) => {
              const isAuthorized = authorizedGroups.includes(log.groupId);
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-4 p-3 rounded-md border transition-all ${
                    isAuthorized ? "bg-muted/30 border-border" : "bg-destructive/5 border-destructive/20 opacity-60"
                  }`}
                >
                  <span className="text-xs font-mono text-muted-foreground shrink-0 w-16">{log.timestamp}</span>
                  <MessageSquare className={`w-4 h-4 shrink-0 ${statusColors[log.status]}`} />
                  <span className="font-mono text-sm text-foreground flex-1 truncate">{log.command}</span>
                  <span className="text-xs font-mono text-muted-foreground shrink-0">from {log.userId}</span>
                  <span className="text-xs font-mono text-muted-foreground shrink-0">{log.groupId.slice(0, 8)}...</span>
                  <StatusBadge status={log.status === "rejected" ? "warning" : log.status === "processed" ? "active" : "pending"} label={log.status} />
                  {!isAuthorized && <span className="text-xs text-destructive font-mono">UNAUTHORIZED</span>}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </GlowCard>
    </div>
  );
};

export default LiveFeed;
