"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { apiGet } from "@/lib/api-client";

interface UserProfile {
  onboardingComplete?: boolean;
  industry?: string | null;
  persona?: string | null;
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

    apiGet<UserProfile>("/api/user/profile")
      .then((profile) => {
        if (cancelled) return;
        if (profile?.onboardingComplete) {
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

  // Always redirect signed-in users — either to dashboard if done, or to path selector
  // The checking state covers the profile fetch; if still loading show a minimal spinner
  if (checking) {
    return (
      <div className="min-h-screen bg-cf-page flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-cf-orange/30 border-t-cf-orange animate-spin" />
      </div>
    );
  }

  // Signed-out visitors: redirect to signup
  if (!isSignedIn) {
    router.replace("/onboarding/signup");
    return null;
  }

  // Signed-in, not complete: go to path selector
  router.replace("/onboarding/path");
  return null;
}
