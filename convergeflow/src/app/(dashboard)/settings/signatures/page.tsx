"use client";

import { useEffect, useState } from "react";
import { Card, Skeleton } from "@/components/ui";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";

interface SignatureRecord {
  id: string;
  name: string;
  html: string;
  isDefault: boolean;
  createdAt: string;
}

export default function SignaturesPage() {
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", html: "", isDefault: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<SignatureRecord[]>("/api/signatures")
      .then((res) => {
        if (!cancelled) setSignatures(res ?? []);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.html.trim()) {
      setError("Name and signature content are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await apiPost<SignatureRecord>("/api/signatures", form);
      if (created) {
        setSignatures((prev) =>
          form.isDefault
            ? [created, ...prev.map((s) => ({ ...s, isDefault: false }))]
            : [created, ...prev],
        );
      }
      setForm({ name: "", html: "", isDefault: false });
      setAdding(false);
    } catch (err) {
      setError("Failed to create signature.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/api/signatures/${id}`);
      setSignatures((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  if (loading) {
    return (
      <>
        <Skeleton className="h-7 w-48 mb-7" />
        <Skeleton className="h-48 mb-4" rounded="lg" />
      </>
    );
  }

  return (
    <>
      <h1 className="text-[22px] font-bold tracking-tight mb-7 font-heading">
        Email Signatures
      </h1>

      {/* Existing signatures */}
      {signatures.length > 0 && (
        <div className="flex flex-col gap-3 mb-5">
          {signatures.map((sig) => (
            <Card key={sig.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[14px] font-bold font-heading">{sig.name}</p>
                    {sig.isDefault && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-[5px] bg-cf-orange/15 text-cf-orange uppercase tracking-wide">
                        Default
                      </span>
                    )}
                  </div>
                  <div
                    className="text-[12px] text-white/40 leading-relaxed border border-white/[0.06] rounded-[10px] p-3 bg-cf-elevated max-h-20 overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: sig.html }}
                  />
                </div>
                <button
                  onClick={() => handleDelete(sig.id)}
                  className="shrink-0 text-white/20 hover:text-red-400 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add signature form */}
      {adding ? (
        <Card>
          <p className="text-sm font-bold mb-4 font-heading">New Signature</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] text-white/20 mb-1.5 block">Signature Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Professional, Casual..."
                className="w-full bg-cf-elevated border border-white/[0.06] rounded-[10px] px-3 py-2.5 text-[13px] text-white outline-none focus:border-cf-orange/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/20 mb-1.5 block">
                Signature HTML
              </label>
              <textarea
                value={form.html}
                onChange={(e) => setForm({ ...form, html: e.target.value })}
                placeholder="<p>Best regards,<br>Your Name</p>"
                rows={5}
                className="w-full bg-cf-elevated border border-white/[0.06] rounded-[10px] px-3 py-2.5 text-[13px] text-white/70 font-mono outline-none focus:border-cf-orange/50 transition-colors resize-y"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="w-4 h-4 rounded accent-cf-orange"
              />
              <label htmlFor="isDefault" className="text-[13px] text-white/50">
                Set as default signature
              </label>
            </div>

            {error && (
              <p className="text-[12px] text-red-400">{error}</p>
            )}

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => { setAdding(false); setError(null); }}
                className="flex-1 py-2 rounded-[10px] bg-white/[0.04] text-[13px] text-white/50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-[2] py-2 rounded-[10px] bg-cf-orange text-white text-[13px] font-bold disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Signature"}
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="px-4 py-2 rounded-[var(--radius-button)] bg-white/[0.04] text-[13px] text-white/50 hover:bg-white/[0.08] transition-colors"
        >
          + Add Signature
        </button>
      )}
    </>
  );
}
