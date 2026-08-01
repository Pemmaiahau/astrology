"use client";

import { AV_PLANETS } from "@/utils/astrology/ashtakavarga";
import { PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";
import { useChart } from "@/components/context/ChartContext";

/** 12 × 8 Bhinna Ashtakavarga grid + Sarvashtakavarga row, by sign. */
export default function AshtakavargaTable() {
  const { ashtakavarga, chart } = useChart();
  if (!ashtakavarga || !chart) {
    return <p className="text-sm text-fg-muted">Cast a chart to compute the Ashtakavarga matrix.</p>;
  }
  const lagnaSign = chart.ascendant.sign;
  const rows = [...AV_PLANETS.map((p) => ({ key: p as string, label: PLANET_NAMES[p] })), { key: "As", label: "Lagna" }];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-center text-xs">
          <thead>
            <tr className="bg-inset uppercase tracking-wider text-eyebrow">
              <th className="px-2 py-2 text-left">BAV</th>
              {SIGNS.map((s, i) => (
                <th key={s} className={`px-1.5 py-2 ${i === lagnaSign ? "text-heading" : ""}`}>
                  {s.slice(0, 3)}
                  <div className="text-[9px] font-normal text-fg-subtle">H{((i - lagnaSign + 12) % 12) + 1}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-line-faint">
                <td className="px-2 py-1.5 text-left font-semibold text-fg-2">{row.label}</td>
                {ashtakavarga.bav[row.key].map((v, i) => (
                  <td key={i} className="px-1.5 py-1.5 font-mono text-fg">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-primary-border-soft bg-inset">
              <td className="px-2 py-2 text-left font-bold text-heading">SAV</td>
              {ashtakavarga.sav.map((v, i) => (
                <td
                  key={i}
                  className={`px-1.5 py-2 font-mono font-bold ${
                    v < 25 ? "bg-bad-wash text-bad" : v > 30 ? "bg-good-wash text-good" : "text-fg-strong"
                  }`}
                >
                  {v}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-fg-muted">
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded bg-bad-wash align-middle ring-1 ring-bad-ring" /> SAV
          &lt; 25 — weak structural capacity: transits through these signs need conservative handling.
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded bg-good-wash align-middle ring-1 ring-good-ring" />{" "}
          SAV &gt; 30 — high capacity: these houses absorb affliction and amplify benefic transits.
        </span>
        <span className="text-fg-subtle">Total SAV = {ashtakavarga.sav.reduce((a, b) => a + b, 0)} (classical total: 337)</span>
      </div>
    </div>
  );
}
