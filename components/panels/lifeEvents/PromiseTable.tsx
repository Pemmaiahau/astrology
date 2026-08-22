"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Sprout } from "lucide-react";
import type { EventPromiseSummary } from "@/data/interpretations/lifeEvents";
import type { Verdict } from "@/data/interpretations/report";
import { CATEGORY_LABELS } from "@/data/interpretations/lifeEventRules";

/**
 * Natal promise, every event at once.
 *
 * The timeline answers "when"; this answers the question that comes before it
 * — "does the chart hold this at all?" — and the two genuinely differ. An
 * event can have a fine window sitting on a chart that is reserved about it,
 * and a reader deserves to see that rather than being handed the date alone.
 * Events the scan left silent appear here too, which is the only place they
 * can appear: their absence from the timeline is itself a reading.
 */

const VERDICT_STYLE: Record<Verdict, string> = {
  "Strong promise": "bg-good-soft text-good ring-good-ring",
  Supportive: "bg-info-soft text-info ring-info-ring",
  Mixed: "bg-primary-soft text-heading ring-primary-ring",
  "Needs effort": "bg-warn-soft text-warn ring-warn-ring",
  Challenged: "bg-bad-soft text-bad ring-bad-ring",
};

export default function PromiseTable({ promises }: { promises: EventPromiseSummary[] }) {
  const [open, setOpen] = useState(false);
  if (!promises.length) return null;

  return (
    <section className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
        )}
        <Sprout className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 font-serif text-base font-bold text-heading">
          Natal Promise — what the chart holds
        </span>
        <span className="text-[11px] text-fg-subtle">{promises.length} events</span>
      </button>

      {open && (
        <div className="space-y-2 px-4 pb-4">
          <p className="text-xs leading-relaxed text-fg-muted">
            Before timing comes promise: a dasha can only deliver what the birth chart already holds. Each
            score below is built from the Bhava Bala of the event&apos;s houses, the Shadbala of their lords
            and of its karakas, the drishti landing on them, the nakshatra lords of their cusps and the
            Sarvashtakavarga support — all natal, none of it moving with time.
          </p>

          <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
            {promises.map((p) => (
              <li key={p.key} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 bg-surface-3 px-3 py-2">
                <span className="text-xs font-semibold text-fg-2">{p.label}</span>
                <span className="text-[10px] uppercase tracking-wider text-fg-faint">
                  {CATEGORY_LABELS[p.category]}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  {p.silent && (
                    <span
                      className="rounded-full bg-neutral-soft px-2 py-0.5 text-[10px] font-medium text-fg-subtle ring-1 ring-inset ring-neutral-ring"
                      title="No window cleared this event's reporting threshold anywhere in the scanned life"
                    >
                      no window
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${VERDICT_STYLE[p.verdict]}`}
                  >
                    {p.verdict}
                  </span>
                  <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-inset-2 sm:block">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-cta-from to-cta-to-hover"
                      style={{ width: `${p.score}%` }}
                    />
                  </span>
                  <span className="w-7 text-right font-mono text-[11px] text-fg-muted">{p.score}</span>
                </span>
                {p.weakness && (
                  <p className="w-full text-[11px] leading-relaxed text-fg-subtle">
                    Weakest link: {p.weakness}.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
