"use client";

import { CheckCircle2, CircleDashed } from "lucide-react";
import WhyList from "@/components/panels/interpretation/WhyList";
import { EVENT_RULES } from "@/utils/astrology/rectification/eventRules";
import { COMPONENT_WEIGHTS } from "@/utils/astrology/rectification/score";
import type { CandidateScore, LifeEvent } from "@/utils/astrology/rectification/types";

/**
 * Per-event hit/miss at the winning minute, each with the classical reason that
 * produced it. Reuses `WhyList` from the Interpretation tab — the reason rows
 * are structurally the same `Evidence` shape, so the same component renders
 * them and the two tabs stay visually consistent.
 */

function Bar({ label, value, weight }: { label: string; value: number; weight: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-inset-2">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-cta-from to-cta-to-hover"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </span>
      <span className="w-24 shrink-0 text-right font-mono text-[10px] text-fg-subtle">
        {value.toFixed(2)} × {weight.toFixed(2)}
      </span>
    </div>
  );
}

export default function EventBreakdown({
  candidate,
  events,
}: {
  candidate: CandidateScore;
  events: LifeEvent[];
}) {
  return (
    <div className="space-y-3">
      {candidate.events.map((e) => {
        const source = events.find((x) => x.id === e.eventId);
        const rule = EVENT_RULES[e.type];
        return (
          <div
            key={e.eventId}
            className={`rounded-lg border p-3 ${e.hit ? "border-good-border bg-good-wash" : "border-line-soft bg-surface-3"}`}
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              {e.hit ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-good-strong" />
              ) : (
                <CircleDashed className="h-4 w-4 shrink-0 text-fg-subtle" />
              )}
              <span className="font-serif text-sm font-bold text-heading">{rule.label}</span>
              <span className="font-mono text-[11px] text-fg-muted">{source?.dateISO}</span>
              <span className="rounded-full bg-inset px-2 py-0.5 text-[10px] font-medium text-fg-muted">
                {source?.precision} · {source?.reliability} · weight {e.weight.toFixed(2)}
              </span>
              <span className="ml-auto font-mono text-sm font-bold text-heading">
                {e.score.toFixed(3)}
              </span>
            </div>

            <p className="mb-2 text-xs leading-relaxed text-fg">{e.summary}</p>

            <div className="mb-2 space-y-1">
              <Bar label="Dasha" value={e.dasha.score} weight={COMPONENT_WEIGHTS.dasha} />
              <Bar label="Transit" value={e.transit.score} weight={COMPONENT_WEIGHTS.transit} />
              <Bar label="Varga" value={e.varga.score} weight={COMPONENT_WEIGHTS.varga} />
            </div>

            <div className="space-y-2">
              <WhyList reasons={e.dasha.reasons} title="Dasha lords" />
              <WhyList reasons={e.transit.reasons} title="Gochara (transits)" />
              <WhyList reasons={e.varga.reasons} title="Divisional charts" />
            </div>

            <p className="mt-2 text-[10px] leading-relaxed text-fg-subtle">
              <span className="font-semibold">Rule: </span>
              {rule.doctrine}
              {e.samples > 1 && ` Integrated over ${e.samples} instants because the date is not exact.`}
              {e.daysToPratyantarBoundary !== null &&
                e.daysToPratyantarBoundary < 10 &&
                ` The event sits ${e.daysToPratyantarBoundary.toFixed(1)} days from a sub-sub-period boundary, so this row is unusually sensitive to the birth minute.`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
