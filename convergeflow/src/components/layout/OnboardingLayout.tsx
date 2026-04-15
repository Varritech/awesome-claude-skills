"use client";

import Link from "next/link";
import { LogoIcon } from "@/components/icons";

const steps = [
  { label: "Account", href: "/onboarding/path" },
  { label: "Domain", href: "/onboarding/domain" },
  { label: "Inboxes", href: "/onboarding/inbox" },
  { label: "Niche", href: "/onboarding/industry" },
  { label: "Launch", href: "/onboarding/style" },
];

// Progress fill widths per step (matching design CSS @keyframes)
const progressWidths = [5, 20, 45, 65, 90];

interface OnboardingLayoutProps {
  children: React.ReactNode;
  currentStep: number; // 1-5
}

export function OnboardingLayout({ children, currentStep }: OnboardingLayoutProps) {
  const fillWidth = progressWidths[currentStep - 1] ?? 0;

  return (
    <div className="min-h-screen bg-cf-page">
      {/* Fixed top bar with integrated step indicator */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-cf-page">
        <div className="flex items-center justify-between px-5 py-5 md:px-8">
          {/* Left: Logo + Brand */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-cf-orange to-cf-orange-dark flex items-center justify-center">
              <LogoIcon size={14} className="text-white" />
            </div>
            <span
              className="text-[15px] font-bold tracking-tight italic"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              ConvergeFlow
            </span>
          </Link>

          {/* Right: Breadcrumb steps */}
          <nav className="hidden md:flex items-center gap-0">
            {steps.map((step, i) => {
              const stepNum = i + 1;
              const isCompleted = stepNum < currentStep;
              const isActive = stepNum === currentStep;
              return (
                <span key={step.label} className="flex items-center">
                  <Link
                    href={step.href}
                    className={`text-xs font-medium transition-colors ${
                      isActive
                        ? "text-white font-bold"
                        : isCompleted
                        ? "text-white/25"
                        : "text-white/[0.12]"
                    }`}
                  >
                    {step.label}
                  </Link>
                  {i < steps.length - 1 && (
                    <span
                      className="w-5 text-center text-[10px] text-white/[0.08]"
                    >
                      /
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Progress track - thin gradient line */}
      <div
        className="fixed top-[62px] left-0 right-0 h-[1px] bg-white/[0.04] z-50"
      >
        <div
          className="h-full bg-gradient-to-r from-cf-orange to-[#FB923C] transition-all duration-700 ease-out"
          style={{ width: `${fillWidth}%` }}
        />
      </div>

      {/* Content */}
      <main className="pt-[100px] pb-[60px] px-5 md:px-6">
        {children}
      </main>
    </div>
  );
}