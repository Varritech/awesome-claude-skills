"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { MetricCard, ActionCard, Card, Skeleton } from "@/components/ui";
import { MiniRing, Sparkline, BarChart, Gauge, RingProgress } from "@/components/charts";
import {
  MailIcon,
  UsersIcon,
  PenIcon,
} from "@/components/icons";
import { apiGet } from "@/lib/api-client";

interface OnboardingState {
  completed?: boolean;
  onboardingSkipped?: boolean;
}

interface WeekdayDatum {
  label: string;
  value: number;
  isHighlighted?: boolean;
}

interface EmailCampaignStatus {
  name: string;
  status: "active" | "warming" | "draft" | "paused" | "done";
}

interface Reply {
  initials: string;
  name: string;
  badge: string;
  badgeColor: "mint" | "default";
  preview: string;
  time: string;
}

interface AnalyticsData {
  sent: number;
  dailyLimit: number;
  sentPercent: number;
  replies: number;
  repliesChangePercent: number;
  repliesPercent: number;
  interested: number;
  interestedNew: number;
  interestedTrend: number[];
  calls: number;
  callsTrend: number[];
  weekData: WeekdayDatum[];
  campaigns: EmailCampaignStatus[];
  inboxHealth: number;
  inboxHealthLabel: string;
  sendCompletionPercent: number;
  recentReplies: Reply[];
}

const statusDotClass: Record<EmailCampaignStatus["status"], string> = {
  active: "bg-cf-green",
  warming: "bg-cf-amber",
  draft: "bg-cf-indigo",
  paused: "bg-cf-indigo",
  done: "bg-white/30",
};

const statusLabel: Record<EmailCampaignStatus["status"], string> = {
  active: "Active",
  warming: "Warming",
  draft: "Draft",
  paused: "Paused",
  done: "Done",
};

function DashboardSkeleton() {
  return (
    <>
      <Skeleton className="h-7 w-48 mb-2" />
      <Skeleton className="h-4 w-72 mb-7" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" rounded="lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <Skeleton className="h-40" rounded="lg" />
        <Skeleton className="h-40" rounded="lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <Skeleton className="h-56" rounded="lg" />
        <Skeleton className="h-56" rounded="lg" />
        <Skeleton className="h-56" rounded="lg" />
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { user } = useUser();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetupBanner, setShowSetupBanner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<AnalyticsData>("/api/analytics?timeRange=today")
      .then((res) => {
        if (cancelled) return;
        setData(res ?? null);
      })
      .catch((err) => {
        console.error("Failed to load analytics", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Check onboarding status for setup banner
    apiGet<OnboardingState>("/api/user/onboarding")
      .then((state) => {
        if (cancelled) return;
        if (!state?.completed && !state?.onboardingSkipped) {
          setShowSetupBanner(true);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const firstName = user?.firstName ?? "there";
  const sent = data?.sent ?? 0;
  const dailyLimit = data?.dailyLimit ?? 50;
  const sentPercent = data?.sentPercent ?? 0;
  const replies = data?.replies ?? 0;
  const repliesChangePercent = data?.repliesChangePercent ?? 0;
  const repliesPercent = data?.repliesPercent ?? 0;
  const interested = data?.interested ?? 0;
  const interestedNew = data?.interestedNew ?? 0;
  const interestedTrend = data?.interestedTrend ?? [0, 0, 0, 0, 0, 0, 0];
  const calls = data?.calls ?? 0;
  const callsTrend = data?.callsTrend ?? [0, 0, 0, 0, 0, 0, 0];
  const weekData = data?.weekData ?? [];
  const campaigns = data?.campaigns ?? [];
  const inboxHealth = data?.inboxHealth ?? 0;
  const inboxHealthLabel = data?.inboxHealthLabel ?? "Unknown";
  const sendCompletionPercent = data?.sendCompletionPercent ?? 0;
  const recentReplies = data?.recentReplies ?? [];

  return (
    <>
      {/* Header */}
      <h1 className="text-[22px] font-bold tracking-tight font-heading">Hey there, {firstName}!</h1>
      <p className="text-[13px] text-white/25 mt-1 mb-7">
        Your emails are working. Here&apos;s what happened today.
      </p>

      {/* Setup banner */}
      {showSetupBanner && (
        <div className="bg-cf-orange/10 border border-cf-orange/20 rounded-[var(--radius-button)] px-5 py-3.5 flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
            <p className="text-[13px] text-white/70">
              Complete your setup to unlock sending.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="shrink-0 px-3.5 py-1.5 rounded-[var(--radius-pill)] bg-cf-orange text-white text-[12px] font-bold whitespace-nowrap"
          >
            Finish Setup
          </Link>
        </div>
      )}

      {/* Inline tip */}
      <div className="bg-cf-elevated rounded-[var(--radius-button)] pl-5 pr-4 py-3.5 border-l-[3px] border-cf-orange flex items-start gap-2.5 mb-5">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#F97316"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 mt-0.5"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <p className="text-[13px] text-white/50 leading-relaxed flex-1">
          Your emails are sending automatically. When someone replies, you&apos;ll see it here. No need to check back every hour.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard
          label="Emails Sent"
          value={String(sent)}
          subtitle={`of ${dailyLimit} today`}
          accent="orange"
          chart={<MiniRing percentage={sentPercent} label={`${sentPercent}%`} color="#F97316" />}
        />
        <MetricCard
          label="Replies"
          value={String(replies)}
          subtitle={`${repliesChangePercent >= 0 ? "+" : ""}${repliesChangePercent}% vs last week`}
          accent="green"
          chart={<MiniRing percentage={repliesPercent} label={`${repliesPercent}%`} color="#22C55E" />}
        />
        <MetricCard
          label="Interested"
          value={String(interested)}
          subtitle={`+${interestedNew} new`}
          accent="amber"
          chart={
            <Sparkline
              data={interestedTrend}
              color="#F59E0B"
              width={48}
              height={36}
            />
          }
        />
        <Card variant="mint" className="!text-cf-card">
          <p className="text-[11px] text-black/35">Calls Booked</p>
          <div className="flex items-end justify-between mt-3">
            <div>
              <p className="text-[36px] font-bold tracking-tighter leading-none font-mono">
                {calls}
              </p>
              <p className="text-[11px] text-black/30 mt-1.5">booked today</p>
            </div>
            <Sparkline
              data={callsTrend}
              color="rgba(0,0,0,0.2)"
              width={48}
              height={24}
            />
          </div>
        </Card>
      </div>

      {/* Two column: Actions + Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {/* Left: Action cards */}
        <div className="flex flex-col gap-2">
          <ActionCard
            icon={<MailIcon size={18} className="text-white/50" />}
            title="Send New Emails"
            description="Start a new batch"
            href="/emails"
          />
          <ActionCard
            icon={<UsersIcon size={18} className="text-white/50" />}
            title="Find Customers"
            description="Browse leads in your area"
            href="/customers"
          />
          <ActionCard
            icon={<PenIcon size={18} className="text-white/50" />}
            title="Email Styles"
            description="Pick your writing persona"
            href="/styles"
          />
        </div>

        {/* Right: Chart */}
        <Card>
          <div className="flex justify-between items-center mb-5">
            <p className="text-sm font-bold font-heading">Email Performance</p>
            <div className="flex gap-[3px] cursor-pointer">
              <div className="w-1 h-1 rounded-full bg-white/30" />
              <div className="w-1 h-1 rounded-full bg-white/30" />
              <div className="w-1 h-1 rounded-full bg-white/30" />
            </div>
          </div>
          <BarChart data={weekData} />
        </Card>
      </div>

      {/* Bottom row: Status + Replies + Gauge */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {/* Email Status */}
        <Card>
          <p className="text-sm font-bold mb-5 font-heading">Your Emails</p>
          <div className="flex flex-col gap-3.5">
            {campaigns.length === 0 && (
              <p className="text-[12px] text-white/30">No campaigns yet.</p>
            )}
            {campaigns.map((campaign) => (
              <div key={campaign.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${statusDotClass[campaign.status]}`} />
                  <span className="text-[13px] font-medium text-white/50">{campaign.name}</span>
                </div>
                <span className="text-[11px] text-white/20">{statusLabel[campaign.status]}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-5">
            <RingProgress percentage={sendCompletionPercent} color="#D4E4DD" />
          </div>
        </Card>

        {/* Recent Replies */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm font-bold font-heading">Recent Replies</p>
            <div className="flex gap-[3px] cursor-pointer">
              <div className="w-1 h-1 rounded-full bg-white/30" />
              <div className="w-1 h-1 rounded-full bg-white/30" />
              <div className="w-1 h-1 rounded-full bg-white/30" />
            </div>
          </div>
          {recentReplies.length === 0 && (
            <p className="text-[12px] text-white/30">No replies yet.</p>
          )}
          {recentReplies.map((reply, i) => (
            <div
              key={`${reply.name}-${i}`}
              className={`flex items-center gap-3 py-3 cursor-pointer ${
                i < recentReplies.length - 1 ? "border-b border-white/[0.04]" : ""
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  reply.badgeColor === "mint"
                    ? "bg-gradient-to-br from-cf-orange to-[#FB923C]"
                    : "bg-cf-elevated text-white/30"
                }`}
              >
                {reply.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold">{reply.name}</span>
                  <span
                    className={`text-[12px] px-3.5 py-1.5 rounded-cf-pill font-medium ${
                      reply.badgeColor === "mint"
                        ? "bg-cf-mint text-cf-card"
                        : "bg-white/6 text-white/35"
                    }`}
                  >
                    {reply.badge}
                  </span>
                </div>
                <p className="text-[12px] text-white/25 mt-1 truncate">{reply.preview}</p>
              </div>
              <span className="text-[11px] text-white/15 shrink-0">{reply.time}</span>
            </div>
          ))}
        </Card>

        {/* Inbox Health */}
        <Card className="flex flex-col items-center">
          <p className="text-sm font-bold mb-4 self-start font-heading">Inbox Health</p>
          <Gauge value={inboxHealth} statusText={inboxHealthLabel} />
        </Card>
      </div>

      {/* Scale CTA */}
      <Card
        variant="orange"
        className="flex items-center justify-between gap-5 max-md:flex-col max-md:text-center"
      >
        <div>
          <h3 className="text-lg font-bold tracking-tight font-heading">
            Want to send more emails?
          </h3>
          <p className="text-[13px] text-white/30">
            Book a quick call and we&apos;ll set you up with a bigger plan.
          </p>
        </div>
        <a
          href="https://cal.com/varritech/convergeflow-intro"
          target="_blank"
          rel="noopener noreferrer"
          className="px-7 py-3 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-sm font-bold font-heading uppercase tracking-wide shrink-0 hover:opacity-90 transition-opacity"
        >
          Book a Call
        </a>
      </Card>
    </>
  );
}
