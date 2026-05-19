"use client";

import { useState } from "react";

interface ContextualHelpProps {
  articleId: string;
  label?: string;
  children?: React.ReactNode;
  className?: string;
}

export function ContextualHelp({
  articleId: _articleId,
  label = "Need help with this?",
  children,
  className = "",
}: ContextualHelpProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`text-[12px] ${className}`}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>{label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {expanded && (
        <div role="region" className="overflow-hidden transition-all duration-200">
          <div className="mt-2 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/50 leading-relaxed">
            {children ?? (
              <p>
                Learn more about this feature in our{" "}
                <a href={`/help#${_articleId}`} className="text-cf-orange hover:underline">
                  help center
                </a>
                .
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
