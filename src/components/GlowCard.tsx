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

const GlowCard = ({ children, className, title, subtitle, headerRight }: GlowCardProps) => (
  <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
    {(title || headerRight) && (
      <div className="flex items-center justify-between mb-4">
        <div>
          {title && <h3 className="text-base font-semibold text-card-foreground">{title}</h3>}
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {headerRight}
      </div>
    )}
    {children}
  </div>
);

export default GlowCard;
