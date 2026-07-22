"use client";

import { MERGE_TAG_DOCS } from "@/lib/emails/merge-tags";

interface VariableGuideProps {
  /** Called with the tag (e.g. {{firstName}}) when a chip is clicked. */
  onInsert: (tag: string) => void;
  className?: string;
}

/**
 * Reference panel for the available email merge tags. Renders the canonical
 * list from `MERGE_TAG_DOCS` as clickable chips — clicking inserts the tag into
 * the editor via `onInsert`.
 */
export function VariableGuide({ onInsert, className }: VariableGuideProps) {
  return (
    <div className={`rounded-[14px] bg-cf-card p-4 ${className ?? ""}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-white/40 mb-2">
        Variables
      </p>
      <p className="text-[11px] text-white/35 leading-relaxed mb-3">
        Click to insert. Replaced per recipient when the email sends.
      </p>
      <div className="flex flex-col gap-1.5">
        {MERGE_TAG_DOCS.map((doc) => (
          <button
            key={doc.tag}
            type="button"
            onClick={() => onInsert(doc.tag)}
            className="group flex items-start gap-2 text-left rounded-[8px] px-2 py-1.5 hover:bg-white/[0.04] transition-colors"
          >
            <code className="text-[12px] font-bold text-cf-orange shrink-0 group-hover:text-cf-orange/80">
              {doc.tag}
            </code>
            <span className="text-[11px] text-white/40 leading-relaxed">
              {doc.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}