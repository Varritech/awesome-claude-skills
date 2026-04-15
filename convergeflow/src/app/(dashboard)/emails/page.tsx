"use client";

import { Card } from "@/components/ui";
import {
  PlusIcon,
  MoreHorizontalIcon,
} from "@/components/icons";

const emailSets = [
  {
    id: 1,
    name: "Roofing - Dallas",
    style: "The Closer",
    status: "active" as const,
    sent: 18,
    total: 25,
    replies: 4,
    interested: 2,
  },
  {
    id: 2,
    name: "Gutters - Ft Worth",
    style: "The Neighbor",
    status: "warming" as const,
    sent: 12,
    total: 25,
    replies: 1,
    interested: 0,
  },
  {
    id: 3,
    name: "Solar - Austin",
    style: "The Expert",
    status: "paused" as const,
    sent: 8,
    total: 25,
    replies: 0,
    interested: 0,
  },
  {
    id: 4,
    name: "Windows - Plano",
    style: "The Helper",
    status: "done" as const,
    sent: 25,
    total: 25,
    replies: 6,
    interested: 3,
  },
];

const statusConfig = {
  active: { label: "Active", bg: "bg-cf-green/15", text: "text-cf-green" },
  warming: { label: "Warming", bg: "bg-cf-amber/15", text: "text-cf-amber" },
  paused: { label: "Paused", bg: "bg-cf-indigo/15", text: "text-cf-indigo" },
  done: { label: "Done", bg: "bg-white/6", text: "text-white/35" },
};

const filters = ["All", "Active", "Warming", "Paused", "Done"];

export default function EmailsPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Your Emails</h1>
          <p className="text-[13px] text-white/25 mt-1">
            Manage your email campaigns
          </p>
        </div>
        <button className="px-5 py-2.5 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2">
          <PlusIcon size={16} />
          New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {filters.map((filter) => (
          <button
            key={filter}
            className={`px-4 py-2 rounded-[var(--radius-pill)] text-[13px] font-medium transition-colors ${
              filter === "All"
                ? "bg-cf-orange text-white"
                : "bg-white/[0.04] text-white/35 hover:bg-white/[0.08]"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Email set cards */}
      <div className="flex flex-col gap-3">
        {emailSets.map((set) => {
          const config = statusConfig[set.status];
          const progress = (set.sent / set.total) * 100;
          return (
            <Card key={set.id} className="cursor-pointer hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-[15px] font-bold">{set.name}</h3>
                    <span
                      className={`px-3 py-1 rounded-[var(--radius-pill)] text-[11px] font-medium ${config.bg} ${config.text}`}
                    >
                      {config.label}
                    </span>
                  </div>
                  <p className="text-[12px] text-white/25 mt-1">
                    Style: {set.style}
                  </p>
                </div>
                <button className="text-white/20 hover:text-white/40">
                  <MoreHorizontalIcon size={18} />
                </button>
              </div>

              {/* Progress bar */}
              <div className="w-full h-[6px] rounded-full bg-cf-elevated mb-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cf-orange to-[#FB923C] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Stats */}
              <div className="flex gap-5 text-[12px]">
                <div>
                  <span className="text-white/20">Sent</span>{" "}
                  <span className="font-medium">
                    {set.sent}/{set.total}
                  </span>
                </div>
                <div>
                  <span className="text-white/20">Replies</span>{" "}
                  <span className="font-medium">{set.replies}</span>
                </div>
                <div>
                  <span className="text-white/20">Interested</span>{" "}
                  <span className="font-medium text-cf-green">{set.interested}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
