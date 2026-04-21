import { InputHTMLAttributes, forwardRef } from "react";

type InputState = "default" | "filled" | "focused" | "error";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  state?: InputState;
  leftIcon?: React.ReactNode;
}

const stateStyles: Record<InputState, string> = {
  default:
    "bg-cf-card border-none text-white/35 placeholder:text-white/35 focus:border-2 focus:border-cf-orange focus:text-white focus:bg-cf-card",
  filled:
    "bg-cf-card border-none text-white",
  focused:
    "bg-cf-card border-2 border-cf-orange text-white",
  error:
    "bg-cf-card border-2 border-cf-red text-cf-red",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ state = "default", leftIcon, className = "", ...props }, ref) => {
    return (
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={`w-full rounded-cf-btn px-5 py-3.5 text-sm font-medium font-sans outline-none transition-all duration-cf-fast ${stateStyles[state]} ${leftIcon ? "pl-11" : ""} ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";