"use client";

import { TrendingUp } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { buildMonthlyPrediction, buildYearlyPrediction } from "@/data/interpretations/predictions";

export default function PredictionPanel() {
  const { chart, activeDasha, transits, sadeSati, now } = useChart();
  if (!chart) return null;
  if (!transits) return null;

  const needsAnchor = !chart.birthUtc;
  const yearly = buildYearlyPrediction(chart, activeDasha, transits, sadeSati, now);
  const monthly = buildMonthlyPrediction(chart, activeDasha, transits, now);

  return (
    <div className="space-y-5">
      {needsAnchor && (
        <p className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 text-xs text-amber-300/90">
          No birth anchor supplied — dasha-based sections are omitted; transit readings below remain valid
          against your mapped Moon and Lagna.
        </p>
      )}

      <section>
        <h3 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-amber-300">
          <TrendingUp className="h-5 w-5" /> Current Year — {now.getFullYear()}
        </h3>
        <div className="space-y-4">
          {yearly.map((s) => (
            <div key={s.heading} className="rounded-xl border border-indigo-800/50 bg-indigo-950/40 p-4">
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-amber-500/80">{s.heading}</h4>
              {s.paragraphs.filter(Boolean).map((p, i) => (
                <p key={i} className="mb-2.5 text-sm leading-relaxed text-slate-300 last:mb-0">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-serif text-lg font-bold text-amber-300">
          Current Month — {now.toLocaleString("en-US", { month: "long" })}
        </h3>
        <div className="space-y-4">
          {monthly.map((s) => (
            <div key={s.heading} className="rounded-xl border border-indigo-800/50 bg-indigo-950/40 p-4">
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-amber-500/80">{s.heading}</h4>
              {s.paragraphs.filter(Boolean).map((p, i) => (
                <p key={i} className="mb-2.5 text-sm leading-relaxed text-slate-300 last:mb-0">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
