"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Eye, Layers, ScrollText, Star } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { PLANET_NAMES } from "@/utils/astrology/constants";
import type { HouseInterpretation } from "@/data/interpretations/synthesis";
import { oneSentence } from "@/data/interpretations/brief";
import { DIGNITY_SHORT } from "@/utils/astrology/states";
import { SIGNS } from "@/utils/astrology/constants";
import { FullReasoning } from "./BriefView";
import ReadingView from "./ReadingView";
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

const TONE_STYLE: Record<HouseInterpretation["verdict"]["tone"], { label: string; className: string }> = {
  favourable: { label: "Favourable", className: "bg-good-soft text-good ring-good-ring" },
  split: { label: "Conditional", className: "bg-primary-soft text-heading ring-primary-ring" },
  unfavourable: { label: "Weak", className: "bg-bad-soft text-bad ring-bad-ring" },
  unscored: { label: "—", className: "text-fg-subtle ring-line-ring" },
};

/**
 * One house as one row: the measurable facts (occupants, lord placement and
 * dignity, aspects, SAV, Bhava Bala) and the convergence verdict, with the
 * full reading and the classical corroboration one click away.
 */
function HouseRow({ h }: { h: HouseInterpretation }) {
  const [open, setOpen] = useState(false);
  const tone = TONE_STYLE[h.verdict.tone];
  const lordPos = h.lord.position;
  return (
    <li className="border-b border-line-soft last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2 text-left text-xs transition hover:bg-inset"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-fg-subtle" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />}
        <span className="w-28 shrink-0 font-serif text-sm font-bold text-heading">
          {h.house}. {SIGNS[h.sign]}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${tone.className}`}>{tone.label}</span>
        <span className="text-fg">
          {h.occupied ? h.planets.map((p) => PLANET_NAMES[p.id]).join(", ") : <span className="text-fg-subtle">empty</span>}
        </span>
        <span className="text-fg-muted">
          lord {PLANET_NAMES[h.lord.id]}
          {lordPos ? ` → H${lordPos.house} ${DIGNITY_SHORT[lordPos.dignity]}${lordPos.retrograde ? " R" : ""}${lordPos.combust ? " C" : ""}` : ""}
        </span>
        {h.aspects.length > 0 && (
          <span className="flex items-center gap-1 text-fg-muted">
            <Eye className="h-3 w-3" />
            {h.aspects.map((a) => PLANET_NAMES[a.from]).join(", ")}
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-fg-subtle">
          {h.sav !== null ? `SAV ${h.sav}` : ""}
          {h.bhavaRupas !== null ? ` · ${h.bhavaRupas.toFixed(1)} rupas` : ""}
        </span>
      </button>
      {!open && (h.verdict.support.length > 0 || h.verdict.against.length > 0) && (
        <p className="px-2 pb-2 pl-8 text-[11px] leading-snug text-fg-muted">
          {h.verdict.support.length > 0 && <span className="text-good">▲ {h.verdict.support.join(", ")}</span>}
          {h.verdict.support.length > 0 && h.verdict.against.length > 0 && " · "}
          {h.verdict.against.length > 0 && <span className="text-bad">▼ {h.verdict.against.join(", ")}</span>}
        </p>
      )}
      {open && (
        <div className="space-y-2 px-2 pb-3 pl-8">
          {h.paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-fg">
              {p}
            </p>
          ))}
          {h.depth.length > 0 && <DepthBlock reading={h} />}
        </div>
      )}
    </li>
  );
}

/**
 * The Interpretation tab: personality profile, detected yogas, the scored
 * life-question cards (career, wealth, marriage, foreign, cautions, lucky —
 * added as collapsible SectionCards), then the house-by-house reading with its
 * classical corroboration block.
 */
export default function InterpretationPanel() {
  const { chart, yogas, extendedYogas, houseReadings } = useChart();
  if (!chart) return null;

  return (
    <div className="space-y-5">
      {/* The astrologer's report — Parts 1–7 (replaces the old Personality Profile block). */}
      <ReadingView />

      {yogas.length + extendedYogas.length > 0 && (
        <section className="rounded-xl border border-good-border bg-good-wash p-4">
          <h3 className="mb-1 flex items-center gap-2 font-serif text-base font-bold text-good">
            <Star className="h-4 w-4" /> Yogas Detected
          </h3>
          <ul className="mb-3 space-y-1">
            {[
              ...yogas.map((y) => ({ key: y.key, name: y.name, planets: y.planets, text: y.description, adverse: ["kemadruma", "shakata", "daridra", "kala-sarpa"].some((k) => y.key.startsWith(k)) && !y.name.includes("cancelled") })),
              ...extendedYogas.map((y) => ({ key: y.key, name: y.name, planets: y.planets, text: y.description, adverse: y.kind === "dosha" })),
            ].map((y) => (
              <li key={y.key} className="flex items-start gap-2 text-sm leading-snug text-fg">
                <span className={`mt-0.5 shrink-0 text-xs ${y.adverse ? "text-bad-strong" : "text-good-strong"}`} aria-hidden>
                  {y.adverse ? "▼" : "▲"}
                </span>
                <span>
                  <span className={`font-semibold ${y.adverse ? "text-bad" : "text-good-2"}`}>{y.name}</span>
                  {y.planets.length > 0 && <span className="text-xs text-fg-muted"> ({y.planets.map((p) => PLANET_NAMES[p]).join(", ")})</span>}
                  {" — "}
                  {oneSentence(y.text)}
                </span>
              </li>
            ))}
          </ul>
          <FullReasoning label="Full yoga descriptions">
            <ul className="space-y-3">
              {[...yogas, ...extendedYogas].map((y) => (
                <li key={y.key} className="text-sm leading-relaxed text-fg">
                  <span className="font-semibold text-good-2">{y.name}</span> — {y.description}
                </li>
              ))}
            </ul>
          </FullReasoning>
        </section>
      )}

      {/* Scored life-question cards (collapsed by default; heavy timing work
          only runs when a card's timing is requested). */}
      <h3 className="px-1 pt-2 font-serif text-base font-bold text-heading">Scores, windows and full reasoning</h3>
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
          One row per house: occupants, the lord's placement and dignity, the planets aspecting it, its
          Ashtakavarga points (SAV) and Bhava Bala, and the verdict of the independent measures (▲ support,
          ▼ against). Open a row for the full reading and the classical corroboration.
        </p>
        <ul className="mt-2 rounded-lg border border-line-soft bg-surface">
          {houseReadings.map((h) => (
            <HouseRow key={h.house} h={h} />
          ))}
        </ul>
      </section>
    </div>
  );
}
