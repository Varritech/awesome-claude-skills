"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingLayout } from "@/components/layout";
import { apiPost } from "@/lib/api-client";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-send on mount
  useEffect(() => {
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendCode() {
    setSending(true);
    setError(null);
    try {
      await apiPost("/api/auth/send-verification", {});
      setSent(true);
    } catch (err) {
      console.error(err);
      setError("Failed to send verification email. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function handleDigitChange(index: number, value: string) {
    const clean = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...digits];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const lastFilled = Math.min(pasted.length, 5);
    inputRefs.current[lastFilled]?.focus();
  }

  async function handleVerify() {
    const code = digits.join("");
    if (code.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiPost("/api/auth/verify-code", { code });
      router.push("/onboarding/domain");
    } catch (err) {
      console.error(err);
      setError("Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const code = digits.join("");

  return (
    <OnboardingLayout currentStep={1}>
      <div className="max-w-[400px] mx-auto">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-[14px] bg-cf-orange/15 flex items-center justify-center mx-auto mb-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h1 className="text-[28px] font-bold tracking-tight mb-2 font-heading">
            Check your inbox
          </h1>
          <p className="text-[14px] text-white/35 leading-relaxed">
            {sending
              ? "Sending verification code..."
              : sent
              ? "We sent a 6-digit code to your email address."
              : "We'll send a verification code to your email."}
          </p>
        </div>

        <div className="bg-cf-card rounded-[24px] p-8">
          {/* OTP Input */}
          <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-12 h-14 text-center text-xl font-bold bg-[#222228] border-2 border-transparent rounded-[12px] text-white outline-none focus:border-cf-orange transition-colors"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          {error && (
            <p className="text-[12px] text-red-400 text-center mb-4">{error}</p>
          )}

          <button
            type="button"
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className={`w-full bg-cf-orange text-white text-sm font-bold py-3.5 px-7 rounded-[14px] border-none font-heading uppercase tracking-wide transition-all duration-150 ${
              code.length === 6 && !loading
                ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
                : "opacity-35 cursor-default"
            }`}
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>

          <div className="text-center mt-5">
            <button
              type="button"
              onClick={sendCode}
              disabled={sending}
              className="text-[13px] text-white/35 hover:text-white/60 transition-colors disabled:opacity-50"
            >
              {sending ? "Sending..." : "Resend code"}
            </button>
          </div>

          <div className="text-center mt-3">
            <button
              type="button"
              onClick={() => router.push("/onboarding/domain")}
              className="text-[13px] text-white/20 hover:text-white/40 transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
}
