"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import type { LifeEventOccurrence } from "@/data/interpretations/lifeEvents";
import type { TimingWindow } from "@/data/interpretations/report";
import EventReasoningPanel from "./EventReasoningPanel";

/**
 * One predicted window on the timeline.
 *
 * Collapsed it is a single scannable line — event, dates, the reader's own age,
 * phase and confidence. Expanded it becomes the reasoning panel. The reasoning
 * is mounted lazily on first expand, the same boundary `SectionCard` uses, so a
 * timeline of a hundred windows costs a hundred header rows and nothing more
 * until something is opened.
 */

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

const GRADE_STYLE: Record<TimingWindow["grade"], string> = {
  strong: "bg-good-soft text-good ring-good-ring",
  moderate: "bg-primary-soft text-heading ring-primary-ring",
  weak: "bg-neutral-soft text-fg-muted ring-neutral-ring",
};

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

export default function EventCard({
  entry,
  icon: Icon,
}: {
  entry: LifeEventOccurrence;
  icon: LucideIcon;
}) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const w = entry.window;

  return (
    <div
      className={`rounded-xl border bg-surface transition ${
        w.phase === "current" ? "border-accent-border" : "border-line"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setEverOpened(true);
        }}
        className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1.5 p-3 text-left transition hover:bg-inset"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-eyebrow" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
        )}
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span
          className={`font-serif text-sm font-bold ${w.phase === "past" ? "text-fg-muted" : "text-fg-2"}`}
        >
          {entry.label}
        </span>
        <span className="font-mono text-xs text-fg-muted">
          {fmt(w.start)} → {fmt(w.end)}
        </span>
        <span className="font-mono text-[11px] text-fg-subtle">
          age {w.ageRange.from}–{w.ageRange.to}
        </span>

        <span className="ml-auto flex flex-wrap items-center gap-1.5">
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
          <span
            className="text-[10px] text-fg-subtle"
            title="How consistently the chart's limbs point the same way for this window"
          >
            {w.confidence}% confidence
          </span>
        </span>
      </button>

      {!open && (
        <div className="px-3 pb-2.5 pl-11">
          <p className="text-[11px] leading-relaxed text-fg-muted">{w.label} — {entry.reasoning.headline}</p>
          {w.subWindows && w.subWindows.length > 0 && (
            <p className="mt-0.5 text-[11px] text-fg-subtle">
              <span className="font-semibold">Tightest stretch:</span> {fmt(w.subWindows[0].start)} →{" "}
              {fmt(w.subWindows[0].end)}
            </p>
          )}
        </div>
      )}

      {open && everOpened && (
        <>
          {w.subWindows && w.subWindows.length > 0 && (
            <div className="border-t border-line-soft px-4 py-3">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
                Triggers inside this window
              </div>
              <ul className="space-y-1 border-l border-line pl-3">
                {w.subWindows.map((s, i) => (
                  <li key={i} className="text-[11px] leading-relaxed text-fg-muted">
                    <span className="font-mono text-fg-subtle">
                      {fmt(s.start)} → {fmt(s.end)}
                    </span>{" "}
                    <span className="font-mono text-fg-faint">
                      (age {s.ageRange.from}–{s.ageRange.to})
                    </span>{" "}
                    — {s.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <EventReasoningPanel r={entry.reasoning} />
        </>
      )}
    </div>
  );
}
