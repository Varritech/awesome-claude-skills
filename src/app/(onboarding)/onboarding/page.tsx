"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { apiGet } from "@/lib/api-client";

// onboardingCompleted (with 'd') matches the field name returned by /api/user/profile.
interface UserProfile {
  onboardingCompleted?: boolean;
  industry?: string | null;
  preferredStyle?: string | null;
}

export default function OnboardingLandingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  useEffect(() => {
    if (!isLoaded) return;

    // Anonymous visitors: send straight to sign-up.
    if (!isSignedIn) {
      router.replace("/onboarding/signup");
      return;
    }

    let cancelled = false;

    apiGet<UserProfile>("/api/user/profile")
      .then((profile) => {
        if (cancelled) return;
        // onboardingCompleted (with 'd') is the canonical field name from UserProfileRecord.
        if (profile?.onboardingCompleted) {
          router.replace("/dashboard");
        } else {
          router.replace("/onboarding/path");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("Failed to load profile", err);
        // On error, default to the path selector so the user can continue.
        router.replace("/onboarding/path");
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, router]);

  // Show a minimal spinner while the profile fetch and redirect resolve.
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-cf-page flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-cf-orange/30 border-t-cf-orange animate-spin" />
      </div>
    );
  }

  return null;
}
