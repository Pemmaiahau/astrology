"use client";

import { CalendarDays } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { NAKSHATRA_QUALITIES } from "@/utils/astrology/constants";
import {
  KARANA_TEXT,
  TITHI_GROUP_TEXT,
  VARA_TEXT,
  YOGA_TEXT,
  tithiGroup,
} from "@/data/interpretations/panchangTexts";

export default function PanchangPanel() {
  const { panchang, chart } = useChart();
  if (!chart) return null;
  if (!panchang) {
    return (
      <p className="rounded-xl border border-line bg-surface p-4 text-sm text-fg-muted">
        Panchang requires the birth instant — add date, time and place to compute the five limbs of time.
      </p>
    );
  }

  const group = tithiGroup(panchang.tithiIndex);
  const pillars = [
    {
      label: "Tithi (Lunar Day)",
      value: `${panchang.paksha} ${panchang.tithiName}`,
      text: `This native was ${TITHI_GROUP_TEXT[group]}`,
    },
    {
      label: "Vara (Solar Day)",
      value: panchang.varaName,
      text: VARA_TEXT[panchang.varaIndex],
    },
    {
      label: "Nakshatra (Moon's Star)",
      value: panchang.nakshatraName,
      text: `Moon in ${panchang.nakshatraName}: ${NAKSHATRA_QUALITIES[panchang.nakshatraIndex]}.`,
    },
    {
      label: "Yoga (Soli-lunar)",
      value: panchang.yogaName,
      text: YOGA_TEXT[panchang.yogaIndex],
    },
    {
      label: "Karana (Half-Tithi)",
      value: panchang.karanaName,
      text: KARANA_TEXT[panchang.karanaName] ?? "",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-heading-border bg-primary-wash p-3">
        <h3 className="flex items-center gap-2 font-serif text-base font-bold text-heading">
          <CalendarDays className="h-4 w-4" /> Panchang at Birth
        </h3>
        <p className="mt-1 text-xs text-fg-muted">
          The five pillars of the birth moment — the baseline energetic signature beneath the chart.
          {panchang.sunrise && (
            <> Sunrise (used for Vara): {panchang.sunrise.toLocaleTimeString("en-GB", { timeZone: chart.meta.timezone })} local.</>
          )}
        </p>
      </div>
      {pillars.map((p) => (
        <div key={p.label} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-eyebrow">{p.label}</span>
            <span className="font-serif text-sm font-bold text-fg-strong">{p.value}</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-fg">{p.text}</p>
        </div>
      ))}
    </div>
  );
}
