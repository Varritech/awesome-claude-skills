/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui";
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
  builtIns: PersonaRecord[];
  custom: PersonaRecord[];
}

const BUILT_IN_META: Record<string, { avatar: string; desc: string; subject: string; body: string; sig: string }> = {
  closer: {
    avatar: "/avatars/closer.png",
    desc: "Direct and confident. Gets straight to the point.",
    subject: "Quick question about your roof",
    body: "Hi Mike, I noticed some shingles lifting on your roof at 42 Elm St. We're doing work in your neighborhood this week. Want a free quote before it gets worse?",
    sig: "— Jake, Jake's Roofing",
  },
  neighbor: {
    avatar: "/avatars/neighbor.png",
    desc: "Friendly and warm. Like a recommendation from next door.",
    subject: "Hey from a local roofer",
    body: "Hey Mike! Just finished a roof for the Johnsons down the street. They were really happy with how it turned out. If you ever need anything, we'd love to help.",
    sig: "— Jake, Jake's Roofing",
  },
  expert: {
    avatar: "/avatars/expert.png",
    desc: "Professional and knowledgeable. Builds trust with expertise.",
    subject: "Roof inspection before storm season",
    body: "Hi Mike, with the recent storms, homes built before 2005 often show early wear on ridge caps and flashing. A quick inspection can catch small issues before they become costly repairs.",
    sig: "— Jake, Jake's Roofing",
  },
  helper: {
    avatar: "/avatars/helper.png",
    desc: "Helpful and genuine. Focused on solving problems.",
    subject: "Can I help with your roof?",
    body: "Hi Mike, I know dealing with roof stuff can be stressful, especially when you're not sure how bad it is. I'm happy to come take a look for free. No pressure at all.",
    sig: "— Jake, Jake's Roofing",
  },
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
        const built = res?.builtIns ?? [];
        const custom = res?.custom ?? [];
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
      const res = await apiPost<{ systemPrompt: string }>(
        "/api/personas/generate",
        { description: customDesc, name: customName },
      );
      setGeneratedPrompt(res?.systemPrompt ?? "");
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
      const res = await apiPost<PersonaRecord>("/api/personas", {
        name: customName || "My Style",
        description: customDesc,
        systemPrompt: generatedPrompt,
        tone: "direct",
      });
      if (res?.id) {
        setCustomPersonas((prev) => [...prev, res]);
        setSelected(res.id);
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

      {/* Persona grid — matches onboarding style page design */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {allPersonas.map((persona) => {
          const isSelected = selected === persona.id;
          const meta = BUILT_IN_META[persona.id];
          return (
            <button
              key={persona.id}
              type="button"
              onClick={() => setSelected(persona.id)}
              className={`relative bg-cf-card rounded-[20px] p-7 text-left cursor-pointer transition-all duration-200 overflow-hidden ${
                isSelected ? "bg-[#1F1F25]" : "hover:bg-[#1F1F25]"
              }`}
              style={isSelected ? { boxShadow: "inset 0 0 0 1.5px rgba(249,115,22,0.4)" } : undefined}
            >
              {/* Selected checkmark */}
              <div
                className={`absolute top-5 right-5 w-[22px] h-[22px] rounded-full bg-cf-orange flex items-center justify-center transition-all duration-200 ${
                  isSelected ? "opacity-100 scale-100" : "opacity-0 scale-50"
                }`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              {/* Avatar + Name */}
              <div className="flex items-center gap-3.5 mb-3.5">
                {meta ? (
                  <div className="w-12 h-12 min-w-[48px] rounded-[16px] overflow-hidden">
                    <img src={meta.avatar} alt={persona.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 min-w-[48px] rounded-[16px] bg-cf-elevated flex items-center justify-center text-xl">
                    ✏️
                  </div>
                )}
                <div>
                  <span className="text-[15px] font-bold tracking-[-0.01em] font-heading block">{persona.name}</span>
                  {!persona.builtIn && (
                    <span className="text-[10px] text-cf-orange font-medium uppercase tracking-wide">Custom</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-[13px] text-white/30 leading-relaxed mb-[18px]">
                {meta?.desc ?? persona.description}
              </p>

              {/* Email preview for built-ins */}
              {meta && (
                <div className="bg-[#161618] rounded-[14px] p-[18px_20px]">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-cf-orange flex-shrink-0" />
                    <span className="text-[11px] text-white/20 font-medium">{meta.subject}</span>
                  </div>
                  <p className="text-[13px] text-white/35 leading-[1.65]">{meta.body}</p>
                  <p className="text-[11px] text-white/[0.12] mt-3">{meta.sig}</p>
                </div>
              )}
            </button>
          );
        })}

        {/* Custom / Create your own card */}
        <button
          type="button"
          onClick={() => setSelected(CUSTOM_ID)}
          className={`relative bg-cf-card rounded-[20px] p-7 text-left cursor-pointer transition-all duration-200 overflow-hidden ${
            selected === CUSTOM_ID ? "bg-[#1F1F25]" : "hover:bg-[#1F1F25]"
          }`}
          style={selected === CUSTOM_ID ? { boxShadow: "inset 0 0 0 1.5px rgba(249,115,22,0.4)" } : undefined}
        >
          <div
            className={`absolute top-5 right-5 w-[22px] h-[22px] rounded-full bg-cf-orange flex items-center justify-center transition-all duration-200 ${
              selected === CUSTOM_ID ? "opacity-100 scale-100" : "opacity-0 scale-50"
            }`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex items-center gap-3.5 mb-3.5">
            <div className="w-12 h-12 min-w-[48px] rounded-[16px] bg-cf-elevated flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <span className="text-[15px] font-bold tracking-[-0.01em] font-heading">Custom Style</span>
          </div>
          <p className="text-[13px] text-white/30 leading-relaxed">
            Describe how you want to sound and the AI will build your writing persona.
          </p>
        </button>
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
