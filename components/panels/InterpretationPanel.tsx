"use client";

import { ScrollText, Star } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { interpretFullChart, lagnaOverview } from "@/data/interpretations/synthesis";

export default function InterpretationPanel() {
  const { chart, yogas } = useChart();
  if (!chart) return null;

  const overview = lagnaOverview(chart);
  const houses = interpretFullChart(chart);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-amber-800/40 bg-gradient-to-br from-amber-950/30 to-indigo-950/30 p-4">
        <h3 className="mb-2 flex items-center gap-2 font-serif text-base font-bold text-amber-300">
          <ScrollText className="h-4 w-4" /> Lagna Assessment
        </h3>
        {overview.map((p, i) => (
          <p key={i} className="mb-2 text-sm leading-relaxed text-slate-300">
            {p}
          </p>
        ))}
      </section>

      {yogas.length > 0 && (
        <section className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-serif text-base font-bold text-emerald-300">
            <Star className="h-4 w-4" /> Structural Yogas Detected
          </h3>
          <ul className="space-y-3">
            {yogas.map((y) => (
              <li key={y.key} className="text-sm leading-relaxed text-slate-300">
                <span className="font-semibold text-emerald-200">{y.name}</span> — {y.description}
              </li>
            ))}
          </ul>
        </section>
      )}

      {houses.map((h) => (
        <section key={h.house} className="rounded-xl border border-indigo-800/50 bg-indigo-950/40 p-4">
          <h3 className="mb-2 font-serif text-base font-bold text-amber-300">
            {h.title}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {h.planets.map((p) => p.id).join(" · ")}
            </span>
          </h3>
          {h.paragraphs.map((p, i) => (
            <p key={i} className="mb-2.5 text-sm leading-relaxed text-slate-300 last:mb-0">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
