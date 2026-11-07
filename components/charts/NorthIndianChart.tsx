"use client";

import { useChart } from "@/components/context/ChartContext";
import { AYANAMSHA_LABELS } from "@/utils/astrology/ayanamsha";
import {
  NORTH_HOUSES,
  NORTH_SIGN_ANCHOR,
  isWideHouse,
  northSlots,
  rashiModel,
  signOfHouse,
  vargaModel,
  type ChartEntry,
  type ChartModel,
} from "@/utils/astrology/chartLayout";
import { NAKSHATRAS, SIGNS, SIGNS_SANSKRIT } from "@/utils/astrology/constants";
import { fmtDeg } from "@/utils/astrology/math";
import type { ChartData } from "@/utils/astrology/types";
import { VARGA_NAMES, type VargaChart } from "@/utils/astrology/varga";

const TONE: Record<ChartEntry["tone"], string> = {
  strong: "fill-good",
  weak: "fill-bad-strong",
  plain: "fill-fg-2",
  lagna: "fill-primary",
};

/**
 * The North Indian diamond: twelve fixed houses with the Lagna always the top
 * diamond, and each house carrying the number of the sign standing in it. The
 * South Indian grid, which fixes the signs instead, stays the default. Drawn as
 * SVG because the houses are triangles and kites; the geometry comes from
 * `chartLayout.ts`, which the PDF export draws from too.
 */
function Diamond({ model, label }: { model: ChartModel; label: string }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={label} className="block h-auto w-full bg-surface">
      {NORTH_HOUSES.map((points, i) => (
        <polygon
          key={i}
          points={points.map((p) => p.join(",")).join(" ")}
          vectorEffect="non-scaling-stroke"
          strokeWidth={1}
          className={`stroke-line-strong ${i === 0 ? "fill-primary-wash-2" : "fill-transparent"}`}
        />
      ))}
      {NORTH_HOUSES.map((_, i) => {
        const house = i + 1;
        const sign = signOfHouse(house, model.lagnaSign);
        const entries = model.bySign[sign];
        const { slots, scale } = northSlots(house, entries.length, isWideHouse(entries));
        const [nx, ny] = NORTH_SIGN_ANCHOR[i];
        return (
          <g key={house}>
            <text
              x={nx}
              y={ny}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={3}
              className={`font-bold ${house === 1 ? "fill-primary" : "fill-planet"}`}
            >
              <title>{`House ${house}: ${SIGNS[sign]}`}</title>
              {sign + 1}
            </text>
            {entries.map((e, j) => (
              <text
                key={e.id}
                x={slots[j].x}
                y={slots[j].y}
                textAnchor={slots[j].align}
                dominantBaseline="middle"
                fontSize={2.8 * scale}
              >
                <title>{e.title}</title>
                <tspan className={`font-bold ${TONE[e.tone]}`}>{e.id}</tspan>
                {e.detail && (
                  <tspan dx={0.7} fontSize={2.3 * scale} className="fill-fg-muted">
                    {e.detail}
                  </tspan>
                )}
                {e.flags && (
                  <tspan dx={0.7} fontSize={2.3 * scale} className="fill-primary font-semibold">
                    {e.flags}
                  </tspan>
                )}
                {e.shift && (
                  <tspan dx={0.7} fontSize={2.3 * scale} className="fill-accent font-semibold">
                    {e.shift}
                  </tspan>
                )}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export default function NorthIndianChart({ chart }: { chart: ChartData }) {
  const { chartStyle } = useChart();
  const chalit = chartStyle === "chalit";
  const lagnaSign = chart.ascendant.sign;
  const moon = chart.planets.find((p) => p.id === "Mo");

  return (
    <div className="overflow-hidden rounded-xl border border-line-strong shadow-2xl shadow-chart-shadow">
      <Diamond
        model={rashiModel(chart, chalit)}
        label={`North Indian chart for ${chart.meta.name || "this birth"}, ${SIGNS[lagnaSign]} Lagna`}
      />
      <div className="flex flex-col items-center gap-0.5 border-t border-line-strong bg-gradient-to-br from-surface-solid via-inset-2 to-surface-solid p-2 text-center">
        <span className="font-serif text-sm font-bold tracking-wide text-primary sm:text-base">
          {chart.meta.name || "Rashi Chakra"}
        </span>
        <span className="text-[10px] text-fg sm:text-xs">
          Lagna: {SIGNS[lagnaSign]} ({SIGNS_SANSKRIT[lagnaSign]}) {fmtDeg(chart.ascendant.degInSign)} ·{" "}
          {NAKSHATRAS[chart.ascendant.nakshatra]}
        </span>
        {moon && (
          <span className="text-[10px] text-fg sm:text-xs">
            Moon: {SIGNS[moon.sign]} · {NAKSHATRAS[moon.nakshatra]} p{moon.pada}
          </span>
        )}
        <span className="mt-1 rounded-full border border-primary-border-soft bg-primary-wash-2 px-2 py-0.5 text-[9px] text-heading-soft sm:text-[10px]">
          {AYANAMSHA_LABELS[chart.meta.ayanamsha]} · {chart.meta.ayanamshaValue.toFixed(4)}°
        </span>
        {chalit && (
          <span className="text-[9px] text-accent">
            {chart.meta.bhavaMethod === "equal"
              ? "Equal houses — Sripati quadrants are degenerate for this chart"
              : "Bhava Chalit (Sripati) — shifted planets marked →B"}
          </span>
        )}
      </div>
    </div>
  );
}

/** The same diamond for a divisional chart: a sign and a dignity per planet, nothing else. */
export function NorthVargaChart({ chart, subtitle }: { chart: VargaChart; subtitle?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line-strong">
      <Diamond
        model={vargaModel(chart)}
        label={`North Indian ${VARGA_NAMES[chart.varga]} chart, ${SIGNS[chart.ascendant]} Lagna`}
      />
      <div className="flex flex-col items-center gap-0.5 border-t border-line-strong bg-gradient-to-br from-surface-solid via-inset-2 to-surface-solid p-2 text-center">
        <span className="font-serif text-sm font-bold text-primary">
          {VARGA_NAMES[chart.varga]}{" "}
          <span className="font-mono text-[10px] font-normal text-fg-muted">{chart.varga}</span>
        </span>
        <span className="text-[10px] text-fg">
          Lagna: {SIGNS[chart.ascendant]} ({SIGNS_SANSKRIT[chart.ascendant]})
        </span>
        {subtitle && <span className="text-[9px] leading-tight text-fg-subtle">{subtitle}</span>}
      </div>
    </div>
  );
}
