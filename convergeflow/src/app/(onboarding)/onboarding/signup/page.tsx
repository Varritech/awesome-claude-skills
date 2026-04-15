"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoIcon } from "@/components/icons";

const progressSteps = ["Sign Up", "Website", "Inbox", "Industry", "Style"];

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogleSignup = () => {
    router.push("/onboarding/path");
  };

  const handleEmailSignup = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/onboarding/path");
  };

  return (
    <div className="min-h-screen bg-cf-page flex items-center justify-center px-6">
      <div className="w-full max-w-[480px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3.5 mb-12">
          <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-cf-orange to-cf-orange-dark flex items-center justify-center">
            <LogoIcon size={22} className="text-white" />
          </div>
          <span className="text-[28px] font-bold tracking-tight italic font-heading">
            ConvergeFlow
          </span>
        </div>

        {/* Step labels */}
        <div className="flex justify-between mb-2">
          {progressSteps.map((label, i) => (
            <span
              key={label}
              className={`text-[11px] font-medium ${
                i === 0 ? "text-cf-orange" : "text-white/[0.2]"
              }`}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-10">
          {progressSteps.map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-sm overflow-hidden bg-white/[0.06]">
              <div
                className={`h-full rounded-sm ${
                  i === 0 ? "bg-cf-orange w-full" : "w-0"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-cf-card rounded-[24px] p-10 text-center animate-[fadeUp_0.5s_ease-out]">
          <h1 className="text-[24px] font-bold tracking-tight mb-2 font-heading">
            Let&apos;s get you some customers.
          </h1>
          <p className="text-sm text-white/50 leading-relaxed mb-8">
            Takes about 2 minutes. No credit card needed.
          </p>

          {/* Google Sign Up */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            className="w-full flex items-center justify-center gap-3 bg-white text-[#1B1B1F] text-base font-bold py-4 px-7 rounded-[14px] cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(255,255,255,0.1)] font-heading uppercase tracking-wide"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign up with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-[1px] bg-white/[0.06]" />
            <span className="text-xs text-white/20">or use email</span>
            <div className="flex-1 h-[1px] bg-white/[0.06]" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailSignup} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="w-full bg-[#222228] border-none rounded-[14px] py-3.5 px-4 text-sm text-white outline-none focus:border-2 focus:border-cf-orange focus:py-3 focus:px-[14px] placeholder:text-white/35"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Pick a password"
              className="w-full bg-[#222228] border-none rounded-[14px] py-3.5 px-4 text-sm text-white outline-none focus:border-2 focus:border-cf-orange focus:py-3 focus:px-[14px] placeholder:text-white/35"
            />
            <button
              type="submit"
              className="w-full bg-cf-orange text-white text-sm font-bold py-3.5 px-7 rounded-[14px] border-none cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(249,115,22,0.3)] mt-1 font-heading uppercase tracking-wide"
            >
              Get Started
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-xs text-white/20 text-center mt-6 leading-relaxed">
          By signing up you agree to our{" "}
          <Link href="#" className="text-cf-orange hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="#" className="text-cf-orange hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}