"use client";

/**
 * Suppression list management page.
 *
 * Displays all suppressed emails for the current user with columns:
 * email, reason, date. Allows manual add and removal.
 */

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Suppression {
  id: string;
  email: string;
  reason: "unsubscribed" | "bounced" | "manual";
  createdAt: string;
}

const REASON_LABELS: Record<Suppression["reason"], string> = {
  unsubscribed: "Unsubscribed",
  bounced: "Bounced",
  manual: "Manual",
};

const REASON_COLORS: Record<Suppression["reason"], string> = {
  unsubscribed: "text-cf-amber",
  bounced: "text-cf-red",
  manual: "text-white/40",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SuppressionsPage() {
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [addEmail, setAddEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchSuppressions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/suppressions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: { suppressions: Suppression[] } };
      setSuppressions(json.data.suppressions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load suppressions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSuppressions();
  }, [fetchSuppressions]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setIsAdding(true);
    setAddError(null);

    try {
      const res = await fetch("/api/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail.trim(), reason: "manual" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setAddEmail("");
      await fetchSuppressions();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add suppression");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemove(email: string) {
    try {
      const res = await fetch("/api/suppressions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchSuppressions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove suppression");
    }
  }

  return (
    <div className="py-10 px-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-heading tracking-tight">Suppression List</h1>
        <p className="text-white/40 text-sm mt-1">
          Emails on this list will never receive outreach from your campaigns.
        </p>
      </div>

      {/* Add suppression form */}
      <Card padding="md" className="mb-6">
        <form onSubmit={handleAdd} className="flex gap-3 items-start">
          <div className="flex-1">
            <Input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="email@domain.com"
              state={addError ? "error" : "default"}
              disabled={isAdding}
            />
            {addError && <p className="text-cf-red text-xs mt-1">{addError}</p>}
          </div>
          <Button type="submit" disabled={isAdding || !addEmail.trim()}>
            {isAdding ? "Adding..." : "Suppress"}
          </Button>
        </form>
      </Card>

      {/* Table */}
      <Card padding="none">
        {isLoading ? (
          <div className="p-6 text-center text-white/30 text-sm">Loading...</div>
        ) : error ? (
          <div className="p-6 text-center text-cf-red text-sm">{error}</div>
        ) : suppressions.length === 0 ? (
          <div className="p-6 text-center text-white/30 text-sm">No suppressed emails yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs text-white/30 font-medium uppercase tracking-wide">
                  Email
                </th>
                <th className="px-5 py-3 text-left text-xs text-white/30 font-medium uppercase tracking-wide">
                  Reason
                </th>
                <th className="px-5 py-3 text-left text-xs text-white/30 font-medium uppercase tracking-wide">
                  Date
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {suppressions.map((s, i) => (
                <tr
                  key={s.id}
                  className={`${i < suppressions.length - 1 ? "border-b border-white/5" : ""}`}
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-white/70">{s.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium ${REASON_COLORS[s.reason]}`}>
                      {REASON_LABELS[s.reason]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-white/30">{formatDate(s.createdAt)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Button variant="danger" size="sm" onClick={() => handleRemove(s.email)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
