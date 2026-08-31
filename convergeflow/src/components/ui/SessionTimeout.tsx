"use client";

import { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import {
  SESSION_TIMEOUT_MS,
  SESSION_WARNING_MS,
  msUntilExpiry,
} from "@/lib/security/session";

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "touchstart", "scroll"] as const;

export function SessionTimeout() {
  const { signOut } = useClerk();
  const [showWarning, setShowWarning] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function resetTimers() {
    lastActivityRef.current = Date.now();
    setShowWarning(false);

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
    }, SESSION_WARNING_MS);

    expiryTimerRef.current = setTimeout(() => {
      signOut({ redirectUrl: '/sign-in' });
    }, SESSION_TIMEOUT_MS);
  }

  useEffect(() => {
    // Start timers on mount
    resetTimers();

    const handleActivity = () => resetTimers();

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!showWarning) return null;

  const remaining = Math.ceil(msUntilExpiry(lastActivityRef.current) / 1000 / 60);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
      <div className="bg-cf-card border border-white/10 rounded-[20px] p-7 max-w-sm w-full shadow-2xl">
        <div className="w-12 h-12 rounded-[12px] bg-cf-amber/15 flex items-center justify-center mx-auto mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </div>
        <h3 className="text-[16px] font-bold font-heading text-center mb-2">
          Session expiring soon
        </h3>
        <p className="text-[13px] text-white/40 text-center leading-relaxed mb-5">
          You&apos;ll be signed out in{" "}
          <span className="text-white font-medium">{remaining} minute{remaining !== 1 ? "s" : ""}</span>{" "}
          due to inactivity.
        </p>
        <button
          onClick={resetTimers}
          className="w-full py-3 rounded-[12px] bg-cf-orange text-white text-[13px] font-bold hover:opacity-90 transition-opacity"
        >
          Stay signed in
        </button>
        <button
          onClick={() => signOut({ redirectUrl: '/sign-in' })}
          className="w-full mt-2 py-2 text-center text-[12px] text-white/25 hover:text-white/50 transition-colors"
        >
          Sign out now
        </button>
      </div>
    </div>
  );
}
