import { HTMLAttributes, forwardRef } from "react";
import Link from "next/link";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "mint" | "orange";
  padding?: "none" | "sm" | "md" | "lg";
}

const variantStyles: Record<string, string> = {
  default: "bg-cf-card",
  elevated: "bg-cf-elevated",
  mint: "bg-cf-mint text-cf-card",
  orange: "bg-gradient-to-br from-cf-orange/20 to-cf-orange-dark/10",
};

const paddingStyles: Record<string, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", padding = "md", className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-cf-card ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

/* Metric card - used for dashboard KPIs */
interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: "orange" | "green" | "amber" | "indigo";
  chart?: React.ReactNode;
}

export const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  ({ label, value, subtitle, accent, chart, className = "", ...props }, ref) => {
    return (
      <Card ref={ref} className={className} {...props}>
        <p className="text-[11px] text-white/20">{label}</p>
        <div className="flex items-end justify-between mt-3">
          <div>
            <p className="text-4xl font-bold tracking-tighter leading-none font-mono">{value}</p>
            {subtitle && (
              <p className={`text-[11px] mt-1.5 ${accent === "green" ? "text-cf-green" : accent === "amber" ? "text-cf-amber" : "text-white/15"}`}>
                {subtitle}
              </p>
            )}
          </div>
          {chart}
        </div>
      </Card>
    );
  }
);

MetricCard.displayName = "MetricCard";

/* Action card - clickable nav items */
interface ActionCardProps extends HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
}

export const ActionCard = forwardRef<HTMLDivElement, ActionCardProps>(
  ({ icon, title, description, href, className = "", ...props }, ref) => {
    const inner = (
      <Card
        ref={ref}
        className={`flex items-center gap-4 cursor-pointer transition-colors duration-cf-fast hover:!bg-cf-elevated ${className}`}
        {...props}
      >
        <div className="w-10 h-10 rounded-cf-icon bg-cf-elevated flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold font-heading">{title}</p>
          <p className="text-[11px] text-white/20 mt-0.5">{description}</p>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/15 flex-shrink-0">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Card>
    );

    if (href) {
      return <Link href={href} className="block">{inner}</Link>;
    }
    return inner;
  }
);

ActionCard.displayName = "ActionCard";