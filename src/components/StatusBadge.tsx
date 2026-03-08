import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: "active" | "inactive" | "pending" | "warning";
  label: string;
};

const statusStyles = {
  active: "bg-accent/10 text-accent border-accent/30",
  inactive: "bg-muted text-muted-foreground border-border",
  pending: "bg-warning/10 text-warning border-warning/30",
  warning: "bg-destructive/10 text-destructive border-destructive/30",
};

const dotStyles = {
  active: "bg-accent",
  inactive: "bg-muted-foreground",
  pending: "bg-warning",
  warning: "bg-destructive",
};

const StatusBadge = ({ status, label }: StatusBadgeProps) => (
  <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono rounded-full border", statusStyles[status])}>
    <span className={cn("w-1.5 h-1.5 rounded-full", dotStyles[status])} />
    {label}
  </span>
);

export default StatusBadge;
