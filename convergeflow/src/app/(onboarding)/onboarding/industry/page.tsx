"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OnboardingLayout } from "@/components/layout";

type Industry = "roofing" | "solar" | "hvac" | "plumbing" | "electrical" | "landscaping" | "general-contracting" | "painting" | "cleaning" | "other";

const industries: { id: Industry; name: string; example: string; icon: React.ReactNode }[] = [
  {
    id: "roofing",
    name: "Roofing",
    example: "Roof repair, replacements, gutters",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "solar",
    name: "Solar",
    example: "Solar panels, installation, maintenance",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
    ),
  },
  {
    id: "hvac",
    name: "HVAC",
    example: "Heating, cooling, air quality",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
      </svg>
    ),
  },
  {
    id: "plumbing",
    name: "Plumbing",
    example: "Pipes, drains, water heaters",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
        <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
      </svg>
    ),
  },
  {
    id: "electrical",
    name: "Electrical",
    example: "Wiring, panels, lighting",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z" />
        <path d="m2 22 3-3" />
        <path d="M7.5 13.5 10 11" />
        <path d="M10.5 16.5 13 14" />
        <path d="m18 3-4 4h6l-4 4" />
      </svg>
    ),
  },
  {
    id: "landscaping",
    name: "Landscaping",
    example: "Lawns, gardens, hardscaping",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 10v.2A3 3 0 0 1 8.9 16v0H5v0h0a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" />
        <path d="M7 16v6" />
        <path d="M13 19v3" />
        <path d="M18 22v-3a3 3 0 0 0-3-3" />
        <path d="M16 10v.2A3 3 0 0 1 14.9 16v0H19v0h0a3 3 0 0 0 1-5.8V10a3 3 0 0 0-6 0Z" />
      </svg>
    ),
  },
  {
    id: "general-contracting",
    name: "General Contracting",
    example: "Renovations, additions, builds",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z" />
        <path d="M10 15V6a2 2 0 0 1 4 0v9" />
        <path d="M4 15v-3a6 6 0 0 1 6-6h0" />
        <path d="M14 6h0a6 6 0 0 1 6 6v3" />
      </svg>
    ),
  },
  {
    id: "painting",
    name: "Painting",
    example: "Interior, exterior, commercial",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
        <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" />
        <path d="M14.5 17.5 4.5 15" />
      </svg>
    ),
  },
  {
    id: "cleaning",
    name: "Cleaning",
    example: "Residential, commercial, deep clean",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" />
        <path d="M19 17v4" />
        <path d="M3 5h4" />
        <path d="M17 19h4" />
      </svg>
    ),
  },
  {
    id: "other",
    name: "Other",
    example: "Tell us what you do",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        <rect width="20" height="14" x="2" y="6" rx="2" />
      </svg>
    ),
  },
];

export default function IndustryPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Industry | null>(null);
  const [otherText, setOtherText] = useState("");

  const canContinue = selected === "other" ? otherText.trim().length > 0 : selected !== null;

  const handleContinue = () => {
    if (!canContinue) return;
    router.push("/onboarding/style");
  };

  return (
    <OnboardingLayout currentStep={4}>
      <div className="max-w-[520px] mx-auto">
        <div className="bg-cf-card rounded-[24px] p-10 text-center animate-[fadeUp_0.5s_ease-out]">
          <h1 className="text-[24px] font-bold tracking-tight mb-2">
            What kind of work do you do?
          </h1>
          <p className="text-sm text-white/50 leading-relaxed mb-8">
            We&apos;ll find customers in your area and write emails that make sense for your business.
          </p>

          {/* Industry Grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {industries.map((industry) => {
              const isSelected = selected === industry.id;
              return (
                <button
                  key={industry.id}
                  type="button"
                  onClick={() => setSelected(industry.id)}
                  className={`bg-[#222228] rounded-[14px] p-4 text-center cursor-pointer transition-all duration-150 border-2 ${
                    isSelected
                      ? "border-cf-orange bg-[#27272E]"
                      : "border-transparent hover:border-cf-orange/30"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-[14px] flex items-center justify-center mx-auto mb-2.5 ${
                      isSelected ? "bg-cf-orange/10" : "bg-cf-card"
                    }`}
                  >
                    <span className={isSelected ? "text-cf-orange" : "text-white/50"}>
                      {industry.icon}
                    </span>
                  </div>
                  <p className="text-[14px] font-bold mb-1">{industry.name}</p>
                  <p className="text-[12px] text-white/35 leading-snug">{industry.example}</p>
                </button>
              );
            })}
          </div>

          {/* Other Input */}
          {selected === "other" && (
            <div className="mb-6 animate-[fadeUp_0.3s_ease-out]">
              <input
                type="text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="What's your business?"
                className="w-full bg-[#222228] border-2 border-transparent rounded-[14px] py-3.5 px-4 text-sm text-white outline-none focus:border-cf-orange font-['DM_Sans'] placeholder:text-white/35"
              />
            </div>
          )}

          {/* Next Button */}
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className={`w-full bg-cf-orange text-white text-sm font-bold py-3.5 px-7 rounded-[14px] border-none cursor-pointer transition-all duration-150 font-['DM_Sans'] ${
              canContinue
                ? "hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
                : "opacity-40 cursor-default"
            }`}
          >
            Next
          </button>
        </div>

        {/* Back link */}
        <div className="text-center mt-5">
          <Link
            href="/onboarding/inbox"
            className="inline-flex items-center gap-1.5 text-[13px] text-white/35 hover:text-white/60 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            Back
          </Link>
        </div>
      </div>
    </OnboardingLayout>
  );
}