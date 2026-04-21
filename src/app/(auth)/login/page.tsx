"use client";

import { SignIn } from "@clerk/nextjs";
import { LogoIcon } from "@/components/icons";

export default function LoginPage() {
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

        {/* Clerk SignIn card - styled to match brand */}
        <div className="animate-[fadeUp_0.5s_ease-out] flex justify-center">
          <SignIn
            path="/login"
            routing="path"
            signUpUrl="/onboarding/signup"
            afterSignInUrl="/onboarding"
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
                identityPreviewText: "text-white/70",
                identityPreviewEditButton: "text-cf-orange",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
