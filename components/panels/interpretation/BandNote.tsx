"use client";

import { AGE_BANDS, bandStance, type BandKey } from "@/utils/astrology/ageBands";

/** How each band is named to the reader when its edge case fires. */
const BAND_LABEL: Record<BandKey, string> = {
  marriage: "marriage",
  careerEntry: "entry and establishment",
  careerChange: "career change and elevation",
  wealth: "earning and accumulation",
  foreign: "moving abroad",
};

/**
 * The standing note above every age-banded window list: what the band is,
 * where the reader currently stands in it, and — required, not optional — that
 * the band is a modern convention rather than a classical rule.
 */
export default function BandNote({
  bands,
  lead,
  age,
}: {
  bands: BandKey[];
  lead: string;
  age: number | null;
}) {
  const whole = age === null ? null : Math.round(age);
  const stances =
    age === null
      ? []
      : bands
          .map((key) => ({ key, band: AGE_BANDS[key], stance: bandStance(AGE_BANDS[key], age) }))
          .filter((s) => s.stance !== "inside");

  return (
    <div className="mb-2 space-y-1 text-[11px] leading-relaxed text-fg-subtle">
      <p>{lead}</p>
      {stances.map(({ key, band, stance }) => (
        <p key={key}>
          {stance === "before"
            ? `You are ${whole}, and the ${BAND_LABEL[key]} band opens at ${band.start} — every window below is still ahead of you.`
            : `You are ${whole}, past the ${band.start}–${band.end} range this section scans for ${BAND_LABEL[key]}. That range has closed, so the chart is being read backwards here: these are the windows that carried the theme, not windows still to come.`}
        </p>
      ))}
      <p>
        The age range is a common-experience convention, not a classical rule — no Parashari text
        fixes these years. Your chart supplies the timing; the band only supplies the plausibility,
        so if your own life ran on a different clock, trust your life.
      </p>
    </div>
  );
}
