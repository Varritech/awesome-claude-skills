"use client";

import { Card, Toggle } from "@/components/ui";
import { Gauge } from "@/components/charts";
import {
  ShieldIcon,
  CheckIcon,
  XIcon,
  AlertIcon,
  GlobeIcon,
  RefreshIcon,
} from "@/components/icons";

const dnsRecords = [
  {
    type: "SPF",
    value: "v=spf1 include:_spf.convergeflow.io ~all",
    status: "valid" as const,
  },
  {
    type: "DKIM",
    value: "v=DKIM1; k=rsa; p=MIGfMA0GCS...",
    status: "valid" as const,
  },
  {
    type: "DMARC",
    value: "v=DMARC1; p=none; rua=mailto:dmarc@convergeflow.io",
    status: "warning" as const,
  },
  {
    type: "MX",
    value: "10 mail.convergeflow.io",
    status: "valid" as const,
  },
];

const statusIcons = {
  valid: { icon: CheckIcon, color: "text-cf-green", bg: "bg-cf-green/15" },
  warning: { icon: AlertIcon, color: "text-cf-amber", bg: "bg-cf-amber/15" },
  invalid: { icon: XIcon, color: "text-red-400", bg: "bg-red-500/15" },
};

const blacklistChecks = [
  { name: "Spamhaus", status: "clean" as const },
  { name: "Barracuda", status: "clean" as const },
  { name: "SORBS", status: "clean" as const },
  { name: "SpamCop", status: "clean" as const },
  { name: "UCEPROTECT", status: "listed" as const },
];

const blackListStatusConfig = {
  clean: { label: "Clean", color: "text-cf-green", dot: "bg-cf-green" },
  listed: { label: "Listed", color: "text-red-400", dot: "bg-red-400" },
};

const inboxProviders = [
  { name: "Gmail", percentage: 95 },
  { name: "Outlook", percentage: 82 },
  { name: "Yahoo", percentage: 88 },
  { name: "Apple Mail", percentage: 90 },
];

export default function DeliverabilityPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight">Deliverability</h1>
        <p className="text-[13px] text-white/25 mt-1">
          Monitor your email health and DNS setup
        </p>
      </div>

      {/* DNS Records */}
      <Card className="mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldIcon size={18} className="text-white/30" />
            <p className="text-sm font-bold">DNS Records</p>
          </div>
          <button className="text-[13px] text-cf-orange hover:opacity-80 transition-opacity flex items-center gap-1.5">
            <RefreshIcon size={14} />
            Refresh
          </button>
        </div>
        <div className="flex flex-col">
          {dnsRecords.map((record, i) => {
            const config = statusIcons[record.status];
            const StatusIcon = config.icon;
            return (
              <div
                key={record.type}
                className={`flex items-center justify-between py-3 ${
                  i < dnsRecords.length - 1 ? "border-b border-white/[0.04]" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-[var(--radius-icon)] ${config.bg} flex items-center justify-center`}
                  >
                    <StatusIcon size={12} className={config.color} />
                  </span>
                  <div>
                    <p className="text-[13px] font-bold">{record.type}</p>
                    <p className="text-[11px] text-white/20 truncate max-w-[280px]">
                      {record.value}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-medium ${config.color}`}
                >
                  {record.status === "valid" ? "Valid" : "Warning"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Inbox Health + Blacklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {/* Inbox Health */}
        <Card className="flex flex-col items-center">
          <p className="text-sm font-bold mb-4 self-start">Inbox Health</p>
          <Gauge value={90} statusText="Great" />
        </Card>

        {/* Blacklist Check */}
        <Card>
          <p className="text-sm font-bold mb-4">Blacklist Check</p>
          <div className="flex flex-col gap-3">
            {blacklistChecks.map((check) => {
              const config = blackListStatusConfig[check.status];
              return (
                <div key={check.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                    <span className="text-[13px] text-white/50">{check.name}</span>
                  </div>
                  <span className={`text-[11px] font-medium ${config.color}`}>
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Tracking Domain + Inbox Placement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold">Tracking Domain</p>
            <Toggle defaultChecked />
          </div>
          <p className="text-[12px] text-white/25 leading-relaxed">
            Use a custom domain for tracking links and opens. This improves deliverability
            by keeping your brand consistent.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <GlobeIcon size={14} className="text-white/20" />
            <span className="text-[13px] text-white/50">track.roofingdallas.com</span>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-bold mb-4">Inbox Placement</p>
          <div className="flex flex-col gap-3">
            {inboxProviders.map((provider) => (
              <div key={provider.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-white/50">{provider.name}</span>
                  <span className="text-[12px] font-medium">{provider.percentage}%</span>
                </div>
                <div className="w-full h-[6px] rounded-full bg-cf-elevated">
                  <div
                    className={`h-full rounded-full transition-all ${
                      provider.percentage >= 90
                        ? "bg-cf-green"
                        : provider.percentage >= 80
                        ? "bg-cf-amber"
                        : "bg-red-400"
                    }`}
                    style={{ width: `${provider.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
