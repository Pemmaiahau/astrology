"use client";

import { useChart } from "@/components/context/ChartContext";
import { AYANAMSHA_LABELS } from "@/utils/astrology/ayanamsha";
import { NAKSHATRAS, SIGNS, SIGNS_SANSKRIT } from "@/utils/astrology/constants";
import { fmtDeg } from "@/utils/astrology/math";
import type { ChartData, PlanetPosition } from "@/utils/astrology/types";

/**
 * Classic South Indian chart: 12 fixed sign boxes clockwise, Aries in the
 * second box of the top row. Grid positions (row, col) per sign index:
 */
const SIGN_CELL: Record<number, [number, number]> = {
  11: [0, 0], 0: [0, 1], 1: [0, 2], 2: [0, 3],
  10: [1, 0], 3: [1, 3],
  9: [2, 0], 4: [2, 3],
  8: [3, 0], 7: [3, 1], 6: [3, 2], 5: [3, 3],
};

function PlanetChip({ p, chalit }: { p: PlanetPosition; chalit: boolean }) {
  const flags: string[] = [];
  if (p.retrograde) flags.push("R");
  if (p.combust) flags.push("C");
  if (p.warWith) flags.push(p.warWinner ? "W+" : "W−");
  const dignityColor =
    p.dignity === "exalted" || p.dignity === "moolatrikona" || p.dignity === "own"
      ? "text-emerald-300"
      : p.dignity === "debilitated"
        ? "text-rose-400"
        : "text-slate-200";
  return (
    <div className="flex items-baseline gap-1 leading-tight">
      <span className={`text-[11px] font-bold sm:text-xs ${dignityColor}`}>{p.id}</span>
      <span className="text-[9px] text-slate-400 sm:text-[10px]">{fmtDeg(p.degInSign)}</span>
      {flags.length > 0 && (
        <span className="text-[9px] font-semibold text-amber-400">[{flags.join("·")}]</span>
      )}
      {chalit && p.bhava !== p.house && (
        <span className="rounded bg-fuchsia-900/60 px-0.5 text-[9px] font-semibold text-fuchsia-300">
          →B{p.bhava}
        </span>
      )}
    </div>
  );
}

export default function SouthIndianChart({ chart }: { chart: ChartData }) {
  const { chartStyle } = useChart();
  const chalit = chartStyle === "chalit";
  const lagnaSign = chart.ascendant.sign;
  const moon = chart.planets.find((p) => p.id === "Mo");

  const cells: (React.ReactNode | null)[][] = Array.from({ length: 4 }, () => Array(4).fill(null));

  for (let sign = 0; sign < 12; sign++) {
    const [r, c] = SIGN_CELL[sign];
    const houseNum = ((sign - lagnaSign + 12) % 12) + 1;
    const isLagna = sign === lagnaSign;
    const occupants = chart.planets.filter((p) => p.sign === sign);
    cells[r][c] = (
      <div
        key={sign}
        className={`relative flex min-h-[92px] flex-col overflow-hidden border border-indigo-700/50 p-1.5 transition sm:min-h-[104px] ${
          isLagna ? "bg-amber-950/40 ring-1 ring-inset ring-amber-500/50" : "bg-indigo-950/40"
        }`}
      >
        <div className="flex items-start justify-between">
          <span className="text-[9px] uppercase tracking-wide text-slate-500 sm:text-[10px]">
            {SIGNS[sign]}
          </span>
          <span
            className={`rounded px-1 text-[9px] font-bold sm:text-[10px] ${
              isLagna ? "bg-amber-500/20 text-amber-300" : "bg-indigo-800/60 text-indigo-300"
            }`}
          >
            {houseNum}
          </span>
        </div>
        {isLagna && (
          <span className="text-[10px] font-bold text-amber-400">
            Lagna {fmtDeg(chart.ascendant.degInSign)}
          </span>
        )}
        <div className="mt-0.5 flex flex-col gap-0.5">
          {occupants.map((p) => (
            <PlanetChip key={p.id} p={p} chalit={chalit} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-indigo-700/50 shadow-2xl shadow-black/40">
      {cells.map((row, r) =>
        row.map((cell, c) => {
          if (cell) return cell;
          if (r === 1 && c === 1) {
            // Centre block spans 2x2
            return (
              <div
                key="centre"
                className="col-span-2 row-span-2 flex flex-col items-center justify-center gap-1 border border-indigo-700/50 bg-gradient-to-br from-indigo-950 via-indigo-900/80 to-indigo-950 p-2 text-center"
              >
                <span className="font-serif text-sm font-bold tracking-wide text-amber-400 sm:text-base">
                  {chart.meta.name || "Rashi Chakra"}
                </span>
                <span className="text-[10px] text-slate-300 sm:text-xs">
                  Lagna: {SIGNS[lagnaSign]} ({SIGNS_SANSKRIT[lagnaSign]})
                </span>
                {moon && (
                  <>
                    <span className="text-[10px] text-slate-300 sm:text-xs">
                      Moon: {SIGNS[moon.sign]} · {NAKSHATRAS[moon.nakshatra]} p{moon.pada}
                    </span>
                  </>
                )}
                <span className="text-[10px] text-slate-400 sm:text-xs">
                  Asc Nak: {NAKSHATRAS[chart.ascendant.nakshatra]}
                </span>
                <span className="mt-1 rounded-full border border-amber-700/40 bg-amber-950/40 px-2 py-0.5 text-[9px] text-amber-300/90 sm:text-[10px]">
                  {AYANAMSHA_LABELS[chart.meta.ayanamsha]} · {chart.meta.ayanamshaValue.toFixed(4)}°
                </span>
                {chalit && (
                  <span className="text-[9px] text-fuchsia-300/90">
                    Bhava Chalit (Sripati) — shifted planets marked →B
                  </span>
                )}
              </div>
            );
          }
          if ((r === 1 || r === 2) && (c === 1 || c === 2)) return null; // covered by centre span
          return <div key={`${r}-${c}`} />;
        })
      )}
    </div>
  );
}
