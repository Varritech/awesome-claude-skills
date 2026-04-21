interface BadgeProps {
  variant?: "pill" | "status";
  color?: "orange" | "green" | "red" | "indigo" | "mint" | "default";
  children: React.ReactNode;
  className?: string;
}

const pillStyles: Record<string, string> = {
  orange: "bg-cf-orange text-white",
  green: "bg-cf-green text-white",
  red: "bg-cf-red text-white",
  indigo: "bg-cf-indigo text-white",
  mint: "bg-cf-mint text-cf-card",
  default: "bg-white/6 text-white/35",
};

const statusDotStyles: Record<string, string> = {
  orange: "bg-cf-orange",
  green: "bg-cf-green",
  red: "bg-cf-red",
  amber: "bg-cf-amber",
  indigo: "bg-cf-indigo",
};

export function Badge({ variant = "pill", color = "default", children, className = "" }: BadgeProps) {
  if (variant === "status") {
    const dotColor = color === "mint" ? "green" : color === "default" ? "indigo" : color;
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`w-2 h-2 rounded-full ${statusDotStyles[dotColor]}`} />
        <span className="text-[13px] font-medium text-white/50">{children}</span>
      </div>
    );
  }

  return (
    <span className={`text-[13px] font-medium px-5 py-2.5 rounded-cf-pill ${pillStyles[color]} ${className}`}>
      {children}
    </span>
  );
}

/* Small inline badge for percentages/counts */
interface CountBadgeProps {
  color?: "orange" | "green" | "red" | "indigo";
  children: React.ReactNode;
  className?: string;
}

const countBadgeStyles: Record<string, string> = {
  orange: "bg-cf-orange text-white",
  green: "bg-cf-green text-white",
  red: "bg-cf-red text-white",
  indigo: "bg-cf-indigo text-white",
};

export function CountBadge({ color = "orange", children, className = "" }: CountBadgeProps) {
  return (
    <span className={`text-[11px] font-bold px-3 py-1.5 rounded-cf-badge ${countBadgeStyles[color]} ${className}`}>
      {children}
    </span>
  );
}