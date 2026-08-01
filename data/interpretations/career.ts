import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import { PLANET_NAMES, SIGN_LORDS, SIGNS } from "@/utils/astrology/constants";
import type { JaiminiInfo } from "@/utils/astrology/jaimini";
import { findActivationWindows } from "@/utils/astrology/scan";
import type { ShadbalaSet } from "@/utils/astrology/shadbala";
import type { PlanetStrength } from "@/utils/astrology/strength";
import { houseInVarga, vargaPositionOf, type VargaSet } from "@/utils/astrology/varga";
import type { AyanamshaId, ChartData, DashaPeriod, PlanetId, YogaFinding } from "@/utils/astrology/types";
import type { Evidence, RankedItem, SectionReport, TimingWindow } from "./report";
import { toTimingWindow, verdictOf } from "./report";
import { ordinal } from "./synthesis";

/**
 * Career & profession.
 *
 * Sources: the 10th-house/lord career indications follow BPHS
 * (Rajayoga/Karmajiva chapters) and Phaladeepika's karmajiva chapter
 * (profession from the lord of the 10th counted from Lagna, Moon and Sun —
 * Phaladeepika's explicit triple-lagna rule); D-10 Dasamsa readings per the
 * standard Shodasavarga usage (BPHS Ch.6: Dasamsa for "the fruits of
 * karma"); Amatyakaraka per Jaimini Upadesa Sutras.
 * Field lists per planet are the consensus significations tabulated across
 * BPHS/Phaladeepika/Brihat Jataka; cited at work level.
 */

/** Career fields classically signified by each planet. */
const CAREER_FIELDS: Record<PlanetId, { label: string; fields: string }> = {
  Su: { label: "Authority & administration", fields: "government service, administration, leadership roles, medicine, politics, senior management" },
  Mo: { label: "Public-facing & care", fields: "hospitality, healthcare and nursing, psychology, travel, marine/liquids trades, public relations" },
  Ma: { label: "Technical & courage-driven", fields: "engineering, defence and police, surgery, sports, real estate and construction, manufacturing" },
  Me: { label: "Commerce & communication", fields: "business and trade, writing and journalism, accounting, IT and analytics, teaching, consulting" },
  Ju: { label: "Advisory & knowledge", fields: "law, finance and banking, teaching and academia, counselling, religious or charitable institutions" },
  Ve: { label: "Arts & refinement", fields: "design, entertainment and media, fashion and luxury goods, hospitality, diplomacy, beauty and wellness" },
  Sa: { label: "Industry & endurance", fields: "heavy industry, mining and minerals, construction, logistics, labour management, long-cycle research" },
  Ra: { label: "Unconventional & foreign", fields: "technology, foreign trade or postings, aviation, mass media, speculative ventures, emerging industries" },
  Ke: { label: "Depth & detachment", fields: "research, mathematics and statistics, spirituality, alternative healing, archival and investigative work" },
};

export interface CareerReport extends SectionReport {
  options: RankedItem[];
  jobVsBusiness: { verdict: string; reasons: Evidence[]; confidence: number };
  environment: string[];
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function buildCareerReport(
  chart: ChartData,
  vargas: VargaSet | null,
  jaimini: JaiminiInfo | null,
  shadbala: ShadbalaSet | null,
  strengths: Partial<Record<PlanetId, PlanetStrength>>,
  yogas: YogaFinding[]
): CareerReport {
  const lagna = chart.ascendant.sign;
  const caveats: string[] = [];
  const planetOf = (id: PlanetId) => chart.planets.find((p) => p.id === id);

  // ---- Collect weighted "votes" for career-giving planets --------------------
  const votes = new Map<PlanetId, Evidence[]>();
  const addVote = (id: PlanetId, text: string, weight: number, ref?: string) => {
    if (!votes.has(id)) votes.set(id, []);
    votes.get(id)!.push({ text, weight, source: ref ? { work: "Phaladeepika / BPHS", ref } : undefined });
  };

  // 10th lord from Lagna (primary), from Moon and Sun (Phaladeepika's rule).
  const tenthLordFrom = (fromSign: number): PlanetId => SIGN_LORDS[(fromSign + 9) % 12];
  const moon = planetOf("Mo");
  const sun = planetOf("Su");

  const l10 = tenthLordFrom(lagna);
  addVote(l10, `${PLANET_NAMES[l10]} rules your 10th house of career`, 30, "karmajiva from the 10th lord");
  if (moon) {
    const m10 = tenthLordFrom(moon.sign);
    addVote(m10, `${PLANET_NAMES[m10]} rules the 10th counted from your Moon`, 15, "karmajiva judged also from the Moon");
  }
  if (sun) {
    const s10 = tenthLordFrom(sun.sign);
    addVote(s10, `${PLANET_NAMES[s10]} rules the 10th counted from your Sun`, 10, "karmajiva judged also from the Sun");
  }

  // Planets occupying the 10th house.
  for (const p of chart.planets.filter((q) => q.house === 10)) {
    addVote(p.id, `${PLANET_NAMES[p.id]} occupies your 10th house`, 20);
  }

  // D-10 Dasamsa: its lagna lord and occupants of its 10th.
  if (vargas) {
    const d10 = vargas.charts.D10;
    const d10LagnaLord = SIGN_LORDS[d10.ascendant];
    addVote(d10LagnaLord, `${PLANET_NAMES[d10LagnaLord]} rules the Dasamsa (D-10 career chart) lagna`, 20);
    for (const p of d10.positions) {
      if (houseInVarga(d10, p.sign) === 10) {
        addVote(p.id, `${PLANET_NAMES[p.id]} sits in the 10th of the Dasamsa`, 12);
      }
    }
  } else {
    caveats.push("Divisional-chart (D-10) evidence unavailable for this chart.");
  }

  // Amatyakaraka (Jaimini career counselor).
  if (jaimini) {
    addVote(jaimini.karakas.AmK, `${PLANET_NAMES[jaimini.karakas.AmK]} is your Amatyakaraka (the career-counsel planet by degree)`, 18);
  }

  // Strongest planet: Shadbala when available, composite otherwise.
  {
    const strongest = shadbala
      ? shadbala.strongest
      : (Object.values(strengths).sort((a, b) => b.score - a.score)[0]?.id ?? null);
    if (strongest) {
      addVote(
        strongest,
        `${PLANET_NAMES[strongest]} is your strongest planet by ${shadbala ? "Shadbala (six-fold strength)" : "the composite measure"}`,
        10
      );
    }
    if (!shadbala) caveats.push("Shadbala needs an exact birth anchor — the quick composite strength stood in for it.");
  }

  // Career-relevant yogas boost their planets.
  for (const y of yogas) {
    if (y.key.startsWith("raja-") || y.key.startsWith("mahapurusha-") || y.key === "budhaditya" ||
        y.key.startsWith("amala") || y.key === "chandra-mangala" || y.key.startsWith("yk-")) {
      for (const pid of y.planets) addVote(pid, `${y.name} involves ${PLANET_NAMES[pid]}`, 8);
    }
  }

  // ---- Rank into 5–8 career options -----------------------------------------
  const ranked = [...votes.entries()]
    .map(([id, evidence]) => ({
      id,
      total: evidence.reduce((s, e) => s + e.weight, 0),
      evidence,
    }))
    .sort((a, b) => b.total - a.total);

  const maxTotal = ranked[0]?.total ?? 1;
  const options: RankedItem[] = ranked.slice(0, 8).map((r) => {
    const score = clamp(Math.round((r.total / maxTotal) * 90 + 5), 5, 95);
    return {
      key: `career-${r.id}`,
      label: `${CAREER_FIELDS[r.id].label} — ${CAREER_FIELDS[r.id].fields}`,
      score,
      verdict: verdictOf(score),
      reasons: r.evidence,
    };
  });
  while (options.length > 5 && options[options.length - 1].score < 20) options.pop();

  // ---- Job vs business balance ----------------------------------------------
  const houseWeight = (house: number): { weight: number; reasons: Evidence[] } => {
    const reasons: Evidence[] = [];
    let weight = 0;
    const lord = SIGN_LORDS[(lagna + house - 1) % 12];
    const s = strengths[lord];
    if (s) {
      weight += s.score;
      reasons.push({ text: `the ${ordinal(house)} lord ${PLANET_NAMES[lord]} scores ${s.score}/100`, weight: s.score - 50 });
    }
    const occupants = chart.planets.filter((p) => p.house === house);
    weight += occupants.length * 12;
    if (occupants.length) {
      reasons.push({
        text: `${occupants.map((p) => PLANET_NAMES[p.id]).join(", ")} occupy the ${ordinal(house)}`,
        weight: occupants.length * 12,
      });
    }
    return { weight, reasons };
  };

  const sixth = houseWeight(6);   // service / employment
  const seventh = houseWeight(7); // independent business / partnership
  const tenth = houseWeight(10);  // status & authority either way

  let verdict: string;
  const gap = sixth.weight - seventh.weight;
  if (gap > 15) {
    verdict = "Employment suits you better than independent business: the 6th house of service outweighs the 7th of enterprise. Structured roles with clear ladders reward you; pure solo ventures cost more energy than they return.";
  } else if (gap < -15) {
    verdict = "Independent business or partnership suits you better than employment: the 7th house outweighs the 6th. You do your best work with skin in the game — consider entrepreneurship, practice or partnership over a salaried track.";
  } else {
    verdict = "Job and business are nearly balanced in this chart. A hybrid path works well — salaried work that builds toward your own practice, or business with a stable anchor client.";
  }
  const jvbConfidence = clamp(45 + Math.abs(gap), 45, 85);

  const environment: string[] = [];
  if (tenth.weight > 70) environment.push("You need visible responsibility — flat, anonymous roles will chafe. Aim for positions where your name is on the outcome.");
  const tenthSign = (lagna + 9) % 12;
  environment.push(`Your 10th house falls in ${SIGNS[tenthSign]} — work cultures matching that sign's temperament fit best.`);
  if (jaimini) {
    const amk = planetOf(jaimini.karakas.AmK);
    if (amk) environment.push(`The Amatyakaraka in your ${ordinal(amk.house)} house suggests career support arrives through ${ordinal(amk.house)}-house channels.`);
  }

  const topEvidenceCount = options[0]?.reasons.length ?? 0;
  const confidence = clamp(40 + topEvidenceCount * 8 + (vargas ? 8 : 0) + (shadbala ? 5 : 0), 30, 90);

  return {
    key: "career",
    title: "Career & Profession",
    headline: options.length
      ? `Your strongest career signals point to: ${CAREER_FIELDS[ranked[0].id].label.toLowerCase()}.`
      : "Career signals are diffuse — placement quality matters more than field here.",
    score: options[0]?.score,
    verdict: options[0] ? verdictOf(options[0].score) : undefined,
    confidence,
    blocks: [
      {
        heading: "Ranked career directions",
        paragraphs: [
          "Each option below is scored by how many independent chart factors point to it — the 10th house from your Lagna, Moon and Sun, the D-10 career chart, the Amatyakaraka, your strongest planet, and career yogas. More agreeing factors = higher score.",
        ],
        items: options,
      },
      {
        heading: "Job or business?",
        paragraphs: [verdict],
        reasons: [...sixth.reasons.map((r) => ({ ...r, text: `Service side: ${r.text}` })),
                  ...seventh.reasons.map((r) => ({ ...r, text: `Business side: ${r.text}` }))],
      },
      { heading: "Working environment", paragraphs: environment },
    ],
    caveats,
    hasDasha: Boolean(chart.birthUtc),
    options,
    jobVsBusiness: { verdict, reasons: [...sixth.reasons, ...seventh.reasons], confidence: jvbConfidence },
    environment,
  };
}

/** Career timing: computed separately (on card expand) because it scans transits. */
export function careerTimingWindows(
  chart: ChartData,
  dashaTree: DashaPeriod[] | null,
  ayanamsha: AyanamshaId,
  av: AshtakavargaResult | null,
  jaimini: JaiminiInfo | null,
  now: Date
): TimingWindow[] {
  if (!dashaTree || !chart.birthUtc) return [];
  const horizon = new Date(now.getTime() + 15 * 365.25 * 86400000);
  const karakas: PlanetId[] = ["Sa", "Su", "Me"];
  if (jaimini) karakas.unshift(jaimini.karakas.AmK);
  const windows = findActivationWindows(
    chart, dashaTree, ayanamsha, av,
    { houses: [10, 6, 7, 2, 11], karakas, maxWindows: 6 },
    now, horizon
  );
  return windows.map((w) =>
    toTimingWindow(w, `${PLANET_NAMES[w.dasha.maha]}–${PLANET_NAMES[w.dasha.antar]} period`)
  );
}
