"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input, Skeleton } from "@/components/ui";
import { CheckIcon, GlobeIcon, RefreshIcon } from "@/components/icons";
import { apiGet, apiPost } from "@/lib/api-client";

interface TrackingDomain {
  id: string;
  domain: string;
  verified: boolean;
  cnameTarget: string;
  createdAt: string;
  lastCheckedAt?: string;
}

export default function TrackingDomainsPage() {
  const [domains, setDomains] = useState<TrackingDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDomains = () =>
    apiGet<{ domains: TrackingDomain[] }>("/api/tracking-domains")
      .then((res) => setDomains(res?.domains ?? []))
      .catch((err) => console.error("Failed to load tracking domains", err));

  useEffect(() => {
    let cancelled = false;
    fetchDomains().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleAdd = async () => {
    if (!newDomain.trim() || saving) return;
    setError(null);
    setSaving(true);
    try {
      await apiPost<TrackingDomain>("/api/tracking-domains", { domain: newDomain.trim() });
      await fetchDomains();
      setNewDomain("");
      setAdding(false);
    } catch (err) {
      setError("Failed to add domain. Check the format and try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (id: string) => {
    if (verifying) return;
    setVerifying(id);
    try {
      await apiPost(`/api/tracking-domains/${id}/verify`, {});
      await fetchDomains();
    } catch (err) {
      console.error("Verification failed", err);
    } finally {
      setVerifying(null);
    }
  };

  if (loading) {
    return (
      <>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <Skeleton className="h-64" rounded="lg" />
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight font-heading">Tracking Domains</h1>
        <p className="text-[13px] text-white/25 mt-1">
          Custom domains for link tracking and open pixels
        </p>
      </div>

      <Card className="mb-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold font-heading">Your Tracking Domains</p>
          <button
            onClick={() => setAdding(true)}
            className="text-[13px] text-cf-orange hover:opacity-80 transition-opacity"
          >
            + Add Domain
          </button>
        </div>

        {domains.length === 0 && !adding && (
          <p className="text-[12px] text-white/30 py-4">
            No tracking domains configured. Add one to use custom link and pixel domains.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {domains.map((domain) => (
            <div
              key={domain.id}
              className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0"
            >
              <div className="flex items-center gap-3">
                <GlobeIcon size={16} className="text-white/30" />
                <div>
                  <p className="text-[13px] font-medium">{domain.domain}</p>
                  <p className="text-[11px] text-white/25 mt-0.5">
                    CNAME → {domain.cnameTarget}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {domain.verified ? (
                  <span className="flex items-center gap-1 text-[11px] text-cf-green bg-cf-green/15 px-2 py-0.5 rounded-full font-medium">
                    <CheckIcon size={10} />
                    Verified
                  </span>
                ) : (
                  <span className="text-[11px] text-cf-amber bg-cf-amber/15 px-2 py-0.5 rounded-full font-medium">
                    Pending
                  </span>
                )}
                <button
                  onClick={() => handleVerify(domain.id)}
                  disabled={verifying === domain.id}
                  className="ml-1 text-[12px] text-white/40 hover:text-white/70 transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  <RefreshIcon size={12} className={verifying === domain.id ? "animate-spin" : ""} />
                  {verifying === domain.id ? "Checking..." : "Verify"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {adding && (
          <div className="mt-4 p-4 bg-cf-elevated rounded-lg">
            <p className="text-[12px] text-white/40 mb-3">
              Add your subdomain (e.g. <code className="bg-white/[0.06] px-1 rounded">track.yourdomain.com</code>).
              Then add a CNAME record pointing to <code className="bg-white/[0.06] px-1 rounded">track.convergeflow.io</code>.
            </p>
            <div className="flex gap-2 mb-3">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="track.yourdomain.com"
                className="flex-1"
              />
            </div>
            {error && <p className="text-[12px] text-red-400 mb-2">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setAdding(false); setNewDomain(""); setError(null); }}
                className="flex-1 py-2 rounded-[var(--radius-button)] bg-white/[0.04] text-[13px] text-white/50"
              >
                Cancel
              </button>
              <Button
                onClick={handleAdd}
                disabled={saving || !newDomain.trim()}
                size="sm"
              >
                {saving ? "Adding..." : "Add Domain"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <p className="text-sm font-bold mb-3 font-heading">How it works</p>
        <ol className="flex flex-col gap-2">
          {[
            "Add your subdomain (e.g. track.yourdomain.com)",
            "Create a CNAME record: track.yourdomain.com → track.convergeflow.io",
            "Click Verify to confirm the DNS record is live",
            "Enable tracking on your campaigns to use this domain",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-cf-orange/20 text-cf-orange text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-[12px] text-white/40">{step}</p>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
