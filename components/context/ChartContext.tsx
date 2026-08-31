"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { computeAutoChart, computeManualChart } from "@/utils/astrology/chart";
import { activeDashaAt, vimshottariTree, type ActiveDasha } from "@/utils/astrology/dasha";
import { computeAshtakavarga, type AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import { computePanchang } from "@/utils/astrology/panchang";
import { currentTransits, sadeSatiPhase } from "@/utils/astrology/transits";
import { detectYogas } from "@/utils/astrology/yogas";
import { allStrengths, type PlanetStrength } from "@/utils/astrology/strength";
import { computeJaimini, type JaiminiInfo } from "@/utils/astrology/jaimini";
import {
  computeBhavaBala,
  computeShadbala,
  type BhavaBala,
  type ShadbalaSet,
} from "@/utils/astrology/shadbala";
import { computeVargaSet, type VargaSet } from "@/utils/astrology/varga";
import { interpretFullChart, type HouseInterpretation } from "@/data/interpretations/synthesis";
import {
  buildPersonalityProfile,
  type PersonalityProfile,
} from "@/data/interpretations/personality";
import { PLANETS } from "@/utils/astrology/constants";
import { isAdvancedUnlocked } from "./advancedAccess";
import type {
  AutoInputState,
  AyanamshaId,
  ChartData,
  DashaPeriod,
  ManualInputState,
  NodeMode,
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
  nodeMode: NodeMode;
  setNodeMode: (n: NodeMode) => void;
  chartStyle: "rashi" | "chalit";
  setChartStyle: (s: "rashi" | "chalit") => void;
  predictionYear: number;
  setPredictionYear: (y: number) => void;
  predictionWindow: "calendar" | "solar";
  setPredictionWindow: (w: "calendar" | "solar") => void;
  /** Year selector for the Speculation tab; kept here so it survives tab switches. */
  speculationYear: number;
  setSpeculationYear: (y: number) => void;
  speculationWindow: "calendar" | "solar";
  setSpeculationWindow: (w: "calendar" | "solar") => void;
  commitAuto: (d: AutoInputState) => void;
  commitManual: (d: ManualInputState) => void;
  /**
   * The input that produced the current chart, if any. Exposed so the entry
   * forms can seed their fields from a restored session — without it a reload
   * showed the saved chart beside a form full of defaults, which is worse than
   * not restoring at all.
   */
  committed: CommittedInput;
  /** Forget the saved session and return to the empty state. */
  clearSession: () => void;
  chart: ChartData | null;
  dashaTree: DashaPeriod[] | null;
  activeDasha: ActiveDasha | null;
  transits: TransitInfo[] | null;
  sadeSati: "rising" | "peak" | "setting" | null;
  panchang: PanchangData | null;
  /** Set when a chart WAS submitted and could not be built. Distinct from `chart === null`. */
  chartError: string | null;
  ashtakavarga: AshtakavargaResult | null;
  yogas: YogaFinding[];
  strengths: Partial<Record<PlanetId, PlanetStrength>>;
  /** All twelve houses, occupied or not */
  houseReadings: HouseInterpretation[];
  personality: PersonalityProfile | null;
  /** All sixteen divisional charts + vargottama + vimshopaka. */
  vargas: VargaSet | null;
  /** Chara karakas, Karakamsa, Arudha/Upapada, Argala. */
  jaimini: JaiminiInfo | null;
  /** Classical six-fold strength; null when the chart lacks a real birth anchor. */
  shadbala: ShadbalaSet | null;
  bhavaBala: BhavaBala[] | null;
  /**
   * Whether the two adult-scope sections (Speculation, Intimacy) are revealed.
   * See `advancedAccess.ts` for the rule and why it lives in one place.
   */
  advancedUnlocked: boolean;
  now: Date;
}

/**
 * Session persistence.
 *
 * A refresh used to destroy the chart and every setting with it, which for a
 * tool used repeatedly on the same handful of charts is the difference between
 * a workspace and a demo. Only the *input* is stored, never the computed chart:
 * the engine is deterministic, so re-deriving on load is both cheaper than
 * serialising a full `ChartData` (with its Dates and nested arrays) and immune
 * to a stored chart going stale against an engine change.
 *
 * Everything is wrapped: `localStorage` throws outright in some privacy modes
 * rather than returning null, and a corrupt or older-shaped payload must
 * degrade to "no saved chart" rather than taking the app down on boot.
 */
const STORE_KEY = "jyotisha.session.v1";

interface StoredSession {
  committed: CommittedInput;
  ayanamsha: AyanamshaId;
  nodeMode: NodeMode;
  chartStyle: "rashi" | "chalit";
  mode: "auto" | "manual";
}

function loadSession(): Partial<StoredSession> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw) as Partial<StoredSession>;
    // Validate the fields that drive computation; anything unrecognised is
    // dropped rather than trusted, so an older payload cannot inject a bad
    // ayanamsha id into `getAyanamsha`.
    const out: Partial<StoredSession> = {};
    if (v.ayanamsha && ["lahiri", "pushya", "raman"].includes(v.ayanamsha)) out.ayanamsha = v.ayanamsha;
    if (v.nodeMode === "mean" || v.nodeMode === "true") out.nodeMode = v.nodeMode;
    if (v.chartStyle === "rashi" || v.chartStyle === "chalit") out.chartStyle = v.chartStyle;
    if (v.mode === "auto" || v.mode === "manual") out.mode = v.mode;
    if (v.committed && (v.committed.kind === "auto" || v.committed.kind === "manual") && v.committed.data) {
      out.committed = v.committed;
    }
    return out;
  } catch {
    return {};
  }
}

function saveSession(v: StoredSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable — persistence is a convenience, never a requirement */
  }
}

const ChartContext = createContext<ChartContextValue | null>(null);

export function ChartProvider({ children }: { children: ReactNode }) {
  // Read once, lazily, so the store is not touched during SSR and the very
  // first client render already has the restored values rather than flashing
  // the empty state and then swapping.
  const [restored] = useState(loadSession);
  const [mode, setMode] = useState<"auto" | "manual">(restored.mode ?? "auto");
  const [ayanamsha, setAyanamsha] = useState<AyanamshaId>(restored.ayanamsha ?? "lahiri");
  const [nodeMode, setNodeMode] = useState<NodeMode>(restored.nodeMode ?? "mean");
  const [chartStyle, setChartStyle] = useState<"rashi" | "chalit">(restored.chartStyle ?? "rashi");
  const [committed, setCommitted] = useState<CommittedInput>(restored.committed ?? null);
  const [now] = useState(() => new Date());
  const [predictionYear, setPredictionYear] = useState(() => new Date().getFullYear());
  const [predictionWindow, setPredictionWindow] = useState<"calendar" | "solar">("calendar");
  // The Speculation tab carries its own year selector, independent of the
  // Predictions one — the two answer different questions and a reader
  // comparing them should not have them move together.
  const [speculationYear, setSpeculationYear] = useState(() => new Date().getFullYear());
  const [speculationWindow, setSpeculationWindow] = useState<"calendar" | "solar">("calendar");

  /**
   * The chart, or the reason there isn't one.
   *
   * This used to be a bare `catch { return null }`, which collapsed two very
   * different states into one: "nothing has been submitted yet" and "something
   * was submitted and the engine threw". Both rendered the same "Cast a chart
   * to begin" placeholder, so a user whose input failed saw it apparently
   * ignored, with nothing anywhere indicating that anything had gone wrong.
   *
   * `computeAutoChart` also returns `null` — not a throw — when its input is
   * incomplete, so that case has to be distinguished too.
   */
  const computed = useMemo<{ chart: ChartData | null; error: string | null }>(() => {
    if (!committed) return { chart: null, error: null };
    try {
      const c =
        committed.kind === "auto"
          ? computeAutoChart(committed.data, ayanamsha, nodeMode)
          : computeManualChart(committed.data, ayanamsha);
      if (!c) {
        return {
          chart: null,
          error:
            "The chart could not be built from that input — a date, time or place is missing or unusable. " +
            "Check the birth details and cast again.",
        };
      }
      return { chart: c, error: null };
    } catch (err) {
      return {
        chart: null,
        error:
          `The chart computation failed: ${err instanceof Error ? err.message : String(err)}. ` +
          `This is a defect rather than a data problem — the engine should degrade rather than throw. ` +
          `The birth details that produced it are worth keeping.`,
      };
    }
  }, [committed, ayanamsha, nodeMode]);

  const chart = computed.chart;
  const chartError = computed.error;

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

  const strengths = useMemo(
    () => (chart ? allStrengths(chart, ashtakavarga) : {}),
    [chart, ashtakavarga]
  );

  // Divisional charts, Jaimini karakas/padas and Shadbala: pure arithmetic
  // over the computed chart — cheap enough to stay on the always-on cascade.
  const vargas = useMemo(() => (chart ? computeVargaSet(chart) : null), [chart]);

  const jaimini = useMemo(() => (chart ? computeJaimini(chart) : null), [chart]);

  const shadbala = useMemo(() => (chart ? computeShadbala(chart) : null), [chart]);

  const bhavaBala = useMemo(
    () => (chart && shadbala ? computeBhavaBala(chart, shadbala) : null),
    [chart, shadbala]
  );

  // The house-by-house reading now consumes the divisional/bala/Ashtakavarga
  // layer as well, so it has to be built AFTER them. Each is optional and the
  // synthesis degrades to the Rashi-only reading when one is null — which is
  // what happens for a manual chart with no birth anchor, where Shadbala (and
  // therefore Bhava Bala) cannot be computed at all.
  const houseReadings = useMemo(
    () =>
      chart
        ? interpretFullChart(chart, strengths, {
            vargas,
            shadbala,
            bhavaBala,
            ashtakavarga,
            jaimini,
          })
        : [],
    [chart, strengths, vargas, shadbala, bhavaBala, ashtakavarga, jaimini]
  );

  // Persist the input and the settings that change what is computed. Runs on
  // every change rather than on unload, because a tab closed abruptly (or a
  // crash) is exactly when losing the chart is most annoying.
  useEffect(() => {
    saveSession({ committed, ayanamsha, nodeMode, chartStyle, mode });
  }, [committed, ayanamsha, nodeMode, chartStyle, mode]);

  const advancedUnlocked = useMemo(() => isAdvancedUnlocked(chart), [chart]);

  const personality = useMemo(
    () => (chart ? buildPersonalityProfile(chart, strengths, yogas, { vargas, jaimini, shadbala }) : null),
    [chart, strengths, yogas, vargas, jaimini, shadbala]
  );

  const value = useMemo<ChartContextValue>(
    () => ({
      mode,
      setMode,
      ayanamsha,
      setAyanamsha,
      nodeMode,
      setNodeMode,
      chartStyle,
      setChartStyle,
      predictionYear,
      setPredictionYear,
      predictionWindow,
      setPredictionWindow,
      speculationYear,
      setSpeculationYear,
      speculationWindow,
      setSpeculationWindow,
      commitAuto: (d) => setCommitted({ kind: "auto", data: d }),
      commitManual: (d) => setCommitted({ kind: "manual", data: d }),
      committed,
      clearSession: () => {
        setCommitted(null);
        try {
          window.localStorage.removeItem(STORE_KEY);
        } catch {
          /* nothing to clear */
        }
      },
      chart,
      dashaTree,
      activeDasha,
      transits,
      sadeSati,
      panchang,
      chartError,
      ashtakavarga,
      yogas,
      strengths,
      houseReadings,
      personality,
      vargas,
      jaimini,
      shadbala,
      bhavaBala,
      advancedUnlocked,
      now,
    }),
    [
      mode, ayanamsha, nodeMode, chartStyle, predictionYear, predictionWindow,
      speculationYear, speculationWindow,
      chart, chartError, committed, dashaTree, activeDasha, transits, sadeSati, panchang, ashtakavarga,
      yogas, strengths, houseReadings, personality, vargas, jaimini, shadbala,
      bhavaBala, advancedUnlocked, now,
    ]
  );

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
}

/** Re-exported so consumers have a single import site for the context. */
export { isAdvancedUnlocked };

export function useChart(): ChartContextValue {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within ChartProvider");
  return ctx;
}
