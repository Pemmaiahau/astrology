"use client";

import { useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Compass,
  Grid3x3,
  Hourglass,
  Moon,
  Settings2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { ChartProvider, useChart } from "@/components/context/ChartContext";
import AshtakavargaTable from "@/components/charts/AshtakavargaTable";
import PlanetTable from "@/components/charts/PlanetTable";
import SouthIndianChart from "@/components/charts/SouthIndianChart";
import AutoInput from "@/components/inputs/AutoInput";
import ManualInput from "@/components/inputs/ManualInput";
import DashaPanel from "@/components/panels/DashaPanel";
import FunctionalLords from "@/components/panels/FunctionalLords";
import InterpretationPanel from "@/components/panels/interpretation/InterpretationPanel";
import LifeAreasPanel from "@/components/panels/LifeAreasPanel";
import PanchangPanel from "@/components/panels/PanchangPanel";
import PredictionPanel from "@/components/panels/PredictionPanel";
import Disclaimer from "@/components/ui/Disclaimer";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { AYANAMSHA_LABELS } from "@/utils/astrology/ayanamsha";
import type { AyanamshaId, NodeMode } from "@/utils/astrology/types";

const TABS = [
  { key: "interpret", label: "Interpretation", icon: BookOpen },
  { key: "life", label: "Life Areas", icon: Compass },
  { key: "dasha", label: "Dasha", icon: Hourglass },
  { key: "predict", label: "Predictions", icon: TrendingUp },
  { key: "panchang", label: "Panchang", icon: CalendarDays },
  { key: "ashtaka", label: "Ashtakavarga", icon: Grid3x3 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

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
            {(["lahiri", "pushya"] as AyanamshaId[]).map((a) => (
              <button
                key={a}
                onClick={() => setAyanamsha(a)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  ayanamsha === a
                    ? "bg-primary-soft text-heading ring-1 ring-inset ring-primary-ring"
                    : "text-fg-muted hover:text-fg-2"
                }`}
              >
                {AYANAMSHA_LABELS[a].split(" ")[0]}
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
  const { mode, setMode } = useChart();
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
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

function Workspace() {
  const { chart } = useChart();
  const [tab, setTab] = useState<TabKey>("interpret");

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
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    tab === key
                      ? "bg-primary-soft text-heading ring-1 ring-inset ring-primary-ring"
                      : "text-fg-muted hover:bg-inset hover:text-fg-2"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            {tab === "interpret" && <InterpretationPanel />}
            {tab === "life" && <LifeAreasPanel />}
            {tab === "dasha" && <DashaPanel />}
            {tab === "predict" && <PredictionPanel />}
            {tab === "panchang" && <PanchangPanel />}
            {tab === "ashtaka" && <AshtakavargaTable />}
          </>
        ) : (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-soft p-8 text-center">
            <Sparkles className="mb-3 h-10 w-10 text-eyebrow-faint" />
            <h2 className="font-serif text-xl font-bold text-heading-soft">Cast a chart to begin</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-fg-muted">
              Enter birth data for full ephemeris calculation, or switch to Manual Configuration to map an
              existing chart directly. Interpretations, Vimshottari dashas, Panchang, Ashtakavarga and
              transit-based predictions will populate here.
            </p>
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
        Jyotisha Studio · astronomy-engine ephemeris · Lahiri &amp; Pushya ayanamsha · Sripati Bhava Chalit ·
        For guidance, not determinism.
      </footer>
    </ChartProvider>
  );
}
