"use client";

import { useEffect, useState } from "react";
import { Card, Skeleton } from "@/components/ui";
import { MailIcon } from "@/components/icons";
import { apiGet } from "@/lib/api-client";

interface InboxHealth {
  id: string;
  email: string;
  displayName?: string;
  provider: string;
  status: string;
  warmupEnabled: boolean;
  warmupProgressPercent: number;
  dailyQuotaUsed: number;
  dailyQuotaTotal: number;
  bounceRate: number;
  lastSentAt?: string;
  statusBadge: "healthy" | "warming" | "warning" | "error";
}

const statusBadgeStyle: Record<InboxHealth["statusBadge"], { bg: string; text: string; label: string }> = {
  healthy: { bg: "bg-cf-green/15", text: "text-cf-green", label: "Healthy" },
  warming: { bg: "bg-cf-amber/15", text: "text-cf-amber", label: "Warming" },
  warning: { bg: "bg-cf-orange/15", text: "text-cf-orange", label: "Warning" },
  error: { bg: "bg-red-500/15", text: "text-red-400", label: "Error" },
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function InboxHealthPage() {
  const [inboxes, setInboxes] = useState<InboxHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiGet<InboxHealth[]>("/api/inboxes/health")
      .then((res) => {
        if (!cancelled) setInboxes(res ?? []);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <>
        <Skeleton className="h-7 w-48 mb-7" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 mb-4" rounded="lg" />
        ))}
      </>
    );
  }

  return (
    <>
      <h1 className="text-[22px] font-bold tracking-tight mb-7 font-heading">
        Inbox Health
      </h1>

      {inboxes.length === 0 && (
        <Card>
          <p className="text-[13px] text-white/30 text-center py-4">
            No inboxes found. Connect an inbox in Settings.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {inboxes.map((inbox) => {
          const badge = statusBadgeStyle[inbox.statusBadge];
          const quotaPct = inbox.dailyQuotaTotal > 0
            ? Math.round((inbox.dailyQuotaUsed / inbox.dailyQuotaTotal) * 100)
            : 0;

          return (
            <Card key={inbox.id}>
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-[var(--radius-icon)] bg-cf-elevated flex items-center justify-center shrink-0">
                  <MailIcon size={16} className="text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold truncate">
                    {inbox.displayName ?? inbox.email}
                  </p>
                  <p className="text-[11px] text-white/25">{inbox.email} &middot; {inbox.provider}</p>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-[var(--radius-pill)] ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Warmup progress */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] text-white/30">Warmup Progress</span>
                    <span className="text-[11px] font-medium text-white/50">
                      {inbox.warmupProgressPercent}%
                    </span>
                  </div>
                  <ProgressBar
                    value={inbox.warmupProgressPercent}
                    max={100}
                    color="bg-cf-mint"
                  />
                </div>

                {/* Daily quota */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] text-white/30">Daily Quota</span>
                    <span className="text-[11px] font-medium text-white/50">
                      {inbox.dailyQuotaUsed} / {inbox.dailyQuotaTotal}
                    </span>
                  </div>
                  <ProgressBar
                    value={inbox.dailyQuotaUsed}
                    max={inbox.dailyQuotaTotal}
                    color={quotaPct > 90 ? "bg-cf-amber" : "bg-cf-orange"}
                  />
                </div>
              </div>

              {/* Bottom stats */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/[0.04]">
                <div>
                  <p className="text-[10px] text-white/20 mb-0.5">Bounce Rate</p>
                  <p className={`text-[13px] font-medium ${inbox.bounceRate > 0.1 ? "text-cf-amber" : "text-white/50"}`}>
                    {(inbox.bounceRate * 100).toFixed(1)}%
                  </p>
                </div>
                {inbox.lastSentAt && (
                  <div>
                    <p className="text-[10px] text-white/20 mb-0.5">Last Send</p>
                    <p className="text-[13px] font-medium text-white/50">
                      {new Date(inbox.lastSentAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-white/20 mb-0.5">Warmup</p>
                  <p className="text-[13px] font-medium text-white/50">
                    {inbox.warmupEnabled ? "On" : "Off"}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
