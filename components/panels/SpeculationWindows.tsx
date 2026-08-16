"use client";

import type { SpeculationWindow } from "@/data/interpretations/speculation";

/**
 * Favourable / adverse window renderer.
 *
 * Deliberately NOT `TimingWindows.tsx`: that component has no concept of an
 * adverse window, and rendering a bad stretch as `grade: "weak"` would read as
 * "a mild good period" — a lie in exactly the place it matters most. This one
 * carries polarity as a first-class property, so an adverse window is styled
 * as adverse rather than as a faint positive.
 *
 * Same visual grammar otherwise: month ranges (never fixed dates), a phase
 * chip, and elapsed rows muted.
 */

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

/**
 * A window's `end` is the exclusive start of the next month block, so naming
 * it directly would print the month *after* the one the window covers. Step
 * back a millisecond to land inside the final month.
 */
const fmtEnd = (d: Date) => fmt(new Date(d.getTime() - 1));

const POLARITY_STYLE: Record<
  SpeculationWindow["polarity"],
  Record<SpeculationWindow["grade"], string>
> = {
  favourable: {
    strong: "bg-good-soft text-good ring-good-ring",
    moderate: "bg-good-wash text-good-2 ring-good-border",
    mild: "bg-neutral-soft text-fg-muted ring-neutral-ring",
  },
  adverse: {
    strong: "bg-bad-soft text-bad ring-bad-ring",
    moderate: "bg-bad-wash text-bad-2 ring-bad-border",
    mild: "bg-warn-soft text-warn ring-warn-ring",
  },
};

const PHASE_STYLE: Record<SpeculationWindow["phase"], string> = {
  past: "bg-neutral-soft text-fg-subtle ring-neutral-ring",
  current: "bg-accent-soft text-accent ring-accent-ring",
  future: "text-fg-muted ring-line-ring",
};

const PHASE_LABEL: Record<SpeculationWindow["phase"], string> = {
  past: "already passed",
  current: "running now",
  future: "upcoming",
};

function WindowRow({ w }: { w: SpeculationWindow }) {
  return (
    <li className={`text-xs leading-relaxed ${w.phase === "past" ? "text-fg-muted" : "text-fg"}`}>
      <div className="mb-0.5 flex flex-wrap items-center gap-2">
        <span className={`font-mono text-[11px] ${w.phase === "past" ? "text-fg-subtle" : "text-fg-muted"}`}>
          {fmt(w.start)} → {fmtEnd(w.end)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${POLARITY_STYLE[w.polarity][w.grade]}`}
        >
          {w.grade} {w.polarity === "favourable" ? "support" : "headwind"}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${PHASE_STYLE[w.phase]}`}
        >
          {PHASE_LABEL[w.phase]}
        </span>
        <span className="font-mono text-[10px] text-fg-subtle">
          {w.score > 0 ? "+" : ""}
          {w.score}
        </span>
        <span className="text-[10px] text-fg-subtle">{w.confidence}% confidence</span>
      </div>
      <div className={`font-medium ${w.phase === "past" ? "text-fg-muted" : "text-fg-2"}`}>{w.label}</div>
      {w.reasons.length > 0 && (
        <ul className="mt-1 space-y-0.5 border-l border-line pl-3">
          {w.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-fg-muted">
              <span
                className={`mt-0.5 shrink-0 ${r.weight >= 0 ? "text-good-strong" : "text-bad-strong"}`}
                aria-hidden
              >
                {r.weight >= 0 ? "▲" : "▼"}
              </span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function SpeculationWindows({
  windows,
  title,
  emptyNote,
}: {
  windows: SpeculationWindow[];
  title: string;
  emptyNote: string;
}) {
  return (
    <div className="rounded-lg border border-line-soft bg-surface-3 p-3">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{title}</div>
      {windows.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-fg-muted">{emptyNote}</p>
      ) : (
        <ul className="space-y-2.5">
          {windows.map((w, i) => (
            <WindowRow key={i} w={w} />
          ))}
        </ul>
      )}
    </div>
  );
}
