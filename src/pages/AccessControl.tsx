import { useState } from "react";
import { Plus, Trash2, Search, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import GlowCard from "@/components/GlowCard";
import StatusBadge from "@/components/StatusBadge";

type Admin = { id: string; telegramId: string; addedAt: string };
type Permission = { userId: string; channels: string[]; expiry: string; status: "active" | "pending" | "warning" };

const mockAdmins: Admin[] = [
  { id: "1", telegramId: "123456789", addedAt: "2026-03-01" },
  { id: "2", telegramId: "987654321", addedAt: "2026-03-05" },
];

const mockPermissions: Permission[] = [
  { userId: "111222333", channels: ["@channel_one", "@channel_two"], expiry: "2026-04-01 18:00", status: "active" },
  { userId: "444555666", channels: ["@main_channel"], expiry: "2026-03-15 12:00", status: "warning" },
  { userId: "777888999", channels: ["@news_feed", "@updates"], expiry: "2026-05-01 00:00", status: "active" },
  { userId: "101010101", channels: ["@test_channel"], expiry: "Pending...", status: "pending" },
];

const AccessControl = () => {
  const [admins, setAdmins] = useState(mockAdmins);
  const [newAdminId, setNewAdminId] = useState("");
  const [search, setSearch] = useState("");

  const filteredPermissions = mockPermissions.filter(
    (p) => p.userId.includes(search) || p.channels.some((c) => c.includes(search))
  );

  const addAdmin = () => {
    if (!newAdminId.trim()) return;
    setAdmins([...admins, { id: Date.now().toString(), telegramId: newAdminId, addedAt: new Date().toISOString().split("T")[0] }]);
    setNewAdminId("");
  };

  const removeAdmin = (id: string) => setAdmins(admins.filter((a) => a.id !== id));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-heading text-foreground text-glow-primary">Access Control</h2>
        <p className="text-muted-foreground mt-1">Manage admins and user permissions for channel posting.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Admin Table */}
        <GlowCard glow="primary" title="Main Admins" subtitle="Telegram User IDs" className="lg:col-span-1">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Telegram ID..."
                value={newAdminId}
                onChange={(e) => setNewAdminId(e.target.value)}
                className="font-mono text-sm bg-muted/50"
                onKeyDown={(e) => e.key === "Enter" && addAdmin()}
              />
              <Button size="icon" onClick={addAdmin} className="bg-primary text-primary-foreground shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50 border border-border">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="font-mono text-sm text-foreground">{admin.telegramId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{admin.addedAt}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeAdmin(admin.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlowCard>

        {/* Permission Mapping */}
        <GlowCard title="Permission Mapping" subtitle="User access from /access commands" className="lg:col-span-2">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by User ID or Channel..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 font-mono text-sm bg-muted/50"
              />
            </div>

            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left text-xs font-mono text-muted-foreground uppercase tracking-wider p-3">User ID</th>
                    <th className="text-left text-xs font-mono text-muted-foreground uppercase tracking-wider p-3">Channels</th>
                    <th className="text-left text-xs font-mono text-muted-foreground uppercase tracking-wider p-3">Expiry</th>
                    <th className="text-left text-xs font-mono text-muted-foreground uppercase tracking-wider p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPermissions.map((perm, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono text-sm text-foreground">{perm.userId}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {perm.channels.map((ch) => (
                            <span key={ch} className="px-2 py-0.5 text-xs font-mono rounded bg-secondary text-secondary-foreground">{ch}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-sm text-muted-foreground">{perm.expiry}</td>
                      <td className="p-3"><StatusBadge status={perm.status} label={perm.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </GlowCard>
      </div>
    </div>
  );
};

export default AccessControl;
