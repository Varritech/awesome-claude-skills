"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { apiGet } from "@/lib/api-client";

interface UserProfile {
  onboardingCompleted?: boolean;
}

// Paths that should remain accessible even to onboarded users (entry points,
// auth handoffs). Everything else under /onboarding is a setup step.
const EXEMPT_PATHS = ["/onboarding/signup", "/onboarding/verify-email"];

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!pathname?.startsWith("/onboarding")) return;
    if (EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return;

    let cancelled = false;
    apiGet<UserProfile>("/api/user/profile")
      .then((profile) => {
        if (cancelled) return;
        if (profile?.onboardingCompleted) {
          router.replace("/dashboard");
        }
      })
      .catch(() => {
        // Profile fetch failures should not block onboarding — fail open.
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, pathname, router]);

  return <>{children}</>;
}
