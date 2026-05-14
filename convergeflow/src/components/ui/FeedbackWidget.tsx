"use client";

import { useState } from "react";

type FeedbackType = "bug" | "feature" | "general";

const typeLabels: Record<FeedbackType, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  general: "General",
};

interface FeedbackWidgetProps {
  className?: string;
}

export function FeedbackWidget({ className = "" }: FeedbackWidgetProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setOpen(false);
    // Reset after close animation
    setTimeout(() => {
      setSuccess(false);
      setMessage("");
      setType("general");
      setError(null);
    }, 200);
  };

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          url: typeof window !== "undefined" ? window.location.href : "",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");
      setSuccess(true);
    } catch {
      setError("Could not send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        aria-label="Open feedback"
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-cf-orange text-white shadow-lg hover:opacity-90 transition-all flex items-center justify-center ${className}`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={handleClose} aria-hidden="true" />

          {/* Panel */}
          <div className="relative w-full max-w-md mx-4 bg-cf-card rounded-[20px] p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-bold font-heading">Send Feedback</h2>
              <button
                type="button"
                aria-label="Close feedback modal"
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition-colors flex items-center justify-center text-white/50"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {success ? (
              <div className="py-8 text-center">
                <div className="w-14 h-14 rounded-full bg-cf-green/20 flex items-center justify-center mx-auto mb-4">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m9 12 2 2 4-4" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                </div>
                <p className="text-[15px] font-bold mb-1 font-heading">Thank you!</p>
                <p className="text-[13px] text-white/40">
                  Your feedback helps us improve ConvergeFlow.
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-5 px-6 py-2.5 rounded-cf-btn bg-white/[0.06] hover:bg-white/[0.12] text-sm text-white/60 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {/* Type selector */}
                <div className="flex gap-2 mb-4">
                  {(["bug", "feature", "general"] as FeedbackType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`flex-1 py-2 rounded-lg text-[12px] font-bold transition-colors ${
                        type === t
                          ? "bg-cf-orange text-white"
                          : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08]"
                      }`}
                    >
                      {typeLabels[t]}
                    </button>
                  ))}
                </div>

                {/* Textarea */}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    type === "bug"
                      ? "Describe what went wrong…"
                      : type === "feature"
                        ? "What feature would help you most?"
                        : "Share your thoughts…"
                  }
                  rows={4}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-[12px] px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-cf-orange resize-none"
                />

                {error && <p className="text-[12px] text-red-400 mt-2">{error}</p>}

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 py-2.5 rounded-cf-btn bg-white/[0.04] text-[13px] text-white/40 hover:bg-white/[0.08] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!message.trim() || submitting}
                    className={`flex-1 py-2.5 rounded-cf-btn bg-cf-orange text-white text-[13px] font-bold transition-opacity ${
                      !message.trim() || submitting
                        ? "opacity-40 cursor-default"
                        : "hover:opacity-90"
                    }`}
                  >
                    {submitting ? "Sending…" : "Send Feedback"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
