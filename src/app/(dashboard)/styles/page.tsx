"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { PenIcon } from "@/components/icons";

const personas = [
  {
    id: "closer",
    name: "The Closer",
    description: "Direct, confident, gets to the point. Perfect for busy decision-makers.",
    preview:
      "Hey {name}, I noticed your roofing on Elm St could use some attention. Want me to take a look this week? No strings attached.",
    traits: ["Direct", "Confident", "Action-oriented"],
    emoji: "🎯",
  },
  {
    id: "neighbor",
    name: "The Neighbor",
    description: "Warm, friendly, feels like talking to someone next door. Builds trust fast.",
    preview:
      "Hey {name}! Just wanted to reach out - I saw your place on my route today and couldn't help but notice the roof could use some love. Happy to swing by anytime!",
    traits: ["Warm", "Friendly", "Trust-building"],
    emoji: "👋",
  },
  {
    id: "expert",
    name: "The Expert",
    description: "Knowledgeable, professional, shares insights that demonstrate expertise.",
    preview:
      "Hi {name}, I've been inspecting roofs in your neighborhood this month and noticed a common pattern - most homes built around 2005 are due for an assessment. Happy to share what I've found.",
    traits: ["Knowledgeable", "Professional", "Insight-driven"],
    emoji: "🧠",
  },
  {
    id: "helper",
    name: "The Helper",
    description: "Empathetic, supportive, focused on solving problems before selling.",
    preview:
      "Hi {name}, I know dealing with roof issues can be stressful. I've helped a few folks in your area recently and would love to make the process easy for you too. What questions do you have?",
    traits: ["Empathetic", "Supportive", "Problem-solver"],
    emoji: "🤝",
  },
];

export default function StylesPage() {
  const [selected, setSelected] = useState("closer");
  const [customizing, setCustomizing] = useState(false);

  const activePersona = personas.find((p) => p.id === selected)!;

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
            onClick={() => setSelected(persona.id)}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-xl">{persona.emoji}</span>
              <h3 className="text-[15px] font-bold font-heading">{persona.name}</h3>
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
            defaultValue={activePersona.preview}
          />
        ) : (
          <p className="text-[13px] text-white/50 leading-relaxed">
            {activePersona.preview}
          </p>
        )}
      </Card>

      {/* Save button */}
      <button className="w-full py-3 rounded-[var(--radius-button)] bg-gradient-to-br from-cf-orange to-cf-orange-dark text-white text-sm font-bold hover:opacity-90 transition-opacity font-heading uppercase tracking-wide">
        Save Style
      </button>
    </>
  );
}
