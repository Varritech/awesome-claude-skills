interface AvatarProps {
  initials?: string;
  variant?: "orange" | "indigo" | "icon" | "mint";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  className?: string;
}

const sizeStyles: Record<string, string> = {
  sm: "w-9 h-9 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-xl",
};

const variantStyles: Record<string, string> = {
  orange: "bg-gradient-to-br from-cf-orange to-[#FB923C] text-white font-bold",
  indigo: "bg-gradient-to-br from-cf-indigo to-cf-indigo-light text-white font-bold",
  icon: "bg-white/6 text-white/40",
  mint: "bg-cf-mint text-cf-card",
};

export function Avatar({ initials, variant = "orange", size = "md", icon, className = "" }: AvatarProps) {
  return (
    <div className={`rounded-full flex items-center justify-center ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>
      {icon || initials}
    </div>
  );
}

/* Three-dot menu button */
export function MenuDot({ className = "" }: { className?: string }) {
  return (
    <div className={`flex gap-[3px] p-2 cursor-pointer ${className}`}>
      <div className="w-1 h-1 rounded-full bg-white/30" />
      <div className="w-1 h-1 rounded-full bg-white/30" />
      <div className="w-1 h-1 rounded-full bg-white/30" />
    </div>
  );
}