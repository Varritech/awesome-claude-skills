"use client";

import { useEffect, useState } from "react";
import { MetricCard, Card, Skeleton } from "@/components/ui";
import { MiniRing, BarChart, DonutChart, Sparkline } from "@/components/charts";
import { apiGet } from "@/lib/api-client";

interface WeekdayDatum {
  label: string;
  value: number;
  isHighlighted?: boolean;
}

interface AnalyticsTableRow {
  name: string;
  sent: number;
  opened: number;
  replied: number;
  rate: string;
}

interface AnalyticsData {
  totalSent: number;
  totalSentChangePercent: number;
  totalSentPercent: number;
  opened: number;
  openRatePercent: number;
  openRateLabel: string;
  replied: number;
  repliedChange: number;
  repliedTrend: number[];
  booked: number;
  bookedTrend: number[];
  weekData: WeekdayDatum[];
  replyBreakdown: { value: number; color: string; label: string }[];
  replyRate: string;
  tableData: AnalyticsTableRow[];
}

const dateFilters = [
  { id: "7D", label: "7D" },
  { id: "14D", label: "14D" },
  { id: "30D", label: "30D" },
  { id: "90D", label: "90D" },
];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7D");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet<AnalyticsData>(`/api/analytics?timeRange=${timeRange}`)
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
    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  if (loading) {
    return (
      <>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-72 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" rounded="lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <Skeleton className="md:col-span-2 h-64" rounded="lg" />
          <Skeleton className="h-64" rounded="lg" />
        </div>
        <Skeleton className="h-48" rounded="lg" />
      </>
    );
  }

  const totalSent = data?.totalSent ?? 0;
  const totalSentChangePercent = data?.totalSentChangePercent ?? 0;
  const totalSentPercent = data?.totalSentPercent ?? 0;
  const opened = data?.opened ?? 0;
  const openRatePercent = data?.openRatePercent ?? 0;
  const openRateLabel = data?.openRateLabel ?? `${openRatePercent}% open rate`;
  const replied = data?.replied ?? 0;
  const repliedChange = data?.repliedChange ?? 0;
  const repliedTrend = data?.repliedTrend ?? [0, 0, 0, 0, 0, 0, 0];
  const booked = data?.booked ?? 0;
  const bookedTrend = data?.bookedTrend ?? [0, 0, 0, 0, 0, 0, 0];
  const weekData = data?.weekData ?? [];
  const replyBreakdown = data?.replyBreakdown ?? [];
  const replyRate = data?.replyRate ?? "0%";
  const tableData = data?.tableData ?? [];

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
              key={filter.id}
              onClick={() => setTimeRange(filter.id)}
              className={`px-3.5 py-1.5 rounded-[var(--radius-pill)] text-[12px] font-medium transition-colors ${
                filter.id === timeRange
                  ? "bg-cf-orange text-white"
                  : "bg-white/[0.04] text-white/35 hover:bg-white/[0.08]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard
          label="Total Sent"
          value={String(totalSent)}
          subtitle={`${totalSentChangePercent >= 0 ? "+" : ""}${totalSentChangePercent}% vs last`}
          accent="orange"
          chart={<MiniRing percentage={totalSentPercent} label={`${totalSentPercent}%`} color="#F97316" />}
        />
        <MetricCard
          label="Opened"
          value={String(opened)}
          subtitle={openRateLabel}
          accent="green"
          chart={<MiniRing percentage={openRatePercent} label={`${openRatePercent}%`} color="#22C55E" />}
        />
        <MetricCard
          label="Replied"
          value={String(replied)}
          subtitle={`${repliedChange >= 0 ? "+" : ""}${repliedChange} from last week`}
          accent="amber"
          chart={
            <Sparkline
              data={repliedTrend}
              color="#F59E0B"
              width={48}
              height={36}
            />
          }
        />
        <MetricCard
          label="Booked"
          value={String(booked)}
          subtitle="from replies"
          accent="orange"
          chart={
            <Sparkline
              data={bookedTrend}
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
            segments={replyBreakdown.length > 0 ? replyBreakdown : [{ value: 1, color: "#222228", label: "No data" }]}
            size={120}
            strokeWidth={14}
            centerLabel={replyRate}
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
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-white/30">
                    No campaigns in this time range.
                  </td>
                </tr>
              )}
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
