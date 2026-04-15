"use client";

import { MetricCard, Card } from "@/components/ui";
import { MiniRing, BarChart, DonutChart, Sparkline } from "@/components/charts";

const weekData = [
  { label: "Mon", value: 45, isHighlighted: false },
  { label: "Tue", value: 62, isHighlighted: false },
  { label: "Wed", value: 78, isHighlighted: true },
  { label: "Thu", value: 55, isHighlighted: false },
  { label: "Fri", value: 90, isHighlighted: false },
  { label: "Sat", value: 35, isHighlighted: false },
  { label: "Sun", value: 20, isHighlighted: false },
];

const dateFilters = ["7D", "14D", "30D", "90D"];

const tableData = [
  { name: "Roofing - Dallas", sent: 42, opened: 28, replied: 7, rate: "68%" },
  { name: "Gutters - Ft Worth", sent: 25, opened: 15, replied: 3, rate: "52%" },
  { name: "Solar - Austin", sent: 18, opened: 12, replied: 2, rate: "44%" },
];

export default function AnalyticsPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight font-heading">Analytics</h1>
          <p className="text-[13px] text-white/25 mt-1">
            See how your emails are performing
          </p>
        </div>

        {/* Date range filters */}
        <div className="flex gap-2">
          {dateFilters.map((filter) => (
            <button
              key={filter}
              className={`px-3.5 py-1.5 rounded-[var(--radius-pill)] text-[12px] font-medium transition-colors ${
                filter === "7D"
                  ? "bg-cf-orange text-white"
                  : "bg-white/[0.04] text-white/35 hover:bg-white/[0.08]"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard
          label="Total Sent"
          value="85"
          subtitle="+12% vs last"
          accent="orange"
          chart={<MiniRing percentage={72} label="72%" color="#F97316" />}
        />
        <MetricCard
          label="Opened"
          value="55"
          subtitle="64.7% open rate"
          accent="green"
          chart={<MiniRing percentage={65} label="65%" color="#22C55E" />}
        />
        <MetricCard
          label="Replied"
          value="12"
          subtitle="+5 from last week"
          accent="amber"
          chart={
            <Sparkline
              data={[20, 45, 30, 65, 40, 80, 55]}
              color="#F59E0B"
              width={48}
              height={36}
            />
          }
        />
        <MetricCard
          label="Booked"
          value="3"
          subtitle="from replies"
          accent="orange"
          chart={
            <Sparkline
              data={[10, 20, 15, 30, 25, 40, 35]}
              color="#F97316"
              width={48}
              height={36}
            />
          }
        />
      </div>

      {/* Chart + Donut */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-bold font-heading">Sends Over Time</p>
            <div className="flex gap-[3px] cursor-pointer">
              <div className="w-1 h-1 rounded-full bg-white/30" />
              <div className="w-1 h-1 rounded-full bg-white/30" />
              <div className="w-1 h-1 rounded-full bg-white/30" />
            </div>
          </div>
          <BarChart data={weekData} />
        </Card>

        <Card className="flex flex-col items-center">
          <p className="text-sm font-bold mb-4 self-start font-heading">Reply Breakdown</p>
          <DonutChart
            segments={[
              { value: 45, color: "#22C55E", label: "Interested" },
              { value: 30, color: "#F59E0B", label: "Maybe" },
              { value: 25, color: "#222228", label: "Not Now" },
            ]}
            size={120}
            strokeWidth={14}
            centerLabel="42%"
            centerSublabel="reply rate"
          />
        </Card>
      </div>

      {/* Data table */}
      <Card>
        <p className="text-sm font-bold mb-4 font-heading">Campaign Details</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="text-left py-3 text-white/20 font-medium">Campaign</th>
                <th className="text-right py-3 text-white/20 font-medium">Sent</th>
                <th className="text-right py-3 text-white/20 font-medium">Opened</th>
                <th className="text-right py-3 text-white/20 font-medium">Replied</th>
                <th className="text-right py-3 text-white/20 font-medium">Open Rate</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row) => (
                <tr
                  key={row.name}
                  className="border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.02]"
                >
                  <td className="py-3 font-medium">{row.name}</td>
                  <td className="py-3 text-right text-white/50">{row.sent}</td>
                  <td className="py-3 text-right text-white/50">{row.opened}</td>
                  <td className="py-3 text-right text-white/50">{row.replied}</td>
                  <td className="py-3 text-right font-medium font-mono">{row.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
