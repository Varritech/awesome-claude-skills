"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingLayout } from "@/components/layout";
import { apiPost } from "@/lib/api-client";

type Provider = "gmail" | "yahoo" | "custom" | null;

interface CustomCredentials {
  smtpHost: string;
  smtpPort: string;
  imapHost: string;
  imapPort: string;
  email: string;
  password: string;
}

const emptyCustom: CustomCredentials = {
  smtpHost: "",
  smtpPort: "587",
  imapHost: "",
  imapPort: "993",
  email: "",
  password: "",
};

export default function InboxPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Provider>(null);
  const [custom, setCustom] = useState<CustomCredentials>(emptyCustom);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selected || submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      if (selected === "gmail" || selected === "yahoo") {
        const data = await apiPost<{ authUrl?: string } | null>("/api/inboxes", {
          provider: selected,
        });
        // OAuth flow: if backend returns an authUrl, redirect for consent
        if (data?.authUrl) {
          window.location.href = data.authUrl;
          return;
        }
        router.push("/onboarding/industry");
      } else {
        // Custom provider maps to the schema's `smtp_imap` shape. The email
        // address doubles as the SMTP/IMAP username.
        await apiPost("/api/inboxes", {
          provider: "smtp_imap",
          email: custom.email,
          smtp: {
            host: custom.smtpHost,
            port: Number(custom.smtpPort),
            user: custom.email,
            password: custom.password,
          },
          imap: {
            host: custom.imapHost,
            port: Number(custom.imapPort),
            user: custom.email,
            password: custom.password,
          },
        });
        router.push("/onboarding/industry");
      }
    } catch (err) {
      console.error(err);
      setError("Could not connect inbox. Check your details and try again.");
      setSubmitting(false);
    }
  };

  const updateCustom = (key: keyof CustomCredentials) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustom((prev) => ({ ...prev, [key]: e.target.value }));
  };

  return (
    <OnboardingLayout currentStep={3}>
      <div className="max-w-[480px] mx-auto">
        {/* Card */}
        <div className="bg-cf-card rounded-[24px] p-10 text-center animate-[fadeUp_0.5s_ease-out]">
          <h1 className="text-[24px] font-bold tracking-tight mb-2 font-heading">
            Where should we send your emails from?
          </h1>
          <p className="text-sm text-white/50 leading-relaxed mb-8">
            We&apos;ll warm it up so everything lands in the inbox.
          </p>

          {/* Provider Cards */}
          <div className="flex flex-col gap-3 mb-6 text-left">
            <button
              type="button"
              onClick={() => setSelected("gmail")}
              className={`flex items-start gap-4 bg-[#222228] rounded-[14px] p-5 cursor-pointer transition-all duration-150 border-2 ${
                selected === "gmail"
                  ? "border-cf-orange bg-[#26262C]"
                  : "border-transparent hover:border-cf-orange/30"
              }`}
            >
              <div
                className={`w-12 h-12 min-w-[48px] rounded-[14px] flex items-center justify-center ${
                  selected === "gmail" ? "bg-cf-orange/10" : "bg-cf-card"
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-bold mb-1 font-heading">Connect Gmail</p>
                <p className="text-[13px] text-white/50 leading-relaxed">
                  One click. We&apos;ll handle the rest.
                </p>
              </div>
            </button>

            <div className="relative">
              <button
                type="button"
                disabled
                className="flex items-start gap-4 bg-[#222228] rounded-[14px] p-5 cursor-not-allowed transition-all duration-150 border-2 border-transparent opacity-50 w-full"
              >
                <div className="w-12 h-12 min-w-[48px] rounded-[14px] flex items-center justify-center bg-cf-card">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-bold mb-1 font-heading">Connect Yahoo</p>
                  <p className="text-[13px] text-white/50 leading-relaxed">
                    Quick and easy.
                  </p>
                </div>
              </button>
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-[6px] bg-white/10 text-white/40 uppercase tracking-wide">
                Coming Soon
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelected("custom")}
              className={`flex items-start gap-4 bg-[#222228] rounded-[14px] p-5 cursor-pointer transition-all duration-150 border-2 ${
                selected === "custom"
                  ? "border-cf-orange bg-[#26262C]"
                  : "border-transparent hover:border-cf-orange/30"
              }`}
            >
              <div
                className={`w-12 h-12 min-w-[48px] rounded-[14px] flex items-center justify-center ${
                  selected === "custom" ? "bg-cf-orange/10" : "bg-cf-card"
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.73 12.73 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-bold mb-1 font-heading">Other provider</p>
                <p className="text-[13px] text-white/50 leading-relaxed">
                  Use your own email service.
                </p>
              </div>
            </button>
          </div>

          {/* Gmail/Yahoo OAuth notice */}
          {selected === "gmail" && (
            <div className="mb-6 text-left animate-[fadeUp_0.3s_ease-out]">
              <div className="bg-[#222228] rounded-[14px] p-5 flex items-start gap-3.5">
                <div className="w-10 h-10 min-w-[40px] rounded-[10px] bg-cf-orange/10 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h6v6" />
                    <path d="M10 14 21 3" />
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  </svg>
                </div>
                <p className="text-[13px] text-white/50 leading-relaxed">
                  You&apos;ll be redirected to Google to connect your account. We only ask for permission to send emails on your behalf.
                </p>
              </div>
            </div>
          )}


          {/* Custom SMTP fields */}
          {selected === "custom" && (
            <div className="mb-6 text-left animate-[fadeUp_0.3s_ease-out]">
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] font-medium text-white/35 mb-1.5 block">SMTP server</label>
                    <input
                      type="text"
                      value={custom.smtpHost}
                      onChange={updateCustom("smtpHost")}
                      placeholder="smtp.example.com"
                      className="w-full bg-cf-card border-2 border-transparent rounded-[14px] py-3.5 px-4 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                    />
                  </div>
                  <div className="w-[100px]">
                    <label className="text-[11px] font-medium text-white/35 mb-1.5 block">Port</label>
                    <input
                      type="text"
                      value={custom.smtpPort}
                      onChange={updateCustom("smtpPort")}
                      placeholder="587"
                      className="w-full bg-cf-card border-2 border-transparent rounded-[14px] py-3.5 px-4 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] font-medium text-white/35 mb-1.5 block">IMAP server</label>
                    <input
                      type="text"
                      value={custom.imapHost}
                      onChange={updateCustom("imapHost")}
                      placeholder="imap.example.com"
                      className="w-full bg-cf-card border-2 border-transparent rounded-[14px] py-3.5 px-4 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                    />
                  </div>
                  <div className="w-[100px]">
                    <label className="text-[11px] font-medium text-white/35 mb-1.5 block">Port</label>
                    <input
                      type="text"
                      value={custom.imapPort}
                      onChange={updateCustom("imapPort")}
                      placeholder="993"
                      className="w-full bg-cf-card border-2 border-transparent rounded-[14px] py-3.5 px-4 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-white/35 mb-1.5 block">Email address</label>
                  <input
                    type="email"
                    value={custom.email}
                    onChange={updateCustom("email")}
                    placeholder="you@example.com"
                    className="w-full bg-cf-card border-2 border-transparent rounded-[14px] py-3.5 px-4 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-white/35 mb-1.5 block">Password</label>
                  <input
                    type="password"
                    value={custom.password}
                    onChange={updateCustom("password")}
                    placeholder="Your email password"
                    className="w-full bg-cf-card border-2 border-transparent rounded-[14px] py-3.5 px-4 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Trust disclaimer */}
          <div className="bg-[#222228] rounded-[14px] p-5 mb-4 text-left">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E85002" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <p className="text-[13px] text-white/60 font-medium">Your account is safe with us</p>
              </div>
              <ul className="text-[12px] text-white/40 leading-relaxed space-y-1.5 pl-[30px]">
                <li>We use safe sending limits to protect your domain reputation</li>
                <li>Emails are sent gradually — never in bulk blasts</li>
                <li>Your credentials are encrypted and never stored in plain text</li>
              </ul>
            </div>
          </div>

          {/* Warmup notice */}
          <div className="bg-[#D4E4DD] rounded-[14px] p-5 flex items-start gap-3.5 mb-7 text-left">
            <div className="w-10 h-10 min-w-[40px] rounded-[10px] bg-[rgba(27,27,31,0.1)] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <p className="text-[13px] text-[#1B1B1F] leading-relaxed font-medium">
              We&apos;re warming up your inbox. Takes about 2 weeks, but you don&apos;t need to do anything.
            </p>
          </div>

          {error && (
            <p className="text-[12px] text-red-400 mb-3 text-left">{error}</p>
          )}

          {/* Next Button */}
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selected || submitting}
            className={`w-full bg-cf-orange text-white text-sm font-bold py-3.5 px-7 rounded-[14px] border-none cursor-pointer transition-all duration-150 font-heading uppercase tracking-wide ${
              selected && !submitting
                ? "hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
                : "opacity-35 cursor-default"
            }`}
          >
            {submitting ? "Connecting..." : "Next"}
          </button>
          <a
            href="/onboarding/domain"
            className="block text-center mt-5 text-[13px] text-white/35 hover:text-white/60 transition-colors"
          >
            Back
          </a>
        </div>
      </div>
    </OnboardingLayout>
  );
}
