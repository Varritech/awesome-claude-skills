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
    </>
  );
}