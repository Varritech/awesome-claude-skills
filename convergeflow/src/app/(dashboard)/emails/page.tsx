"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Skeleton } from "@/components/ui";
import { PlusIcon, MoreHorizontalIcon } from "@/components/icons";
import { apiGet, apiPost } from "@/lib/api-client";

type CampaignStatus = "active" | "warming" | "paused" | "done" | "draft";

interface EmailSet {
  id: string | number;
  name: string;
  style: string;
  status: CampaignStatus;
  sent: number;
  total: number;
  replies: number;
  interested: number;
}


const statusConfig: Record<CampaignStatus, { label: string; bg: string; text: string }> = {
  active: { label: "Active", bg: "bg-cf-green/15", text: "text-cf-green" },
  warming: { label: "Warming", bg: "bg-cf-amber/15", text: "text-cf-amber" },
  paused: { label: "Paused", bg: "bg-cf-indigo/15", text: "text-cf-indigo" },
  done: { label: "Done", bg: "bg-white/6", text: "text-white/35" },
  draft: { label: "Draft", bg: "bg-white/[0.04]", text: "text-white/35" },
};

const filters = ["All", "Active", "Warming", "Paused", "Done"];

export default function EmailsPage() {
  const router = useRouter();
  const [emailSets, setEmailSets] = useState<EmailSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<EmailSet[]>("/api/emails")
      .then((res) => {
        if (cancelled) return;
        setEmailSets(Array.isArray(res) ? res : []);
      })
      .catch((err) => {
        console.error("Failed to load emails", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNewCampaign = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await apiPost<{ id: string }>("/api/emails", {});
      if (res?.id) {
        router.push(`/emails/${res.id}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const filtered =
    activeFilter === "All"
      ? emailSets
      : emailSets.filter((s) => s.status === activeFilter.toLowerCase());

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight font-heading">Your Emails</h1>
          <p className="text-[13px] text-white/25 mt-1">
            Manage your email campaigns
          </p>
        </div>
        <button
          onClick={handleNewCampaign}
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
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" rounded="lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-[14px] text-white/40 mb-4">
            {emailSets.length === 0
              ? "No email campaigns yet."
              : `No campaigns with status "${activeFilter}".`}
          </p>
          {emailSets.length === 0 && (
            <button
              onClick={handleNewCampaign}
              disabled={creating}
              className="px-5 py-2.5 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-sm font-bold hover:opacity-90 transition-opacity inline-flex items-center gap-2 font-heading uppercase tracking-wide disabled:opacity-60"
            >
              <PlusIcon size={16} />
              Start your first campaign
            </button>
          )}
        </Card>
      )}

      {/* Email set cards */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((set) => {
            const config = statusConfig[set.status] ?? statusConfig.draft;
            const progress = set.total > 0 ? (set.sent / set.total) * 100 : 0;
            return (
              <Card
                key={set.id}
                className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => router.push(`/emails/${set.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-[15px] font-bold font-heading">{set.name}</h3>
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
                  <button className="text-white/20 hover:text-white/40" onClick={(e) => e.stopPropagation()}>
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
                    <span className="font-medium font-mono">
                      {set.sent}/{set.total}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/20">Replies</span>{" "}
                    <span className="font-medium font-mono">{set.replies}</span>
                  </div>
                  <div>
                    <span className="text-white/20">Interested</span>{" "}
                    <span className="font-medium text-cf-green font-mono">{set.interested}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
