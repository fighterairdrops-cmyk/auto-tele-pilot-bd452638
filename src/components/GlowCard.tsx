import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type GlowCardProps = {
  children: ReactNode;
  className?: string;
  glow?: "primary" | "accent" | "warning" | "destructive" | "none";
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
};

const glowStyles = {
  primary: "border-glow-primary",
  accent: "border-accent/30 glow-accent",
  warning: "border-warning/30 glow-warning",
  destructive: "border-destructive/30 glow-destructive",
  none: "",
};

const GlowCard = ({ children, className, glow = "none", title, subtitle, headerRight }: GlowCardProps) => (
  <div className={cn("rounded-lg border bg-card p-6", glowStyles[glow], className)}>
    {(title || headerRight) && (
      <div className="flex items-center justify-between mb-4">
        <div>
          {title && <h3 className="text-lg font-semibold font-heading text-card-foreground">{title}</h3>}
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {headerRight}
      </div>
    )}
    {children}
  </div>
);

export default GlowCard;
