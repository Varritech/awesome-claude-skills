"use client";

import { useState } from "react";

interface ToggleProps {
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Toggle({ defaultChecked = false, checked: controlledChecked, onChange, label, className = "" }: ToggleProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isControlled = controlledChecked !== undefined;
  const isChecked = isControlled ? controlledChecked : internalChecked;

  const handleToggle = () => {
    const next = !isChecked;
    if (!isControlled) setInternalChecked(next);
    onChange?.(next);
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        onClick={handleToggle}
        className={`relative w-11 h-6 rounded-full transition-colors duration-cf-fast ${
          isChecked ? "bg-cf-orange" : "bg-white/6"
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-cf-fast ${
            isChecked
              ? "right-0.5 bg-white"
              : "left-0.5 bg-white/20"
          }`}
        />
      </button>
      {label && (
        <span className={`text-[13px] ${isChecked ? "text-white/50" : "text-white/20"}`}>
          {label}
        </span>
      )}
    </div>
  );
}