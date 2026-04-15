"use client";

import { MetricCard, ActionCard, Card } from "@/components/ui";
import { MiniRing, Sparkline, BarChart, Gauge, RingProgress } from "@/components/charts";
import {
  MailIcon,
  UsersIcon,
  PenIcon,
} from "@/components/icons";

export default function DashboardPage() {
  const weekData = [
    { label: "Mon", value: 25, isHighlighted: false },
    { label: "Tue", value: 40, isHighlighted: false },
    { label: "Wed", value: 55, isHighlighted: false },
    { label: "Thu", value: 42, isHighlighted: true },
    { label: "Fri", value: 35, isHighlighted: false },
    { label: "Sat", value: 20, isHighlighted: false },
  ];

  return (
    <>
      {/* Header */}
      <h1 className="text-[22px] font-bold tracking-tight font-heading">Hey there, Jake!</h1>
      <p className="text-[13px] text-white/25 mt-1 mb-7">
        Your emails are working. Here&apos;s what happened today.
      </p>

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
          value="42"
          subtitle="of 50 today"
          accent="orange"
          chart={<MiniRing percentage={68} label="68%" color="#F97316" />}
        />
        <MetricCard
          label="Replies"
          value="7"
          subtitle="+43% vs last week"
          accent="green"
          chart={<MiniRing percentage={33} label="33%" color="#22C55E" />}
        />
        <MetricCard
          label="Interested"
          value="3"
          subtitle="+1 new"
          accent="amber"
          chart={
            <Sparkline
              data={[30, 50, 20, 65, 40, 80, 100]}
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
                1
              </p>
              <p className="text-[11px] text-black/30 mt-1.5">booked today</p>
            </div>
            <Sparkline
              data={[20, 35, 25, 50, 40, 65, 55]}
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
          />
          <ActionCard
            icon={<UsersIcon size={18} className="text-white/50" />}
            title="Find Customers"
            description="Browse leads in your area"
          />
          <ActionCard
            icon={<PenIcon size={18} className="text-white/50" />}
            title="Email Styles"
            description="Pick your writing persona"
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-cf-green" />
                <span className="text-[13px] font-medium text-white/50">Roofing - Dallas</span>
              </div>
              <span className="text-[11px] text-white/20">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-cf-amber" />
                <span className="text-[13px] font-medium text-white/50">Gutters - Ft Worth</span>
              </div>
              <span className="text-[11px] text-white/20">Warming</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-cf-indigo" />
                <span className="text-[13px] font-medium text-white/50">Solar - Austin</span>
              </div>
              <span className="text-[11px] text-white/20">Draft</span>
            </div>
          </div>
          <div className="flex justify-center mt-5">
            <RingProgress percentage={66} color="#D4E4DD" />
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
          {[
            { initials: "MT", name: "Mike Thompson", badge: "Interested", badgeColor: "mint" as const, preview: "Yeah we've been looking for a roofer. Can you come by Thursday?", time: "2h" },
            { initials: "SC", name: "Sarah Chen", badge: "Interested", badgeColor: "mint" as const, preview: "Send me a quote for the whole house. 2,400 sq ft.", time: "5h" },
            { initials: "DM", name: "Dave Morrison", badge: "Not Now", badgeColor: "default" as const, preview: "Not right now but maybe in the spring.", time: "1d" },
          ].map((reply, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 py-3 cursor-pointer ${
                i < 2 ? "border-b border-white/[0.04]" : ""
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
          <Gauge value={90} statusText="Great" />
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
        <button className="px-7 py-3 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-sm font-bold font-heading uppercase tracking-wide shrink-0 hover:opacity-90 transition-opacity">
          Book a Call
        </button>
      </Card>
    </>
  );
}