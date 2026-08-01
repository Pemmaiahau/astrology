"use client";

import type { Evidence } from "@/data/interpretations/report";

/**
 * Renders the "why" behind a reading: each piece of evidence with its lean
 * (supportive / challenging) and classical source when cited.
 */
export default function WhyList({ reasons, title = "Why" }: { reasons: Evidence[]; title?: string }) {
  if (!reasons.length) return null;
  return (
    <div className="rounded-lg border border-line-soft bg-surface-3 p-3">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{title}</div>
      <ul className="space-y-1">
        {reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-fg">
            <span
              className={`mt-0.5 shrink-0 ${r.weight >= 0 ? "text-good-strong" : "text-bad-strong"}`}
              aria-hidden
            >
              {r.weight >= 0 ? "▲" : "▼"}
            </span>
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
        ))}
      </ul>
    </div>
  );
}
