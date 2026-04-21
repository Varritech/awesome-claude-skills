"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Skeleton } from "@/components/ui";
import { ChevronLeftIcon } from "@/components/icons";
import { apiGet, apiStream } from "@/lib/api-client";

type EmailStatus = "replied" | "opened" | "sent" | "bounced";

interface EmailItem {
  id: string | number;
  recipient: string;
  company?: string;
  subject: string;
  status: EmailStatus;
  lastActivity: string;
  preview?: string;
}

interface EmailCampaignDetail {
  id: string;
  name: string;
  style: string;
  status: "active" | "warming" | "paused" | "done" | "draft";
  startedAt?: string;
  sent: number;
  total: number;
  replied: number;
  interested: number;
  openRate: string;
  emails: EmailItem[];
}

const statusConfig: Record<EmailStatus, { label: string; bg: string; text: string; dot: string }> = {
  replied: { label: "Replied", bg: "bg-cf-mint/15", text: "text-cf-green", dot: "bg-cf-green" },
  opened: { label: "Opened", bg: "bg-cf-amber/15", text: "text-cf-amber", dot: "bg-cf-amber" },
  sent: { label: "Sent", bg: "bg-white/[0.04]", text: "text-white/35", dot: "bg-white/20" },
  bounced: { label: "Bounced", bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400" },
};

const campaignStatusBadge: Record<EmailCampaignDetail["status"], { bg: string; text: string; label: string }> = {
  active: { bg: "bg-cf-green/15", text: "text-cf-green", label: "Active" },
  warming: { bg: "bg-cf-amber/15", text: "text-cf-amber", label: "Warming" },
  paused: { bg: "bg-cf-indigo/15", text: "text-cf-indigo", label: "Paused" },
  done: { bg: "bg-white/6", text: "text-white/35", label: "Done" },
  draft: { bg: "bg-white/[0.04]", text: "text-white/35", label: "Draft" },
};

const filters = ["All", "Replied", "Opened", "Sent", "Bounced"];

export default function EmailDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [campaign, setCampaign] = useState<EmailCampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [regenerating, setRegenerating] = useState(false);
  const [regenerated, setRegenerated] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    apiGet<EmailCampaignDetail>(`/api/emails/${id}`)
      .then((data) => {
        if (cancelled) return;
        setCampaign(data ?? null);
      })
      .catch((err) => {
        console.error("Failed to load email", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleRegenerate = async () => {
    if (!id || regenerating) return;
    setRegenerating(true);
    setRegenerated("");
    try {
      const stream = apiStream<{ response?: string; done?: boolean; error?: string }>(
        `/api/emails/${id}/generate`,
      );
      for await (const chunk of stream) {
        if (chunk.error) {
          console.error("Stream error", chunk.error);
          break;
        }
        if (chunk.response) {
          setRegenerated((prev) => prev + chunk.response);
        }
        if (chunk.done) break;
      }
    } catch (err) {
      console.error("Regenerate failed", err);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <>
        <Skeleton className="h-4 w-32 mb-5" />
        <Skeleton className="h-40 mb-5" rounded="lg" />
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" rounded="lg" />
          ))}
        </div>
      </>
    );
  }

  if (!campaign) {
    return (
      <>
        <a
          href="/emails"
          className="flex items-center gap-1.5 text-[13px] text-white/30 hover:text-white/50 transition-colors mb-5"
        >
          <ChevronLeftIcon size={16} />
          Back to Emails
        </a>
        <Card>
          <p className="text-[14px] text-white/50">Email campaign not found.</p>
        </Card>
      </>
    );
  }

  const filtered =
    filter === "All"
      ? campaign.emails
      : campaign.emails.filter((e) => e.status === filter.toLowerCase());

  const badge = campaignStatusBadge[campaign.status] ?? campaignStatusBadge.draft;

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
              {campaign.name}
            </h1>
            <p className="text-[13px] text-white/25 mt-1">
              {campaign.style} style
              {campaign.startedAt && ` \u00B7 Started ${campaign.startedAt}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="px-3 py-1.5 rounded-[var(--radius-pill)] text-[11px] font-medium bg-cf-orange/15 text-cf-orange hover:bg-cf-orange/25 transition-colors disabled:opacity-60"
            >
              {regenerating ? "Regenerating..." : "Regenerate"}
            </button>
            <span className={`px-3 py-1 rounded-[var(--radius-pill)] text-[11px] font-medium ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] text-white/20">Sent</p>
            <p className="text-[20px] font-bold font-mono">{campaign.sent}/{campaign.total}</p>
          </div>
          <div>
            <p className="text-[11px] text-white/20">Replied</p>
            <p className="text-[20px] font-bold font-mono">{campaign.replied}</p>
          </div>
          <div>
            <p className="text-[11px] text-white/20">Interested</p>
            <p className="text-[20px] font-bold text-cf-green font-mono">{campaign.interested}</p>
          </div>
          <div>
            <p className="text-[11px] text-white/20">Open Rate</p>
            <p className="text-[20px] font-bold font-mono">{campaign.openRate}</p>
          </div>
        </div>
      </Card>

      {/* Streaming regenerated preview */}
      {(regenerating || regenerated) && (
        <Card className="mb-5">
          <p className="text-sm font-bold mb-2 font-heading">Regenerated Draft</p>
          <pre className="text-[13px] text-white/60 whitespace-pre-wrap font-sans leading-relaxed">
            {regenerated || "..."}
          </pre>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-[var(--radius-pill)] text-[13px] font-medium transition-colors ${
              f === filter
                ? "bg-cf-orange text-white"
                : "bg-white/[0.04] text-white/35 hover:bg-white/[0.08]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Email list */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <Card>
            <p className="text-[13px] text-white/40">No emails match this filter.</p>
          </Card>
        )}
        {filtered.map((email) => {
          const config = statusConfig[email.status] ?? statusConfig.sent;
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
