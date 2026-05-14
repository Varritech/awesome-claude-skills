"use client";

import { useEffect, useState, useRef } from "react";
import { Card, Skeleton } from "@/components/ui";
import { apiGet } from "@/lib/api-client";

type EventType = "sent" | "opened" | "replied" | "bounced";

interface FeedEvent {
  type: EventType;
  leadName: string;
  campaignName: string;
  timestamp: string;
}

const EVENT_CONFIG: Record<EventType, { label: string; color: string; bg: string; icon: string }> = {
  sent: { label: "Sent", color: "text-white/40", bg: "bg-white/[0.06]", icon: "→" },
  opened: { label: "Opened", color: "text-cf-green", bg: "bg-cf-green/10", icon: "👁" },
  replied: { label: "Replied", color: "text-cf-orange", bg: "bg-cf-orange/10", icon: "↩" },
  bounced: { label: "Bounced", color: "text-red-400", bg: "bg-red-500/10", icon: "✕" },
};

function relativeTime(isoStr: string): string {
  if (!isoStr) return "—";
  const diff = Date.now() - new Date(isoStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityFeedPage() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFeed = () =>
    apiGet<{ events: FeedEvent[] }>("/api/analytics/feed")
      .then((res) => {
        setEvents(res?.events ?? []);
      })
      .catch((err) => {
        console.error("Failed to fetch activity feed", err);
      });

  useEffect(() => {
    let cancelled = false;
    fetchFeed().finally(() => {
      if (!cancelled) setLoading(false);
    });

    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(() => {
      if (!cancelled) fetchFeed();
    }, 30_000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (loading) {
    return (
      <>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <Skeleton className="h-96" rounded="lg" />
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight font-heading">Activity Feed</h1>
        <p className="text-[13px] text-white/25 mt-1">
          Real-time email events · refreshes every 30s
        </p>
      </div>

      <Card>
        {events.length === 0 && (
          <p className="text-[13px] text-white/30 py-6 text-center">No email activity yet.</p>
        )}
        <div className="flex flex-col">
          {events.map((event, i) => {
            const config = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.sent;
            return (
              <div
                key={`${event.type}-${event.timestamp}-${i}`}
                className={`flex items-center gap-3 py-3 ${
                  i < events.length - 1 ? "border-b border-white/[0.04]" : ""
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-[var(--radius-icon)] ${config.bg} flex items-center justify-center text-[11px] font-bold ${config.color} shrink-0`}
                >
                  {config.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px]">
                    <span className={`font-bold ${config.color}`}>{config.label}</span>
                    {" · "}
                    <span className="text-white/70">{event.leadName}</span>
                    {" in "}
                    <span className="text-white/50 truncate">{event.campaignName}</span>
                  </p>
                </div>
                <span className="text-[11px] text-white/25 shrink-0 font-mono">
                  {relativeTime(event.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
