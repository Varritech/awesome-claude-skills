"use client";

import { SignUp } from "@clerk/nextjs";
import { LogoIcon } from "@/components/icons";

const progressSteps = ["Sign Up", "Website", "Inbox", "Industry", "Style"];

export default function SignupPage() {
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
          {progressSteps.map((step, i) => (
            <div key={step} className="flex-1 h-1 rounded-sm overflow-hidden bg-white/[0.06]">
              <div
                className={`h-full rounded-sm ${
                  i === 0 ? "bg-cf-orange w-full" : "w-0"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Clerk SignUp card */}
        <div className="animate-[fadeUp_0.5s_ease-out] flex justify-center">
          <SignUp
            path="/onboarding/signup"
            routing="path"
            signInUrl="/login"
            forceRedirectUrl="/onboarding"
            appearance={{
              variables: {
                colorPrimary: "#F97316",
                colorBackground: "#1B1B1F",
                colorInputBackground: "#222228",
                colorInputText: "#FFFFFF",
                colorText: "#FFFFFF",
                colorTextSecondary: "rgba(255,255,255,0.5)",
                colorDanger: "#EF4444",
                borderRadius: "14px",
                fontFamily: "var(--font-chivo), sans-serif",
              },
              elements: {
                rootBox: "w-full",
                card: "bg-cf-card rounded-[24px] p-10 shadow-none border-none",
                headerTitle: "text-[24px] font-bold tracking-tight font-heading text-white",
                headerSubtitle: "text-sm text-white/50",
                socialButtonsBlockButton:
                  "bg-white text-[#1B1B1F] hover:bg-white/90 border-0 rounded-[14px] font-bold",
                socialButtonsBlockButtonText: "text-[#1B1B1F] font-bold",
                dividerLine: "bg-white/[0.06]",
                dividerText: "text-white/20 text-xs",
                formFieldInput:
                  "bg-[#222228] border-none rounded-[14px] text-sm text-white placeholder:text-white/35 focus:ring-2 focus:ring-cf-orange",
                formFieldLabel: "text-white/70 text-[11px] font-medium",
                formButtonPrimary:
                  "bg-cf-orange hover:bg-cf-orange-dark rounded-[14px] font-bold uppercase tracking-wide font-heading text-white",
                footerActionLink: "text-cf-orange hover:opacity-80",
              },
            }}
          />
        </div>

        {/* Footer */}
        <p className="text-xs text-white/20 text-center mt-6 leading-relaxed">
          By signing up you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
