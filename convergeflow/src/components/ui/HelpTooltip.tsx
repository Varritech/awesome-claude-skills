"use client";

import { useState } from "react";

type Position = "top" | "bottom" | "left" | "right";

interface HelpTooltipProps {
  content: string;
  position?: Position;
  className?: string;
}

const positionStyles: Record<Position, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function HelpTooltip({ content, position = "top", className = "" }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-label="help"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="w-4 h-4 rounded-full bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/70 transition-colors text-[10px] font-bold leading-none flex items-center justify-center"
      >
        ?
      </button>
      {visible && (
        <div
          role="tooltip"
          className={`absolute z-50 w-max max-w-[220px] px-3 py-2 rounded-lg bg-cf-elevated border border-white/[0.08] text-[12px] text-white/70 leading-relaxed shadow-xl pointer-events-none animate-in fade-in zoom-in-95 duration-100 ${positionStyles[position]}`}
        >
          {content}
        </div>
      )}
    </span>
  );
}
