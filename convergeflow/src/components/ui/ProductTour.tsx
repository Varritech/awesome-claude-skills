"use client";

import { useEffect, useRef, useState } from "react";
import { useTour, TOUR_STEPS } from "@/lib/stores/useTour";
import { apiPatch } from "@/lib/api-client";

interface TooltipPosition {
  top: number;
  left: number;
}

function getTooltipPosition(
  targetEl: Element,
  tooltipEl: HTMLDivElement | null,
  position: "top" | "bottom" | "left" | "right",
): TooltipPosition {
  const rect = targetEl.getBoundingClientRect();
  const tooltipHeight = tooltipEl?.offsetHeight ?? 120;
  const tooltipWidth = tooltipEl?.offsetWidth ?? 280;
  const gap = 12;

  switch (position) {
    case "top":
      return {
        top: rect.top + window.scrollY - tooltipHeight - gap,
        left: rect.left + window.scrollX + rect.width / 2 - tooltipWidth / 2,
      };
    case "bottom":
      return {
        top: rect.bottom + window.scrollY + gap,
        left: rect.left + window.scrollX + rect.width / 2 - tooltipWidth / 2,
      };
    case "left":
      return {
        top: rect.top + window.scrollY + rect.height / 2 - tooltipHeight / 2,
        left: rect.left + window.scrollX - tooltipWidth - gap,
      };
    case "right":
      return {
        top: rect.top + window.scrollY + rect.height / 2 - tooltipHeight / 2,
        left: rect.right + window.scrollX + gap,
      };
  }
}

export function ProductTour() {
  const { tourActive, currentStep, nextStep, prevStep, endTour } = useTour();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<TooltipPosition>({ top: 0, left: 0 });

  const step = TOUR_STEPS[currentStep];

  useEffect(() => {
    if (!tourActive || !step) return;

    const el = document.querySelector(step.target);
    if (!el) return;

    // Scroll element into view
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    // Position tooltip after scroll
    const timer = setTimeout(() => {
      const newPos = getTooltipPosition(el, tooltipRef.current, step.position);
      setPos(newPos);
    }, 300);

    return () => clearTimeout(timer);
  }, [tourActive, currentStep, step]);

  async function handleEndTour() {
    endTour();
    // Mark tour as completed
    try {
      await apiPatch("/api/user/profile", { tourCompleted: true });
    } catch {
      // non-critical
    }
  }

  if (!tourActive || !step) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[999]"
        onClick={handleEndTour}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[1000] w-72 bg-cf-card border border-white/10 rounded-[16px] p-5 shadow-2xl"
        style={{ top: pos.top, left: pos.left }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-white/30 font-medium">
            {currentStep + 1} of {TOUR_STEPS.length}
          </span>
          <button
            onClick={handleEndTour}
            className="text-white/20 hover:text-white/60 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1 mb-4">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === currentStep ? "bg-cf-orange flex-[2]" : "bg-white/15 flex-1"
              }`}
            />
          ))}
        </div>

        <h3 className="text-[14px] font-bold font-heading mb-1.5">{step.title}</h3>
        <p className="text-[13px] text-white/40 leading-relaxed mb-4">{step.body}</p>

        <div className="flex gap-2">
          {!isFirst && (
            <button
              onClick={prevStep}
              className="flex-1 py-2 rounded-[10px] bg-white/[0.04] text-[13px] text-white/50 hover:bg-white/[0.08] transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={isLast ? handleEndTour : nextStep}
            className="flex-[2] py-2 rounded-[10px] bg-cf-orange text-white text-[13px] font-bold hover:opacity-90 transition-opacity"
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>

        <button
          onClick={handleEndTour}
          className="w-full mt-2 text-center text-[12px] text-white/20 hover:text-white/40 transition-colors"
        >
          Skip tour
        </button>
      </div>
    </>
  );
}
