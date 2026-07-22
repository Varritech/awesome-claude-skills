"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Skeleton } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { apiGet, apiPost } from "@/lib/api-client";

interface Campaign {
  id: string;
  name: string;
  status: string;
  persona: string;
  description?: string;
}

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-white/[0.04]", text: "text-white/35", label: "Draft" },
  scheduled: { bg: "bg-cf-indigo/15", text: "text-cf-indigo", label: "Scheduled" },
  running: { bg: "bg-cf-green/15", text: "text-cf-green", label: "Running" },
  paused: { bg: "bg-cf-amber/15", text: "text-cf-amber", label: "Paused" },
  completed: { bg: "bg-white/[0.04]", text: "text-white/35", label: "Completed" },
  archived: { bg: "bg-white/[0.04]", text: "text-white/35", label: "Archived" },
};

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ data: Campaign[] }>("/api/campaigns")
      .then((res) => {
        if (!cancelled) setCampaigns(res?.data ?? []);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNew = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await apiPost<{ data: Campaign }>("/api/campaigns", {
        name: "New campaign",
        persona: "closer",
      });
      if (res?.data?.id) router.push(`/campaigns/${res.data.id}`);
    } catch (err) {
      console.error("Failed to create campaign", err);
      setCreating(false);
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

  return (
    <>
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-[22px] font-bold tracking-tight font-heading">Campaigns</h1>
        <button
          type="button"
          onClick={handleNew}
          disabled={creating}
          className="flex items-center gap-1.5 bg-cf-orange text-white text-sm font-bold py-2 px-3.5 rounded-[12px] disabled:opacity-40 font-heading uppercase tracking-wide"
        >
          <PlusIcon size={14} />
          {creating ? "Creating…" : "New campaign"}
        </button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <p className="text-[13px] text-white/30 text-center py-4">
            No campaigns yet. Create one to author its email sequence.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {campaigns.map((c) => {
            const badge = statusBadge[c.status] ?? statusBadge.draft!;
            return (
              <Card
                key={c.id}
                className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => router.push(`/campaigns/${c.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold truncate">{c.name}</p>
                    {c.description && (
                      <p className="text-[12px] text-white/40 truncate">{c.description}</p>
                    )}
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-[var(--radius-pill)] ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}