"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Skeleton } from "@/components/ui";
import { ChevronLeftIcon } from "@/components/icons";
import { apiGet, apiStream } from "@/lib/api-client";

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function EmailDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [email, setEmail] = useState<EmailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerated, setRegenerated] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    apiGet<{ data: EmailRecord } | EmailRecord>(`/api/emails/${id}`)
      .then((res) => {
        if (cancelled) return;
        const record = (res as { data: EmailRecord })?.data ?? (res as EmailRecord);
        setEmail(record ?? null);
      })
      .catch((err) => {
        console.error("Failed to load email", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  const handleRegenerate = async () => {
    if (!id || !email || regenerating) return;
    setRegenerating(true);
    setRegenerated("");
    try {
      const stream = apiStream<{ response?: string; done?: boolean; error?: string }>(
        `/api/emails/${id}/generate`,
        {
          method: "POST",
          body: JSON.stringify({
            persona: email.persona,
            leadData: {},
          }),
        },
      );
      for await (const chunk of stream) {
        if (chunk.error) { console.error("Stream error", chunk.error); break; }
        if (chunk.response) setRegenerated((prev) => prev + chunk.response);
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
        <Skeleton className="h-64 mb-5" rounded="lg" />
      </>
    );
  }

  if (!email) {
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
          <p className="text-[14px] text-white/50">Email not found.</p>
        </Card>
      </>
    );
  }

  const config = statusConfig[email.status] ?? statusConfig.draft;

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
          <div className="flex-1 min-w-0 pr-4">
            <h1 className="text-[20px] font-bold tracking-tight font-heading leading-snug">
              {email.subject}
            </h1>
            <div className="flex items-center gap-2.5 mt-2">
              <span className={`px-2.5 py-0.5 rounded-[var(--radius-pill)] text-[11px] font-medium ${config.bg} ${config.text}`}>
                {config.label}
                {email.status === "queued" && email.scheduledFor
                  ? ` · ${formatDate(email.scheduledFor)}`
                  : ""}
              </span>
              <span className="text-[12px] text-white/25">
                {personaLabel[email.persona] ?? email.persona}
              </span>
            </div>
          </div>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="shrink-0 px-3 py-1.5 rounded-[var(--radius-pill)] text-[11px] font-medium bg-cf-orange/15 text-cf-orange hover:bg-cf-orange/25 transition-colors disabled:opacity-60"
          >
            {regenerating ? "Regenerating..." : "Regenerate"}
          </button>
        </div>

        {email.scheduledFor && email.status === "queued" && (
          <p className="text-[12px] text-white/25 mb-4">
            Scheduled to send at 8:00 AM on {formatDate(email.scheduledFor)}
          </p>
        )}

        {/* Body */}
        <div className="border-t border-white/[0.06] pt-4">
          <p className="text-[12px] text-white/25 mb-2 uppercase tracking-wider font-medium">Body</p>
          <pre className="text-[13px] text-white/70 whitespace-pre-wrap font-sans leading-relaxed">
            {email.body.replace(/\{\{firstName\}\}/g, "there")}
          </pre>
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
    </>
  );
}
