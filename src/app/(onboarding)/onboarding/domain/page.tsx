"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OnboardingLayout } from "@/components/layout";
import { LogoIcon } from "@/components/icons";
import { apiPost } from "@/lib/api-client";

type DomainOption = "own" | "convergeflow" | null;
type DnsStatus = "checking" | "valid" | "invalid";

interface DnsRecord {
  type: string;
  name: string;
  host: string;
  value: string;
  status: DnsStatus;
}

// Shape returned by /api/domains POST — dnsInstructions is a flat object keyed by record name.
interface ApiDnsInstruction {
  host: string;
  type: string;
  value: string;
}

interface ApiDomainData {
  id: string;
  domain: string;
  overallStatus?: string;
  dnsInstructions?: {
    spf?: ApiDnsInstruction;
    dkim?: ApiDnsInstruction;
    dmarc?: ApiDnsInstruction;
    mx?: ApiDnsInstruction;
  };
}

interface DomainVerifyData {
  id: string;
  overallStatus?: string;
  spfStatus?: string;
  dkimStatus?: string;
  dmarcStatus?: string;
}

/** Convert the flat dnsInstructions map from the API into the array the UI renders. */
function instructionsToRecords(
  instructions: ApiDomainData["dnsInstructions"]
): DnsRecord[] {
  if (!instructions) return fallbackDnsRecords;
  const order: Array<{ key: keyof NonNullable<ApiDomainData["dnsInstructions"]>; name: string }> = [
    { key: "dkim", name: "DKIM" },
    { key: "spf", name: "SPF" },
    { key: "dmarc", name: "DMARC" },
    { key: "mx", name: "MX" },
  ];
  return order
    .filter(({ key }) => instructions[key])
    .map(({ key, name }) => ({
      type: instructions[key]!.type ?? "TXT",
      name,
      host: instructions[key]!.host ?? "",
      value: instructions[key]!.value ?? "",
      status: "checking" as DnsStatus,
    }));
}

const fallbackDnsRecords: DnsRecord[] = [
  {
    type: "TXT",
    name: "DKIM",
    host: "cf._domainkey.yourdomain.com",
    value: "v=DKIM1; k=rsa; p=MIGfMA0GCSqGS...",
    status: "checking",
  },
  {
    type: "TXT",
    name: "SPF",
    host: "@",
    value: "v=spf1 include:_spf.mailforge.com ~all",
    status: "checking",
  },
  {
    type: "TXT",
    name: "DMARC",
    host: "_dmarc.yourdomain.com",
    value: "v=DMARC1; p=none; rua=mailto:dmarc@convergeflow.io",
    status: "checking",
  },
];

const statusStyles: Record<DnsStatus, { dot: string; label: string; color: string }> = {
  checking: { dot: "bg-amber-500 animate-pulse", label: "Checking...", color: "text-white/50" },
  valid: { dot: "bg-cf-green", label: "Verified", color: "text-cf-green" },
  invalid: { dot: "bg-red-400", label: "Not found", color: "text-red-400" },
};

/** Map the API's per-record status strings to our local DnsStatus. */
function mapApiStatus(s?: string): DnsStatus {
  if (s === "green") return "valid";
  if (s === "red") return "invalid";
  return "checking";
}

export default function DomainPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<DomainOption>(null);
  const [showDns, setShowDns] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>(fallbackDnsRecords);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const allValid = dnsRecords.every((r) => r.status === "valid");

  useEffect(() => {
    if (!domainId) return;
    // Poll every 4 seconds until verified
    const poll = async () => {
      try {
        const data = await apiPost<DomainVerifyData>(`/api/domains/${domainId}/verify`, {});
        if (data) {
          setDnsRecords((prev) =>
            prev.map((r) => {
              const key = r.name.toLowerCase() as "spf" | "dkim" | "dmarc" | "mx";
              const apiStatus = (data as Record<string, string | undefined>)[`${key}Status`];
              return { ...r, status: mapApiStatus(apiStatus) };
            })
          );
          if (data.overallStatus === "green" && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (err) {
        console.error("DNS verify poll failed", err);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 4000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [domainId]);

  const handleNext = async () => {
    if (!selected || submitting) return;
    setError(null);

    if (selected === "convergeflow") {
      setSubmitting(true);
      try {
        // API expects { domain, purpose } — use a placeholder domain for ConvergeFlow-managed ones.
        // The backend recognises "convergeflow" purpose and provisions the domain automatically.
        await apiPost<ApiDomainData>("/api/domains", {
          domain: "convergeflow.io",
          purpose: "sending",
        });
        router.push("/onboarding/inbox");
      } catch (err) {
        console.error(err);
        setError("Could not provision domain. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!domainInput.trim()) {
      setError("Enter your website domain to continue.");
      return;
    }

    setSubmitting(true);
    try {
      // API expects { domain: string, purpose: "primary" | "sending" }
      const data = await apiPost<ApiDomainData>("/api/domains", {
        domain: domainInput.trim(),
        purpose: "sending",
      });
      if (data?.dnsInstructions) {
        setDnsRecords(instructionsToRecords(data.dnsInstructions));
      }
      if (data?.id) setDomainId(data.id);
      setShowDns(true);
    } catch (err) {
      console.error(err);
      setError("Could not save your domain. Check the format and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectOption = (option: DomainOption) => {
    setSelected(option);
    setError(null);
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
          <h1 className="text-[30px] font-bold tracking-tight leading-tight mb-2 font-heading">
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
                    <span className="text-[15px] font-bold font-heading">
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
                    <span className="text-[15px] font-bold font-heading">
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

              {selected === "own" && (
                <div className="animate-[fadeUp_0.3s_ease-out]">
                  <label className="text-[11px] font-medium text-white/35 mb-1.5 block">
                    Your website domain
                  </label>
                  <input
                    type="text"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="yourdomain.com"
                    className="w-full bg-[#222228] border-2 border-transparent rounded-[14px] py-3.5 px-4 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                  />
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-[12px] text-red-400 mb-3 text-left">{error}</p>
          )}

          {/* Default Next Button */}
          {!showDns && (
            <>
              <button
                type="button"
                onClick={handleNext}
                disabled={!selected || submitting}
                className={`w-full bg-cf-orange text-white text-sm font-bold py-3.5 px-7 rounded-[14px] border-none cursor-pointer transition-all duration-150 font-heading uppercase tracking-wide ${
                  selected && !submitting
                    ? "hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
                    : "opacity-35 cursor-default"
                }`}
              >
                {submitting ? "Saving..." : "Next"}
              </button>
              <Link
                href="/onboarding"
                className="block text-center mt-5 text-[13px] text-white/35 hover:text-white/60 transition-colors"
              >
                Back
              </Link>
            </>
          )}

          {/* DNS Records Section */}
          {showDns && (
            <div className="text-left">
              <p className="text-[15px] font-bold mb-1.5 font-heading">
                Add these records to your website host
              </p>
              <p className="text-[13px] text-white/50 leading-relaxed mb-5">
                Copy each record below and add them where you manage your website.
                Most hosts have a &quot;DNS&quot; or &quot;Records&quot; section.
              </p>

              <div className="flex flex-col gap-2.5 mb-5">
                {dnsRecords.map((record) => {
                  const statusStyle = statusStyles[record.status] ?? statusStyles.checking;
                  return (
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
                          <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                          <span className={`text-xs ${statusStyle.color}`}>{statusStyle.label}</span>
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
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => router.push("/onboarding/inbox")}
                  className="w-full bg-cf-orange text-white text-sm font-bold py-3.5 px-7 rounded-[14px] border-none cursor-pointer transition-all duration-150 font-heading uppercase tracking-wide hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
                >
                  {allValid ? "Verified - Continue" : "Verify & Continue"}
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
