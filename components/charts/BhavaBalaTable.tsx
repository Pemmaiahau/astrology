"use client";

import { useChart } from "@/components/context/ChartContext";
import { HOUSE_SIGNIFICATIONS, SIGNS } from "@/utils/astrology/constants";
import { ordinal } from "@/utils/astrology/format";

/**
 * Bhava Bala — the classical strength of each of the twelve houses, in rupas.
 *
 * `computeBhavaBala` has run on every chart with a birth anchor since the
 * Shadbala layer landed, and `ChartContext` has carried the result the whole
 * time without a single component reading it. This is that surface.
 *
 * Sits beside the Ashtakavarga grid because the two answer the same question
 * from different directions: Ashtakavarga scores a house by transit support,
 * Bhava Bala by the standing strength of its lord, its occupants and the
 * glances it receives. Where they disagree, the disagreement is the finding.
 */

/** One rupa = 60 virupas. The classical "sufficient" mark for a bhava. */
const STRONG_RUPAS = 8;
const WEAK_RUPAS = 5;

function band(rupas: number): { label: string; chip: string; glyph: string } {
  if (rupas >= STRONG_RUPAS)
    return { label: "strong", chip: "bg-good-soft text-good ring-good-ring", glyph: "▲" };
  if (rupas < WEAK_RUPAS)
    return { label: "weak", chip: "bg-bad-soft text-bad ring-bad-ring", glyph: "▼" };
  return { label: "moderate", chip: "bg-neutral-soft text-fg-muted ring-neutral-ring", glyph: "–" };
}

export default function BhavaBalaTable() {
  const { bhavaBala, chart } = useChart();

  if (!chart) return null;
  if (!bhavaBala) {
    return (
      <p className="rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-fg-muted">
        House strength (Bhava Bala) needs an exact birth time and place, because several of its parts are
        measured from the moment of birth itself. Add a birth anchor to compute it.
      </p>
    );
  }

  const max = Math.max(...bhavaBala.map((b) => b.rupas), 1);
  const strongest = bhavaBala.reduce((a, b) => (b.rupas > a.rupas ? b : a));
  const weakest = bhavaBala.reduce((a, b) => (b.rupas < a.rupas ? b : a));

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-heading-border bg-primary-wash p-3">
        <h3 className="font-serif text-base font-bold text-heading">House Strength (Bhava Bala)</h3>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">
          How much backing each house has, measured the classical way in rupas — from the strength of its
          ruling planet, whatever sits in it, and the glances it receives. Your strongest area is the{" "}
          <span className="font-semibold text-fg-2">{ordinal(strongest.house)}</span> and your weakest is the{" "}
          <span className="font-semibold text-fg-2">{ordinal(weakest.house)}</span>. Read it alongside the
          Ashtakavarga grid above: that scores a house by how well transits through it tend to go, this
          scores what the house has to start with.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="bg-inset text-left uppercase tracking-wider text-eyebrow">
              <th className="px-2 py-2">House</th>
              <th className="px-2 py-2">Sign</th>
              <th className="px-2 py-2">Governs</th>
              <th className="px-2 py-2 text-right">Rupas</th>
              <th className="px-2 py-2">Strength</th>
            </tr>
          </thead>
          <tbody>
            {bhavaBala.map((b) => {
              const sign = (chart.ascendant.sign + b.house - 1) % 12;
              const t = band(b.rupas);
              return (
                <tr key={b.house} className="border-t border-line-faint">
                  <td className="px-2 py-1.5 font-semibold text-fg-strong">{ordinal(b.house)}</td>
                  <td className="px-2 py-1.5 text-fg">{SIGNS[sign]}</td>
                  <td className="px-2 py-1.5 text-fg-muted">
                    {HOUSE_SIGNIFICATIONS[b.house - 1].split(",").slice(0, 2).join(", ")}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-fg">{b.rupas.toFixed(2)}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-inset-2">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-cta-from to-cta-to-hover"
                          style={{ width: `${Math.round((b.rupas / max) * 100)}%` }}
                        />
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${t.chip}`}
                      >
                        <span aria-hidden>{t.glyph}</span> {t.label}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-fg-subtle">
        Bands follow the usual working convention rather than a sutra: 8 rupas and above reads as strong,
        below 5 as needing support. The absolute numbers matter less than the ordering — which of your
        houses has the most behind it, and which has the least.
      </p>
    </div>
  );
}
