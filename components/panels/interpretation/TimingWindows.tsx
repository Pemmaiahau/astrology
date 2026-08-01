"use client";

import type { TimingWindow } from "@/data/interpretations/report";

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

const GRADE_STYLE: Record<TimingWindow["grade"], string> = {
  strong: "bg-good-soft text-good ring-good-ring",
  moderate: "bg-primary-soft text-heading ring-primary-ring",
  weak: "bg-neutral-soft text-fg-muted ring-neutral-ring",
};

/** Probable-window list. Always phrased as windows, never as fixed dates. */
export default function TimingWindows({ windows, title }: { windows: TimingWindow[]; title: string }) {
  if (!windows.length) return null;
  return (
    <div className="rounded-lg border border-line-soft bg-surface-3 p-3">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{title}</div>
      <ul className="space-y-2">
        {windows.map((w, i) => (
          <li key={i} className="text-xs leading-relaxed text-fg">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-fg-2">{w.label}</span>
              <span className="font-mono text-fg-muted">
                {fmt(w.start)} → {fmt(w.end)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${GRADE_STYLE[w.grade]}`}
              >
                {w.grade}
              </span>
              <span className="text-[10px] text-fg-subtle">{w.confidence}% confidence</span>
            </div>
            {w.reasons.length > 0 && (
              <div className="mt-0.5 text-[11px] text-fg-muted">{w.reasons.join(" · ")}</div>
            )}
            {w.subWindows && w.subWindows.length > 0 && (
              <ul className="mt-1 space-y-0.5 border-l border-line pl-3">
                {w.subWindows.map((s, j) => (
                  <li key={j} className="text-[11px] text-fg-muted">
                    <span className="font-mono">{fmt(s.start)} → {fmt(s.end)}</span> — {s.label}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
