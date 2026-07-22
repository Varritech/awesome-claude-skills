"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Skeleton } from "@/components/ui";
import { ChevronLeftIcon } from "@/components/icons";
import { SequenceEditor } from "@/components/SequenceEditor";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";

interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  persona: string;
  description?: string;
  sequenceId?: string;
  emails?: Array<{ id: string; subject: string; status: string }>;
}

interface LeadOption {
  id: string;
  firstName?: string;
  company?: string;
}

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-white/[0.04]", text: "text-white/35", label: "Draft" },
  scheduled: { bg: "bg-cf-indigo/15", text: "text-cf-indigo", label: "Scheduled" },
  running: { bg: "bg-cf-green/15", text: "text-cf-green", label: "Running" },
  paused: { bg: "bg-cf-amber/15", text: "text-cf-amber", label: "Paused" },
  completed: { bg: "bg-white/[0.04]", text: "text-white/35", label: "Completed" },
  archived: { bg: "bg-white/[0.04]", text: "text-white/35", label: "Archived" },
};

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  // Leads
  const [campaignLeads, setCampaignLeads] = useState<LeadOption[]>([]);
  const [availableLeads, setAvailableLeads] = useState<LeadOption[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [attaching, setAttaching] = useState(false);

  const refreshLeads = async () => {
    try {
      const [attached, all] = await Promise.all([
        apiGet<{ data: LeadOption[] }>(`/api/campaigns/${id}/leads`),
        apiGet<{ data: LeadOption[] }>("/api/leads?limit=50"),
      ]);
      setCampaignLeads(Array.isArray(attached?.data) ? attached.data : []);
      setAvailableLeads(Array.isArray(all?.data) ? all.data : []);
    } catch (err) {
      console.error("Failed to load leads", err);
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    apiGet<{ data: CampaignDetail }>(`/api/campaigns/${id}`)
      .then((res) => {
        if (!cancelled) setCampaign(res?.data ?? null);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    refreshLeads();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleStart = async () => {
    if (starting || !campaign) return;
    setStarting(true);
    try {
      await apiPost(`/api/campaigns/${id}/start`, {});
      await apiGet<{ data: CampaignDetail }>(`/api/campaigns/${id}`).then((res) =>
        setCampaign(res?.data ?? campaign),
      );
    } catch (err) {
      console.error("Failed to start campaign", err);
    } finally {
      setStarting(false);
    }
  };

  const handleSequenceSaved = async (sequenceId: string) => {
    try {
      await apiPatch(`/api/campaigns/${id}`, { sequenceId });
      setCampaign((prev) => (prev ? { ...prev, sequenceId } : prev));
    } catch (err) {
      console.error("Failed to link sequence to campaign", err);
    }
  };

  const toggleLead = (leadId: string) =>
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });

  const handleAttachLeads = async () => {
    if (attaching || selectedLeadIds.size === 0) return;
    setAttaching(true);
    try {
      await apiPost(`/api/campaigns/${id}/leads`, { leadIds: [...selectedLeadIds] });
      setSelectedLeadIds(new Set());
      await refreshLeads();
    } catch (err) {
      console.error("Failed to attach leads", err);
    } finally {
      setAttaching(false);
    }
  };

  if (loading) {
    return (
      <>
        <Skeleton className="h-7 w-48 mb-7" />
        <Skeleton className="h-40 mb-4" rounded="lg" />
      </>
    );
  }

  if (!campaign) {
    return (
      <Card>
        <p className="text-[13px] text-white/30 text-center py-4">Campaign not found.</p>
      </Card>
    );
  }

  const badge = statusBadge[campaign.status] ?? statusBadge.draft!;

  return (
    <>
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-[13px] text-white/40 hover:text-white/70 mb-5 transition-colors"
      >
        <ChevronLeftIcon size={16} />
        Campaigns
      </Link>

      <Card className="mb-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold tracking-tight font-heading truncate">
              {campaign.name}
            </h1>
            {campaign.description && (
              <p className="text-[12px] text-white/40 mt-1">{campaign.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-[var(--radius-pill)] ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
            <button
              type="button"
              onClick={handleStart}
              disabled={starting || campaign.status === "running"}
              className="bg-cf-orange text-white text-sm font-bold py-2 px-4 rounded-[12px] disabled:opacity-40 font-heading uppercase tracking-wide"
            >
              {starting ? "Starting…" : "Start campaign"}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <p className="text-sm font-bold mb-2 font-heading">Sequence</p>
        <p className="text-[12px] text-white/40 leading-relaxed mb-4">
          Author the multi-step email series for this campaign. Use AI-generate to draft a
          5-email Straight Line sequence from a lead, then tweak + save.
        </p>
        <SequenceEditor
          sequenceId={campaign.sequenceId}
          campaignId={campaign.id}
          onSaved={handleSequenceSaved}
        />
      </Card>

      <Card className="mt-5">
        <p className="text-sm font-bold mb-2 font-heading">
          Leads · {campaignLeads.length} in this campaign
        </p>
        <p className="text-[12px] text-white/40 leading-relaxed mb-4">
          Add leads to this campaign. When started, the sequence sends to these leads.
        </p>

        {campaignLeads.length > 0 && (
          <ul className="flex flex-col gap-1 mb-4">
            {campaignLeads.map((l) => (
              <li key={l.id} className="text-[12px] text-white/55">
                {l.firstName ?? "Lead"}{l.company ? ` · ${l.company}` : ""}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] font-bold uppercase tracking-wide text-white/40 mb-2">
          Add leads
        </p>
        {availableLeads.length === 0 ? (
          <p className="text-[12px] text-white/30">
            No leads available. Add leads under Customers first.
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto mb-3">
              {availableLeads.map((l) => {
                const checked = selectedLeadIds.has(l.id);
                return (
                  <li key={l.id}>
                    <label className="flex items-center gap-2 text-[12px] text-white/55 cursor-pointer hover:text-white/80">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLead(l.id)}
                        aria-label={`${l.firstName ?? "Lead"}${l.company ? ` ${l.company}` : ""}`}
                        className="accent-cf-orange"
                      />
                      {l.firstName ?? "Lead"}{l.company ? ` · ${l.company}` : ""}
                    </label>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={handleAttachLeads}
              disabled={attaching || selectedLeadIds.size === 0}
              className="bg-cf-orange text-white text-sm font-bold py-2 px-4 rounded-[12px] disabled:opacity-40 font-heading uppercase tracking-wide"
            >
              {attaching ? "Adding…" : "Add to campaign"}
            </button>
          </>
        )}
      </Card>
    </>
  );
}