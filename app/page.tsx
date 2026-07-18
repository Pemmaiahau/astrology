"use client";

import { useState } from "react";
import {
  BookOpen,
  CalendarDays,
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
import InterpretationPanel from "@/components/panels/InterpretationPanel";
import PanchangPanel from "@/components/panels/PanchangPanel";
import PredictionPanel from "@/components/panels/PredictionPanel";
import { AYANAMSHA_LABELS } from "@/utils/astrology/ayanamsha";
import type { AyanamshaId } from "@/utils/astrology/types";

const TABS = [
  { key: "interpret", label: "Interpretation", icon: BookOpen },
  { key: "dasha", label: "Dasha", icon: Hourglass },
  { key: "predict", label: "Predictions", icon: TrendingUp },
  { key: "panchang", label: "Panchang", icon: CalendarDays },
  { key: "ashtaka", label: "Ashtakavarga", icon: Grid3x3 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function Header() {
  const { ayanamsha, setAyanamsha, chartStyle, setChartStyle, chart } = useChart();
  return (
    <header className="border-b border-indigo-800/40 bg-indigo-950/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Moon className="h-6 w-6 text-amber-400" />
          <div>
            <h1 className="font-serif text-lg font-bold tracking-wide text-amber-300">Jyotisha Studio</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">
              Precision Vedic Astrology
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-indigo-800/60 bg-indigo-950/60 p-1">
            <Settings2 className="ml-1 h-3.5 w-3.5 text-slate-500" />
            {(["lahiri", "pushya"] as AyanamshaId[]).map((a) => (
              <button
                key={a}
                onClick={() => setAyanamsha(a)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  ayanamsha === a
                    ? "bg-amber-500/20 text-amber-300 ring-1 ring-inset ring-amber-600/50"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {AYANAMSHA_LABELS[a].split(" ")[0]}
              </button>
            ))}
          </div>
          {chart && (
            <div className="flex items-center gap-1 rounded-lg border border-indigo-800/60 bg-indigo-950/60 p-1">
              {(["rashi", "chalit"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setChartStyle(s)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    chartStyle === s
                      ? "bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-inset ring-fuchsia-600/50"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {s === "rashi" ? "Rashi" : "Bhava Chalit"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function InputCard() {
  const { mode, setMode } = useChart();
  return (
    <div className="rounded-xl border border-indigo-800/50 bg-indigo-950/40 p-4">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-indigo-800/60 bg-indigo-950/60 p-1">
        <button
          onClick={() => setMode("auto")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            mode === "auto"
              ? "bg-amber-500/20 text-amber-300 ring-1 ring-inset ring-amber-600/50"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Birth Data (Ephemeris)
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            mode === "manual"
              ? "bg-amber-500/20 text-amber-300 ring-1 ring-inset ring-amber-600/50"
              : "text-slate-400 hover:text-slate-200"
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
    <div className="rounded-xl border border-fuchsia-800/40 bg-fuchsia-950/20 p-3 text-xs text-slate-300">
      <span className="font-semibold text-fuchsia-300">Bhava Chalit (Sripati) shifts: </span>
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
            <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-indigo-800/50 bg-indigo-950/40 p-1">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    tab === key
                      ? "bg-amber-500/20 text-amber-300 ring-1 ring-inset ring-amber-600/50"
                      : "text-slate-400 hover:bg-indigo-900/40 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            {tab === "interpret" && <InterpretationPanel />}
            {tab === "dasha" && <DashaPanel />}
            {tab === "predict" && <PredictionPanel />}
            {tab === "panchang" && <PanchangPanel />}
            {tab === "ashtaka" && <AshtakavargaTable />}
          </>
        ) : (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-indigo-800/50 bg-indigo-950/20 p-8 text-center">
            <Sparkles className="mb-3 h-10 w-10 text-amber-500/50" />
            <h2 className="font-serif text-xl font-bold text-amber-300/90">Cast a chart to begin</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
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
      <Workspace />
      <footer className="border-t border-indigo-900/40 py-4 text-center text-[11px] text-slate-600">
        Jyotisha Studio · astronomy-engine ephemeris · Lahiri &amp; Pushya ayanamsha · Sripati Bhava Chalit ·
        For guidance, not determinism.
      </footer>
    </ChartProvider>
  );
}
