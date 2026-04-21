"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Skeleton } from "@/components/ui";
import { PlusIcon, MoreHorizontalIcon } from "@/components/icons";
import { apiGet, apiPost } from "@/lib/api-client";

type CampaignStatus = "active" | "warming" | "paused" | "done" | "draft";
type Persona = "closer" | "neighbor" | "expert" | "helper";

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

const PERSONAS: { id: Persona; label: string; description: string; icon: string }[] = [
  { id: "closer", label: "Closer", description: "Direct, results-driven, closing-focused", icon: "🎯" },
  { id: "neighbor", label: "Neighbor", description: "Warm, casual, friendly and relatable", icon: "👋" },
  { id: "expert", label: "Expert", description: "Authoritative, data-backed, credible", icon: "🧠" },
  { id: "helper", label: "Helper", description: "Empathetic, supportive, problem-solving", icon: "🤝" },
];

function NewCampaignModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (campaign: EmailSet) => void;
}) {
  const [name, setName] = useState("");
  const [persona, setPersona] = useState<Persona>("closer");
  const [targetLeadCount, setTargetLeadCount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiPost<EmailSet>("/api/campaigns", {
        name: name.trim(),
        persona,
        targetLeadCount: targetLeadCount ? Number(targetLeadCount) : undefined,
      });
      if (res) {
        onCreated(res);
      }
    } catch (err) {
      console.error("Failed to create campaign", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#1B1B1F] rounded-t-[24px] md:rounded-[24px] w-full max-w-lg p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-bold font-heading">New Email Set</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] text-white/40 hover:bg-white/[0.10] hover:text-white/70 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Campaign name */}
        <div className="mb-5">
          <label className="text-[11px] text-white/20 mb-1.5 block">Campaign name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q2 Outreach — SaaS Founders"
            className="w-full bg-[#222228] rounded-[14px] px-4 py-3 text-sm text-white outline-none focus:ring-1 focus:ring-cf-orange placeholder:text-white/20"
          />
        </div>

        {/* Persona picker */}
        <div className="mb-5">
          <label className="text-[11px] text-white/20 mb-2 block">Pick a style</label>
          <div className="grid grid-cols-2 gap-2.5">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPersona(p.id)}
                className={`flex flex-col items-start gap-1 p-3.5 rounded-[14px] text-left transition-colors ${
                  persona === p.id
                    ? "bg-cf-orange/10 ring-1 ring-cf-orange"
                    : "bg-[#222228] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[18px] leading-none">{p.icon}</span>
                  <span className="text-[13px] font-bold font-heading">{p.label}</span>
                </div>
                <p className="text-[11px] text-white/30 leading-snug">{p.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Target count */}
        <div className="mb-7">
          <label className="text-[11px] text-white/20 mb-1.5 block">Target lead count</label>
          <input
            type="number"
            value={targetLeadCount}
            onChange={(e) => setTargetLeadCount(e.target.value)}
            placeholder="How many leads to target?"
            min="1"
            className="w-full bg-[#222228] rounded-[14px] px-4 py-3 text-sm text-white outline-none focus:ring-1 focus:ring-cf-orange placeholder:text-white/20"
          />
        </div>

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={!name.trim() || submitting}
          className="w-full py-3 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 font-heading uppercase tracking-wide"
        >
          {submitting ? "Creating..." : "Create Email Set"}
        </button>
      </div>
    </div>
  );
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
  const [showModal, setShowModal] = useState(false);

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

  const handleCampaignCreated = (campaign: EmailSet) => {
    setEmailSets((prev) => [campaign, ...prev]);
    setShowModal(false);
  };

  const filtered =
    activeFilter === "All"
      ? emailSets
      : emailSets.filter((s) => s.status === activeFilter.toLowerCase());

  return (
    <>
      {showModal && (
        <NewCampaignModal
          onClose={() => setShowModal(false)}
          onCreated={handleCampaignCreated}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight font-heading">Your Emails</h1>
          <p className="text-[13px] text-white/25 mt-1">
            Manage your email campaigns
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2 font-heading uppercase tracking-wide"
        >
          <PlusIcon size={16} />
          New Email Set
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
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-sm font-bold hover:opacity-90 transition-opacity inline-flex items-center gap-2 font-heading uppercase tracking-wide"
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
