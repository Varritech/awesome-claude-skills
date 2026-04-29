/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OnboardingLayout } from "@/components/layout";
import { UsersIcon, PenIcon, SendIcon, ChartIcon } from "@/components/icons";
import { apiPatch } from "@/lib/api-client";

type Persona = "closer" | "neighbor" | "expert" | "helper";

const personas: {
  id: Persona;
  name: string;
  desc: string;
  avatar: string;
  subject: string;
  body: string;
  sig: string;
}[] = [
  {
    id: "closer",
    name: "The Closer",
    desc: "Direct and confident. Gets straight to the point.",
    avatar: "/avatars/closer.png",
    subject: "Quick question about your roof",
    body: "Hi Mike, I noticed some shingles lifting on your roof at 42 Elm St. We're doing work in your neighborhood this week. Want a free quote before it gets worse?",
    sig: "— Jake, Jake's Roofing",
  },
  {
    id: "neighbor",
    name: "The Neighbor",
    desc: "Friendly and warm. Like a recommendation from next door.",
    avatar: "/avatars/neighbor.png",
    subject: "Hey from a local roofer",
    body: "Hey Mike! Just finished a roof for the Johnsons down the street. They were really happy with how it turned out. If you ever need anything, we'd love to help.",
    sig: "— Jake, Jake's Roofing",
  },
  {
    id: "expert",
    name: "The Expert",
    desc: "Professional and knowledgeable. Builds trust with expertise.",
    avatar: "/avatars/expert.png",
    subject: "Roof inspection before storm season",
    body: "Hi Mike, with the recent storms, homes built before 2005 often show early wear on ridge caps and flashing. A quick inspection can catch small issues before they become costly repairs.",
    sig: "— Jake, Jake's Roofing",
  },
  {
    id: "helper",
    name: "The Helper",
    desc: "Helpful and genuine. Focused on solving problems.",
    avatar: "/avatars/helper.png",
    subject: "Can I help with your roof?",
    body: "Hi Mike, I know dealing with roof stuff can be stressful, especially when you're not sure how bad it is. I'm happy to come take a look for free. No pressure at all.",
    sig: "— Jake, Jake's Roofing",
  },
];

export default function StylePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Persona | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLaunch = async () => {
    if (!selected || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      // Step 1: save the preferred writing style to the user profile.
      // updateProfileSchema accepts { preferredStyle } — use /api/user/profile.
      // The onboarding endpoint only accepts { step, completed } and rejects { persona, onboardingComplete }.
      await apiPatch("/api/user/profile", { preferredStyle: selected });

      // Step 2: mark onboarding complete via the dedicated onboarding endpoint.
      // updateOnboardingSchema requires { step: Step, completed: boolean }.
      await apiPatch("/api/user/onboarding", { step: "persona", completed: true });

      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Could not save your style. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <OnboardingLayout currentStep={5}>
      <div className="max-w-[720px] mx-auto animate-[enter_0.6s_cubic-bezier(0.23,1,0.32,1)]">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-[32px] font-bold tracking-[-0.04em] leading-tight mb-2 font-heading">
            Last step.{" "}
            <span className="text-cf-orange">How should your emails sound?</span>
          </h1>
          <p className="text-[15px] text-white/30 leading-relaxed">
            Pick a writing style. Each one sounds different. You can always change it later.
          </p>
        </div>

        {/* Persona Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {personas.map((persona) => {
            const isSelected = selected === persona.id;
            return (
              <button
                key={persona.id}
                type="button"
                onClick={() => setSelected(persona.id)}
                className={`relative bg-cf-card rounded-[20px] p-7 text-left cursor-pointer transition-all duration-200 overflow-hidden ${
                  isSelected ? "bg-[#1F1F25]" : "hover:bg-[#1F1F25]"
                }`}
                style={isSelected ? { boxShadow: "inset 0 0 0 1.5px rgba(249,115,22,0.4)" } : undefined}
              >
                {/* Selected badge */}
                <div
                  className={`absolute top-5 right-5 w-[22px] h-[22px] rounded-full bg-cf-orange flex items-center justify-center transition-all duration-200 ${
                    isSelected ? "opacity-100 scale-100" : "opacity-0 scale-50"
                  }`}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>

                {/* Avatar + Name */}
                <div className="flex items-center gap-3.5 mb-3.5">
                  <div className="w-12 h-12 min-w-[48px] rounded-[16px] overflow-hidden">
                    <img
                      src={persona.avatar}
                      alt={persona.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[15px] font-bold tracking-[-0.01em] font-heading">{persona.name}</span>
                </div>

                {/* Description */}
                <p className="text-[13px] text-white/30 leading-relaxed mb-[18px]">{persona.desc}</p>

                {/* Email Preview */}
                <div className="bg-[#161618] rounded-[14px] p-[18px_20px]">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-cf-orange flex-shrink-0" />
                    <span className="text-[11px] text-white/20 font-medium">{persona.subject}</span>
                  </div>
                  <p className="text-[13px] text-white/35 leading-[1.65]">{persona.body}</p>
                  <p className="text-[11px] text-white/[0.12] mt-3">{persona.sig}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* How it Works — trust layer */}
        <div className="bg-cf-card rounded-[20px] p-7 mb-8">
          <p className="text-[13px] font-bold text-white/60 mb-5 font-heading uppercase tracking-wide">How it works</p>
          <p className="text-[14px] text-white/45 leading-relaxed mb-6">
            Every template, sequence, and sending pattern inside ConvergeFlow is built on proven strategies from the best cold email marketers in the world — so you don&apos;t have to spend months experimenting.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#161618] rounded-[14px] p-4 text-center">
              <div className="w-10 h-10 rounded-[10px] bg-[#222228] flex items-center justify-center mx-auto mb-2.5">
                <UsersIcon size={18} className="text-white/50" />
              </div>
              <p className="text-[12px] font-bold text-white/70 mb-0.5 font-heading">Select leads</p>
              <p className="text-[11px] text-white/30">We find the right people</p>
            </div>
            <div className="bg-[#161618] rounded-[14px] p-4 text-center">
              <div className="w-10 h-10 rounded-[10px] bg-[#222228] flex items-center justify-center mx-auto mb-2.5">
                <PenIcon size={18} className="text-white/50" />
              </div>
              <p className="text-[12px] font-bold text-white/70 mb-0.5 font-heading">Personalize</p>
              <p className="text-[11px] text-white/30">AI writes for each lead</p>
            </div>
            <div className="bg-[#161618] rounded-[14px] p-4 text-center">
              <div className="w-10 h-10 rounded-[10px] bg-[#222228] flex items-center justify-center mx-auto mb-2.5">
                <SendIcon size={18} className="text-white/50" />
              </div>
              <p className="text-[12px] font-bold text-white/70 mb-0.5 font-heading">Send</p>
              <p className="text-[11px] text-white/30">Safe limits, zero spam</p>
            </div>
            <div className="bg-[#161618] rounded-[14px] p-4 text-center">
              <div className="w-10 h-10 rounded-[10px] bg-[#222228] flex items-center justify-center mx-auto mb-2.5">
                <ChartIcon size={18} className="text-white/50" />
              </div>
              <p className="text-[12px] font-bold text-white/70 mb-0.5 font-heading">Track</p>
              <p className="text-[11px] text-white/30">Opens, replies, booked calls</p>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-[13px] text-red-400 mb-3 text-center">{error}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <Link
            href="/onboarding/industry"
            className="flex items-center gap-1.5 text-[13px] text-white/20 hover:text-white/40 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            Back
          </Link>
          <button
            type="button"
            onClick={handleLaunch}
            disabled={!selected || submitting}
            className={`bg-cf-orange text-white text-sm font-bold py-3.5 px-9 rounded-[14px] border-none cursor-pointer transition-all duration-250 font-heading uppercase tracking-wide ${
              selected && !submitting
                ? "opacity-100 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
                : "opacity-25 cursor-default"
            }`}
          >
            {submitting ? "Saving..." : "Start sending emails"}
          </button>
        </div>
      </div>
    </OnboardingLayout>
  );
}
