"use client";

import { AlertTriangle, GitCompareArrows } from "lucide-react";
import { AYANAMSHA_LABELS } from "@/utils/astrology/ayanamsha";
import { NAKSHATRAS, PLANET_NAMES } from "@/utils/astrology/constants";
import { EVENT_RULES } from "@/utils/astrology/rectification/eventRules";
import type {
  ConfidenceTier,
  DualAyanamshaResult,
  RectificationResult,
} from "@/utils/astrology/rectification/types";

/**
 * Side-by-side reconciliation of the two independent sweeps.
 *
 * The two columns are never averaged, blended, or resolved into a single
 * "answer" — that would be inventing a school that neither tradition holds.
 * Their agreement is the confidence signal, their disagreement is information,
 * and the per-event split is often more useful than either winning time.
 */

const TIER_STYLE: Record<ConfidenceTier, string> = {
  High: "bg-good-soft text-good ring-good-ring",
  Moderate: "bg-primary-soft text-heading ring-primary-ring",
  Low: "bg-bad-soft text-bad ring-bad-ring",
};

function Column({ result }: { result: RectificationResult }) {
  return (
    <div className="rounded-lg border border-line-soft bg-surface-3 p-3">
      <div className="mb-1 font-serif text-sm font-bold text-heading">
        {AYANAMSHA_LABELS[result.ayanamsha]}
      </div>
      <div className="font-mono text-2xl font-bold text-heading-2">
        {result.interval.startLocal}
        {result.interval.startOffsetMin !== result.interval.endOffsetMin && `–${result.interval.endLocal}`}
      </div>
      <div className="mb-2 font-mono text-[11px] text-fg-muted">
        best {result.best.localTime} ({result.best.offsetMin > 0 ? "+" : ""}
        {result.best.offsetMin} min)
      </div>
      <dl className="space-y-0.5 text-[11px] text-fg-muted">
        <div className="flex justify-between gap-2">
          <dt>Verdict</dt>
          <dd className={result.verdict === "determinate" ? "font-semibold text-good" : "font-semibold text-warn"}>
            {result.verdict === "determinate" ? "Determinate" : "Indeterminate"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Score</dt>
          <dd className="font-mono text-fg">{result.best.score.toFixed(4)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Margin over next</dt>
          <dd className="font-mono text-fg">{result.stats.margin.toFixed(4)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>z over median</dt>
          <dd className="font-mono text-fg">{result.stats.zScore.toFixed(2)}σ</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Leave-one-out</dt>
          <dd className={result.stability.stable ? "text-good" : "text-bad"}>
            {result.stability.stable ? "stable" : "unstable"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Moon nakshatra</dt>
          <dd className="text-fg">{NAKSHATRAS[result.best.moonNakshatra]}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Opening dasha</dt>
          <dd className="text-fg">{PLANET_NAMES[result.best.openingLord]}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function AyanamshaCompare({ result }: { result: DualAyanamshaResult }) {
  const r = result.reconciliation;

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <GitCompareArrows className="h-4 w-4 text-primary" />
        <h3 className="font-serif text-base font-bold text-heading">
          Lahiri and Pushya, computed independently
        </h3>
        <span
          className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${TIER_STYLE[r.tier]}`}
        >
          {r.tier} confidence · {r.divergenceMin} min apart
        </span>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Column result={result.lahiri} />
        <Column result={result.pushya} />
      </div>

      {r.nakshatraDivergence && (
        <div className="mb-3 rounded-lg border border-bad-border bg-bad-wash p-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-bad">
            <AlertTriangle className="h-4 w-4" /> The two systems disagree about your Moon&apos;s nakshatra
          </div>
          <p className="text-xs leading-relaxed text-bad-2">
            Under Lahiri the Moon sits in {NAKSHATRAS[r.lahiriOpening.nakshatra]} (
            {PLANET_NAMES[r.lahiriOpening.lord]}-ruled); under Pushya it sits in{" "}
            {NAKSHATRAS[r.pushyaOpening.nakshatra]} ({PLANET_NAMES[r.pushyaOpening.lord]}-ruled).
            That is not a small difference. The opening Mahadasha lord, the balance of dasha at
            birth and the order of all nine Mahadashas differ — the two columns above are running
            two entirely different Vimshottari sequences and are answering two different questions.
            Choose the ayanamsha you work in, then read only that column. Do not average them.
          </p>
        </div>
      )}

      <div className="mb-3 overflow-x-auto rounded-lg border border-line-soft">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="bg-inset text-[10px] uppercase tracking-wider text-fg-subtle">
            <tr>
              <th className="px-2 py-1.5 font-bold">Event</th>
              <th className="px-2 py-1.5 font-bold">Lahiri</th>
              <th className="px-2 py-1.5 font-bold">Pushya</th>
              <th className="px-2 py-1.5 font-bold">Fits better under</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-faint">
            {r.eventSplit.map((s) => (
              <tr key={s.eventId}>
                <td className="px-2 py-1 text-fg">{EVENT_RULES[s.type].label}</td>
                <td className="px-2 py-1 font-mono text-fg-muted">{s.lahiriScore.toFixed(3)}</td>
                <td className="px-2 py-1 font-mono text-fg-muted">{s.pushyaScore.toFixed(3)}</td>
                <td
                  className={`px-2 py-1 font-medium ${
                    s.favours === "tie" ? "text-fg-subtle" : "text-heading-2"
                  }`}
                >
                  {s.favours === "tie" ? "—" : AYANAMSHA_LABELS[s.favours].split(" ")[0]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-1.5">
        {r.notes.map((n, i) => (
          <li key={i} className="text-[11px] leading-relaxed text-fg-muted">
            — {n}
          </li>
        ))}
      </ul>
    </section>
  );
}
