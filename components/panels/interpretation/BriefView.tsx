"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { BriefPoint, SectionBrief } from "@/data/interpretations/brief";

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

const LEAN = {
  up: { glyph: "▲", className: "text-good-strong", label: "Supports" },
  flat: { glyph: "–", className: "text-fg-subtle", label: "Context" },
  down: { glyph: "▼", className: "text-bad-strong", label: "Counts against" },
} as const;

/** The decisive points of a section, strongest first, with their direction. */
export function BriefPoints({ points, title = "Key factors" }: { points: BriefPoint[]; title?: string }) {
  if (!points.length) return null;
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{title}</div>
      <ul className="space-y-1">
        {points.map((p, i) => {
          const lean = LEAN[p.lean];
          return (
            <li key={i} className="flex items-start gap-2 text-sm leading-snug text-fg">
              <span className={`mt-0.5 shrink-0 text-xs ${lean.className}`} aria-hidden>
                {lean.glyph}
              </span>
              <span className="sr-only">{lean.label}: </span>
              <span>{p.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The short view of a scored section: decisive factors, the top options and
 * the next windows. Everything shown is selected from the section's own
 * weighted evidence (see `brief.ts`), so it never disagrees with the full text.
 */
export default function BriefView({ brief, topTitle = "Most likely" }: { brief: SectionBrief; topTitle?: string }) {
  return (
    <div className="space-y-3 rounded-lg border border-primary-border-soft bg-primary-wash/40 p-3">
      {brief.top.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{topTitle}</div>
          <ol className="space-y-1">
            {brief.top.map((t, i) => (
              <li key={t.label} className="text-sm leading-snug text-fg">
                <span className="font-semibold text-heading-2">
                  {i + 1}. {t.label}
                </span>{" "}
                <span className="font-mono text-xs text-fg-muted">
                  {t.score}/100 · {t.verdict}
                </span>
                {t.why && <span className="block text-xs text-fg-muted">{t.why}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
      <BriefPoints points={brief.points} />
      {brief.next.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">Next windows</div>
          <ul className="space-y-0.5">
            {brief.next.map((w, i) => (
              <li key={i} className="text-sm text-fg">
                <span className="font-mono text-xs">
                  {fmt(w.start)} → {fmt(w.end)}
                </span>{" "}
                <span className="text-xs text-fg-muted">
                  (age {w.ageRange.from}–{w.ageRange.to}) · {w.label} · {w.grade}, {w.confidence}%
                  {w.confirmedBy?.length ? ` · confirmed by ${w.confirmedBy.join(" + ")}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Collapsed container for the full prose and evidence behind a brief. */
export function FullReasoning({ children, label = "Full reasoning" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-line-soft">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-fg-muted transition hover:bg-inset"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {label}
      </button>
      {open && <div className="space-y-4 border-t border-line-soft px-3 py-3">{children}</div>}
    </div>
  );
}
