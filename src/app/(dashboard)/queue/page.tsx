"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, Skeleton } from "@/components/ui";
import { apiGet, apiPatch } from "@/lib/api-client";

type QueuedEmailStatus = "queued" | "paused";

interface QueuedEmail {
  id: string;
  leadName: string;
  leadEmail?: string;
  campaignId: string;
  campaignName: string;
  subject: string;
  scheduledFor?: string | null;
  status: QueuedEmailStatus;
  inboxId?: string;
}

const statusConfig: Record<QueuedEmailStatus, { label: string; bg: string; text: string }> = {
  queued: { label: "Queued", bg: "bg-cf-green/15", text: "text-cf-green" },
  paused: { label: "Paused", bg: "bg-cf-indigo/15", text: "text-cf-indigo" },
};

function formatScheduledAt(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function QueuePage() {
  const [emails, setEmails] = useState<QueuedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | QueuedEmailStatus>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await apiGet<{ data: QueuedEmail[] }>("/api/emails/queue");
      setEmails(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load queue", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const toggleEmailStatus = async (email: QueuedEmail) => {
    const newStatus: QueuedEmailStatus = email.status === "queued" ? "paused" : "queued";
    setActionLoading(email.id);
    try {
      await apiPatch(`/api/emails/${email.id}`, { status: newStatus });
      setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, status: newStatus } : e)));
    } catch (err) {
      console.error("Failed to update email status", err);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = filter === "all" ? emails : emails.filter((e) => e.status === filter);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Send Queue</h1>
          <p className="text-sm text-white/45 mt-0.5">
            Manage queued and paused emails across all campaigns
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-white/50">
          <span className="text-cf-green">
            {emails.filter((e) => e.status === "queued").length}
          </span>
          <span>queued</span>
          <span className="mx-1.5 text-white/20">·</span>
          <span className="text-cf-indigo">
            {emails.filter((e) => e.status === "paused").length}
          </span>
          <span>paused</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-white/8 pb-0">
        {(["all", "queued", "paused"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t capitalize transition-colors ${
              filter === f
                ? "text-white border-b-2 border-cf-green -mb-px"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/30">
            <p className="text-sm">No {filter === "all" ? "" : filter} emails in queue</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-white/40 text-xs">
                <th className="px-4 py-3 text-left font-medium">Lead</th>
                <th className="px-4 py-3 text-left font-medium">Campaign</th>
                <th className="px-4 py-3 text-left font-medium">Subject</th>
                <th className="px-4 py-3 text-left font-medium">Scheduled</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((email) => {
                const sc = statusConfig[email.status];
                const isLoading = actionLoading === email.id;
                return (
                  <tr
                    key={email.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Lead */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-white/90 truncate max-w-[140px]">
                        {email.leadName || "Unknown"}
                      </div>
                      {email.leadEmail && (
                        <div className="text-xs text-white/35 truncate max-w-[140px]">
                          {email.leadEmail}
                        </div>
                      )}
                    </td>
                    {/* Campaign */}
                    <td className="px-4 py-3 text-white/60 truncate max-w-[120px]">
                      {email.campaignName || email.campaignId}
                    </td>
                    {/* Subject */}
                    <td className="px-4 py-3 text-white/70 truncate max-w-[200px]">
                      {email.subject || "(no subject)"}
                    </td>
                    {/* Scheduled at */}
                    <td className="px-4 py-3 text-white/45 whitespace-nowrap">
                      {formatScheduledAt(email.scheduledFor)}
                    </td>
                    {/* Status badge */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                      >
                        {sc.label}
                      </span>
                    </td>
                    {/* Toggle action */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleEmailStatus(email)}
                        disabled={isLoading}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          email.status === "queued"
                            ? "bg-white/8 text-white/60 hover:bg-white/12 hover:text-white/80"
                            : "bg-cf-green/15 text-cf-green hover:bg-cf-green/25"
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        {isLoading ? "…" : email.status === "queued" ? "Pause" : "Resume"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
