"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  Compass,
  Dices,
  Flame,
  Grid2x2,
  Grid3x3,
  Hourglass,
  Layers,
  Moon,
  OctagonAlert,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { ChartProvider, useChart } from "@/components/context/ChartContext";
import AshtakavargaTable from "@/components/charts/AshtakavargaTable";
import ShadbalaTable from "@/components/charts/ShadbalaTable";
import PlanetTable from "@/components/charts/PlanetTable";
import SouthIndianChart from "@/components/charts/SouthIndianChart";
import AutoInput from "@/components/inputs/AutoInput";
import ManualInput from "@/components/inputs/ManualInput";
import DashaPanel from "@/components/panels/DashaPanel";
import FunctionalLords from "@/components/panels/FunctionalLords";
import InterpretationPanel from "@/components/panels/interpretation/InterpretationPanel";
import LifeAreasPanel from "@/components/panels/LifeAreasPanel";
import LifeEventsPanel from "@/components/panels/lifeEvents/LifeEventsPanel";
import PanchangPanel from "@/components/panels/PanchangPanel";
import PredictionPanel from "@/components/panels/PredictionPanel";
import RectificationPanel from "@/components/panels/rectification/RectificationPanel";
import JaiminiPanel from "@/components/panels/JaiminiPanel";
import VargaPanel from "@/components/panels/VargaPanel";
import Disclaimer from "@/components/ui/Disclaimer";
import DownloadReport from "@/components/ui/DownloadReport";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { AYANAMSHA_IDS, AYANAMSHA_LABELS, AYANAMSHA_SHORT } from "@/utils/astrology/ayanamsha";
import type { NodeMode } from "@/utils/astrology/types";

/**
 * The two gated panels are code-split rather than statically imported.
 *
 * Their data modules (`speculation.ts` 87 KB + `intimacy.ts` 64 KB of source)
 * were shipping in the main route chunk for every visitor, even though the tabs
 * that reach them only appear once `isAdvancedUnlocked` is satisfied. Splitting
 * them changes no visibility behaviour — the gate is unchanged and still
 * decides whether the tab exists at all — it only stops the payload being
 * downloaded and parsed by sessions that can never open it.
 *
 * `ssr: false` because both panels read the chart out of context and have no
 * meaningful server-rendered form; the loading state is a moment at most, since
 * the chunk is fetched the instant the gate opens.
 */
const SpeculationPanel = dynamic(() => import("@/components/panels/SpeculationPanel"), {
  ssr: false,
  loading: () => <PanelSkeleton label="Speculation" />,
});
const IntimacyPanel = dynamic(() => import("@/components/panels/IntimacyPanel"), {
  ssr: false,
  loading: () => <PanelSkeleton label="Intimacy" />,
});

function PanelSkeleton({ label }: { label: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-line bg-surface-soft text-sm text-fg-muted">
      Loading {label}…
    </div>
  );
}

const BASE_TABS = [
  { key: "interpret", label: "Interpretation", icon: BookOpen },
  { key: "life", label: "Life Areas", icon: Compass },
  { key: "dasha", label: "Dasha", icon: Hourglass },
  { key: "events", label: "Life Events", icon: CalendarRange },
  { key: "predict", label: "Predictions", icon: TrendingUp },
  { key: "panchang", label: "Panchang", icon: CalendarDays },
  { key: "vargas", label: "Vargas", icon: Grid2x2 },
  { key: "strength", label: "Strength", icon: Grid3x3 },
  { key: "jaimini", label: "Jaimini", icon: Layers },
  { key: "rectify", label: "Rectify Time", icon: Target },
] as const;

/**
 * Shown only when `isAdvancedUnlocked` (see ChartContext) — the `AU-` name
 * prefix together with an actual gender selection. The gate is silent by
 * design: nothing in the input forms advertises it, and neither panel's copy
 * refers to what revealed it.
 */
const GATED_TABS = [
  { key: "speculation", label: "Speculation", icon: Dices },
  { key: "intimacy", label: "Intimacy", icon: Flame },
] as const;

type TabKey = (typeof BASE_TABS)[number]["key"] | (typeof GATED_TABS)[number]["key"];

function Header() {
  const { ayanamsha, setAyanamsha, chartStyle, setChartStyle, chart, nodeMode, setNodeMode } =
    useChart();
  return (
    <header className="border-b border-line-soft bg-surface-2 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Moon className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-serif text-lg font-bold tracking-wide text-heading">Jyotisha Studio</h1>
            <p className="text-[10px] uppercase tracking-widest text-fg-subtle">
              Precision Vedic Astrology
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-line-2 bg-surface-2 p-1">
            <Settings2 className="ml-1 h-3.5 w-3.5 text-fg-subtle" />
            {AYANAMSHA_IDS.map((a) => (
              <button
                key={a}
                onClick={() => setAyanamsha(a)}
                title={AYANAMSHA_LABELS[a]}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  ayanamsha === a
                    ? "bg-primary-soft text-heading ring-1 ring-inset ring-primary-ring"
                    : "text-fg-muted hover:text-fg-2"
                }`}
              >
                {AYANAMSHA_SHORT[a]}
              </button>
            ))}
          </div>
          <div
            className="flex items-center gap-1 rounded-lg border border-line-2 bg-surface-2 p-1"
            title="Rahu/Ketu computation: mean node is the classical convention; true node is the instantaneous (osculating) node"
          >
            {(["mean", "true"] as NodeMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setNodeMode(m)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  nodeMode === m
                    ? "bg-primary-soft text-heading ring-1 ring-inset ring-primary-ring"
                    : "text-fg-muted hover:text-fg-2"
                }`}
              >
                {m === "mean" ? "Mean Node" : "True Node"}
              </button>
            ))}
          </div>
          {chart && (
            <div className="flex items-center gap-1 rounded-lg border border-line-2 bg-surface-2 p-1">
              {(["rashi", "chalit"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setChartStyle(s)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    chartStyle === s
                      ? "bg-accent-soft text-accent ring-1 ring-inset ring-accent-ring"
                      : "text-fg-muted hover:text-fg-2"
                  }`}
                >
                  {s === "rashi" ? "Rashi" : "Bhava Chalit"}
                </button>
              ))}
            </div>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function InputCard() {
  const { mode, setMode, committed, clearSession, chart } = useChart();
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      {committed && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-line-soft bg-surface-soft px-2.5 py-1.5">
          <span className="text-[11px] text-fg-muted">
            Restored from your last session — this chart survives a refresh.
          </span>
          <button
            type="button"
            onClick={clearSession}
            className="ml-auto text-[11px] font-medium text-eyebrow underline-offset-2 hover:underline"
          >
            Clear
          </button>
        </div>
      )}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-line-2 bg-surface-2 p-1">
        <button
          onClick={() => setMode("auto")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            mode === "auto"
              ? "bg-primary-soft text-heading ring-1 ring-inset ring-primary-ring"
              : "text-fg-muted hover:text-fg-2"
          }`}
        >
          Birth Data (Ephemeris)
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            mode === "manual"
              ? "bg-primary-soft text-heading ring-1 ring-inset ring-primary-ring"
              : "text-fg-muted hover:text-fg-2"
          }`}
        >
          Manual Configuration
        </button>
      </div>
      {mode === "auto" ? <AutoInput /> : <ManualInput />}
      {chart && <DownloadReport />}
    </div>
  );
}

function ChalitShiftSummary() {
  const { chart, chartStyle } = useChart();
  if (!chart || chartStyle !== "chalit" || !chart.cusps) return null;
  const shifted = chart.planets.filter((p) => p.bhava !== p.house);
  return (
    <div className="rounded-xl border border-accent-border bg-accent-wash p-3 text-xs text-fg">
      <span className="font-semibold text-accent">Bhava Chalit (Sripati) shifts: </span>
      {shifted.length === 0
        ? "no planet changes house structurally — the Rashi chart reading holds as-is."
        : shifted.map((p) => `${p.id}: H${p.house} → B${p.bhava}`).join(" · ") +
          ". Read these planets' event-level results from their bhava, their dignity from their sign."}
    </div>
  );
}

/**
 * Ashtakavarga, Shadbala and Bhava Bala on one tab.
 *
 * They belong together because they are three answers to the same question
 * asked from different directions — Ashtakavarga scores a sign by transit
 * support, Shadbala scores a graha by its six-fold capacity, Bhava Bala scores
 * a house by its lord and the glances it receives. Reading any one alone is how
 * a chart gets over- or under-called; the disagreements between them are the
 * finding.
 */
function StrengthTab() {
  return (
    <div className="space-y-6">
      <ShadbalaTable />
      <AshtakavargaTable />
    </div>
  );
}

function Workspace() {
  const { chart, chartError, advancedUnlocked } = useChart();
  const [tab, setTab] = useState<TabKey>("interpret");

  const tabs = useMemo(
    () => (advancedUnlocked ? [...BASE_TABS, ...GATED_TABS] : [...BASE_TABS]),
    [advancedUnlocked]
  );

  // Derived, not stored: recasting the chart without the gate satisfied falls
  // back to Interpretation on the same render, with no effect, no loop and no
  // flash of an unavailable panel.
  const activeTab: TabKey = tabs.some((t) => t.key === tab) ? tab : "interpret";

  return (
    <main className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-5 lg:grid-cols-[minmax(380px,460px)_1fr]">
      {/* Left column: inputs + chart */}
      <div className="space-y-4">
        <InputCard />
        {chart && (
          <>
            <SouthIndianChart chart={chart} />
            <ChalitShiftSummary />
            <PlanetTable chart={chart} />
            <FunctionalLords />
          </>
        )}
      </div>

      {/* Right column: analysis tabs */}
      <div className="min-w-0">
        {chart ? (
          <>
            <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
              {tabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    activeTab === key
                      ? "bg-primary-soft text-heading ring-1 ring-inset ring-primary-ring"
                      : "text-fg-muted hover:bg-inset hover:text-fg-2"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            {activeTab === "interpret" && <InterpretationPanel />}
            {activeTab === "life" && <LifeAreasPanel />}
            {activeTab === "dasha" && <DashaPanel />}
            {activeTab === "events" && <LifeEventsPanel />}
            {activeTab === "predict" && <PredictionPanel />}
            {activeTab === "panchang" && <PanchangPanel />}
            {activeTab === "vargas" && <VargaPanel />}
            {activeTab === "strength" && <StrengthTab />}
            {activeTab === "jaimini" && <JaiminiPanel />}
            {activeTab === "rectify" && <RectificationPanel />}
            {activeTab === "speculation" && <SpeculationPanel />}
            {activeTab === "intimacy" && <IntimacyPanel />}
          </>
        ) : (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-soft p-8 text-center">
            {chartError ? (
              <>
                <OctagonAlert className="mb-3 h-10 w-10 text-bad-strong" />
                <h2 className="font-serif text-xl font-bold text-bad-strong">That chart could not be cast</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-fg">{chartError}</p>
              </>
            ) : (
              <>
            <Sparkles className="mb-3 h-10 w-10 text-eyebrow-faint" />
            <h2 className="font-serif text-xl font-bold text-heading-soft">Cast a chart to begin</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-fg-muted">
              Enter birth data for full ephemeris calculation, or switch to Manual Configuration to map an
              existing chart directly. Interpretations, Vimshottari dashas, Panchang, divisional charts,
              Shadbala, Jaimini and transit-based predictions will populate here.
            </p>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <ChartProvider>
      <Header />
      <Disclaimer />
      <Workspace />
      <footer className="border-t border-line-faint py-4 text-center text-[11px] text-fg-faint">
        Jyotisha Studio · astronomy-engine ephemeris · Lahiri, Pushya &amp; Raman ayanamsha · Sripati Bhava Chalit ·
        For guidance, not determinism.
      </footer>
    </ChartProvider>
  );
}
