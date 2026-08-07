"use client";

import type { TimingWindow } from "@/data/interpretations/report";

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

const GRADE_STYLE: Record<TimingWindow["grade"], string> = {
  strong: "bg-good-soft text-good ring-good-ring",
  moderate: "bg-primary-soft text-heading ring-primary-ring",
  weak: "bg-neutral-soft text-fg-muted ring-neutral-ring",
};

/**
 * Elapsed windows read muted; the one you are living in reads loudest.
 * "Upcoming" is deliberately outline-only — it is the default state and should
 * not compete with the accent chip for attention.
 */
const PHASE_STYLE: Record<TimingWindow["phase"], string> = {
  past: "bg-neutral-soft text-fg-subtle ring-neutral-ring",
  current: "bg-accent-soft text-accent ring-accent-ring",
  future: "text-fg-muted ring-line-ring",
};

const PHASE_LABEL: Record<TimingWindow["phase"], string> = {
  past: "already passed",
  current: "running now",
  future: "upcoming",
};

function WindowRow({ w }: { w: TimingWindow }) {
  return (
    <li className={`text-xs leading-relaxed ${w.phase === "past" ? "text-fg-muted" : "text-fg"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={w.phase === "past" ? "font-medium text-fg-muted" : "font-medium text-fg-2"}>
          {w.label}
        </span>
        <span className="font-mono text-fg-muted">
          {fmt(w.start)} → {fmt(w.end)}
        </span>
        <span className="font-mono text-fg-subtle">
          age {w.ageRange.from}–{w.ageRange.to}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${PHASE_STYLE[w.phase]}`}
        >
          {PHASE_LABEL[w.phase]}
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
              <span className="font-mono">
                {fmt(s.start)} → {fmt(s.end)}
              </span>{" "}
              <span className="font-mono text-fg-subtle">
                (age {s.ageRange.from}–{s.ageRange.to})
              </span>{" "}
              — {s.label}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Probable-window list. Always phrased as windows, never as fixed dates, and
 * always anchored to the reader's own age — a window is only meaningful as a
 * stage of a life. Windows carrying a `group` are rendered under its heading.
 */
export default function TimingWindows({ windows, title }: { windows: TimingWindow[]; title: string }) {
  if (!windows.length) return null;

  // Preserve first-appearance order of groups; ungrouped windows keep a flat list.
  const groups: { name: string | null; items: TimingWindow[] }[] = [];
  for (const w of windows) {
    const name = w.group ?? null;
    const bucket = groups.find((g) => g.name === name);
    if (bucket) bucket.items.push(w);
    else groups.push({ name, items: [w] });
  }
  const grouped = groups.some((g) => g.name !== null);

  return (
    <div className="rounded-lg border border-line-soft bg-surface-3 p-3">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{title}</div>
      {grouped ? (
        <div className="space-y-3">
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.name && (
                <div className="mb-1 text-[11px] font-semibold text-fg-2">{g.name}</div>
              )}
              <ul className="space-y-2">
                {g.items.map((w, i) => (
                  <WindowRow key={i} w={w} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {windows.map((w, i) => (
            <WindowRow key={i} w={w} />
          ))}
        </ul>
      )}
    </div>
  );
}
