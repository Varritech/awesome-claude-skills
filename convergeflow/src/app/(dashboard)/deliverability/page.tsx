"use client";

import { useEffect, useState } from "react";
import { Card, Toggle, Skeleton } from "@/components/ui";
import { Gauge } from "@/components/charts";
import {
  ShieldIcon,
  CheckIcon,
  XIcon,
  AlertIcon,
  GlobeIcon,
  RefreshIcon,
} from "@/components/icons";
import { apiGet } from "@/lib/api-client";

type DnsStatus = "valid" | "warning" | "invalid";
type BlacklistStatus = "clean" | "listed";

interface DnsRecord {
  type: string;
  value: string;
  status: DnsStatus;
}

interface BlacklistCheck {
  name: string;
  status: BlacklistStatus;
}

interface InboxProvider {
  name: string;
  percentage: number;
}

interface DeliverabilityData {
  dnsRecords: DnsRecord[];
  blacklistChecks: BlacklistCheck[];
  inboxProviders: InboxProvider[];
  inboxHealth: number;
  inboxHealthLabel: string;
  trackingDomainEnabled: boolean;
  trackingDomain?: string;
}

const statusIcons: Record<DnsStatus, { icon: typeof CheckIcon; color: string; bg: string; label: string }> = {
  valid: { icon: CheckIcon, color: "text-cf-green", bg: "bg-cf-green/15", label: "Valid" },
  warning: { icon: AlertIcon, color: "text-cf-amber", bg: "bg-cf-amber/15", label: "Warning" },
  invalid: { icon: XIcon, color: "text-red-400", bg: "bg-red-500/15", label: "Invalid" },
};

const blackListStatusConfig: Record<BlacklistStatus, { label: string; color: string; dot: string }> = {
  clean: { label: "Clean", color: "text-cf-green", dot: "bg-cf-green" },
  listed: { label: "Listed", color: "text-red-400", dot: "bg-red-400" },
};

export default function DeliverabilityPage() {
  const [data, setData] = useState<DeliverabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(false);

  const load = () => {
    return apiGet<DeliverabilityData>("/api/deliverability")
      .then((res) => {
        setData(res ?? null);
      })
      .catch((err) => {
        console.error("Failed to load deliverability", err);
      });
  };

  useEffect(() => {
    let cancelled = false;
    apiGet<DeliverabilityData>("/api/deliverability")
      .then((res) => {
        if (cancelled) return;
        setData(res ?? null);
        setTrackingEnabled(res?.trackingDomainEnabled ?? false);
      })
      .catch((err) => {
        console.error("Failed to load deliverability", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-72 mb-6" />
        <Skeleton className="h-64 mb-5" rounded="lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <Skeleton className="h-56" rounded="lg" />
          <Skeleton className="h-56" rounded="lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <Skeleton className="h-40" rounded="lg" />
          <Skeleton className="h-40" rounded="lg" />
        </div>
      </>
    );
  }

  const dnsRecords = data?.dnsRecords ?? [];
  const blacklistChecks = data?.blacklistChecks ?? [];
  const inboxProviders = data?.inboxProviders ?? [];
  const inboxHealth = data?.inboxHealth ?? 0;
  const inboxHealthLabel = data?.inboxHealthLabel ?? "Unknown";
  const trackingDomain = data?.trackingDomain;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight font-heading">Deliverability</h1>
        <p className="text-[13px] text-white/25 mt-1">
          Monitor your email health and DNS setup
        </p>
      </div>

      {/* DNS Records */}
      <Card className="mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldIcon size={18} className="text-white/30" />
            <p className="text-sm font-bold font-heading">DNS Records</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-[13px] text-cf-orange hover:opacity-80 transition-opacity flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshIcon size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <div className="flex flex-col">
          {dnsRecords.length === 0 && (
            <p className="text-[12px] text-white/30 py-2">No DNS records configured.</p>
          )}
          {dnsRecords.map((record, i) => {
            const config = statusIcons[record.status] ?? statusIcons.warning;
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
                <span className={`text-[11px] font-medium ${config.color}`}>
                  {config.label}
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
          <p className="text-sm font-bold mb-4 self-start font-heading">Inbox Health</p>
          <Gauge value={inboxHealth} statusText={inboxHealthLabel} />
        </Card>

        {/* Blacklist Check */}
        <Card>
          <p className="text-sm font-bold mb-4 font-heading">Blacklist Check</p>
          <div className="flex flex-col gap-3">
            {blacklistChecks.length === 0 && (
              <p className="text-[12px] text-white/30">No blacklist data yet.</p>
            )}
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
            <p className="text-sm font-bold font-heading">Tracking Domain</p>
            <Toggle
              checked={trackingEnabled}
              onChange={(checked) => {
                setTrackingEnabled(checked);
                // TODO: PATCH /api/deliverability/tracking when real endpoint exists
              }}
            />
          </div>
          <p className="text-[12px] text-white/25 leading-relaxed">
            Use a custom domain for tracking links and opens. This improves deliverability
            by keeping your brand consistent.
          </p>
          {trackingDomain && (
            <div className="mt-4 flex items-center gap-2">
              <GlobeIcon size={14} className="text-white/20" />
              <span className="text-[13px] text-white/50">{trackingDomain}</span>
            </div>
          )}
        </Card>

        <Card>
          <p className="text-sm font-bold mb-4 font-heading">Inbox Placement</p>
          <div className="flex flex-col gap-3">
            {inboxProviders.length === 0 && (
              <p className="text-[12px] text-white/30">No placement data yet.</p>
            )}
            {inboxProviders.map((provider) => (
              <div key={provider.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-white/50">{provider.name}</span>
                  <span className="text-[12px] font-medium font-mono">{provider.percentage}%</span>
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
