"use client";

import { NAKSHATRAS, PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";
import { fmtDeg } from "@/utils/astrology/math";
import { DIGNITY_SHORT } from "@/utils/astrology/states";
import type { ChartData } from "@/utils/astrology/types";

export default function PlanetTable({ chart }: { chart: ChartData }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="bg-inset text-left uppercase tracking-wider text-eyebrow">
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
            <tr key={p.id} className="border-t border-line-faint">
              <td className="px-2 py-1.5 font-semibold text-fg-strong">{PLANET_NAMES[p.id]}</td>
              <td className="px-2 py-1.5 text-fg">{SIGNS[p.sign]}</td>
              <td className="px-2 py-1.5 font-mono text-fg">{fmtDeg(p.degInSign)}</td>
              <td className="px-2 py-1.5 text-fg">
                {NAKSHATRAS[p.nakshatra]} <span className="text-fg-subtle">p{p.pada}</span>
              </td>
              <td className="px-2 py-1.5 text-fg">{p.house}</td>
              <td className={`px-2 py-1.5 ${p.bhava !== p.house ? "font-bold text-accent" : "text-fg"}`}>
                {p.bhava}
              </td>
              <td
                className={`px-2 py-1.5 font-semibold ${
                  ["exalted", "moolatrikona", "own"].includes(p.dignity)
                    ? "text-good"
                    : p.dignity === "debilitated"
                      ? "text-bad-strong"
                      : "text-fg"
                }`}
              >
                {DIGNITY_SHORT[p.dignity]}
              </td>
              <td className="px-2 py-1.5 text-primary">
                {[
                  p.retrograde ? "R" : null,
                  p.combust ? "C" : null,
                  p.warWith ? (p.warWinner ? "War✓" : "War✗") : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || <span className="text-fg-faint">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
