"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { computeAutoChart, computeManualChart } from "@/utils/astrology/chart";
import { activeDashaAt, vimshottariTree, type ActiveDasha } from "@/utils/astrology/dasha";
import { computeAshtakavarga, type AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import { computePanchang } from "@/utils/astrology/panchang";
import { currentTransits, sadeSatiPhase } from "@/utils/astrology/transits";
import { detectYogas } from "@/utils/astrology/yogas";
import { PLANETS } from "@/utils/astrology/constants";
import type {
  AutoInputState,
  AyanamshaId,
  ChartData,
  DashaPeriod,
  ManualInputState,
  PanchangData,
  PlanetId,
  TransitInfo,
  YogaFinding,
} from "@/utils/astrology/types";

type CommittedInput =
  | { kind: "auto"; data: AutoInputState }
  | { kind: "manual"; data: ManualInputState }
  | null;

interface ChartContextValue {
  mode: "auto" | "manual";
  setMode: (m: "auto" | "manual") => void;
  ayanamsha: AyanamshaId;
  setAyanamsha: (a: AyanamshaId) => void;
  chartStyle: "rashi" | "chalit";
  setChartStyle: (s: "rashi" | "chalit") => void;
  commitAuto: (d: AutoInputState) => void;
  commitManual: (d: ManualInputState) => void;
  chart: ChartData | null;
  dashaTree: DashaPeriod[] | null;
  activeDasha: ActiveDasha | null;
  transits: TransitInfo[] | null;
  sadeSati: "rising" | "peak" | "setting" | null;
  panchang: PanchangData | null;
  ashtakavarga: AshtakavargaResult | null;
  yogas: YogaFinding[];
  now: Date;
}

const ChartContext = createContext<ChartContextValue | null>(null);

export function ChartProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [ayanamsha, setAyanamsha] = useState<AyanamshaId>("lahiri");
  const [chartStyle, setChartStyle] = useState<"rashi" | "chalit">("rashi");
  const [committed, setCommitted] = useState<CommittedInput>(null);
  const [now] = useState(() => new Date());

  const chart = useMemo<ChartData | null>(() => {
    if (!committed) return null;
    try {
      return committed.kind === "auto"
        ? computeAutoChart(committed.data, ayanamsha)
        : computeManualChart(committed.data, ayanamsha);
    } catch {
      return null;
    }
  }, [committed, ayanamsha]);

  const dashaTree = useMemo(() => {
    if (!chart || !chart.birthUtc) return null;
    const moon = chart.planets.find((p) => p.id === "Mo");
    if (!moon) return null;
    return vimshottariTree(moon.longitude, chart.birthUtc);
  }, [chart]);

  const activeDasha = useMemo(
    () => (dashaTree ? activeDashaAt(dashaTree, now) : null),
    [dashaTree, now]
  );

  const transits = useMemo(
    () => (chart ? currentTransits(chart, ayanamsha, now) : null),
    [chart, ayanamsha, now]
  );

  const sadeSati = useMemo(() => (transits ? sadeSatiPhase(transits) : null), [transits]);

  const panchang = useMemo(() => {
    if (!chart || !chart.birthUtc) return null;
    const sun = chart.planets.find((p) => p.id === "Su");
    const moon = chart.planets.find((p) => p.id === "Mo");
    if (!sun || !moon) return null;
    return computePanchang(
      sun.longitude,
      moon.longitude,
      chart.birthUtc,
      chart.meta.timezone,
      chart.lat,
      chart.lon
    );
  }, [chart]);

  const ashtakavarga = useMemo(() => {
    if (!chart) return null;
    const signs: Partial<Record<PlanetId, number>> = {};
    for (const id of PLANETS) {
      const p = chart.planets.find((q) => q.id === id);
      if (p) signs[id] = p.sign;
    }
    if (["Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa"].some((id) => signs[id as PlanetId] === undefined)) {
      return null;
    }
    return computeAshtakavarga(signs, chart.ascendant.sign);
  }, [chart]);

  const yogas = useMemo(() => (chart ? detectYogas(chart) : []), [chart]);

  const value: ChartContextValue = {
    mode,
    setMode,
    ayanamsha,
    setAyanamsha,
    chartStyle,
    setChartStyle,
    commitAuto: (d) => setCommitted({ kind: "auto", data: d }),
    commitManual: (d) => setCommitted({ kind: "manual", data: d }),
    chart,
    dashaTree,
    activeDasha,
    transits,
    sadeSati,
    panchang,
    ashtakavarga,
    yogas,
    now,
  };

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
}

export function useChart(): ChartContextValue {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within ChartProvider");
  return ctx;
}
