"use client";

import type { Evidence } from "@/data/interpretations/report";

/**
 * Renders the "why" behind a reading: each piece of evidence with its lean
 * (supportive / neutral / challenging) and classical source when cited.
 *
 * Three states, not two. A zero-weight `Evidence` is context the section
 * recorded without it counting either way — the 7th lord's placement in the
 * marriage report, for instance. Testing `weight >= 0` folded those in with
 * the supportive ones and showed them under a green ▲, which reads as the
 * chart backing a claim it is actually neutral on.
 *
 * The glyph carries the meaning, so the polarity survives greyscale, print and
 * colour-blindness; the `sr-only` label carries it to screen readers, which
 * `aria-hidden` on the glyph would otherwise deny them.
 */
const LEAN = {
  up: { glyph: "▲", className: "text-good-strong", label: "Supports" },
  flat: { glyph: "–", className: "text-fg-subtle", label: "Context" },
  down: { glyph: "▼", className: "text-bad-strong", label: "Counts against" },
} as const;
export default function WhyList({ reasons, title = "Why" }: { reasons: Evidence[]; title?: string }) {
  if (!reasons.length) return null;
  return (
    <div className="rounded-lg border border-line-soft bg-surface-3 p-3">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{title}</div>
      <ul className="space-y-1">
        {reasons.map((r, i) => {
          const lean = LEAN[r.weight > 0 ? "up" : r.weight < 0 ? "down" : "flat"];
          return (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-fg">
            <span className={`mt-0.5 shrink-0 ${lean.className}`} aria-hidden>
              {lean.glyph}
            </span>
            <span className="sr-only">{lean.label}: </span>
            <span>
              {r.text}
              {r.source && (
                <span className="text-fg-subtle">
                  {" "}
                  — {r.source.work}
                  {r.source.ref ? `, ${r.source.ref}` : ""}
                </span>
              )}
            </span>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
