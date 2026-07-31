"use client";

import { Eye, ScrollText, Star, UserRound } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { PLANET_NAMES } from "@/utils/astrology/constants";

export default function InterpretationPanel() {
  const { chart, yogas, houseReadings, personality } = useChart();
  if (!chart) return null;

  return (
    <div className="space-y-5">
      {personality && (
        <section className="rounded-xl border border-amber-800/40 bg-gradient-to-br from-amber-950/30 to-indigo-950/30 p-4">
          <h3 className="mb-1 flex items-center gap-2 font-serif text-base font-bold text-amber-300">
            <UserRound className="h-4 w-4" /> Personality Profile
          </h3>
          <p className="mb-3 text-sm font-medium italic text-amber-200/90">{personality.headline}</p>
          <div className="space-y-4">
            {personality.sections.map((s) => (
              <div key={s.heading}>
                <h4 className="mb-1.5 font-serif text-sm font-semibold text-amber-200/80">
                  {s.heading}
                </h4>
                {s.paragraphs.map((p, i) => (
                  <p key={i} className="mb-2 text-sm leading-relaxed text-slate-300 last:mb-0">
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

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

      <section className="rounded-xl border border-indigo-800/40 bg-indigo-950/20 px-4 py-3">
        <h3 className="flex items-center gap-2 font-serif text-base font-bold text-amber-300">
          <ScrollText className="h-4 w-4" /> House-by-House Reading
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          All twelve houses are judged. Houses with no occupant are read the classical way — by the
          condition of their lord and by the drishti (aspects) they receive.
        </p>
      </section>

      {houseReadings.map((h) => (
        <section
          key={h.house}
          className={`rounded-xl border p-4 ${
            h.occupied
              ? "border-indigo-800/50 bg-indigo-950/40"
              : "border-slate-700/50 bg-slate-900/40"
          }`}
        >
          <h3 className="mb-1 font-serif text-base font-bold text-amber-300">{h.title}</h3>
          <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            {h.occupied ? (
              <span className="font-medium text-indigo-300">
                {h.planets.map((p) => PLANET_NAMES[p.id]).join(" · ")}
              </span>
            ) : (
              <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-medium text-slate-400">
                No occupants — read via lord and aspect
              </span>
            )}
            <span>
              Lord: <span className="text-slate-300">{PLANET_NAMES[h.lord.id]}</span>
              {h.lord.position ? ` (in the ${h.lord.position.house}th)` : " (not placed)"}
            </span>
            {h.aspects.length > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {h.aspects.map((a) => `${PLANET_NAMES[a.from]} ${a.offset}th`).join(", ")}
              </span>
            )}
            {h.conjunctions.length > 0 && (
              <span className="text-slate-300">
                {h.conjunctions[h.conjunctions.length - 1].tier} conjunction
              </span>
            )}
          </div>
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
