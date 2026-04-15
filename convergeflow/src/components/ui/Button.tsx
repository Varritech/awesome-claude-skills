import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "mint" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-cf-orange text-white hover:opacity-90",
  secondary:
    "bg-cf-card text-white hover:bg-cf-elevated",
  mint:
    "bg-cf-mint text-cf-card hover:opacity-90",
  ghost:
    "bg-transparent text-cf-orange hover:bg-cf-orange/10",
  danger:
    "bg-cf-red/10 text-cf-red hover:bg-cf-red/20",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-xs font-bold px-4 py-2 rounded-cf-icon",
  md: "text-sm font-bold px-7 py-3.5 rounded-cf-btn",
  lg: "text-base font-bold px-9 py-4.5 rounded-[16px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", icon, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 transition-colors duration-cf-fast font-heading uppercase tracking-wide ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {icon}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";