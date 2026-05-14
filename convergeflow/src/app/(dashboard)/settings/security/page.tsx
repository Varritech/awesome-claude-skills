"use client";

import { useEffect, useState } from "react";
import { Card, Skeleton } from "@/components/ui";
import { apiGet } from "@/lib/api-client";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  severity: "critical" | "high" | "medium" | "low";
}

interface ChecklistData {
  items: ChecklistItem[];
  score: number;
  passedCount: number;
  total: number;
}

const severityColor: Record<ChecklistItem["severity"], string> = {
  critical: "text-red-400",
  high: "text-cf-amber",
  medium: "text-cf-orange",
  low: "text-white/40",
};

const severityBg: Record<ChecklistItem["severity"], string> = {
  critical: "bg-red-500/10",
  high: "bg-cf-amber/10",
  medium: "bg-cf-orange/10",
  low: "bg-white/5",
};

export default function SecurityChecklistPage() {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiGet<ChecklistData>("/api/security/checklist")
      .then((res) => {
        if (!cancelled) setData(res ?? null);
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
        <Skeleton className="h-24 mb-5" rounded="lg" />
        <Skeleton className="h-96" rounded="lg" />
      </>
    );
  }

  const score = data?.score ?? 0;
  const passedCount = data?.passedCount ?? 0;
  const total = data?.total ?? 0;
  const items = data?.items ?? [];

  const scoreColor =
    score >= 80 ? "text-cf-green" : score >= 50 ? "text-cf-amber" : "text-red-400";
  const scoreBg =
    score >= 80 ? "bg-cf-green/10" : score >= 50 ? "bg-cf-amber/10" : "bg-red-500/10";

  return (
    <>
      <h1 className="text-[22px] font-bold tracking-tight mb-7 font-heading">
        Security Checklist
      </h1>

      {/* Score card */}
      <Card className={`mb-5 ${scoreBg}`}>
        <div className="flex items-center gap-5">
          <div className={`text-[48px] font-bold font-mono leading-none ${scoreColor}`}>
            {score}
          </div>
          <div>
            <p className="text-[15px] font-bold font-heading">Security Score</p>
            <p className="text-[12px] text-white/30">
              {passedCount} of {total} checks passing
            </p>
          </div>
          <div className="ml-auto">
            <div className="w-16 h-16 relative">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle
                  cx="18" cy="18" r="15.9"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="3"
                />
                <circle
                  cx="18" cy="18" r="15.9"
                  fill="none"
                  stroke={score >= 80 ? "#22C55E" : score >= 50 ? "#F59E0B" : "#F87171"}
                  strokeWidth="3"
                  strokeDasharray={`${score} ${100 - score}`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </Card>

      {/* Checklist items */}
      <Card>
        <p className="text-sm font-bold mb-4 font-heading">Security Checks</p>
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-3 rounded-[12px] ${severityBg[item.severity]}`}
            >
              {/* Status icon */}
              <div className="mt-0.5 shrink-0">
                {item.passed ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <path d="m9 11 3 3L22 4" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m15 9-6 6M9 9l6 6" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[13px] font-medium">{item.label}</p>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-[5px] uppercase tracking-wide ${severityBg[item.severity]} ${severityColor[item.severity]}`}
                  >
                    {item.severity}
                  </span>
                </div>
                <p className="text-[12px] text-white/30 leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
