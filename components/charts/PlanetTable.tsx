"use client";

import { NAKSHATRAS, PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";
import { fmtDeg } from "@/utils/astrology/math";
import { DIGNITY_SHORT } from "@/utils/astrology/states";
import type { ChartData } from "@/utils/astrology/types";

export default function PlanetTable({ chart }: { chart: ChartData }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-indigo-800/50">
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="bg-indigo-900/50 text-left uppercase tracking-wider text-amber-500/80">
            <th className="px-2 py-2">Graha</th>
            <th className="px-2 py-2">Sign</th>
            <th className="px-2 py-2">Degree</th>
            <th className="px-2 py-2">Nakshatra</th>
            <th className="px-2 py-2">House</th>
            <th className="px-2 py-2">Bhava</th>
            <th className="px-2 py-2">Dignity</th>
            <th className="px-2 py-2">States</th>
          </tr>
        </thead>
        <tbody>
          {chart.planets.map((p) => (
            <tr key={p.id} className="border-t border-indigo-900/50">
              <td className="px-2 py-1.5 font-semibold text-slate-100">{PLANET_NAMES[p.id]}</td>
              <td className="px-2 py-1.5 text-slate-300">{SIGNS[p.sign]}</td>
              <td className="px-2 py-1.5 font-mono text-slate-300">{fmtDeg(p.degInSign)}</td>
              <td className="px-2 py-1.5 text-slate-300">
                {NAKSHATRAS[p.nakshatra]} <span className="text-slate-500">p{p.pada}</span>
              </td>
              <td className="px-2 py-1.5 text-slate-300">{p.house}</td>
              <td className={`px-2 py-1.5 ${p.bhava !== p.house ? "font-bold text-fuchsia-300" : "text-slate-300"}`}>
                {p.bhava}
              </td>
              <td
                className={`px-2 py-1.5 font-semibold ${
                  ["exalted", "moolatrikona", "own"].includes(p.dignity)
                    ? "text-emerald-300"
                    : p.dignity === "debilitated"
                      ? "text-rose-400"
                      : "text-slate-300"
                }`}
              >
                {DIGNITY_SHORT[p.dignity]}
              </td>
              <td className="px-2 py-1.5 text-amber-400">
                {[
                  p.retrograde ? "R" : null,
                  p.combust ? "C" : null,
                  p.warWith ? (p.warWinner ? "War✓" : "War✗") : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || <span className="text-slate-600">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
