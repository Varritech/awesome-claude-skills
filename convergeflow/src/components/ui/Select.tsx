"use client";

import { useState } from "react";

interface SelectProps {
  value?: string;
  options: { label: string; value: string }[];
  onChange?: (value: string) => void;
  className?: string;
}

export function Select({ value: controlledValue, options, onChange, className = "" }: SelectProps) {
  const [internalValue, setInternalValue] = useState(controlledValue || options[0]?.value || "");
  const [isOpen, setIsOpen] = useState(false);
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;
  const selectedOption = options.find((o) => o.value === currentValue);

  const handleSelect = (value: string) => {
    if (!isControlled) setInternalValue(value);
    onChange?.(value);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-cf-card rounded-cf-btn px-5 py-3.5 text-sm text-white flex items-center justify-between cursor-pointer ${className}`}
      >
        <span>{selectedOption?.label || "Select..."}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-cf-elevated rounded-cf-btn overflow-hidden z-50 shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full px-5 py-3 text-sm text-left hover:bg-white/6 transition-colors ${
                option.value === currentValue ? "text-cf-orange" : "text-white/50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}