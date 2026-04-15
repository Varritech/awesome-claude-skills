"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OnboardingLayout } from "@/components/layout";
import { LogoIcon } from "@/components/icons";

type DomainOption = "own" | "convergeflow" | null;

export default function DomainPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<DomainOption>(null);
  const [showDns, setShowDns] = useState(false);

  const dnsRecords = [
    {
      type: "TXT",
      name: "DKIM",
      host: "cf._domainkey.yourdomain.com",
      value: "v=DKIM1; k=rsa; p=MIGfMA0GCSqGS...",
      status: "checking" as const,
    },
    {
      type: "TXT",
      name: "SPF",
      host: "@",
      value: "v=spf1 include:convergeflow.com ~all",
      status: "checking" as const,
    },
    {
      type: "TXT",
      name: "DMARC",
      host: "_dmarc.yourdomain.com",
      value: "v=DMARC1; p=none; rua=mailto:dmarc@convergeflow.com",
      status: "checking" as const,
    },
  ];

  const handleNext = () => {
    if (!selected) return;
    if (selected === "convergeflow") {
      router.push("/onboarding/inbox");
    } else {
      setShowDns(true);
    }
  };

  const handleSelectOption = (option: DomainOption) => {
    setSelected(option);
    if (showDns) setShowDns(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <OnboardingLayout currentStep={2}>
      <div className="max-w-[480px] mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-[30px] font-bold tracking-tight leading-tight mb-2">
            First step.{" "}
            <span className="text-cf-orange">Connect your website.</span>
          </h1>
          <p className="text-[15px] text-white/30 leading-relaxed">
            This makes sure your emails land in the inbox, not spam.
          </p>
        </div>

        {/* Card */}
        <div className="bg-cf-card rounded-[24px] p-10 text-center">
          {/* Option Cards */}
          {!showDns && (
            <div className="flex flex-col gap-3 mb-7 text-left">
              <button
                type="button"
                onClick={() => handleSelectOption("own")}
                className={`flex items-start gap-4 bg-[#222228] rounded-[14px] p-5 cursor-pointer transition-all duration-150 border-2 ${
                  selected === "own"
                    ? "border-cf-orange bg-[#26262C]"
                    : "border-transparent hover:border-cf-orange/30"
                }`}
              >
                <div
                  className={`w-12 h-12 min-w-[48px] rounded-[14px] flex items-center justify-center ${
                    selected === "own" ? "bg-cf-orange/10" : "bg-cf-card"
                  }`}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                    <path d="M2 12h20" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-[15px] font-bold">
                      Use my own website
                    </span>
                  </div>
                  <p className="text-[13px] text-white/50 leading-relaxed">
                    You&apos;ll copy a few settings to your website host. Takes
                    about 5 minutes.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectOption("convergeflow")}
                className={`flex items-start gap-4 bg-[#222228] rounded-[14px] p-5 cursor-pointer transition-all duration-150 border-2 ${
                  selected === "convergeflow"
                    ? "border-cf-orange bg-[#26262C]"
                    : "border-transparent hover:border-cf-orange/30"
                }`}
              >
                <div
                  className={`w-12 h-12 min-w-[48px] rounded-[14px] flex items-center justify-center ${
                    selected === "convergeflow" ? "bg-cf-orange/10" : "bg-cf-card"
                  }`}
                >
                  <LogoIcon size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-[15px] font-bold">
                      Use a ConvergeFlow address
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-[6px] bg-[#D4E4DD] text-[#1B1B1F] whitespace-nowrap">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[13px] text-white/50 leading-relaxed">
                    We&apos;ll set one up for you right now. No setup needed.
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Default Next Button */}
          {!showDns && (
            <>
              <button
                type="button"
                onClick={handleNext}
                disabled={!selected}
                className={`w-full bg-cf-orange text-white text-sm font-bold py-3.5 px-7 rounded-[14px] border-none cursor-pointer transition-all duration-150 font-['DM_Sans'] ${
                  selected
                    ? "hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
                    : "opacity-35 cursor-default"
                }`}
              >
                Next
              </button>
              <Link
                href="/onboarding/path"
                className="block text-center mt-5 text-[13px] text-white/35 hover:text-white/60 transition-colors"
              >
                Back
              </Link>
            </>
          )}

          {/* DNS Records Section */}
          {showDns && (
            <div className="text-left">
              <p className="text-[15px] font-bold mb-1.5">
                Add these records to your website host
              </p>
              <p className="text-[13px] text-white/50 leading-relaxed mb-5">
                Copy each record below and add them where you manage your website.
                Most hosts have a &quot;DNS&quot; or &quot;Records&quot; section.
              </p>

              <div className="flex flex-col gap-2.5 mb-5">
                {dnsRecords.map((record) => (
                  <div
                    key={record.type + record.name}
                    className="bg-[#222228] rounded-[14px] p-4"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-[6px] bg-cf-orange/[0.12] text-cf-orange">
                          {record.type}
                        </span>
                        <span className="text-[13px] font-medium text-white/70">
                          {record.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs text-white/50">Checking...</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] text-white/35 min-w-[48px] font-medium">
                        Name
                      </span>
                      <div className="flex-1 bg-cf-card rounded-[10px] py-2.5 px-3.5 text-xs text-white/70 font-mono overflow-x-auto whitespace-nowrap">
                        {record.host}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(record.host)}
                        className="w-9 h-9 min-w-[36px] rounded-[10px] bg-cf-card flex items-center justify-center hover:bg-cf-orange/[0.12] transition-colors"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="rgba(255,255,255,0.5)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-white/35 min-w-[48px] font-medium">
                        Value
                      </span>
                      <div className="flex-1 bg-cf-card rounded-[10px] py-2.5 px-3.5 text-xs text-white/70 font-mono overflow-x-auto whitespace-nowrap">
                        {record.value}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(record.value)}
                        className="w-9 h-9 min-w-[36px] rounded-[10px] bg-cf-card flex items-center justify-center hover:bg-cf-orange/[0.12] transition-colors"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="rgba(255,255,255,0.5)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => router.push("/onboarding/inbox")}
                  className="w-full bg-cf-orange text-white text-sm font-bold py-3.5 px-7 rounded-[14px] border-none cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(249,115,22,0.3)] font-['DM_Sans']"
                >
                  Verify &amp; Continue
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/onboarding/inbox")}
                  className="text-center text-[13px] text-white/35 hover:text-white/60 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </OnboardingLayout>
  );
}