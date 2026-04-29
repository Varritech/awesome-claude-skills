"use client";

import { useEffect, useState } from "react";
import { Card, Skeleton } from "@/components/ui";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";

interface PersonaRecord {
  id: string;
  builtIn: boolean;
  name: string;
  description: string;
  systemPrompt: string;
  tone: string;
  userId?: string;
}

interface PersonasApiResponse {
  data: {
    builtIns: PersonaRecord[];
    custom: PersonaRecord[];
  };
}

const TONE_EMOJI: Record<string, string> = {
  direct: "🎯",
  warm: "👋",
  expert: "🧠",
  friendly: "🤝",
  irreverent: "😏",
};

const TONE_LABEL: Record<string, string> = {
  direct: "Direct",
  warm: "Warm",
  expert: "Expert",
  friendly: "Friendly",
  irreverent: "Irreverent",
};

const CUSTOM_ID = "__custom__";

export default function StylesPage() {
  const [builtIns, setBuiltIns] = useState<PersonaRecord[]>([]);
  const [customPersonas, setCustomPersonas] = useState<PersonaRecord[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Custom persona form state
  const [customDesc, setCustomDesc] = useState("");
  const [customName, setCustomName] = useState("My Style");
  const [generating, setGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiGet<PersonasApiResponse>("/api/personas")
      .then((res) => {
        if (cancelled) return;
        const built = res?.data?.builtIns ?? [];
        const custom = res?.data?.custom ?? [];
        setBuiltIns(built);
        setCustomPersonas(custom);
        // Default select first built-in
        if (built.length > 0) setSelected(built[0].id);
      })
      .catch((err) => console.error("Failed to load personas", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const allPersonas: PersonaRecord[] = [
    ...builtIns,
    ...customPersonas,
  ];

  const activePersona = allPersonas.find((p) => p.id === selected);

  const handleGenerate = async () => {
    if (!customDesc.trim() || generating) return;
    setGenerating(true);
    try {
      // Ask the AI to turn the user's description into a system prompt
      const res = await apiPost<{ data: { systemPrompt: string } }>(
        "/api/personas/generate",
        { description: customDesc, name: customName },
      );
      setGeneratedPrompt(res?.data?.systemPrompt ?? "");
    } catch {
      // Fallback: build a basic prompt from the description
      setGeneratedPrompt(
        `You are a cold email writer. ${customDesc.trim()} Keep emails concise, personal, and end with one clear CTA.`
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveCustom = async () => {
    if (saving || !generatedPrompt.trim()) return;
    setSaving(true);
    try {
      const res = await apiPost<{ data: PersonaRecord }>("/api/personas", {
        name: customName || "My Style",
        description: customDesc,
        systemPrompt: generatedPrompt,
        tone: "direct",
      });
      if (res?.data) {
        setCustomPersonas((prev) => [...prev, res.data]);
        setSelected(res.data.id);
        // Reset form
        setCustomDesc("");
        setGeneratedPrompt("");
        setCustomName("My Style");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSelection = async () => {
    if (!selected || selected === CUSTOM_ID || saving) return;
    setSaving(true);
    try {
      await apiPatch("/api/user/onboarding", { persona: selected });
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
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" rounded="lg" />)}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight font-heading">Email Styles</h1>
        <p className="text-[13px] text-white/25 mt-1">Pick your writing persona</p>
      </div>

      {/* Built-in persona grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {allPersonas.map((persona) => {
          const isSelected = selected === persona.id;
          return (
            <Card
              key={persona.id}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "ring-2 ring-cf-orange bg-cf-orange/[0.06]"
                  : "hover:bg-white/[0.03]"
              }`}
              onClick={() => setSelected(persona.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{TONE_EMOJI[persona.tone] ?? "✉️"}</span>
                  <h3 className="text-[15px] font-bold font-heading">{persona.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {persona.builtIn ? null : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cf-orange/20 text-cf-orange uppercase tracking-wide">
                      Custom
                    </span>
                  )}
                  {isSelected && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cf-orange text-white uppercase tracking-wide">
                      Selected
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[12px] text-white/35 leading-relaxed mb-3">
                {persona.description}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                <span className="px-2.5 py-1 rounded-[var(--radius-pill)] text-[10px] font-medium bg-white/[0.04] text-white/30">
                  {TONE_LABEL[persona.tone] ?? persona.tone}
                </span>
              </div>
            </Card>
          );
        })}

        {/* Custom / Create your own card */}
        <Card
          className={`cursor-pointer transition-all ${
            selected === CUSTOM_ID
              ? "ring-2 ring-cf-orange bg-cf-orange/[0.06]"
              : "hover:bg-white/[0.03]"
          }`}
          onClick={() => setSelected(CUSTOM_ID)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">✏️</span>
              <h3 className="text-[15px] font-bold font-heading">Custom Style</h3>
            </div>
            {selected === CUSTOM_ID && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cf-orange text-white uppercase tracking-wide">
                Selected
              </span>
            )}
          </div>
          <p className="text-[12px] text-white/35 leading-relaxed mb-3">
            Describe how you want to sound and the AI will build your writing persona.
          </p>
          <div className="flex gap-1.5 flex-wrap">
            <span className="px-2.5 py-1 rounded-[var(--radius-pill)] text-[10px] font-medium bg-white/[0.04] text-white/30">
              AI-generated
            </span>
          </div>
        </Card>
      </div>

      {/* Custom style builder — shown when Custom is selected */}
      {selected === CUSTOM_ID && (
        <Card className="mb-5">
          <p className="text-sm font-bold font-heading mb-4">Build Your Style</p>

          <div className="mb-3">
            <label className="text-[11px] text-white/30 uppercase tracking-wide font-medium mb-1.5 block">
              Style name
            </label>
            <input
              className="w-full bg-cf-elevated rounded-[var(--radius-button)] px-3 py-2.5 text-[13px] text-white/80 outline-none focus:ring-1 focus:ring-cf-orange/50"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. My Founder Voice"
            />
          </div>

          <div className="mb-4">
            <label className="text-[11px] text-white/30 uppercase tracking-wide font-medium mb-1.5 block">
              Describe how you want to sound
            </label>
            <textarea
              className="w-full bg-cf-elevated rounded-[var(--radius-button)] p-3 text-[13px] text-white/70 leading-relaxed outline-none focus:ring-1 focus:ring-cf-orange/50 resize-none min-h-[100px]"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              placeholder="e.g. Casual but credible, like a founder talking to another founder. Short sentences, no fluff, light humor. Never corporate."
            />
          </div>

          {generatedPrompt && (
            <div className="mb-4">
              <label className="text-[11px] text-white/30 uppercase tracking-wide font-medium mb-1.5 block">
                AI-generated system prompt
              </label>
              <textarea
                className="w-full bg-cf-elevated rounded-[var(--radius-button)] p-3 text-[13px] text-white/50 leading-relaxed outline-none focus:ring-1 focus:ring-cf-orange/50 resize-none min-h-[80px]"
                value={generatedPrompt}
                onChange={(e) => setGeneratedPrompt(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={!customDesc.trim() || generating}
              className="flex-1 py-2.5 rounded-[var(--radius-button)] border border-cf-orange/40 text-cf-orange text-[13px] font-bold hover:bg-cf-orange/10 transition-colors disabled:opacity-40 font-heading"
            >
              {generating ? "Generating..." : generatedPrompt ? "Re-generate" : "Generate with AI"}
            </button>
            {generatedPrompt && (
              <button
                onClick={handleSaveCustom}
                disabled={saving}
                className="flex-1 py-2.5 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-60 font-heading"
              >
                {saving ? "Saving..." : "Save Custom Style"}
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Preview of selected built-in */}
      {activePersona && selected !== CUSTOM_ID && (
        <Card className="mb-5">
          <p className="text-sm font-bold font-heading mb-3">Style Preview</p>
          <p className="text-[12px] text-white/40 leading-relaxed mb-3">
            {activePersona.systemPrompt}
          </p>
        </Card>
      )}

      {/* Save selection button */}
      {selected !== CUSTOM_ID && (
        <button
          onClick={handleSaveSelection}
          disabled={saving || !selected}
          className="w-full py-3 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-sm font-bold hover:opacity-90 transition-opacity font-heading uppercase tracking-wide disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Style"}
        </button>
      )}
    </>
  );
}
