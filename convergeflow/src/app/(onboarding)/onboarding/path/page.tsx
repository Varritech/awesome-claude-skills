"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OnboardingLayout } from "@/components/layout";

type PathChoice = "self" | "dwy" | null;

export default function PathPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<PathChoice>(null);

  const handleContinue = () => {
    if (!selected) return;
    if (selected === "self") {
      router.push("/onboarding/domain");
    } else {
      router.push("/onboarding/openclaw");
    }
  };

  return (
    <OnboardingLayout currentStep={1}>
      <div className="max-w-[640px] mx-auto">
        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="text-[28px] font-bold tracking-tight leading-tight mb-2 font-heading">
            Let&apos;s get you some customers.
          </h1>
          <p className="text-sm text-white/25">
            Pick how you want to get started.
          </p>
        </div>

        {/* Two paths */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
          {/* Self-serve */}
          <button
            type="button"
            onClick={() => setSelected("self")}
            className={`text-left rounded-[24px] p-8 cursor-pointer transition-all duration-150 border-2 ${
              selected === "self"
                ? "border-cf-orange bg-[#26262C]"
                : "border-transparent bg-cf-card hover:border-cf-orange/30"
            }`}
          >
            <div className="w-12 h-12 rounded-[14px] bg-[#222228] flex items-center justify-center mb-5">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </div>
            <p className="text-base font-bold mb-1.5 font-heading">
              I&apos;ll set it up myself
            </p>
            <p className="text-[13px] text-white/25 leading-relaxed mb-5">
              Takes about 2 minutes. Connect your domain, pick your niche, and
              launch.
            </p>
            <div className="flex gap-1.5">
              <span className="text-[11px] font-medium px-3 py-1.5 rounded-[24px] bg-white/[0.06] text-white/25">
                5 clicks
              </span>
              <span className="text-[11px] font-medium px-3 py-1.5 rounded-[24px] bg-white/[0.06] text-white/25">
                Free
              </span>
            </div>
          </button>

          {/* OpenClaw DWY */}
          <button
            type="button"
            onClick={() => setSelected("dwy")}
            className={`text-left rounded-[24px] p-8 cursor-pointer transition-all duration-150 border-2 relative overflow-hidden ${
              selected === "dwy"
                ? "border-cf-orange bg-[#26262C]"
                : "border-transparent bg-gradient-to-br from-[#1E1B10] to-cf-card hover:border-cf-orange/30"
            }`}
          >
            {/* Orange accent stripe */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cf-orange to-cf-orange-dark" />
            <div className="w-12 h-12 rounded-[14px] bg-cf-orange flex items-center justify-center mb-5">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-base font-bold mb-1.5 font-heading">
              Handle it for me
            </p>
            <p className="text-[13px] text-white/25 leading-relaxed mb-5">
              Too busy to sit at a laptop? Just tell us what you need over
              WhatsApp. We&apos;ll do everything.
            </p>
            <div className="flex gap-1.5">
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-[6px] bg-cf-orange/15 text-cf-orange">
                OpenClaw
              </span>
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-[6px] bg-cf-orange/15 text-cf-orange">
                DWY
              </span>
            </div>
          </button>
        </div>

        {/* Continue button */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selected}
          className={`w-full bg-cf-orange text-white text-sm font-bold py-3.5 px-7 rounded-[14px] border-none cursor-pointer transition-all duration-150 font-heading uppercase tracking-wide ${
            selected
              ? "hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
              : "opacity-35 cursor-default"
          }`}
        >
          Continue
        </button>

        {/* Back link */}
        <Link
          href="/onboarding/signup"
          className="block text-center mt-5 text-[13px] text-white/35 hover:text-white/60 transition-colors"
        >
          Back
        </Link>
      </div>
    </OnboardingLayout>
  );
}