"use client";

import { useState } from "react";
import { Grid2x2, Star } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import VargaChartGrid from "@/components/charts/VargaChartGrid";
import { PLANET_NAMES, PLANETS, SIGNS } from "@/utils/astrology/constants";
import { DIGNITY_LABELS, DIGNITY_SHORT } from "@/utils/astrology/states";
import {
  houseInVarga,
  vargaPositionOf,
  VARGA_IDS,
  VARGA_NAMES,
  VARGA_SIGNIFICATIONS,
  VIMSHOPAKA_WEIGHTS,
  type VargaId,
} from "@/utils/astrology/varga";
import { SHADBALA_PLANETS } from "@/utils/astrology/constants";

/**
 * The Shodasavarga viewer.
 *
 * All sixteen divisional charts have been computed on every chart since the
 * varga layer landed, and until now not one of them was rendered — they reached
 * the reader only as sentences inside the interpretation. This is that surface:
 * the grid, the per-graha table, the vargottama set, and the four Vimshopaka
 * scoring schemes.
 *
 * The two grids shown side by side are deliberate. A varga is only meaningful
 * *against* the Rashi — "Jupiter is in Sagittarius in the D-9" says nothing on
 * its own; "Jupiter is in Pisces in D-1 and Sagittarius in D-9" is the reading.
 * So the D-1 is always the left-hand chart and the selected varga the right.
 */

/** One rupa of Vimshopaka is 20; these are the classical reading bands. */
function vimshopakaBand(score: number): { label: string; chip: string } {
  if (score >= 15) return { label: "excellent", chip: "bg-good-soft text-good ring-good-ring" };
  if (score >= 10) return { label: "good", chip: "bg-info-soft text-info ring-info-ring" };
  if (score >= 5) return { label: "middling", chip: "bg-warn-soft text-warn ring-warn-ring" };
  return { label: "poor", chip: "bg-bad-soft text-bad ring-bad-ring" };
}

const SCHEME_LABEL: Record<keyof typeof VIMSHOPAKA_WEIGHTS, string> = {
  shad: "Shadvarga (6)",
  sapta: "Saptavarga (7)",
  dasha: "Dasavarga (10)",
  shodasha: "Shodasavarga (16)",
};

export default function VargaPanel() {
  const { chart, vargas } = useChart();
  const [selected, setSelected] = useState<VargaId>("D9");

  if (!chart || !vargas) return null;

  const vc = vargas.charts[selected];
  const d1 = vargas.charts.D1;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-heading-border bg-primary-wash p-3">
        <h3 className="flex items-center gap-2 font-serif text-base font-bold text-heading">
          <Grid2x2 className="h-4 w-4" /> Shodasavarga — the sixteen divisional charts
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">
          Each varga re-maps the same sidereal longitudes onto a new set of signs, and each is read for its
          own subject. A promise the Rashi makes is confirmed or withdrawn by the division that owns that
          subject — which is why the D-1 stays on screen beside whichever varga you pick. Degree inside a
          varga sign carries no classical meaning, so only the sign and the dignity are shown.
        </p>
      </section>

      {/* Varga selector */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
        {VARGA_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setSelected(id)}
            title={`${VARGA_NAMES[id]} — ${VARGA_SIGNIFICATIONS[id]}`}
            className={`rounded-lg px-2.5 py-1.5 font-mono text-xs font-semibold transition ${
              selected === id
                ? "bg-primary-soft text-heading ring-1 ring-inset ring-primary-ring"
                : "text-fg-muted hover:bg-inset hover:text-fg-2"
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      <p className="px-1 text-sm leading-relaxed text-fg">
        <span className="font-serif font-bold text-heading">
          {VARGA_NAMES[selected]} ({selected})
        </span>{" "}
        is read for <span className="italic">{VARGA_SIGNIFICATIONS[selected]}</span>.
      </p>

      {/* D-1 beside the selected varga */}
      <div className="grid gap-3 lg:grid-cols-2">
        <VargaChartGrid chart={d1} subtitle="the birth chart, for comparison" />
        <VargaChartGrid chart={vc} subtitle={VARGA_SIGNIFICATIONS[selected]} />
      </div>

      {/* Per-graha table: where each body sits in D-1 vs the selected varga */}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="bg-inset uppercase tracking-wider text-eyebrow">
              <th className="px-2.5 py-2">Graha</th>
              <th className="px-2.5 py-2">Rashi (D-1)</th>
              <th className="px-2.5 py-2">{selected}</th>
              <th className="px-2.5 py-2">House in {selected}</th>
              <th className="px-2.5 py-2">Dignity there</th>
              <th className="px-2.5 py-2">Moved?</th>
            </tr>
          </thead>
          <tbody>
            {PLANETS.map((id) => {
              const a = vargaPositionOf(d1, id);
              const b = vargaPositionOf(vc, id);
              if (!a || !b) return null;
              const moved = a.sign !== b.sign;
              const strong = ["exalted", "moolatrikona", "own", "greatFriend"].includes(b.dignity);
              const weak = ["debilitated", "greatEnemy", "enemy"].includes(b.dignity);
              return (
                <tr key={id} className="border-t border-line-faint">
                  <td className="px-2.5 py-1.5 font-semibold text-fg-2">
                    {PLANET_NAMES[id]}
                    {vargas.vargottama.includes(id) && (
                      <span className="ml-1 text-accent" title="Vargottama (same sign in D-1 and D-9)">
                        ★
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 text-fg-muted">{SIGNS[a.sign]}</td>
                  <td className="px-2.5 py-1.5 text-fg">{SIGNS[b.sign]}</td>
                  <td className="px-2.5 py-1.5 font-mono text-fg-muted">{houseInVarga(vc, b.sign)}</td>
                  <td
                    className={`px-2.5 py-1.5 ${strong ? "text-good" : weak ? "text-bad-strong" : "text-fg-muted"}`}
                  >
                    {DIGNITY_LABELS[b.dignity]}
                  </td>
                  <td className="px-2.5 py-1.5 text-[11px] text-fg-subtle">
                    {selected === "D1" ? "—" : moved ? "yes" : "same sign"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Vargottama */}
      <section className="rounded-xl border border-accent-border bg-accent-wash p-4">
        <h4 className="mb-1.5 flex items-center gap-2 font-serif text-sm font-bold text-accent">
          <Star className="h-4 w-4" /> Vargottama
        </h4>
        {vargas.vargottama.length === 0 ? (
          <p className="text-xs leading-relaxed text-fg">
            No graha holds the same sign in the Rashi and the Navamsa in this chart. Nothing is wrong with
            that — vargottama is a bonus, not a requirement — but it does mean no placement here carries the
            double confirmation that a vargottama graha does.
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-fg">
            <span className="font-semibold text-accent">
              {vargas.vargottama.map((id) => PLANET_NAMES[id]).join(", ")}
            </span>{" "}
            {vargas.vargottama.length === 1 ? "holds" : "hold"} the same sign in the Rashi and the Navamsa.
            A vargottama graha behaves the same way in both accounts, so its results arrive in the form the
            birth chart describes rather than in some altered version of it — the strongest corroboration the
            divisional system offers.
          </p>
        )}
      </section>

      {/* Vimshopaka */}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead>
            <tr className="bg-inset uppercase tracking-wider text-eyebrow">
              <th className="px-2.5 py-2">Vimshopaka bala</th>
              {(Object.keys(VIMSHOPAKA_WEIGHTS) as (keyof typeof VIMSHOPAKA_WEIGHTS)[]).map((k) => (
                <th key={k} className="px-2.5 py-2 text-center">
                  {SCHEME_LABEL[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHADBALA_PLANETS.map((id) => (
              <tr key={id} className="border-t border-line-faint">
                <td className="px-2.5 py-1.5 font-semibold text-fg-2">{PLANET_NAMES[id]}</td>
                {(Object.keys(VIMSHOPAKA_WEIGHTS) as (keyof typeof VIMSHOPAKA_WEIGHTS)[]).map((k) => {
                  const v = vargas.vimshopaka[id][k];
                  const band = vimshopakaBand(v);
                  return (
                    <td key={k} className="px-2.5 py-1.5 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ring-1 ring-inset ${band.chip}`}
                        title={band.label}
                      >
                        {v.toFixed(2)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-fg-faint">
        Each Vimshopaka scheme scores a graha out of 20 by its dignity across a fixed set of vargas, weighted
        per BPHS. The four schemes differ only in how many divisions they consult — Shadvarga is the quick
        read, Shodasavarga the exacting one. 15+ reads as excellent, 10–15 good, 5–10 middling, below 5 poor.
        Rahu and Ketu are excluded: they own no sign, so dignity is undefined for them.
      </p>
    </div>
  );
}
