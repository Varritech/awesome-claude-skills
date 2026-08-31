"use client";

import { useEffect, useState } from "react";
import { Card, Skeleton } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api-client";
import { groupByThread } from "@/lib/replies/threading";
import type { Thread } from "@/lib/replies/threading";
import type { ReplyCategory } from "@/lib/replies/categories";

const CATEGORY_LABELS: Record<ReplyCategory, string> = {
  interested: "Interested",
  not_interested: "Not Interested",
  do_not_contact: "Do Not Contact",
  auto_reply: "Auto Reply",
  out_of_office: "Out of Office",
  referral: "Referral",
  question: "Question",
  booked: "Booked",
};

const CATEGORY_COLORS: Record<ReplyCategory, string> = {
  interested: "bg-green-500/20 text-green-400",
  not_interested: "bg-white/10 text-white/40",
  do_not_contact: "bg-red-500/20 text-red-400",
  auto_reply: "bg-white/10 text-white/30",
  out_of_office: "bg-yellow-500/20 text-yellow-400",
  referral: "bg-blue-500/20 text-blue-400",
  question: "bg-purple-500/20 text-purple-400",
  booked: "bg-cf-orange/20 text-cf-orange",
};

type ReplyEmail = {
  id: string;
  subject?: string;
  body?: string;
  replyBody?: string;
  replyCategory?: ReplyCategory;
  repliedAt?: string;
  sentAt?: string;
  lead?: { firstName?: string; lastName?: string; company?: string; email?: string } | null;
  campaign?: { name?: string } | null;
};

const ALL_CATEGORIES: ReplyCategory[] = [
  "interested",
  "booked",
  "question",
  "not_interested",
  "do_not_contact",
  "auto_reply",
  "out_of_office",
  "referral",
];

function formatTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getLeadName(email: ReplyEmail): string {
  const lead = email.lead;
  if (!lead) return "Unknown Lead";
  return [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email || "Unknown";
}

interface RepliesApiResponse {
  data: ReplyEmail[];
}

export default function RepliesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ReplyCategory | "all">("all");
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);

  // Reply composer state
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<RepliesApiResponse>("/api/replies")
      .then((res) => {
        if (cancelled) return;
        const data = res?.data ?? [];
        setThreads(groupByThread(data as Parameters<typeof groupByThread>[0]));
      })
      .catch((err) => console.error("Failed to load replies", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredThreads =
    selectedCategory === "all"
      ? threads
      : threads.filter((t) =>
          t.emails.some((e) => {
            const email = e as unknown as ReplyEmail;
            return email.replyCategory === selectedCategory;
          })
        );

  const categoryCounts = ALL_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = threads.filter((t) =>
      t.emails.some((e) => (e as unknown as ReplyEmail).replyCategory === cat)
    ).length;
    return acc;
  }, {});

  async function handleDraft() {
    if (!selectedThread || drafting) return;
    const latestEmail = selectedThread.emails[selectedThread.emails.length - 1];
    setDrafting(true);
    try {
      const res = await apiGet<{ data: { draft: string } }>(
        `/api/replies/${latestEmail.id}/respond?draft=true`
      );
      if (res?.data?.draft) setReplyBody(res.data.draft);
    } catch {
      // silent
    } finally {
      setDrafting(false);
    }
  }

  async function handleSendReply() {
    if (!selectedThread || !replyBody.trim() || replying) return;
    const latestEmail = selectedThread.emails[selectedThread.emails.length - 1];
    setReplying(true);
    try {
      await apiPost(`/api/replies/${latestEmail.id}/respond`, { body: replyBody });
      setReplyBody("");
    } catch (err) {
      console.error("Failed to send reply", err);
    } finally {
      setReplying(false);
    }
  }

  if (loading) {
    return (
      <>
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-56 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48" rounded="lg" />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="flex gap-5 h-[calc(100vh-7rem)]">
      {/* ── Left sidebar: category filters ──────────────────────────────────── */}
      <aside className="w-48 shrink-0 flex flex-col gap-1">
        <h1 className="text-[18px] font-bold tracking-tight font-heading mb-4">Replies</h1>

        <button
          onClick={() => setSelectedCategory("all")}
          className={`text-left px-3 py-2 rounded-[var(--radius-button)] text-[13px] transition-colors flex items-center justify-between ${
            selectedCategory === "all"
              ? "bg-cf-orange/10 text-cf-orange font-bold"
              : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
          }`}
        >
          <span>All Replies</span>
          <span className="text-[11px] opacity-60">{threads.length}</span>
        </button>

        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`text-left px-3 py-2 rounded-[var(--radius-button)] text-[13px] transition-colors flex items-center justify-between ${
              selectedCategory === cat
                ? "bg-cf-orange/10 text-cf-orange font-bold"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
            }`}
          >
            <span>{CATEGORY_LABELS[cat]}</span>
            {categoryCounts[cat] > 0 && (
              <span className="text-[11px] opacity-60">{categoryCounts[cat]}</span>
            )}
          </button>
        ))}
      </aside>

      {/* ── Thread list ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {filteredThreads.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-white/25 text-[13px]">
            No replies in this category
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredThreads.map((thread) => {
              const latestEmail = thread.emails[thread.emails.length - 1] as unknown as ReplyEmail;
              const isSelected = selectedThread?.id === thread.id;
              const category = latestEmail.replyCategory;

              return (
                <Card
                  key={thread.id}
                  onClick={() => {
                    setSelectedThread(thread);
                    setReplyBody("");
                  }}
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? "ring-2 ring-cf-orange bg-cf-orange/[0.04]"
                      : "hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[14px] font-bold font-heading truncate">
                          {getLeadName(latestEmail)}
                        </span>
                        {latestEmail.lead?.company && (
                          <span className="text-[11px] text-white/25 shrink-0">
                            {latestEmail.lead.company}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-white/50 truncate mb-1">
                        {latestEmail.subject ?? "(no subject)"}
                      </p>
                      <p className="text-[11px] text-white/30 truncate">
                        {latestEmail.replyBody ?? latestEmail.body ?? ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {category && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${CATEGORY_COLORS[category] ?? "bg-white/10 text-white/40"}`}
                        >
                          {CATEGORY_LABELS[category]}
                        </span>
                      )}
                      <span className="text-[10px] text-white/20">
                        {formatTime(latestEmail.repliedAt ?? latestEmail.sentAt)}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Thread detail + composer ─────────────────────────────────────── */}
      {selectedThread && (
        <div className="w-96 shrink-0 flex flex-col gap-3 overflow-y-auto">
          <Card>
            <p className="text-[13px] font-bold font-heading mb-3">Thread</p>
            <div className="flex flex-col gap-2">
              {selectedThread.emails.map((email) => {
                const e = email as unknown as ReplyEmail;
                return (
                  <div
                    key={email.id}
                    className="text-[12px] bg-cf-elevated rounded-[var(--radius-button)] p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/40 font-medium">{getLeadName(e)}</span>
                      <span className="text-white/20 text-[10px]">{formatTime(e.sentAt)}</span>
                    </div>
                    <p className="text-white/60 leading-relaxed whitespace-pre-wrap">
                      {e.body ?? ""}
                    </p>
                    {e.replyBody && (
                      <div className="mt-2 pt-2 border-t border-white/[0.04]">
                        <p className="text-[10px] text-white/30 mb-1 uppercase tracking-wide">
                          Reply
                        </p>
                        <p className="text-white/50 leading-relaxed">{e.replyBody}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Reply composer */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-bold font-heading">Reply</p>
              <button
                onClick={handleDraft}
                disabled={drafting}
                className="text-[11px] text-cf-orange border border-cf-orange/30 rounded-[var(--radius-pill)] px-2.5 py-1 hover:bg-cf-orange/10 transition-colors disabled:opacity-40"
              >
                {drafting ? "Drafting..." : "AI Draft"}
              </button>
            </div>
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              className="w-full bg-cf-elevated rounded-[var(--radius-button)] p-3 text-[12px] text-white/70 leading-relaxed outline-none focus:ring-1 focus:ring-cf-orange/50 resize-none min-h-[120px] mb-3"
              placeholder="Write your reply..."
            />
            <button
              onClick={handleSendReply}
              disabled={!replyBody.trim() || replying}
              className="w-full py-2.5 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-60 font-heading"
            >
              {replying ? "Sending..." : "Send Reply"}
            </button>
          </Card>
        </div>
      )}
    </div>
  );
}
