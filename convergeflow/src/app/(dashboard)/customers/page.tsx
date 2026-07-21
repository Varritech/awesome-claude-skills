"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, Button, Skeleton } from "@/components/ui";
import { SearchIcon, DownloadIcon } from "@/components/icons";
import { apiGet, apiPost } from "@/lib/api-client";

type Freshness = "new" | "warm" | "cold";
type EnrichmentStatus = "pending" | "categorizing" | "done" | "failed";

interface Lead {
  id: string | number;
  name: string;
  company: string;
  industry: string;
  category?: string;
  location: string;
  freshness: Freshness;
  score: number;
  enrichmentStatus?: EnrichmentStatus;
}

interface LeadsResponse {
  leads?: Lead[];
  categories?: string[];
  needsPull?: boolean;
}

// Fallback chip set shown only until the DB reports real categories.
const fallbackCategories = [
  "All",
  "Roofing",
  "Gutters",
  "Solar",
  "Windows",
  "HVAC",
  "Plumbing",
];

const freshnessConfig: Record<Freshness, { label: string; color: string }> = {
  new: { label: "New", color: "text-cf-green" },
  warm: { label: "Warm", color: "text-cf-amber" },
  cold: { label: "Cold", color: "text-white/25" },
};

const POLL_INTERVAL_MS = 5000;

export default function CustomersPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<(string | number)[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [categories, setCategories] = useState<string[]>(fallbackCategories);
  const [addToCampaignOpen, setAddToCampaignOpen] = useState(false);

  // Tracks categories we've already auto-pulled for, so we never trigger a
  // second provider call for the same trade (DB-first after the first pull).
  const pulledRef = useRef<Set<string>>(new Set());
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLeads = useCallback(async (cat: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (cat !== "All") params.set("category", cat);
    const path = `/api/leads${params.toString() ? `?${params.toString()}` : ""}`;

    try {
      const res = await apiGet<LeadsResponse>(path);
      setLeads(res?.leads ?? []);
      if (res?.categories?.length) {
        setCategories(["All", ...res.categories]);
      }

      // Auto-pull the first time a trade category has no cached leads.
      if (res?.needsPull && cat !== "All" && !pulledRef.current.has(cat)) {
        pulledRef.current.add(cat);
        await apiPost("/api/leads/search", {
          provider: "aleads",
          industry: cat,
          location: "United States",
          count: 50,
        });
        // Reload from the DB now that leads are persisted.
        const refreshed = await apiGet<LeadsResponse>(path);
        setLeads(refreshed?.leads ?? []);
        if (refreshed?.categories?.length) {
          setCategories(["All", ...refreshed.categories]);
        }
      }
    } catch (err) {
      console.error("Failed to load leads", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads(category);
  }, [category, loadLeads]);

  // Poll while any lead is still being AI-categorized; stop once all settle.
  useEffect(() => {
    const pending = leads.some(
      (l) => l.enrichmentStatus === "pending" || l.enrichmentStatus === "categorizing",
    );
    if (!pending) {
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }
    pollTimer.current = setTimeout(async () => {
      const params = new URLSearchParams();
      if (category !== "All") params.set("category", category);
      try {
        const res = await apiGet<LeadsResponse>(`/api/leads${params.toString() ? `?${params.toString()}` : ""}`);
        setLeads(res?.leads ?? []);
        if (res?.categories?.length) setCategories(["All", ...res.categories]);
      } catch {
        // ignore — next poll will retry
      }
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [leads, category]);

  // Free-text search is a client-side filter over the currently loaded leads
  // (the previous version built a GET to /api/leads/search, which is POST-only
  // and silently 405'd). Server-side `q` can be added later if scale demands.
  const visibleLeads = query.trim()
    ? leads.filter((l) => {
        const q = query.trim().toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q) ||
          l.location.toLowerCase().includes(q)
        );
      })
    : leads;

  const toggleLead = (id: string | number) => {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleExport = () => {
    const selected = leads.filter((l) => selectedLeads.includes(l.id));
    const rows = [
      ["Name", "Company", "Category", "Location", "Score"].join(","),
      ...selected.map((l) => [l.name, l.company, l.category ?? "", l.location, l.score].join(",")),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight font-heading">Find Customers</h1>
          <p className="text-[13px] text-white/25 mt-1">
            Browse leads in your area
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-5">
        <SearchIcon
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, company, or location..."
          className="w-full bg-cf-card rounded-[var(--radius-button)] pl-11 pr-4 py-3 text-[14px] text-white placeholder:text-white/20 outline-none focus:ring-1 focus:ring-cf-orange/50"
        />
      </div>

      {/* Category filter chips (real trades from the DB) */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-[var(--radius-pill)] text-[13px] font-medium whitespace-nowrap transition-colors ${
              cat === category
                ? "bg-cf-orange text-white"
                : "bg-white/[0.04] text-white/35 hover:bg-white/[0.08]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-2 mb-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" rounded="lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && visibleLeads.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-[14px] text-white/40">
            {query.trim() ? `No leads match "${query}".` : "No leads in this category yet."}
          </p>
        </Card>
      )}

      {/* Lead cards */}
      {!loading && visibleLeads.length > 0 && (
        <div className="flex flex-col gap-2 mb-5">
          {visibleLeads.map((lead) => {
            const config = freshnessConfig[lead.freshness];
            const isSelected = selectedLeads.includes(lead.id);
            const categorizing =
              lead.enrichmentStatus === "pending" || lead.enrichmentStatus === "categorizing";
            return (
              <Card
                key={lead.id}
                className={`cursor-pointer transition-colors ${
                  isSelected ? "ring-1 ring-cf-orange" : ""
                }`}
                onClick={() => toggleLead(lead.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "bg-cf-orange border-cf-orange"
                        : "border-white/20"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold">{lead.name}</span>
                      <span className={`text-[11px] font-medium ${config.color}`}>
                        {config.label}
                      </span>
                      {categorizing && (
                        <span className="text-[11px] font-medium text-white/30">
                          categorizing…
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-white/25">
                      {lead.company} &middot; {lead.location}
                      {lead.category ? ` &middot; ${lead.category}` : ""}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-bold font-mono">{lead.score}</p>
                    <p className="text-[10px] text-white/20">Score</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sticky action bar */}
      {selectedLeads.length > 0 && (
        <div className="fixed bottom-[calc(var(--mobile-nav-height)+1rem)] md:bottom-6 left-1/2 -translate-x-1/2 bg-cf-card rounded-[var(--radius-button)] px-6 py-3 flex items-center gap-4 shadow-lg z-40 border border-white/[0.06]">
          <span className="text-[13px] text-white/50">
            {selectedLeads.length} selected
          </span>
          <Button variant="primary" size="sm" onClick={() => setAddToCampaignOpen(true)}>
            Add to Campaign
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <DownloadIcon size={14} className="mr-1.5" />
            Export
          </Button>
        </div>
      )}

      {addToCampaignOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-cf-card rounded-[var(--radius-button)] p-6 max-w-sm w-full">
            <h3 className="text-[16px] font-bold font-heading mb-2">Add to Campaign</h3>
            <p className="text-[13px] text-white/40 mb-2">{selectedLeads.length} lead{selectedLeads.length !== 1 ? "s" : ""} selected</p>
            <p className="text-[13px] text-white/30 mb-5">Go to Emails to create a campaign and add these leads.</p>
            <div className="flex gap-3">
              <button onClick={() => setAddToCampaignOpen(false)} className="flex-1 py-2.5 rounded-[var(--radius-button)] bg-white/[0.04] text-[13px] text-white/50">Cancel</button>
              <a href="/emails" className="flex-1 py-2.5 rounded-[var(--radius-button)] bg-cf-orange text-white text-[13px] font-bold text-center">Go to Emails</a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}