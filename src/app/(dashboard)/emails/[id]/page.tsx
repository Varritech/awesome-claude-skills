"use client";

import { Card } from "@/components/ui";
import {
  ChevronLeftIcon,
} from "@/components/icons";

const emails = [
  {
    id: 1,
    recipient: "Mike Thompson",
    company: "Thompson Roofing",
    subject: "Quick question about your roofing",
    status: "replied" as const,
    lastActivity: "2h ago",
    preview: "Yeah we've been looking for a roofer. Can you come by Thursday?",
  },
  {
    id: 2,
    recipient: "Sarah Chen",
    company: "Chen Homes",
    subject: "Roofing estimate for your property",
    status: "replied" as const,
    lastActivity: "5h ago",
    preview: "Send me a quote for the whole house. 2,400 sq ft.",
  },
  {
    id: 3,
    recipient: "Dave Morrison",
    company: "Morrison Property",
    subject: "Your roof inspection results",
    status: "opened" as const,
    lastActivity: "1d ago",
    preview: "",
  },
  {
    id: 4,
    recipient: "Lisa Park",
    company: "Parkview Realty",
    subject: "Quick question about your roofing",
    status: "opened" as const,
    lastActivity: "2d ago",
    preview: "",
  },
  {
    id: 5,
    recipient: "Tom Williams",
    company: "Williams & Sons",
    subject: "Roofing estimate for your property",
    status: "sent" as const,
    lastActivity: "3d ago",
    preview: "",
  },
  {
    id: 6,
    recipient: "Amy Roberts",
    company: "Roberts Construction",
    subject: "Your roof inspection results",
    status: "bounced" as const,
    lastActivity: "3d ago",
    preview: "",
  },
];

const statusConfig = {
  replied: { label: "Replied", bg: "bg-cf-mint/15", text: "text-cf-green", dot: "bg-cf-green" },
  opened: { label: "Opened", bg: "bg-cf-amber/15", text: "text-cf-amber", dot: "bg-cf-amber" },
  sent: { label: "Sent", bg: "bg-white/[0.04]", text: "text-white/35", dot: "bg-white/20" },
  bounced: { label: "Bounced", bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400" },
};

const filters = ["All", "Replied", "Opened", "Sent", "Bounced"];

export default function EmailDetailPage() {
  return (
    <>
      {/* Back link */}
      <a
        href="/emails"
        className="flex items-center gap-1.5 text-[13px] text-white/30 hover:text-white/50 transition-colors mb-5"
      >
        <ChevronLeftIcon size={16} />
        Back to Emails
      </a>

      {/* Header card */}
      <Card className="mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight font-heading">
              Roofing - Dallas
            </h1>
            <p className="text-[13px] text-white/25 mt-1">
              The Closer style &middot; Started Apr 10
            </p>
          </div>
          <span className="px-3 py-1 rounded-[var(--radius-pill)] text-[11px] font-medium bg-cf-green/15 text-cf-green">
            Active
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] text-white/20">Sent</p>
            <p className="text-[20px] font-bold font-mono">18/25</p>
          </div>
          <div>
            <p className="text-[11px] text-white/20">Replied</p>
            <p className="text-[20px] font-bold font-mono">4</p>
          </div>
          <div>
            <p className="text-[11px] text-white/20">Interested</p>
            <p className="text-[20px] font-bold text-cf-green font-mono">2</p>
          </div>
          <div>
            <p className="text-[11px] text-white/20">Open Rate</p>
            <p className="text-[20px] font-bold font-mono">68%</p>
          </div>
        </div>
      </Card>

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

      {/* Email list */}
      <div className="flex flex-col gap-2">
        {emails.map((email) => {
          const config = statusConfig[email.status];
          return (
            <Card key={email.id} className="cursor-pointer hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    email.status === "replied"
                      ? "bg-gradient-to-br from-cf-orange to-[#FB923C]"
                      : "bg-cf-elevated text-white/30"
                  }`}
                >
                  {email.recipient
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold">{email.recipient}</span>
                    <span
                      className={`text-[11px] px-2.5 py-1 rounded-[var(--radius-pill)] font-medium ${config.bg} ${config.text}`}
                    >
                      {config.label}
                    </span>
                  </div>
                  <p className="text-[12px] text-white/20 mt-0.5">
                    {email.subject}
                  </p>
                  {email.preview && (
                    <p className="text-[12px] text-white/25 mt-1 truncate">
                      {email.preview}
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-white/15 shrink-0">
                  {email.lastActivity}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
