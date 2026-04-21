"use client";

import { useEffect, useState } from "react";
import { Card, Skeleton } from "@/components/ui";
import { PenIcon } from "@/components/icons";
import { apiGet, apiPatch } from "@/lib/api-client";

interface Persona {
  id: string;
  name: string;
  description: string;
  preview: string;
  traits: string[];
  emoji?: string;
}

interface PersonasApiResponse {
  data: {
    builtIns: Persona[];
    custom: Persona[];
  };
}

interface ProfileApiResponse {
  data: {
    activePersona?: string;
  };
}

const fallbackEmojis: Record<string, string> = {
  closer: "🎯",
  neighbor: "👋",
  expert: "🧠",
  helper: "🤝",
};

export default function StylesPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [savedPersona, setSavedPersona] = useState<string>("");
  const [customizing, setCustomizing] = useState(false);
  const [customPreview, setCustomPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet<PersonasApiResponse>("/api/personas"),
      apiGet<ProfileApiResponse>("/api/user/profile"),
    ])
      .then(([personasRes, profileRes]) => {
        if (cancelled) return;
        const builtIns = personasRes?.data?.builtIns ?? [];
        const custom = personasRes?.data?.custom ?? [];
        const list = [...builtIns, ...custom];
        setPersonas(list);
        const activePersonaId =
          profileRes?.data?.activePersona ?? list[0]?.id ?? "";
        setSelected(activePersonaId);
        setSavedPersona(activePersonaId);
        const active = list.find((p) => p.id === activePersonaId);
        if (active) setCustomPreview(active.preview);
      })
      .catch((err) => {
        console.error("Failed to load personas", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activePersona = personas.find((p) => p.id === selected);

  useEffect(() => {
    if (activePersona && !customizing) {
      setCustomPreview(activePersona.preview);
    }
  }, [activePersona, customizing]);

  const handleSave = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await apiPatch("/api/user/profile", { activePersona: selected });
      setSavedPersona(selected);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" rounded="lg" />
          ))}
        </div>
        <Skeleton className="h-40 mb-5" rounded="lg" />
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight font-heading">Email Styles</h1>
        <p className="text-[13px] text-white/25 mt-1">
          Pick your writing persona
        </p>
      </div>

      {/* Persona grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {personas.map((persona) => (
          <Card
            key={persona.id}
            className={`cursor-pointer transition-colors ${
              selected === persona.id ? "ring-1 ring-cf-orange" : ""
            }`}
            onClick={() => {
              setSelected(persona.id);
              setCustomizing(false);
            }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-xl">{persona.emoji ?? fallbackEmojis[persona.id] ?? "✉️"}</span>
              <h3 className="text-[15px] font-bold font-heading">{persona.name}</h3>
              {savedPersona === persona.id && (
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-cf-orange bg-cf-orange/10 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            <p className="text-[12px] text-white/35 leading-relaxed mb-3">
              {persona.description}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {persona.traits.map((trait) => (
                <span
                  key={trait}
                  className="px-2.5 py-1 rounded-[var(--radius-pill)] text-[10px] font-medium bg-white/[0.04] text-white/30"
                >
                  {trait}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Email preview */}
      {activePersona && (
        <Card className="mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold font-heading">Preview</p>
            <button
              className="text-[13px] text-cf-orange hover:opacity-80 transition-opacity flex items-center gap-1.5"
              onClick={() => setCustomizing(!customizing)}
            >
              <PenIcon size={14} />
              {customizing ? "Done" : "Customize"}
            </button>
          </div>
          {customizing ? (
            <textarea
              className="w-full bg-cf-elevated rounded-[var(--radius-button)] p-4 text-[13px] text-white/70 leading-relaxed outline-none focus:ring-1 focus:ring-cf-orange/50 resize-none min-h-[120px]"
              value={customPreview}
              onChange={(e) => setCustomPreview(e.target.value)}
            />
          ) : (
            <p className="text-[13px] text-white/50 leading-relaxed">
              {customPreview || activePersona.preview}
            </p>
          )}
        </Card>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || !selected}
        className="w-full py-3 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-sm font-bold hover:opacity-90 transition-opacity font-heading uppercase tracking-wide disabled:opacity-60"
      >
        {saving ? "Saving..." : saveSuccess ? "Saved!" : "Save Style"}
      </button>
    </>
  );
}
