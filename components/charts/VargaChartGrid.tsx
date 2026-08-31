"use client";

import { PLANET_NAMES, SIGNS, SIGNS_SANSKRIT } from "@/utils/astrology/constants";
import { DIGNITY_SHORT } from "@/utils/astrology/states";
import type { VargaChart } from "@/utils/astrology/varga";
import { VARGA_NAMES } from "@/utils/astrology/varga";

/**
 * A South Indian grid for any divisional chart.
 *
 * `SouthIndianChart` is bound to `ChartData` — it reads degrees, retrogression,
 * combustion and Bhava Chalit, none of which exist in a varga. A varga position
 * is a sign and a dignity and nothing else, because degree inside a varga sign
 * carries no classical meaning. So this is a separate, deliberately thinner
 * component rather than a generalisation of that one: trying to share a
 * component would have meant threading "which of these fields are real here?"
 * through every row of the existing chart.
 */

/** Fixed sign boxes, clockwise, Aries in the second box of the top row. */
const SIGN_CELL: Record<number, [number, number]> = {
  11: [0, 0], 0: [0, 1], 1: [0, 2], 2: [0, 3],
  10: [1, 0], 3: [1, 3],
  9: [2, 0], 4: [2, 3],
  8: [3, 0], 7: [3, 1], 6: [3, 2], 5: [3, 3],
};

const STRONG = ["exalted", "moolatrikona", "own", "greatFriend"];
const WEAK = ["debilitated", "greatEnemy", "enemy"];

export default function VargaChartGrid({
  chart,
  subtitle,
}: {
  chart: VargaChart;
  subtitle?: string;
}) {
  const cells: (React.ReactNode | null)[][] = Array.from({ length: 4 }, () => Array(4).fill(null));

  for (let sign = 0; sign < 12; sign++) {
    const [r, c] = SIGN_CELL[sign];
    const houseNum = ((sign - chart.ascendant + 12) % 12) + 1;
    const isLagna = sign === chart.ascendant;
    const occupants = chart.positions.filter((p) => p.sign === sign);

    cells[r][c] = (
      <div
        key={sign}
        className={`relative flex min-h-[78px] flex-col overflow-hidden border border-line-strong p-1.5 ${
          isLagna ? "bg-primary-wash-2 ring-1 ring-inset ring-primary-ring" : "bg-surface"
        }`}
      >
        <div className="flex items-start justify-between">
          <span className="text-[9px] uppercase tracking-wide text-fg-subtle">{SIGNS[sign].slice(0, 3)}</span>
          <span
            className={`rounded px-1 text-[9px] font-bold ${
              isLagna ? "bg-primary-soft text-heading" : "bg-inset-3 text-planet"
            }`}
          >
            {houseNum}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5">
          {occupants.map((p) => (
            <span key={p.id} className="flex items-baseline gap-0.5 leading-tight">
              <span
                className={`text-[11px] font-bold ${
                  STRONG.includes(p.dignity)
                    ? "text-good"
                    : WEAK.includes(p.dignity)
                      ? "text-bad-strong"
                      : "text-fg-2"
                }`}
                title={`${PLANET_NAMES[p.id]} — ${p.dignity}`}
              >
                {p.id}
              </span>
              <span className="text-[8px] text-fg-subtle">{DIGNITY_SHORT[p.dignity]}</span>
              {p.vargottama && (
                <span className="text-[8px] font-bold text-accent" title="Vargottama">
                  ★
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-line-strong">
      {cells.map((row, r) =>
        row.map((cell, c) => {
          if (cell) return cell;
          if (r === 1 && c === 1) {
            return (
              <div
                key="centre"
                className="col-span-2 row-span-2 flex flex-col items-center justify-center gap-0.5 border border-line-strong bg-gradient-to-br from-surface-solid via-inset-2 to-surface-solid p-2 text-center"
              >
                <span className="font-serif text-sm font-bold text-primary">
                  {VARGA_NAMES[chart.varga]}
                </span>
                <span className="font-mono text-[10px] text-fg-muted">{chart.varga}</span>
                <span className="text-[10px] text-fg">
                  Lagna: {SIGNS[chart.ascendant]} ({SIGNS_SANSKRIT[chart.ascendant]})
                </span>
                {subtitle && <span className="mt-0.5 text-[9px] leading-tight text-fg-subtle">{subtitle}</span>}
              </div>
            );
          }
          if ((r === 1 || r === 2) && (c === 1 || c === 2)) return null;
          return <div key={`${r}-${c}`} />;
        })
      )}
    </div>
  );
}
