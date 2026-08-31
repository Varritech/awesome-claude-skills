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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DnsStatus = "valid" | "warning" | "invalid";
type BlacklistStatus = "clean" | "listed";
type RecommendationSeverity = "critical" | "warning" | "info";

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

interface PerInbox {
  id: string;
  email: string;
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  bounceRate: number;
  complaintRate: number;
}

interface BounceTrendPoint {
  date: string;
  rate: number;
}

interface Recommendation {
  id: string;
  severity: RecommendationSeverity;
  title: string;
  description: string;
  action: string;
}

interface Alert {
  id: string;
  type: string;
  campaignId?: string;
  value?: number;
  createdAt: string;
}

interface DeliverabilityData {
  healthScore: number;
  inboxes: PerInbox[];
  bounceTrend: BounceTrendPoint[];
  dnsRecords: DnsRecord[];
  blacklistChecks: BlacklistCheck[];
  inboxProviders: InboxProvider[];
  inboxHealth: number;
  inboxHealthLabel: string;
  trackingDomainEnabled: boolean;
  trackingDomain?: string | null;
}

interface RecommendationsData {
  recommendations: Recommendation[];
}

interface AlertsData {
  alerts: Alert[];
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

const severityColors: Record<RecommendationSeverity, { bg: string; text: string; badge: string }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-400", badge: "bg-red-500/20 text-red-400" },
  warning: { bg: "bg-cf-amber/10", text: "text-cf-amber", badge: "bg-cf-amber/20 text-cf-amber" },
  info: { bg: "bg-white/[0.04]", text: "text-white/50", badge: "bg-white/10 text-white/50" },
};

function BoolBadge({ value, label }: { value: boolean; label: string }) {
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
        value ? "bg-cf-green/20 text-cf-green" : "bg-red-500/20 text-red-400"
      }`}
    >
      {label}
    </span>
  );
}

export default function DeliverabilityPage() {
  const [data, setData] = useState<DeliverabilityData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(false);

  const load = () => {
    return Promise.all([
      apiGet<DeliverabilityData>("/api/deliverability"),
      apiGet<RecommendationsData>("/api/deliverability/recommendations"),
      apiGet<AlertsData>("/api/alerts"),
    ])
      .then(([delivData, recData, alertData]) => {
        setData(delivData ?? null);
        setTrackingEnabled(delivData?.trackingDomainEnabled ?? false);
        setRecommendations(recData?.recommendations ?? []);
        setAlerts(alertData?.alerts ?? []);
      })
      .catch((err) => {
        console.error("Failed to load deliverability", err);
      });
  };

  useEffect(() => {
    let cancelled = false;
    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <Skeleton className="h-24 mb-3" rounded="lg" />
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
  const inboxHealth = data?.inboxHealth ?? data?.healthScore ?? 0;
  const inboxHealthLabel = data?.inboxHealthLabel ?? "Unknown";
  const trackingDomain = data?.trackingDomain;
  const inboxes = data?.inboxes ?? [];
  const bounceTrend = data?.bounceTrend ?? [];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight font-heading">Deliverability</h1>
          <p className="text-[13px] text-white/25 mt-1">
            Monitor your email health and DNS setup
          </p>
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

      {/* Alert banner */}
      {alerts.length > 0 && (
        <div className="mb-5 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertIcon size={16} className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-red-400">
              {alerts.length} active alert{alerts.length > 1 ? "s" : ""}
            </p>
            {alerts.slice(0, 2).map((a) => (
              <p key={a.id} className="text-[12px] text-white/40 mt-0.5">
                {a.type === "high_bounce"
                  ? `High bounce rate (${((a.value ?? 0) * 100).toFixed(1)}%)${a.campaignId ? ` on campaign ${a.campaignId}` : ""}`
                  : a.type}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* DNS Records */}
      <Card className="mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldIcon size={18} className="text-white/30" />
            <p className="text-sm font-bold font-heading">DNS Records</p>
          </div>
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

      {/* Bounce Rate Trend */}
      {bounceTrend.length > 0 && (
        <Card className="mb-5">
          <p className="text-sm font-bold mb-4 font-heading">Bounce Rate Trend (7 days)</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={bounceTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                tickFormatter={(v: string) => v.slice(5)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                tickFormatter={(v: number) => `${v}%`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                itemStyle={{ color: "#F59E0B" }}
                formatter={(v: number) => [`${v}%`, "Bounce rate"]}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#F59E0B" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Per-inbox status */}
      {inboxes.length > 0 && (
        <Card className="mb-5">
          <p className="text-sm font-bold mb-4 font-heading">Inbox Status</p>
          <div className="flex flex-col gap-3">
            {inboxes.map((inbox, i) => (
              <div
                key={inbox.id}
                className={`flex items-center justify-between py-3 ${
                  i < inboxes.length - 1 ? "border-b border-white/[0.04]" : ""
                }`}
              >
                <div>
                  <p className="text-[13px] font-medium">{inbox.email}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    Bounce: {(inbox.bounceRate * 100).toFixed(1)}% · Complaint: {(inbox.complaintRate * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <BoolBadge value={inbox.spf} label="SPF" />
                  <BoolBadge value={inbox.dkim} label="DKIM" />
                  <BoolBadge value={inbox.dmarc} label="DMARC" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <p className="text-sm font-bold mb-4 font-heading">Recommendations</p>
          <div className="flex flex-col gap-3">
            {recommendations.map((rec) => {
              const colors = severityColors[rec.severity];
              return (
                <div
                  key={rec.id}
                  className={`rounded-lg p-3 ${colors.bg}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${colors.badge}`}>
                      {rec.severity}
                    </span>
                    <p className="text-[13px] font-bold">{rec.title}</p>
                  </div>
                  <p className="text-[12px] text-white/40 mb-1.5">{rec.description}</p>
                  <p className="text-[11px] text-white/25 italic">{rec.action}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}
