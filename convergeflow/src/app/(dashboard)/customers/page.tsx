"use client";

import { useState } from "react";
import { Card, Button } from "@/components/ui";
import {
  SearchIcon,
  DownloadIcon,
} from "@/components/icons";

const industries = [
  "All",
  "Roofing",
  "Gutters",
  "Solar",
  "Windows",
  "HVAC",
  "Plumbing",
];

const leads = [
  {
    id: 1,
    name: "Mike Thompson",
    company: "Thompson Roofing",
    industry: "Roofing",
    location: "Dallas, TX",
    freshness: "new" as const,
    score: 92,
  },
  {
    id: 2,
    name: "Sarah Chen",
    company: "Chen Homes",
    industry: "Roofing",
    location: "Fort Worth, TX",
    freshness: "new" as const,
    score: 87,
  },
  {
    id: 3,
    name: "Dave Morrison",
    company: "Morrison Property",
    industry: "Gutters",
    location: "Austin, TX",
    freshness: "warm" as const,
    score: 74,
  },
  {
    id: 4,
    name: "Lisa Park",
    company: "Parkview Realty",
    industry: "Solar",
    location: "Plano, TX",
    freshness: "warm" as const,
    score: 68,
  },
  {
    id: 5,
    name: "Tom Williams",
    company: "Williams & Sons",
    industry: "Windows",
    location: "Dallas, TX",
    freshness: "cold" as const,
    score: 45,
  },
];

const freshnessConfig = {
  new: { label: "New", color: "text-cf-green" },
  warm: { label: "Warm", color: "text-cf-amber" },
  cold: { label: "Cold", color: "text-white/25" },
};

export default function CustomersPage() {
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);

  const toggleLead = (id: number) => {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
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
          placeholder="Search by name, company, or location..."
          className="w-full bg-cf-card rounded-[var(--radius-button)] pl-11 pr-4 py-3 text-[14px] text-white placeholder:text-white/20 outline-none focus:ring-1 focus:ring-cf-orange/50"
        />
      </div>

      {/* Industry filter chips */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {industries.map((ind) => (
          <button
            key={ind}
            className={`px-4 py-2 rounded-[var(--radius-pill)] text-[13px] font-medium whitespace-nowrap transition-colors ${
              ind === "All"
                ? "bg-cf-orange text-white"
                : "bg-white/[0.04] text-white/35 hover:bg-white/[0.08]"
            }`}
          >
            {ind}
          </button>
        ))}
      </div>

      {/* Lead cards */}
      <div className="flex flex-col gap-2 mb-5">
        {leads.map((lead) => {
          const config = freshnessConfig[lead.freshness];
          const isSelected = selectedLeads.includes(lead.id);
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
                  </div>
                  <p className="text-[12px] text-white/25">
                    {lead.company} &middot; {lead.location}
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

      {/* Sticky action bar */}
      {selectedLeads.length > 0 && (
        <div className="fixed bottom-[calc(var(--mobile-nav-height)+1rem)] md:bottom-6 left-1/2 -translate-x-1/2 bg-cf-card rounded-[var(--radius-button)] px-6 py-3 flex items-center gap-4 shadow-lg z-40 border border-white/[0.06]">
          <span className="text-[13px] text-white/50">
            {selectedLeads.length} selected
          </span>
          <Button variant="primary" size="sm">
            Add to Campaign
          </Button>
          <Button variant="ghost" size="sm">
            <DownloadIcon size={14} className="mr-1.5" />
            Export
          </Button>
        </div>
      )}
    </>
  );
}
