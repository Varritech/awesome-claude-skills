"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { OnboardingLayout } from "@/components/layout";
import { Button } from "@/components/ui";
import { LogoIcon, ZapIcon, MailIcon, ChartIcon } from "@/components/icons";
import { apiGet } from "@/lib/api-client";

interface OnboardingState {
  completed?: boolean;
}

export default function OnboardingLandingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    // Anonymous visitors see the marketing landing page (no check needed)
    if (!isSignedIn) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    apiGet<OnboardingState>("/api/user/onboarding")
      .then((state) => {
        if (cancelled) return;
        if (state?.completed) {
          router.replace("/dashboard");
        } else {
          setChecking(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // If the profile doesn't exist yet, just show the path selector
        console.error("Failed to load profile", err);
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, router]);

  if (checking) {
    return (
      <OnboardingLayout currentStep={1}>
        <div className="max-w-2xl mx-auto pt-16 flex items-center justify-center min-h-[320px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-cf-orange/30 border-t-cf-orange animate-spin" />
            <p className="text-[13px] text-white/40">Loading your account...</p>
          </div>
        </div>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout currentStep={1}>
      <div className="max-w-2xl mx-auto pt-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <div className="w-16 h-16 rounded-[16px] bg-gradient-to-br from-cf-orange to-cf-orange-dark flex items-center justify-center mx-auto mb-6">
            <LogoIcon size={28} className="text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 font-heading">
            Cold email made simple
          </h1>
          <p className="text-lg text-white/35 max-w-md mx-auto leading-relaxed">
            5 clicks to a booked call. Set up your domain, connect your inbox,
            and start sending emails that land in the primary tab.
          </p>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
          <div className="rounded-cf-card bg-cf-card p-6 text-center">
            <div className="w-10 h-10 rounded-cf-icon bg-cf-orange/15 flex items-center justify-center mx-auto mb-4">
              <ZapIcon size={20} className="text-cf-orange" />
            </div>
            <h3 className="text-sm font-bold mb-1 font-heading">5-minute setup</h3>
            <p className="text-[11px] text-white/35">
              Domain, inbox, templates - all configured in a few clicks.
            </p>
          </div>
          <div className="rounded-cf-card bg-cf-card p-6 text-center">
            <div className="w-10 h-10 rounded-cf-icon bg-cf-mint/15 flex items-center justify-center mx-auto mb-4">
              <MailIcon size={20} className="text-cf-mint" />
            </div>
            <h3 className="text-sm font-bold mb-1 font-heading">Land in primary</h3>
            <p className="text-[11px] text-white/35">
              SPF, DKIM, DMARC auto-configured so you hit the inbox, not spam.
            </p>
          </div>
          <div className="rounded-cf-card bg-cf-card p-6 text-center">
            <div className="w-10 h-10 rounded-cf-icon bg-cf-green/15 flex items-center justify-center mx-auto mb-4">
              <ChartIcon size={20} className="text-cf-green" />
            </div>
            <h3 className="text-sm font-bold mb-1 font-heading">Industry templates</h3>
            <p className="text-[11px] text-white/35">
              Proven sequences for roofing, solar, HVAC, and more.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4">
          <Link
            href={isSignedIn ? "/onboarding/domain" : "/onboarding/signup"}
            className="w-full max-w-md"
          >
            <Button size="lg" className="w-full">
              {isSignedIn ? "Continue setup" : "Get started free"}
            </Button>
          </Link>
          <p className="text-[11px] text-white/20">
            No credit card required. Set up in under 10 minutes.
          </p>
        </div>
      </div>
    </OnboardingLayout>
  );
}
