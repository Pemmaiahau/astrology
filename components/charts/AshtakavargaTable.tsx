"use client";

import { AV_PLANETS } from "@/utils/astrology/ashtakavarga";
import { PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";
import { useChart } from "@/components/context/ChartContext";

/** 12 × 8 Bhinna Ashtakavarga grid + Sarvashtakavarga row, by sign. */
export default function AshtakavargaTable() {
  const { ashtakavarga, chart } = useChart();
  if (!ashtakavarga || !chart) {
    return <p className="text-sm text-slate-400">Cast a chart to compute the Ashtakavarga matrix.</p>;
  }
  const lagnaSign = chart.ascendant.sign;
  const rows = [...AV_PLANETS.map((p) => ({ key: p as string, label: PLANET_NAMES[p] })), { key: "As", label: "Lagna" }];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-indigo-800/50">
        <table className="w-full min-w-[720px] text-center text-xs">
          <thead>
            <tr className="bg-indigo-900/50 uppercase tracking-wider text-amber-500/80">
              <th className="px-2 py-2 text-left">BAV</th>
              {SIGNS.map((s, i) => (
                <th key={s} className={`px-1.5 py-2 ${i === lagnaSign ? "text-amber-300" : ""}`}>
                  {s.slice(0, 3)}
                  <div className="text-[9px] font-normal text-slate-500">H{((i - lagnaSign + 12) % 12) + 1}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-indigo-900/50">
                <td className="px-2 py-1.5 text-left font-semibold text-slate-200">{row.label}</td>
                {ashtakavarga.bav[row.key].map((v, i) => (
                  <td key={i} className="px-1.5 py-1.5 font-mono text-slate-300">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-amber-700/50 bg-indigo-900/40">
              <td className="px-2 py-2 text-left font-bold text-amber-300">SAV</td>
              {ashtakavarga.sav.map((v, i) => (
                <td
                  key={i}
                  className={`px-1.5 py-2 font-mono font-bold ${
                    v < 25 ? "bg-rose-950/60 text-rose-300" : v > 30 ? "bg-emerald-950/60 text-emerald-300" : "text-slate-100"
                  }`}
                >
                  {v}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded bg-rose-950 align-middle ring-1 ring-rose-700/60" /> SAV
          &lt; 25 — weak structural capacity: transits through these signs need conservative handling.
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded bg-emerald-950 align-middle ring-1 ring-emerald-700/60" />{" "}
          SAV &gt; 30 — high capacity: these houses absorb affliction and amplify benefic transits.
        </span>
        <span className="text-slate-500">Total SAV = {ashtakavarga.sav.reduce((a, b) => a + b, 0)} (classical total: 337)</span>
      </div>
    </div>
  );
}
