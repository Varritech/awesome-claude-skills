"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Skeleton } from "@/components/ui";
import { PlusIcon, MoreHorizontalIcon } from "@/components/icons";
import { apiGet, apiPost } from "@/lib/api-client";

type EmailStatus = "draft" | "queued" | "sent" | "opened" | "replied" | "bounced";
type Persona = "closer" | "neighbor" | "expert" | "helper";

interface EmailRecord {
  id: string;
  subject: string;
  body: string;
  persona: Persona;
  status: EmailStatus;
  scheduledFor?: string | null;
  sentAt?: string | null;
  createdAt: string;
  leadId?: string | null;
}

interface CampaignRecord {
  id: string;
  name: string;
  status: string;
  persona: string;
}

const campaignStatusBadge: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-white/[0.04]", text: "text-white/35", label: "Draft" },
  scheduled: { bg: "bg-cf-indigo/15", text: "text-cf-indigo", label: "Scheduled" },
  running: { bg: "bg-cf-green/15", text: "text-cf-green", label: "Running" },
  paused: { bg: "bg-cf-amber/15", text: "text-cf-amber", label: "Paused" },
  completed: { bg: "bg-white/[0.04]", text: "text-white/35", label: "Completed" },
  archived: { bg: "bg-white/[0.04]", text: "text-white/35", label: "Archived" },
};

const statusConfig: Record<EmailStatus, { label: string; bg: string; text: string }> = {
  draft:   { label: "Draft",   bg: "bg-white/[0.04]",   text: "text-white/35" },
  queued:  { label: "Scheduled · 8:00 AM", bg: "bg-cf-indigo/15", text: "text-cf-indigo" },
  sent:    { label: "Sent",    bg: "bg-white/[0.06]",   text: "text-white/40" },
  opened:  { label: "Opened",  bg: "bg-cf-amber/15",    text: "text-cf-amber" },
  replied: { label: "Replied", bg: "bg-cf-green/15",    text: "text-cf-green" },
  bounced: { label: "Bounced", bg: "bg-red-500/15",     text: "text-red-400" },
};

const personaLabel: Record<Persona, string> = {
  closer:   "The Closer",
  neighbor: "The Neighbor",
  expert:   "The Expert",
  helper:   "The Helper",
};

const filters = ["All", "Scheduled", "Sent", "Replied", "Draft"];

function formatScheduledDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function EmailsPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [creating, setCreating] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadEmails() {
      try {
        const res = await apiGet<{ data: EmailRecord[] }>("/api/emails");
        if (cancelled) return;
        const items = Array.isArray(res) ? res : (res?.data ?? []);

        if (items.length === 0) {
          // No emails yet — auto-draft from leads, then reload once
          try {
            await apiPost("/api/emails/auto-draft", {});
          } catch {
            // auto-draft failed (e.g. Ollama not reachable) — show empty state
          }
          if (cancelled) return;
          const res2 = await apiGet<{ data: EmailRecord[] }>("/api/emails");
          if (cancelled) return;
          setEmails(Array.isArray(res2) ? res2 : (res2?.data ?? []));
        } else {
          setEmails(items);
        }
      } catch (err) {
        console.error("Failed to load emails", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadCampaigns() {
      try {
        const res = await apiGet<{ data: CampaignRecord[] }>("/api/campaigns");
        if (cancelled) return;
        setCampaigns(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load campaigns", err);
      }
    }

    loadEmails();
    loadCampaigns();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNewCampaign = async () => {
    if (creatingCampaign) return;
    setCreatingCampaign(true);
    try {
      const res = await apiPost<{ data: { id: string } }>("/api/campaigns", {
        name: "New campaign",
        persona: "closer",
      });
      const id = res?.data?.id ?? (res as { id?: string })?.id;
      if (id) router.push(`/campaigns/${id}`);
    } catch (err) {
      console.error("Failed to create campaign", err);
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handleNewEmail = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await apiPost<{ data: { id: string } }>("/api/emails", {
        subject: "New email",
        body: "",
        persona: "neighbor",
      });
      const id = res?.data?.id ?? (res as { id?: string })?.id;
      if (id) router.push(`/emails/${id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const filterMap: Record<string, (e: EmailRecord) => boolean> = {
    All:       () => true,
    Scheduled: (e) => e.status === "queued",
    Sent:      (e) => e.status === "sent" || e.status === "opened",
    Replied:   (e) => e.status === "replied",
    Draft:     (e) => e.status === "draft",
  };

  const filtered = emails.filter(filterMap[activeFilter] ?? (() => true));

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight font-heading">Your Emails</h1>
          <p className="text-[13px] text-white/25 mt-1">
            Drafts are scheduled to send at 8:00 AM
          </p>
        </div>
        <button
          onClick={handleNewEmail}
          disabled={creating}
          className="px-5 py-2.5 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2 font-heading uppercase tracking-wide disabled:opacity-60"
        >
          <PlusIcon size={16} />
          {creating ? "Creating..." : "New Email"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-[var(--radius-pill)] text-[13px] font-medium transition-colors ${
              filter === activeFilter
                ? "bg-cf-orange text-white"
                : "bg-white/[0.04] text-white/35 hover:bg-white/[0.08]"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" rounded="lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-[14px] text-white/40 mb-4">
            {emails.length === 0
              ? "Drafting your first emails from leads..."
              : `No emails with filter "${activeFilter}".`}
          </p>
          {emails.length === 0 && (
            <button
              onClick={handleNewEmail}
              disabled={creating}
              className="px-5 py-2.5 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-sm font-bold hover:opacity-90 transition-opacity inline-flex items-center gap-2 font-heading uppercase tracking-wide disabled:opacity-60"
            >
              <PlusIcon size={16} />
              Write your first email
            </button>
          )}
        </Card>
      )}

      {/* Email list */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((email) => {
            const config = statusConfig[email.status] ?? statusConfig.draft;
            const schedDate = email.scheduledFor ? formatScheduledDate(email.scheduledFor) : null;
            return (
              <Card
                key={email.id}
                className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => router.push(`/emails/${email.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className="text-[14px] font-bold font-heading truncate">{email.subject}</h3>
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-[var(--radius-pill)] text-[11px] font-medium ${config.bg} ${config.text}`}>
                        {config.label}
                        {email.status === "queued" && schedDate ? ` · ${schedDate}` : ""}
                      </span>
                    </div>
                    <p className="text-[12px] text-white/20 line-clamp-2 leading-relaxed">
                      {email.body.replace(/\{\{firstName\}\}/g, "there")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button className="text-white/20 hover:text-white/40" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontalIcon size={16} />
                    </button>
                    <span className="text-[11px] text-white/20">
                      {personaLabel[email.persona] ?? email.persona}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Campaigns — multi-step sequences, on the same tab as emails */}
      {!loading && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[18px] font-bold tracking-tight font-heading">Campaigns</h2>
              <p className="text-[12px] text-white/25 mt-0.5">
                Multi-step email sequences. Generate with AI, add leads, start.
              </p>
            </div>
            <button
              onClick={handleNewCampaign}
              disabled={creatingCampaign}
              className="px-4 py-2 rounded-[var(--radius-button)] bg-cf-card border border-white/[0.06] text-white text-[13px] font-bold hover:bg-white/[0.04] transition-colors flex items-center gap-2 font-heading uppercase tracking-wide disabled:opacity-60"
            >
              <PlusIcon size={14} />
              {creatingCampaign ? "Creating..." : "New campaign"}
            </button>
          </div>

          {campaigns.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-[13px] text-white/30">
                No campaigns yet. Create one to author its email sequence.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {campaigns.map((c) => {
                const badge = campaignStatusBadge[c.status] ?? campaignStatusBadge.draft!;
                return (
                  <Card
                    key={c.id}
                    className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => router.push(`/campaigns/${c.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[14px] font-bold truncate">{c.name}</p>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-[var(--radius-pill)] ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
