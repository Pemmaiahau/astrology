"use client";

import { useState } from "react";
import { useChart } from "@/components/context/ChartContext";
import { PLANET_NAMES, SHADBALA_PLANETS } from "@/utils/astrology/constants";
import type { BalaFactor, PlanetShadbala } from "@/utils/astrology/shadbala";

/**
 * Shadbala — the classical six-fold strength, in rupas.
 *
 * `computeShadbala` has run on every chart with a birth anchor since the
 * strength layer landed, and `ChartContext` has carried the full result — six
 * limbs, every sub-bala, Ishta/Kashta, the minimum-requirement ratio — without
 * a single component rendering it. `README.md` advertises this table as a
 * headline feature. This is the table.
 *
 * The ratio column is the one that matters most and is the one usually left
 * out of published tables: BPHS gives each graha a *different* minimum (Mercury
 * needs 7 rupas, Saturn only 5), so a raw total tells you almost nothing until
 * it is divided by that graha's own requirement.
 */

const LIMBS: { key: keyof Pick<PlanetShadbala, "sthana" | "dig" | "kala" | "cheshta" | "naisargika" | "drik">; label: string; gloss: string }[] = [
  { key: "sthana", label: "Sthana", gloss: "positional — exaltation, divisional dignity, odd/even, angularity, decanate" },
  { key: "dig", label: "Dig", gloss: "directional — distance from the graha's powerless cusp" },
  { key: "kala", label: "Kala", gloss: "temporal — day/night, paksha, thirds, year/month/day/hour lords, declination, war" },
  { key: "cheshta", label: "Cheshta", gloss: "motional — the seeghra-kendra, i.e. how the graha is moving" },
  { key: "naisargika", label: "Naisargika", gloss: "natural — the fixed ladder from Saturn weakest to Sun strongest" },
  { key: "drik", label: "Drik", gloss: "aspectual — net benefic minus malefic drishti received" },
];

const sum = (fs: BalaFactor[]) => fs.reduce((a, f) => a + f.virupas, 0);

function ratioChip(ratio: number): string {
  if (ratio >= 1.2) return "bg-good-soft text-good ring-good-ring";
  if (ratio >= 1) return "bg-info-soft text-info ring-info-ring";
  if (ratio >= 0.8) return "bg-warn-soft text-warn ring-warn-ring";
  return "bg-bad-soft text-bad ring-bad-ring";
}

export default function ShadbalaTable() {
  const { shadbala, chart } = useChart();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!chart) return null;
  if (!shadbala) {
    return (
      <p className="rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-fg-muted">
        Shadbala needs an exact birth time and place: four of its six limbs (Dig, Kala, Cheshta and the
        day-frame that Kala rests on) are measured from the moment and location of birth itself. Add a birth
        anchor to compute it. Until then the interpretation falls back to the composite strength score, which
        is a transparent heuristic rather than the classical measure.
      </p>
    );
  }

  const maxTotal = Math.max(...SHADBALA_PLANETS.map((id) => shadbala.planets[id].totalVirupas));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-serif text-base font-bold text-heading">Shadbala — six-fold planetary strength</h3>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">
          All values in rupas (60 virupas = 1 rupa). Each graha is measured against{" "}
          <span className="font-semibold text-fg-2">its own</span> classical minimum, which is why the ratio
          column matters more than the total: Mercury must reach 7 rupas to be counted sufficient, Saturn
          only 5. Click any row for the sub-bala breakdown. Rahu and Ketu take no Shadbala.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="bg-inset uppercase tracking-wider text-eyebrow">
              <th className="px-2.5 py-2">Graha</th>
              {LIMBS.map((l) => (
                <th key={l.key} className="px-2 py-2 text-right" title={l.gloss}>
                  {l.label}
                </th>
              ))}
              <th className="px-2.5 py-2 text-right">Total</th>
              <th className="px-2.5 py-2 text-right">Needs</th>
              <th className="px-2.5 py-2 text-center">Ratio</th>
              <th className="px-2.5 py-2 text-right">Ishta</th>
              <th className="px-2.5 py-2 text-right">Kashta</th>
            </tr>
          </thead>
          <tbody>
            {SHADBALA_PLANETS.map((id) => {
              const p = shadbala.planets[id];
              const open = expanded === id;
              return (
                <>
                  <tr
                    key={id}
                    onClick={() => setExpanded(open ? null : id)}
                    className={`cursor-pointer border-t border-line-faint transition hover:bg-inset ${
                      open ? "bg-inset" : ""
                    }`}
                  >
                    <td className="px-2.5 py-1.5 font-semibold text-fg-2">
                      {PLANET_NAMES[id]}
                      {shadbala.strongest === id && (
                        <span className="ml-1 rounded bg-good-soft px-1 text-[9px] font-bold text-good">
                          strongest
                        </span>
                      )}
                      {shadbala.weakest === id && (
                        <span className="ml-1 rounded bg-bad-soft px-1 text-[9px] font-bold text-bad">
                          weakest
                        </span>
                      )}
                    </td>
                    {LIMBS.map((l) => (
                      <td key={l.key} className="px-2 py-1.5 text-right font-mono text-fg-muted">
                        {(sum(p[l.key]) / 60).toFixed(2)}
                      </td>
                    ))}
                    <td className="px-2.5 py-1.5 text-right font-mono font-bold text-fg-strong">
                      {p.rupas.toFixed(2)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-mono text-fg-subtle">
                      {(p.required / 60).toFixed(2)}
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ring-1 ring-inset ${ratioChip(p.ratio)}`}
                      >
                        {Math.round(p.ratio * 100)}%
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-mono text-good">{p.ishta.toFixed(1)}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono text-bad-strong">
                      {p.kashta.toFixed(1)}
                    </td>
                  </tr>
                  {open && (
                    <tr key={`${id}-detail`} className="border-t border-line-faint bg-surface-soft">
                      <td colSpan={11} className="px-3 py-2.5">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {LIMBS.map((l) => (
                            <div key={l.key} className="rounded-lg bg-surface-3 p-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-eyebrow">
                                {l.label} — {(sum(p[l.key]) / 60).toFixed(2)} rupas
                              </p>
                              <p className="mb-1 text-[10px] leading-tight text-fg-faint">{l.gloss}</p>
                              {p[l.key].map((f) => (
                                <div key={f.label} className="flex justify-between text-[11px]">
                                  <span className="text-fg-muted">{f.label}</span>
                                  <span
                                    className={`font-mono ${f.virupas < 0 ? "text-bad-strong" : "text-fg"}`}
                                  >
                                    {f.virupas.toFixed(1)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                          Ishta ({p.ishta.toFixed(1)}) and Kashta ({p.kashta.toFixed(1)}) are the geometric
                          means of Uchcha with Cheshta, and of their complements — the classical split of a
                          graha&apos;s capacity into the benefic and malefic halves. A high total with a high
                          Kashta is a strong graha that is strongly difficult, which is a real and common
                          result rather than a contradiction.
                        </p>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Visual ranking */}
      <div className="rounded-xl border border-line bg-surface p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
          Ranked by total strength
        </p>
        <div className="space-y-1">
          {[...SHADBALA_PLANETS]
            .sort((a, b) => shadbala.planets[b].totalVirupas - shadbala.planets[a].totalVirupas)
            .map((id) => {
              const p = shadbala.planets[id];
              return (
                <div key={id} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[11px] font-semibold text-fg-2">
                    {PLANET_NAMES[id]}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-inset-2">
                    <div
                      className={`h-full rounded-full ${p.ratio >= 1 ? "bg-good" : "bg-warn"}`}
                      style={{ width: `${Math.round((p.totalVirupas / maxTotal) * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[11px] text-fg-muted">
                    {p.rupas.toFixed(2)}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
