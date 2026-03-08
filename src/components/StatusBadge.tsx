import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: "active" | "inactive" | "pending" | "warning";
  label: string;
};

const statusStyles = {
  active: "bg-accent/10 text-accent border-accent/30 glow-accent",
  inactive: "bg-muted text-muted-foreground border-border",
  pending: "bg-warning/10 text-warning border-warning/30 glow-warning",
  warning: "bg-destructive/10 text-destructive border-destructive/30 glow-destructive",
};

const StatusBadge = ({ status, label }: StatusBadgeProps) => (
  <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-full border", statusStyles[status])}>
    <span className={cn("w-1.5 h-1.5 rounded-full", {
      "bg-accent animate-pulse-glow": status === "active",
      "bg-muted-foreground": status === "inactive",
      "bg-warning animate-pulse-glow": status === "pending",
      "bg-destructive animate-pulse-glow": status === "warning",
    })} />
    {label}
  </span>
);

export default StatusBadge;
