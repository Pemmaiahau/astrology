import { AGE_BANDS, agePriorFor, dateAtAge } from "@/utils/astrology/ageBands";
import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import { PLANET_NAMES, SIGN_LORDS, SIGNS } from "@/utils/astrology/constants";
import type { JaiminiInfo } from "@/utils/astrology/jaimini";
import { findActivationWindows } from "@/utils/astrology/scan";
import type { ShadbalaSet } from "@/utils/astrology/shadbala";
import type { PlanetStrength } from "@/utils/astrology/strength";
import { houseInVarga, vargaPositionOf, type VargaSet } from "@/utils/astrology/varga";
import type { AyanamshaId, ChartData, DashaPeriod, PlanetId, YogaFinding } from "@/utils/astrology/types";
import type { Evidence, RankedItem, SectionReport, TimingWindow } from "./report";
import { plain, toTimingWindow, verdictOf } from "./report";
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
  addVote(l10, `${PLANET_NAMES[l10]} rules your 10th house — the house of the work you are known for`, 30, "karmajiva from the 10th lord");
  if (moon) {
    const m10 = tenthLordFrom(moon.sign);
    addVote(m10, `${PLANET_NAMES[m10]} rules the 10th counted from your Moon, so this direction also suits you emotionally`, 15, "karmajiva judged also from the Moon");
  }
  if (sun) {
    const s10 = tenthLordFrom(sun.sign);
    addVote(s10, `${PLANET_NAMES[s10]} rules the 10th counted from your Sun, so this work fits who you take yourself to be`, 10, "karmajiva judged also from the Sun");
  }

  // Planets occupying the 10th house.
  for (const p of chart.planets.filter((q) => q.house === 10)) {
    addVote(p.id, `${PLANET_NAMES[p.id]} sits in your 10th house, putting its stamp on how you are seen at work`, 20);
  }

  // D-10 Dasamsa: its lagna lord and occupants of its 10th.
  if (vargas) {
    const d10 = vargas.charts.D10;
    const d10LagnaLord = SIGN_LORDS[d10.ascendant];
    addVote(d10LagnaLord, `${PLANET_NAMES[d10LagnaLord]} rules the rising sign of your ${plain("Dasamsa")} — the chart read for working life specifically`, 20);
    for (const p of d10.positions) {
      if (houseInVarga(d10, p.sign) === 10) {
        addVote(p.id, `${PLANET_NAMES[p.id]} sits in the 10th house of your career chart, which is a second, independent vote for it`, 12);
      }
    }
  } else {
    caveats.push(
      "The D-10 career chart could not be built for this chart, so one of the independent votes below is missing. The ranking still holds; it simply rests on fewer sources."
    );
  }

  // Amatyakaraka (Jaimini career counselor).
  if (jaimini) {
    addVote(jaimini.karakas.AmK, `${PLANET_NAMES[jaimini.karakas.AmK]} is your ${plain("Amatyakaraka")}, the planet that classically shows where help and advancement come from`, 18);
  }

  // Strongest planet: Shadbala when available, composite otherwise.
  {
    const strongest = shadbala
      ? shadbala.strongest
      : (Object.values(strengths).sort((a, b) => b.score - a.score)[0]?.id ?? null);
    if (strongest) {
      addVote(
        strongest,
        `${PLANET_NAMES[strongest]} is the strongest planet in your chart by ${shadbala ? plain("Shadbala") : "the composite strength measure"} — whatever it touches tends to be where you are simply better than average`,
        10
      );
    }
    if (!shadbala)
      caveats.push(
        "Shadbala, the classical six-fold strength measure, needs an exact birth time and place, so the quicker composite score stood in for it here. That mostly affects fine ordering between close options, not the overall shape of the ranking."
      );
  }

  // Career-relevant yogas boost their planets — once per yoga *name*, not once
  // per finding. `detectYogas` emits a separate Raja Yoga finding for every
  // kendra-lord/trikona-lord pair, so a planet standing in two such pairs used
  // to collect two identical +8 votes carrying word-for-word identical text:
  // the reader saw the same sentence twice and the score counted it twice.
  // One yoga type, one vote. (The alternative — scaling the weight by how many
  // pairs a planet appears in — would need a multiplicity weighting no source
  // supplies, so it is deliberately not done.)
  const creditedYogas = new Set<string>();
  for (const y of yogas) {
    if (y.key.startsWith("raja-") || y.key.startsWith("mahapurusha-") || y.key === "budhaditya" ||
        y.key.startsWith("amala") || y.key === "chandra-mangala" || y.key.startsWith("yk-")) {
      for (const pid of y.planets) {
        const credit = `${pid}|${y.name}`;
        if (creditedYogas.has(credit)) continue;
        creditedYogas.add(credit);
        addVote(pid, `${y.name} forms in your chart and ${PLANET_NAMES[pid]} is part of it, which lifts everything that planet governs`, 8);
      }
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
      reasons.push({ text: `${PLANET_NAMES[lord]} rules your ${ordinal(house)} house and scores ${s.score}/100 for strength`, weight: s.score - 50 });
    }
    const occupants = chart.planets.filter((p) => p.house === house);
    weight += occupants.length * 12;
    if (occupants.length) {
      reasons.push({
        text: `${occupants.map((p) => PLANET_NAMES[p.id]).join(", ")} ${occupants.length === 1 ? "sits" : "sit"} in your ${ordinal(house)} house, adding weight to that side`,
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
    verdict =
      "Employment suits you better than working for yourself: your 6th house, which carries service and steady work, outweighs your 7th, which carries enterprise. In practice that means a role with a clear ladder and a boss you respect gets more out of you than a solo venture does. Going fully independent tends to cost you more energy than it returns — which is worth knowing before you romanticise it.";
  } else if (gap < -15) {
    verdict =
      "Working for yourself suits you better than employment: your 7th house of enterprise and partnership outweighs your 6th of service. You do your best work with something of your own at stake, and you tend to underperform in roles where the upside belongs to someone else. A practice, a business, or a genuine partnership is the shape to aim for.";
  } else {
    verdict =
      "Job and business sit almost level in your chart, which is a real result rather than a fence-sit. A hybrid tends to work best: salaried work that quietly builds toward your own practice, or a business held steady by one anchor client. The thing to avoid is jumping between the two every few years without letting either compound.";
  }
  const jvbConfidence = clamp(45 + Math.abs(gap), 45, 85);

  const environment: string[] = [];
  if (tenth.weight > 70)
    environment.push(
      "You need visible responsibility. A flat, anonymous role chafes on you within a year or two, however good the pay is — the thing that keeps you engaged is having your name attached to the outcome, including when it goes wrong."
    );
  const tenthSign = (lagna + 9) % 12;
  environment.push(
    `Your 10th house falls in ${SIGNS[tenthSign]}, and work cultures with that sign's temperament are where you settle in fastest. It is worth weighing that against salary when you choose between two offers — the culture is the thing you live in every day.`
  );
  if (jaimini) {
    const amk = planetOf(jaimini.karakas.AmK);
    if (amk)
      environment.push(
        `Your Amatyakaraka sits in the ${ordinal(amk.house)} house, which is where career support tends to reach you from. Practically: the doors that open for you usually open through ${ordinal(amk.house)}-house channels rather than through cold applications.`
      );
  }

  const topEvidenceCount = options[0]?.reasons.length ?? 0;
  const confidence = clamp(40 + topEvidenceCount * 8 + (vargas ? 8 : 0) + (shadbala ? 5 : 0), 30, 90);

  return {
    key: "career",
    title: "Career & Profession",
    headline: options.length
      ? `Your chart points most strongly toward ${CAREER_FIELDS[ranked[0].id].label.toLowerCase()} — that is where the most independent factors agree.`
      : "Your career signals are spread thin rather than pointing one way, which usually means how you work matters more than what field you pick.",
    score: options[0]?.score,
    verdict: options[0] ? verdictOf(options[0].score) : undefined,
    confidence,
    blocks: [
      {
        heading: "Where your work fits best",
        paragraphs: [
          "Each direction below is scored by how many independent parts of your chart point at it: your 10th house read from the rising sign, from the Moon and from the Sun, your D-10 career chart, your Amatyakaraka, your strongest planet, and any career-forming combinations. The more of those agree, the higher the score.",
          "Read these as the grain of the wood rather than as a list of job titles. Work that runs with the grain costs you less to sustain, which over twenty years matters more than any single decision about which role to take.",
        ],
        items: options,
      },
      {
        heading: "Job or business?",
        paragraphs: [verdict],
        reasons: [...sixth.reasons.map((r) => ({ ...r, text: `Service side: ${r.text}` })),
                  ...seventh.reasons.map((r) => ({ ...r, text: `Business side: ${r.text}` }))],
      },
      { heading: "The conditions you work best in", paragraphs: environment },
    ],
    caveats,
    hasDasha: Boolean(chart.birthUtc),
    options,
    jobVsBusiness: { verdict, reasons: [...sixth.reasons, ...seventh.reasons], confidence: jvbConfidence },
    environment,
  };
}

export const CAREER_ENTRY_GROUP = "Entry & establishment (22–30)";
export const CAREER_CHANGE_GROUP = "Change, elevation & independence (28–50)";

/**
 * Career timing: computed separately (on card expand) because it scans
 * transits. Two scans rather than one, because a working life has two very
 * different questions in it — *getting established* (22–30, read from the
 * 10th/6th/2nd) and *changing, rising or going independent* (28–50, read from
 * the 10th/7th/11th/3rd). Each is scanned across its own age band, so a
 * 40-year-old still sees the entry window they lived through and a 24-year-old
 * still sees the elevation window ahead of them. `now` only labels phase.
 */
export function careerTimingWindows(
  chart: ChartData,
  dashaTree: DashaPeriod[] | null,
  ayanamsha: AyanamshaId,
  av: AshtakavargaResult | null,
  jaimini: JaiminiInfo | null,
  now: Date
): TimingWindow[] {
  if (!dashaTree || !chart.birthUtc) return [];
  const birth = chart.birthUtc;
  const amk = jaimini ? [jaimini.karakas.AmK] : [];

  const scan = (
    band: (typeof AGE_BANDS)["careerEntry"],
    houses: number[],
    karakas: PlanetId[],
    maxWindows: number,
    group: string
  ): TimingWindow[] =>
    findActivationWindows(
      chart, dashaTree, ayanamsha, av,
      {
        houses,
        karakas,
        maxWindows,
        agePriorAt: agePriorFor(birth, band),
        relativeTo: now,
      },
      dateAtAge(birth, band.start), dateAtAge(birth, band.end)
    ).map((w) =>
      toTimingWindow(w, `${PLANET_NAMES[w.dasha.maha]}–${PLANET_NAMES[w.dasha.antar]} period`, birth, group)
    );

  const entry = scan(
    AGE_BANDS.careerEntry,
    [10, 6, 2],
    [...amk, "Sa", "Su", "Me"],
    3,
    CAREER_ENTRY_GROUP
  );
  const change = scan(
    AGE_BANDS.careerChange,
    [10, 7, 11, 3],
    [...amk, "Sa", "Su", "Me", "Ra"],
    4,
    CAREER_CHANGE_GROUP
  );
  return [...entry, ...change];
}
