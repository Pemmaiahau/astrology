import { aspectedSigns, aspectsOnHouse, naturalBenefics } from "@/utils/astrology/aspects";
import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import {
  NAKSHATRAS,
  PLANET_NAMES,
  SIGN_LORDS,
  SIGNS,
} from "@/utils/astrology/constants";
import { activeDashaAt } from "@/utils/astrology/dasha";
import { allStrengths } from "@/utils/astrology/strength";
import { DIGNITY_LABELS } from "@/utils/astrology/states";
import type { ChartData, DashaPeriod, PlanetId, YogaFinding } from "@/utils/astrology/types";
import type { JaiminiInfo } from "@/utils/astrology/jaimini";
import type { BhavaBala, ShadbalaSet } from "@/utils/astrology/shadbala";
import type { VargaSet } from "@/utils/astrology/varga";
import { ownedHouses } from "@/utils/astrology/yogas";
import { FUNCTIONAL_ROLES } from "./lordships";
import { buildAreaOptions, type AreaLever, type AreaPossibility } from "./lifeAreaOptions";
// Verdict thresholds shared with the scored Interpretation sections.
import { verdictOf } from "./report";
import { ordinal } from "./synthesis";

/**
 * Life-area analysis engine. For each area (finance, health, love, marriage,
 * career, children & education, property & vehicles, spirituality) it reads:
 *   - the area's primary houses: sign, occupants (with functional role),
 *     benefic/malefic drishti landing on them,
 *   - each primary house lord: placement, dignity, composite strength,
 *     combustion/retrogression/war, position counted from the house it rules,
 *   - the area karakas (natural significators) under the same lens,
 *   - nakshatra-dispositor relationships for lords and karakas,
 *   - detected yogas touching the area's planets,
 * then aggregates a 0–100 area score → a verdict tier, and (when a dasha tree
 * exists) reports which running dasha lords activate the area now plus the
 * upcoming Maha–Antar windows (20-year horizon) connected to it.
 * Pure function of (chart, dashaTree, ashtakavarga, yogas, now) — no UI.
 */

export type LifeAreaKey =
  | "finance"
  | "health"
  | "love"
  | "marriage"
  | "career"
  | "children"
  | "property"
  | "spirituality";

interface AreaConfig {
  key: LifeAreaKey;
  name: string;
  blurb: string;
  /** Houses whose lords/occupants/aspects drive the verdict. */
  primary: number[];
  /** Houses mentioned in support but not scored. */
  supporting: number[];
  karakas: PlanetId[];
}

export const AREA_CONFIGS: AreaConfig[] = [
  {
    key: "finance",
    name: "Finance & Wealth",
    blurb: "earnings, savings, gains and accumulated assets (2nd and 11th houses; Jupiter as dhana-karaka)",
    primary: [2, 11],
    supporting: [9],
    karakas: ["Ju"],
  },
  {
    key: "health",
    name: "Health & Vitality",
    blurb: "constitution, immunity, disease and recovery (1st and 6th houses; the Sun as vitality-karaka)",
    primary: [1, 6],
    supporting: [8],
    karakas: ["Su"],
  },
  {
    key: "love",
    name: "Love & Romance",
    blurb: "romance, courtship and affairs of the heart (5th house; Venus as prema-karaka)",
    primary: [5],
    supporting: [7, 11],
    karakas: ["Ve"],
  },
  {
    key: "marriage",
    name: "Marriage & Partnership",
    blurb: "marriage, the spouse and committed alliances (7th house; Venus as kalatra-karaka)",
    primary: [7],
    supporting: [2, 12],
    karakas: ["Ve"],
  },
  {
    key: "career",
    name: "Job & Career",
    blurb: "profession, status and workplace (10th house; Saturn as karma-karaka, the Sun for authority)",
    primary: [10],
    supporting: [6, 11],
    karakas: ["Sa", "Su"],
  },
  {
    key: "children",
    name: "Children & Education",
    blurb: "progeny, intellect and learning (5th house, 9th for higher study; Jupiter as putra-karaka, Mercury for intellect)",
    primary: [5],
    supporting: [4, 9],
    karakas: ["Ju", "Me"],
  },
  {
    key: "property",
    name: "Property & Vehicles",
    blurb: "land, home, real estate and conveyances (4th house; Mars as bhumi-karaka, Venus for vehicles)",
    primary: [4],
    supporting: [2, 11],
    karakas: ["Ma", "Ve"],
  },
  {
    key: "spirituality",
    name: "Spirituality & Moksha",
    blurb: "dharma, devotion and liberation (9th and 12th houses; Jupiter as guru-karaka, Ketu as moksha-karaka)",
    primary: [9, 12],
    supporting: [5, 8],
    karakas: ["Ju", "Ke"],
  },
];

export type AreaVerdict = "Strong promise" | "Supportive" | "Mixed" | "Needs effort" | "Challenged";

export interface AreaHouseReading {
  house: number;
  sign: number;
  lines: string[];
}

export interface ActivationWindow {
  label: string;
  start: Date;
  end: Date;
  reason: string;
  grade: "strong" | "moderate";
}

export interface LifeAreaReport {
  key: LifeAreaKey;
  name: string;
  blurb: string;
  score: number;
  verdict: AreaVerdict;
  houses: AreaHouseReading[];
  karakas: string[];
  nakshatra: string[];
  yogas: string[];
  cautions: string[];
  activationNow: string[];
  windows: ActivationWindow[];
  hasDasha: boolean;
  /** Ranked, chart-derived directions this area can actually take. */
  possibilities: AreaPossibility[];
  /** The practical levers: what to lead with, what to pair, what to repair. */
  levers: AreaLever[];
  /** Divisional / Bhava Bala / Shadbala second opinion for the area. */
  corroboration: string[];
}

/**
 * The classical layers the possibilities engine reads. All optional: a manual
 * chart with no birth anchor has no Shadbala and therefore no Bhava Bala, and
 * the ranking simply rests on fewer sources.
 */
export interface LifeAreaDepth {
  vargas?: VargaSet | null;
  shadbala?: ShadbalaSet | null;
  bhavaBala?: BhavaBala[] | null;
  jaimini?: JaiminiInfo | null;
}

const DUSTHANA = [6, 8, 12];
const UPACHAYA = [3, 6, 10, 11];
const YEAR_MS = 365.25 * 86400000;
const HORIZON_YEARS = 20;

function firstSentence(text: string): string {
  const i = text.indexOf(". ");
  return i === -1 ? text : text.slice(0, i + 1);
}

function flagsOf(chart: ChartData, id: PlanetId): string {
  const p = chart.planets.find((q) => q.id === id);
  if (!p) return "";
  const flags: string[] = [];
  if (p.retrograde) flags.push("retrograde");
  if (p.combust) flags.push("combust");
  if (p.warWith) flags.push(p.warWinner ? "graha yuddha winner" : "graha yuddha loser");
  return flags.length ? ` (${flags.join(", ")})` : "";
}

/** Why is this planet connected to the area? null = not connected. */
function connectionReason(chart: ChartData, id: PlanetId, cfg: AreaConfig): string | null {
  const lagna = chart.ascendant.sign;
  const reasons: string[] = [];
  const owned = ownedHouses(id, lagna).filter((h) => cfg.primary.includes(h));
  if (owned.length) reasons.push(`lord of the ${owned.map(ordinal).join("/")}`);
  const p = chart.planets.find((q) => q.id === id);
  if (p && cfg.primary.includes(p.house)) reasons.push(`occupies the ${ordinal(p.house)}`);
  if (cfg.karakas.includes(id)) reasons.push("karaka");
  if (p) {
    const aspected = cfg.primary.filter((h) => {
      const sign = (lagna + h - 1) % 12;
      return p.sign !== sign && aspectedSigns(id, p.sign).includes(sign);
    });
    if (aspected.length) reasons.push(`aspects the ${aspected.map(ordinal).join("/")}`);
  }
  return reasons.length ? reasons.join("; ") : null;
}

export function buildLifeAreaReports(
  chart: ChartData,
  dashaTree: DashaPeriod[] | null,
  ashtakavarga: AshtakavargaResult | null,
  yogaFindings: YogaFinding[],
  now: Date,
  depth: LifeAreaDepth = {}
): LifeAreaReport[] {
  const lagna = chart.ascendant.sign;
  const strengths = allStrengths(chart, ashtakavarga);
  const benefics = naturalBenefics(chart);
  const roles = FUNCTIONAL_ROLES[lagna];
  const hasDasha = Boolean(dashaTree && chart.birthUtc);

  return AREA_CONFIGS.map((cfg) => {
    const houses: AreaHouseReading[] = [];
    const cautions: string[] = [];
    const nakshatraLines: string[] = [];
    const nakSeen = new Set<PlanetId>();

    const addNakLine = (id: PlanetId, roleLabel: string) => {
      if (nakSeen.has(id)) return;
      nakSeen.add(id);
      const p = chart.planets.find((q) => q.id === id);
      const s = strengths[id];
      if (!p || !s) return;
      const relText = {
        self: "its own star — self-directed, self-sustaining results",
        friend: "a natural friend — the star supports the planet's agenda",
        neutral: "a neutral relation — the star neither helps nor hinders",
        enemy: "a natural enemy — inner friction between the planet's agenda and its star-lord",
      }[s.nakshatraRelation];
      nakshatraLines.push(
        `${PLANET_NAMES[id]} (${roleLabel}) occupies ${NAKSHATRAS[p.nakshatra]}, ruled by ${PLANET_NAMES[s.nakshatraLord]}: ${relText}.`
      );
    };

    // ---- Primary house readings -------------------------------------------
    let lordScoreSum = 0;
    let lordCount = 0;
    let occupantAdj = 0;
    let aspectAdj = 0;
    const relevantPlanets = new Set<PlanetId>(cfg.karakas);

    for (const h of cfg.primary) {
      const sign = (lagna + h - 1) % 12;
      const lordId = SIGN_LORDS[sign];
      relevantPlanets.add(lordId);
      const occupants = chart.planets.filter((p) => p.house === h);
      const lines: string[] = [];

      lines.push(
        `The ${ordinal(h)} house falls in ${SIGNS[sign]}${
          occupants.length
            ? `, occupied by ${occupants.map((o) => PLANET_NAMES[o.id]).join(", ")}`
            : ", unoccupied"
        }.`
      );

      // Lord condition
      const lord = chart.planets.find((p) => p.id === lordId);
      const lordStr = strengths[lordId];
      if (lord && lordStr) {
        lordScoreSum += lordStr.score;
        lordCount++;
        lines.push(
          `Its lord ${PLANET_NAMES[lordId]} sits in the ${ordinal(lord.house)} house in ${SIGNS[lord.sign]} — ${DIGNITY_LABELS[lord.dignity]}, strength ${lordStr.score}/100 (${lordStr.grade})${flagsOf(chart, lordId)}.`
        );
        const fromHouse = ((lord.house - h + 12) % 12) + 1;
        if (DUSTHANA.includes(fromHouse)) {
          lines.push(
            `${PLANET_NAMES[lordId]} stands in the ${ordinal(fromHouse)} from the house it rules — its protection arrives late, and only after deliberate effort.`
          );
          cautions.push(
            `${cfg.name}: the ${ordinal(h)} lord ${PLANET_NAMES[lordId]} is in a dusthana counted from its own house.`
          );
        }
        if (lord.combust) cautions.push(`${cfg.name}: the ${ordinal(h)} lord ${PLANET_NAMES[lordId]} is combust.`);
        if (lord.dignity === "debilitated") {
          const cancelled = yogaFindings.some((y) => y.key === `nbrj-${lordId}`);
          cautions.push(
            `${cfg.name}: the ${ordinal(h)} lord ${PLANET_NAMES[lordId]} is debilitated${cancelled ? " — but Neechabhanga cancellation applies, converting early weakness into eventual strength" : ""}.`
          );
        }
        addNakLine(lordId, `${ordinal(h)} lord`);
      }

      // Occupants with functional colouring
      for (const o of occupants) {
        relevantPlanets.add(o.id);
        const role =
          roles.yogakaraka === o.id
            ? "yogakaraka"
            : roles.benefics.includes(o.id)
              ? "functional benefic"
              : roles.malefics.includes(o.id)
                ? "functional malefic"
                : "functionally neutral";
        const oStr = strengths[o.id];
        lines.push(
          `${PLANET_NAMES[o.id]} (${role}, ${oStr ? `${oStr.score}/100 ${oStr.grade}` : "—"}) occupies this house${flagsOf(chart, o.id)}.`
        );
        let adj =
          roles.yogakaraka === o.id ? 6 : roles.benefics.includes(o.id) ? 4 : roles.malefics.includes(o.id) ? -4 : 0;
        // Natural malefics do well in upachaya houses — soften the penalty.
        if (adj < 0 && UPACHAYA.includes(h) && !benefics.includes(o.id)) adj += 2;
        if (oStr) adj += oStr.grade === "Excellent" || oStr.grade === "Strong" ? 2 : oStr.grade === "Afflicted" ? -2 : 0;
        occupantAdj += adj;
      }

      // Drishti on the house
      const aspecting = aspectsOnHouse(chart, h);
      const benA = aspecting.filter((id) => benefics.includes(id));
      const malA = aspecting.filter((id) => !benefics.includes(id));
      if (benA.length)
        lines.push(`Benefic drishti from ${benA.map((id) => PLANET_NAMES[id]).join(", ")} steadies this house.`);
      if (malA.length)
        lines.push(`Malefic drishti from ${malA.map((id) => PLANET_NAMES[id]).join(", ")} applies pressure here.`);
      aspectAdj += benA.length * 3 - malA.length * 3;
      if (malA.length >= 2 && benA.length === 0) {
        cautions.push(
          `${cfg.name}: the ${ordinal(h)} house takes ${malA.length} malefic aspects with no benefic counterweight.`
        );
      }

      houses.push({ house: h, sign, lines });
    }

    // ---- Karakas ------------------------------------------------------------
    const karakaLines: string[] = [];
    let karakaScoreSum = 0;
    let karakaCount = 0;
    for (const k of cfg.karakas) {
      const p = chart.planets.find((q) => q.id === k);
      const s = strengths[k];
      if (!p || !s) continue;
      karakaScoreSum += s.score;
      karakaCount++;
      const top = [...s.factors].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 2);
      karakaLines.push(
        `${PLANET_NAMES[k]} as karaka: in ${SIGNS[p.sign]} in the ${ordinal(p.house)} house — ${DIGNITY_LABELS[p.dignity]}, strength ${s.score}/100 (${s.grade})${flagsOf(chart, k)}. Key factors: ${top.map((f) => `${f.label} ${f.delta > 0 ? "+" : ""}${f.delta}`).join("; ")}.`
      );
      if (p.combust) cautions.push(`${cfg.name}: karaka ${PLANET_NAMES[k]} is combust — its significations need conscious cultivation.`);
      addNakLine(k, "karaka");
    }

    // ---- Yogas touching this area -------------------------------------------
    const yogaLines = yogaFindings
      .filter((y) => y.planets.some((pid) => relevantPlanets.has(pid)))
      .map((y) => `${y.name} (${y.planets.map((id) => PLANET_NAMES[id]).join(", ")}): ${firstSentence(y.description)}`);

    // ---- Aggregate score ------------------------------------------------------
    const lordScore = lordCount ? lordScoreSum / lordCount : 50;
    const karakaScore = karakaCount ? karakaScoreSum / karakaCount : 50;
    const raw =
      0.5 * lordScore +
      0.35 * karakaScore +
      7.5 + // neutral ballast so a fully average chart lands mid-scale
      Math.max(-12, Math.min(12, occupantAdj)) +
      Math.max(-10, Math.min(10, aspectAdj));
    const score = Math.max(5, Math.min(95, Math.round(raw)));

    // ---- Dasha activation -------------------------------------------------------
    const activationNow: string[] = [];
    const windows: ActivationWindow[] = [];
    if (hasDasha && dashaTree) {
      const active = activeDashaAt(dashaTree, now);
      if (active) {
        const levels: { label: string; lord: PlanetId }[] = [
          { label: "Mahadasha", lord: active.maha.lord },
          { label: "Antardasha", lord: active.antar.lord },
          { label: "Pratyantardasha", lord: active.pratyantar.lord },
        ];
        for (const { label, lord } of levels) {
          const reason = connectionReason(chart, lord, cfg);
          if (reason) activationNow.push(`${label} lord ${PLANET_NAMES[lord]} is connected: ${reason}.`);
        }
      }
      const horizon = new Date(now.getTime() + HORIZON_YEARS * YEAR_MS);
      for (const md of dashaTree) {
        if (md.end.getTime() <= now.getTime() || md.start.getTime() >= horizon.getTime()) continue;
        const mdReason = connectionReason(chart, md.lord, cfg);
        for (const ad of md.children ?? []) {
          if (ad.end.getTime() <= now.getTime() || ad.start.getTime() >= horizon.getTime()) continue;
          const adReason = connectionReason(chart, ad.lord, cfg);
          if (!mdReason && !adReason) continue;
          const parts: string[] = [];
          if (mdReason) parts.push(`${PLANET_NAMES[md.lord]}: ${mdReason}`);
          if (adReason) parts.push(`${PLANET_NAMES[ad.lord]}: ${adReason}`);
          windows.push({
            label: `${PLANET_NAMES[md.lord]}–${PLANET_NAMES[ad.lord]}`,
            start: ad.start,
            end: ad.end,
            reason: parts.join(" · "),
            grade: mdReason && adReason ? "strong" : "moderate",
          });
          if (windows.length >= 8) break;
        }
        if (windows.length >= 8) break;
      }
    }

    const optionSet = buildAreaOptions({
      chart,
      key: cfg.key,
      primary: cfg.primary,
      supporting: cfg.supporting,
      karakas: cfg.karakas,
      strengths,
      vargas: depth.vargas ?? null,
      shadbala: depth.shadbala ?? null,
      bhavaBala: depth.bhavaBala ?? null,
      ashtakavarga,
      jaimini: depth.jaimini ?? null,
    });

    return {
      key: cfg.key,
      name: cfg.name,
      blurb: cfg.blurb,
      score,
      verdict: verdictOf(score),
      possibilities: optionSet.possibilities,
      levers: optionSet.levers,
      corroboration: optionSet.corroboration,
      houses,
      karakas: karakaLines,
      nakshatra: nakshatraLines,
      yogas: yogaLines,
      cautions,
      activationNow,
      windows,
      hasDasha,
    };
  });
}
