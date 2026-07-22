"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { generatedEmailsToSteps } from "@/lib/sequences/map-generated";
import type { GeneratedEmail } from "@/lib/ai/sequence-generator";
import { VariableGuide } from "./VariableGuide";

type ConditionType = "always" | "no_reply" | "no_open";

interface SequenceStep {
  order: number;
  subject: string;
  body: string;
  delayDays: number;
  condition: { type: ConditionType; afterDays: number };
}

interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
}

interface LeadOption {
  id: string;
  firstName?: string;
  company?: string;
}

interface SequenceEditorProps {
  sequenceId?: string;
  /** When provided, an "AI-generate" button produces a 5-email sequence for a picked lead. */
  campaignId?: string;
  /** Fired with the sequence id after a successful save (so the caller can link it to a campaign). */
  onSaved?: (sequenceId: string) => void;
}

function blankStep(order: number): SequenceStep {
  return {
    order,
    subject: "",
    body: "",
    delayDays: 0,
    condition: { type: "always", afterDays: 0 },
  };
}

/**
 * Inline sequence editor: author a multi-step email series (ordered steps with
 * subject/body/delay/condition), manually, with a variable reference guide.
 * Save creates (POST /api/sequences) or updates (PUT /api/sequences/[id]).
 */
export function SequenceEditor({ sequenceId, campaignId, onSaved }: SequenceEditorProps) {
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<SequenceStep[]>([blankStep(0)]);
  const [loading, setLoading] = useState(!!sequenceId);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [savedId, setSavedId] = useState<string | undefined>(sequenceId);

  // AI-generate state
  const [showAi, setShowAi] = useState(false);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [pickedLead, setPickedLead] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!sequenceId) return;
    let cancelled = false;
    apiGet<Sequence>(`/api/sequences/${sequenceId}`)
      .then((data) => {
        if (cancelled || !data) return;
        setName(data.name ?? "");
        setSteps(data.steps?.length ? data.steps : [blankStep(0)]);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sequenceId]);

  const addStep = () =>
    setSteps((prev) => [...prev, blankStep(prev.length)]);

  const updateStep = (index: number, patch: Partial<SequenceStep>) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const deleteStep = (index: number) =>
    setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })));

  const insertVariable = (tag: string) =>
    setSteps((prev) =>
      prev.map((s, i) =>
        i === activeStep ? { ...s, body: s.body + tag } : s,
      ),
    );

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const payload = { name: name || "Untitled sequence", steps };
    try {
      if (savedId) {
        await apiPut(`/api/sequences/${savedId}`, payload);
        onSaved?.(savedId);
      } else {
        const created = await apiPost<{ id: string }>("/api/sequences", payload);
        if (created?.id) {
          setSavedId(created.id);
          onSaved?.(created.id);
        }
      }
    } catch (err) {
      console.error("Failed to save sequence", err);
    } finally {
      setSaving(false);
    }
  };

  const openAiPicker = async () => {
    setShowAi(true);
    try {
      const res = await apiGet<{ data: LeadOption[] }>("/api/leads?limit=50");
      setLeads(res?.data ?? []);
    } catch (err) {
      console.error("Failed to load leads", err);
    }
  };

  const handleAiGenerate = async () => {
    if (!campaignId || !pickedLead || generating) return;
    setGenerating(true);
    try {
      const res = await apiPost<{ emails: GeneratedEmail[] }>(
        `/api/campaigns/${campaignId}/generate-sequence`,
        { prospectId: pickedLead },
      );
      if (res?.emails?.length) {
        setSteps(generatedEmailsToSteps(res.emails));
      }
    } catch (err) {
      console.error("AI generation failed", err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <p className="text-[13px] text-white/30">Loading sequence…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        placeholder="Sequence name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-cf-card border-2 border-transparent rounded-[14px] py-3 px-4 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
        <div className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <div key={i} className="bg-cf-card rounded-[14px] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-white/40">
                  Step {i + 1}
                </span>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteStep(i)}
                    className="text-[11px] text-white/30 hover:text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Subject"
                value={step.subject}
                onChange={(e) => updateStep(i, { subject: e.target.value })}
                className="w-full bg-[#222228] rounded-[10px] py-2.5 px-3 text-[13px] text-white outline-none border border-transparent focus:border-cf-orange/40 mb-2 placeholder:text-white/30"
              />
              <textarea
                placeholder="Body — use the variables panel to personalize"
                value={step.body}
                onFocus={() => setActiveStep(i)}
                onChange={(e) => updateStep(i, { body: e.target.value })}
                rows={4}
                className="w-full bg-[#222228] rounded-[10px] py-2.5 px-3 text-[13px] text-white outline-none border border-transparent focus:border-cf-orange/40 mb-2 placeholder:text-white/30 resize-y"
              />
              <div className="flex items-center gap-3 text-[12px] text-white/50">
                <label className="flex items-center gap-1.5">
                  Wait
                  <input
                    type="number"
                    min={0}
                    value={step.delayDays}
                    onChange={(e) => updateStep(i, { delayDays: Number(e.target.value) })}
                    className="w-16 bg-[#222228] rounded-[8px] py-1.5 px-2 text-white outline-none border border-transparent focus:border-cf-orange/40"
                  />
                  days
                </label>
                <label className="flex items-center gap-1.5">
                  If
                  <select
                    value={step.condition.type}
                    onChange={(e) =>
                      updateStep(i, {
                        condition: { ...step.condition, type: e.target.value as ConditionType },
                      })
                    }
                    className="bg-[#222228] rounded-[8px] py-1.5 px-2 text-white outline-none border border-transparent focus:border-cf-orange/40"
                  >
                    <option value="always">always</option>
                    <option value="no_reply">no reply</option>
                    <option value="no_open">no open</option>
                  </select>
                </label>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addStep}
            className="self-start text-[12px] font-bold uppercase tracking-wide text-cf-orange hover:text-cf-orange/80"
          >
            + Add step
          </button>
        </div>

        <VariableGuide onInsert={insertVariable} />
      </div>

      {campaignId && (
        <div className="bg-cf-card rounded-[14px] p-4">
          <button
            type="button"
            onClick={openAiPicker}
            className="text-[12px] font-bold uppercase tracking-wide text-cf-orange hover:text-cf-orange/80"
          >
            AI-generate sequence
          </button>
          {showAi && (
            <div className="flex flex-wrap items-end gap-3 mt-3">
              <label className="flex flex-col gap-1 text-[12px] text-white/50">
                Pick a lead
                <select
                  aria-label="Pick a lead"
                  value={pickedLead}
                  onChange={(e) => setPickedLead(e.target.value)}
                  className="bg-[#222228] rounded-[10px] py-2 px-3 text-[13px] text-white outline-none border border-transparent focus:border-cf-orange/40"
                >
                  <option value="">Select a lead…</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.firstName ?? "Lead"}{l.company ? ` · ${l.company}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={!pickedLead || generating}
                className="bg-cf-orange text-white text-sm font-bold py-2 px-4 rounded-[10px] disabled:opacity-40 font-heading uppercase tracking-wide"
              >
                {generating ? "Generating…" : "Generate"}
              </button>
              <p className="text-[11px] text-white/35 leading-relaxed">
                Generates a 5-email Straight Line sequence for the picked lead. Tweak + save.
              </p>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="self-start bg-cf-orange text-white text-sm font-bold py-2.5 px-5 rounded-[12px] disabled:opacity-40 font-heading uppercase tracking-wide"
      >
        {saving ? "Saving…" : "Save sequence"}
      </button>
    </div>
  );
}