"use client";

import { PLANET_NAMES } from "@/utils/astrology/constants";
import { ordinal } from "@/utils/astrology/format";
import type { EventReasoning } from "@/data/interpretations/lifeEvents";
import type { Verdict } from "@/data/interpretations/report";
import WhyList from "@/components/panels/interpretation/WhyList";

/**
 * Why one window is on the timeline.
 *
 * Four limbs in the order the engine builds them — the birth chart's promise,
 * the dasha, the transits, the age band — then the classical rule the whole
 * reading came from. The rule is shown last and in full: a reader who
 * disagrees with the doctrine should be able to see exactly which doctrine
 * they are disagreeing with, and every score above it is derived from those
 * houses and karakas alone.
 */

const VERDICT_STYLE: Record<Verdict, string> = {
  "Strong promise": "bg-good-soft text-good ring-good-ring",
  Supportive: "bg-info-soft text-info ring-info-ring",
  Mixed: "bg-primary-soft text-heading ring-primary-ring",
  "Needs effort": "bg-warn-soft text-warn ring-warn-ring",
  Challenged: "bg-bad-soft text-bad ring-bad-ring",
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{title}</div>
      {children}
    </div>
  );
}

export default function EventReasoningPanel({ r }: { r: EventReasoning }) {
  return (
    <div className="space-y-4 border-t border-line-soft p-4">
      <p className="text-sm font-medium italic text-heading-2">{r.headline}</p>

      {/* --- 1. Does the chart promise it at all? --- */}
      <Block title="Natal promise — what the birth chart holds">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${VERDICT_STYLE[r.promiseVerdict]}`}
          >
            {r.promiseVerdict}
          </span>
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-inset-2">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-cta-from to-cta-to-hover"
              style={{ width: `${r.promiseScore}%` }}
            />
          </span>
          <span className="font-mono text-xs text-fg-muted">{r.promiseScore}/100</span>
        </div>
        <WhyList reasons={r.promiseEvidence} title="From the birth chart" />
      </Block>

      {/* --- 2. The period --- */}
      <Block title="Vimshottari period">
        <p className="mb-1.5 text-sm font-semibold text-heading">{r.dashaLabel}</p>
        <ul className="space-y-0.5 text-xs leading-relaxed text-fg-muted">
          {r.mahaClaims.length > 0 && (
            <li>
              <span className="font-semibold text-fg-2">Mahadasha lord:</span> {r.mahaClaims.join(" · ")}
            </li>
          )}
          {r.antarClaims.length > 0 && (
            <li>
              <span className="font-semibold text-fg-2">Antardasha lord:</span> {r.antarClaims.join(" · ")}
            </li>
          )}
        </ul>
      </Block>

      {/* --- 3. The sky --- */}
      <Block title="Gochara — transits over the period">
        <div className="space-y-2 rounded-lg border border-line-soft bg-surface-3 p-3">
          <p className="text-xs leading-relaxed text-fg">
            {r.doubleTransitPct > 0 ? (
              <>
                <span className="font-semibold text-heading">Guru–Shani double transit:</span> Jupiter and
                Saturn jointly influence the houses of this event across{" "}
                <span className="font-mono">{r.doubleTransitPct}%</span> of the period.
              </>
            ) : (
              <span className="text-fg-muted">
                Jupiter and Saturn do not jointly light these houses during this period — the strongest
                classical confirmation is absent here.
              </span>
            )}
          </p>

          {r.contactLines.length > 0 && (
            <ul className="space-y-0.5">
              {r.contactLines.map((c, i) => (
                <li key={i} className="text-[11px] leading-relaxed text-fg-muted">
                  {c}
                </li>
              ))}
            </ul>
          )}

          <ul className="space-y-0.5 border-t border-line-soft pt-2">
            {r.gocharaLines.map((g, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-fg-muted">
                {g}
              </li>
            ))}
          </ul>

          {r.saturnLine && (
            <p className="rounded-md border border-warn-ring bg-warn-soft px-2 py-1.5 text-[11px] leading-relaxed text-warn">
              {r.saturnLine}
            </p>
          )}
        </div>
      </Block>

      {/* --- 4. Everything that moved the score --- */}
      <Block title="How the score was reached">
        <WhyList reasons={r.weighted} title="Weighted contributions" />
        {r.ageLine && <p className="mt-1.5 text-[11px] leading-relaxed text-fg-subtle">{r.ageLine}</p>}
      </Block>

      {/* --- 5. The rule --- */}
      <div className="rounded-lg border border-heading-border bg-primary-wash p-3">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-eyebrow">
          The classical rule this was read from
        </div>
        <p className="text-xs leading-relaxed text-fg">{r.doctrine}</p>
        <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-fg-subtle">
          Houses read: {r.houses.primary.map(ordinal).join(", ")}
          {r.houses.supporting.length > 0 && ` · supporting ${r.houses.supporting.map(ordinal).join(", ")}`}
          {r.houses.negating.length > 0 && ` · obstructing ${r.houses.negating.map(ordinal).join(", ")}`}
          {" · karakas "}
          {r.karakas.map((k) => PLANET_NAMES[k]).join(", ")}
        </p>
      </div>
    </div>
  );
}
