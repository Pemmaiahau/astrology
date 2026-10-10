import { aspectedSigns } from "@/utils/astrology/aspects";
import { NAKSHATRA_QUALITIES } from "@/utils/astrology/constants";
import type { TimingWindow } from "../report";
import { ASPECT_ON_HOUSE } from "../aspectTexts";
import { PLANET_IN_HOUSE } from "../planetInHouse";
import { HOUSE_GOVERNS } from "../significations";
import {
  aspectorsOfSign, bhavaRupas, deg, DIGNITY_WORD, fmtRatio, houseSign, lordOf, name, names, nakOf, occupants, ord,
  planet, ratio, sav, sentences, SIGNS, type ReadingContext, type ReadingSubsection,
} from "./context";

const KENDRA = [1, 4, 7, 10];
const TRIKONA = [5, 9];
const DUSTHANA = [6, 8, 12];

/** "Your 10th lord sits in your 3rd, so career runs through courage, effort…" */
export function lordInHouseSentence(rc: ReadingContext, house: number): string | null {
  const lord = lordOf(rc, house);
  const p = planet(rc, lord);
  if (!p) return null;
  const quality = p.house === house
    ? "its own house — the matter is self-directed and stable"
    : DUSTHANA.includes(p.house)
      ? DUSTHANA.includes(house)
        ? "a difficult house ruled from a difficult house, which classically reverses into gain after struggle (Vipareeta)"
        : "a difficult house, so results come with effort, delay or a detour"
      : KENDRA.includes(p.house) || TRIKONA.includes(p.house)
        ? "a supportive house, so results flow with less resistance"
        : "a growth house, so results build with effort over time";
  return `Your ${ord(house)} lord ${name(lord)} sits in your ${ord(p.house)}, carrying ${HOUSE_GOVERNS[house].short} into ${HOUSE_GOVERNS[p.house].phrase} — ${quality}.`;
}

/**
 * The standard house subsection: the sign, its lord's placement and strength,
 * occupants and aspects as the lead; each occupant's and aspect's reading,
 * the lord's placement and the SAV verdict as bullets.
 */
export function houseSubsection(rc: ReadingContext, house: number, heading: string): ReadingSubsection {
  const sign = houseSign(rc, house);
  const lord = lordOf(rc, house);
  const lp = planet(rc, lord);
  const occ = occupants(rc, house);
  const asp = aspectorsOfSign(rc, sign, aspectedSigns);
  const r = ratio(rc, lord);
  const lead: string[] = [];
  if (lp) {
    const n = nakOf(lp.longitude);
    lead.push(
      `The ${ord(house)} house is ${SIGNS[sign]}${occ.length ? `, occupied by ${names(occ)}` : ", with no occupants"}. Its lord ${name(lord)} is in the ${ord(lp.house)} at ${deg(lp.longitude)} ${SIGNS[lp.sign]} (${n.name}), ${DIGNITY_WORD[lp.dignity]}${lp.retrograde && lord !== "Ra" && lord !== "Ke" ? ", retrograde" : ""}${lp.combust ? ", combust" : ""}${r !== null ? `, at ${fmtRatio(r)} its Shadbala requirement` : ""}.`
    );
  }
  const facts: string[] = [];
  if (asp.length) facts.push(`${names(asp)} ${asp.length > 1 ? "aspect" : "aspects"} it`);
  const s = sav(rc, house);
  if (s !== null) facts.push(`it holds ${s} SAV bindus (${s >= 30 ? "well above" : s >= 28 ? "above" : s >= 25 ? "just below" : "well below"} the 28 average)`);
  const bb = bhavaRupas(rc, house);
  if (bb !== null) facts.push(`Bhava Bala ${bb.toFixed(1)} rupas`);
  if (facts.length) lead.push(`${facts[0][0].toUpperCase()}${facts.join("; ").slice(1)}.`);

  const bullets: string[] = [];
  const li = lordInHouseSentence(rc, house);
  if (li) bullets.push(li);
  if (lp) bullets.push(`${name(lord)} works through ${nakOf(lp.longitude).name}: ${NAKSHATRA_QUALITIES[nakOf(lp.longitude).index]}.`);
  for (const id of occ) bullets.push(`${name(id)} here: ${sentences(PLANET_IN_HOUSE[id][house - 1], 2).join(" ")}`);
  for (const id of asp) bullets.push(`${name(id)}'s aspect: ${sentences(ASPECT_ON_HOUSE[id][house - 1], 1).join(" ")}`);
  return { heading, lead, bullets };
}

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/** One bullet per upcoming or running window, with the cross-checks named. */
export function windowBullets(windows: TimingWindow[], max = 4): string[] {
  const live = windows
    .filter((w) => w.phase !== "past")
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, max);
  return live.map(
    (w) =>
      `${fmt(w.start)} – ${fmt(w.end)} (age ${w.ageRange.from}–${w.ageRange.to}): ${w.label}, ${w.grade} (${w.confidence}% confidence)${w.confirmedBy?.length ? `, confirmed by ${w.confirmedBy.join(" and ")} dasha` : ""}${w.phase === "current" ? " — running now" : ""}.`
  );
}

/** The most recent passed window, for "if it happened, it most likely happened then". */
export function lastPassed(windows: TimingWindow[]): TimingWindow | null {
  const past = windows.filter((w) => w.phase === "past").sort((a, b) => b.confidence - a.confidence);
  return past[0] ?? null;
}
