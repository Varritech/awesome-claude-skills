"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Skeleton } from "@/components/ui";
import { ChevronLeftIcon } from "@/components/icons";
import { apiGet, apiPatch, apiStream } from "@/lib/api-client";

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
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [markingInterested, setMarkingInterested] = useState(false);
  const [markedInterested, setMarkedInterested] = useState<Set<string | number>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

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

  const openPanel = (email: EmailItem) => {
    setSelectedEmail(email);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setTimeout(() => setSelectedEmail(null), 300);
  };

  const handleMarkInterested = async () => {
    if (!selectedEmail || markingInterested) return;
    setMarkingInterested(true);
    try {
      await apiPatch(`/api/emails/${selectedEmail.id}`, { status: "replied", interested: true });
      setMarkedInterested((prev) => new Set(prev).add(selectedEmail.id));
    } catch (err) {
      console.error("Failed to mark as interested", err);
    } finally {
      setMarkingInterested(false);
    }
  };

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
            <Card key={email.id} className="cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => openPanel(email)}>
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

      {/* Backdrop */}
      {panelOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={closePanel}
          aria-hidden="true"
        />
      )}

      {/* Thread side panel */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-[#1B1B1F] shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-out ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selectedEmail && (() => {
          const config = statusConfig[selectedEmail.status] ?? statusConfig.sent;
          const isReplied = selectedEmail.status === "replied";
          const alreadyInterested = markedInterested.has(selectedEmail.id);
          return (
            <>
              {/* Panel header */}
              <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isReplied
                        ? "bg-gradient-to-br from-cf-orange to-[#FB923C]"
                        : "bg-cf-elevated text-white/30"
                    }`}
                  >
                    {selectedEmail.recipient
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold truncate">{selectedEmail.recipient}</p>
                    {selectedEmail.company && (
                      <p className="text-[12px] text-white/30 truncate">{selectedEmail.company}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span
                    className={`text-[11px] px-2.5 py-1 rounded-[var(--radius-pill)] font-medium ${config.bg} ${config.text}`}
                  >
                    {config.label}
                  </span>
                  <button
                    onClick={closePanel}
                    aria-label="Close panel"
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition-colors text-white/50 hover:text-white"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Thread body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {/* Last activity */}
                <p className="text-[11px] text-white/20">{selectedEmail.lastActivity}</p>

                {/* Sent email bubble */}
                <div className="bg-cf-elevated rounded-xl rounded-tl-sm px-4 py-3">
                  <p className="text-[11px] text-white/25 mb-1.5 font-medium">You sent</p>
                  <p className="text-[13px] text-white/70 leading-relaxed">
                    {selectedEmail.preview ?? "Email content loading..."}
                  </p>
                </div>

                {/* Reply bubble (if replied) */}
                {isReplied && (
                  <div className="bg-cf-mint/10 border border-cf-mint/20 rounded-xl rounded-tr-sm px-4 py-3 self-end w-full">
                    <p className="text-[11px] text-cf-green/70 mb-1.5 font-medium">
                      {selectedEmail.recipient} replied
                    </p>
                    <p className="text-[13px] text-white/60 leading-relaxed">
                      Reply received. Full content available in your inbox.
                    </p>
                  </div>
                )}
              </div>

              {/* Panel footer */}
              {isReplied && (
                <div className="px-5 py-4 border-t border-white/[0.06]">
                  <button
                    onClick={handleMarkInterested}
                    disabled={markingInterested || alreadyInterested}
                    className={`w-full py-2.5 rounded-[var(--radius-pill)] text-[13px] font-medium transition-colors ${
                      alreadyInterested
                        ? "bg-cf-mint/20 text-cf-green cursor-default"
                        : "bg-cf-mint/15 text-cf-green hover:bg-cf-mint/25 disabled:opacity-60"
                    }`}
                  >
                    {alreadyInterested
                      ? "Marked as Interested"
                      : markingInterested
                      ? "Saving..."
                      : "Mark as Interested"}
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </>
  );
}
