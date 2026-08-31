"use client";

import { useState } from "react";
import { Eye, Layers, ScrollText, Star, UserRound } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { PLANET_NAMES } from "@/utils/astrology/constants";
import type { HouseInterpretation } from "@/data/interpretations/synthesis";
import CareerCard from "./CareerCard";
import CautionsCard from "./CautionsCard";
import ForeignCard from "./ForeignCard";
import LuckyCard from "./LuckyCard";
import MarriageCard from "./MarriageCard";
import WealthCard from "./WealthCard";

/**
 * The classical corroboration block for one house.
 *
 * Kept collapsed by default and visually separated from the Rashi prose above,
 * because it answers a different question: the paragraphs above say what the
 * birth chart promises, and this says how many of the other classical accounts
 * back that promise. Merging them would let a reader mistake corroboration for
 * a second, independent claim about the same thing.
 */
function DepthBlock({ reading }: { reading: HouseInterpretation }) {
  const [open, setOpen] = useState(false);
  const chips: string[] = [];
  if (reading.sav !== null) chips.push(`SAV ${reading.sav}`);
  if (reading.bhavaRupas !== null) chips.push(`Bhava Bala ${reading.bhavaRupas.toFixed(1)} rupas`);

  return (
    <div className="mt-3 rounded-lg border border-line-soft bg-surface-soft">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left transition hover:bg-inset"
      >
        <Layers className="h-3.5 w-3.5 shrink-0 text-eyebrow" />
        <span className="text-xs font-bold uppercase tracking-wider text-eyebrow">
          Classical corroboration
        </span>
        {chips.map((c) => (
          <span
            key={c}
            className="rounded-full bg-inset-2 px-2 py-0.5 font-mono text-[10px] font-semibold text-fg-muted"
          >
            {c}
          </span>
        ))}
        <span className="ml-auto text-[11px] font-medium text-fg-subtle">
          {open ? "hide" : `${reading.depth.length} checks`}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-line-soft px-3 py-2.5">
          {reading.depth.map((d, i) => (
            <p
              key={i}
              className={`text-xs leading-relaxed ${
                i === reading.depth.length - 1 && d.startsWith("Convergence")
                  ? "rounded-md bg-primary-wash p-2 font-medium text-heading-soft"
                  : "text-fg-muted"
              }`}
            >
              {d}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The Interpretation tab: personality profile, detected yogas, the scored
 * life-question cards (career, wealth, marriage, foreign, cautions, lucky —
 * added as collapsible SectionCards), then the house-by-house reading with its
 * classical corroboration block.
 */
export default function InterpretationPanel() {
  const { chart, yogas, houseReadings, personality } = useChart();
  if (!chart) return null;

  return (
    <div className="space-y-5">
      {personality && (
        <section className="rounded-xl border border-heading-border bg-gradient-to-br from-primary-wash to-surface-soft p-4">
          <h3 className="mb-1 flex items-center gap-2 font-serif text-base font-bold text-heading">
            <UserRound className="h-4 w-4" /> Personality Profile
          </h3>
          <p className="mb-3 text-sm font-medium italic text-heading-2">{personality.headline}</p>
          <div className="space-y-4">
            {personality.sections.map((s) => (
              <div key={s.heading}>
                <h4 className="mb-1.5 font-serif text-sm font-semibold text-heading-2">
                  {s.heading}
                </h4>
                {s.paragraphs.map((p, i) => (
                  <p key={i} className="mb-2 text-sm leading-relaxed text-fg last:mb-0">
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {yogas.length > 0 && (
        <section className="rounded-xl border border-good-border bg-good-wash p-4">
          <h3 className="mb-2 flex items-center gap-2 font-serif text-base font-bold text-good">
            <Star className="h-4 w-4" /> Structural Yogas Detected
          </h3>
          <ul className="space-y-3">
            {yogas.map((y) => (
              <li key={y.key} className="text-sm leading-relaxed text-fg">
                <span className="font-semibold text-good-2">{y.name}</span> — {y.description}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Scored life-question cards (collapsed by default; heavy timing work
          only runs when a card's timing is requested). */}
      <CareerCard />
      <WealthCard />
      <MarriageCard />
      <ForeignCard />
      <CautionsCard />
      <LuckyCard />

      <section className="rounded-xl border border-line-soft bg-surface-soft px-4 py-3">
        <h3 className="flex items-center gap-2 font-serif text-base font-bold text-heading">
          <ScrollText className="h-4 w-4" /> House-by-House Reading
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">
          All twelve houses are judged. Houses with no occupant are read the classical way — by the
          condition of their lord and by the drishti (aspects) they receive. Each house also carries a
          <span className="font-semibold text-fg-2"> Classical corroboration </span>
          block: the Navamsa and the house&apos;s own divisional chart, its Bhava Bala in rupas, its
          Sarvashtakavarga bindus, the lord&apos;s Shadbala against the classical minimum, and Jaimini
          argala — ending in a convergence line saying how many of those independent measures agree.
        </p>
      </section>

      {houseReadings.map((h) => (
        <section
          key={h.house}
          className={`rounded-xl border p-4 ${
            h.occupied
              ? "border-line bg-surface"
              : "border-vacant-border bg-vacant"
          }`}
        >
          <h3 className="mb-1 font-serif text-base font-bold text-heading">{h.title}</h3>
          <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
            {h.occupied ? (
              <span className="font-medium text-planet">
                {h.planets.map((p) => PLANET_NAMES[p.id]).join(" · ")}
              </span>
            ) : (
              <span className="rounded bg-vacant-chip px-1.5 py-0.5 font-medium text-fg-muted">
                No occupants — read via lord and aspect
              </span>
            )}
            <span>
              Lord: <span className="text-fg">{PLANET_NAMES[h.lord.id]}</span>
              {h.lord.position ? ` (in the ${h.lord.position.house}th)` : " (not placed)"}
            </span>
            {h.aspects.length > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {h.aspects.map((a) => `${PLANET_NAMES[a.from]} ${a.offset}th`).join(", ")}
              </span>
            )}
            {h.conjunctions.length > 0 && (
              <span className="text-fg">
                {h.conjunctions[h.conjunctions.length - 1].tier} conjunction
              </span>
            )}
          </div>
          {h.paragraphs.map((p, i) => (
            <p key={i} className="mb-2.5 text-sm leading-relaxed text-fg last:mb-0">
              {p}
            </p>
          ))}
          {h.depth.length > 0 && <DepthBlock reading={h} />}
        </section>
      ))}
    </div>
  );
}
