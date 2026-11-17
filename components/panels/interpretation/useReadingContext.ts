"use client";

import { useMemo } from "react";
import { useChart } from "@/components/context/ChartContext";
import { buildReadingContext, type ReadingContext } from "@/data/interpretations/reading";

/**
 * The reading context (chart + every computed layer) the Interpretation tab's
 * judgements are built from. Shared by the chart reading, the life-question
 * cards and the house rows, so all three reach their verdicts from the same
 * weighing (data/interpretations/reading/judge.ts) and cannot disagree.
 */
export function useReadingContext(): ReadingContext | null {
  const ctx = useChart();
  const { chart } = ctx;
  return useMemo(
    () =>
      chart
        ? buildReadingContext({
            chart,
            ayanamsha: ctx.ayanamsha,
            now: ctx.now,
            vargas: ctx.vargas,
            jaimini: ctx.jaimini,
            shadbala: ctx.shadbala,
            bhavaBala: ctx.bhavaBala,
            av: ctx.ashtakavarga,
            strengths: ctx.strengths,
            yogas: ctx.yogas,
            extended: ctx.extendedYogas,
            special: ctx.specialPoints,
            dashaTree: ctx.dashaTree,
            confirm: ctx.confirm,
          })
        : null,
    [chart, ctx.ayanamsha, ctx.now, ctx.vargas, ctx.jaimini, ctx.shadbala, ctx.bhavaBala, ctx.ashtakavarga, ctx.strengths, ctx.yogas, ctx.extendedYogas, ctx.specialPoints, ctx.dashaTree, ctx.confirm]
  );
}
