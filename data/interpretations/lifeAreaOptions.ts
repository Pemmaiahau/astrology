import { PLANET_NAMES, SIGN_LORDS, SIGNS } from "@/utils/astrology/constants";
import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import type { JaiminiInfo } from "@/utils/astrology/jaimini";
import type { BhavaBala, ShadbalaSet } from "@/utils/astrology/shadbala";
import type { PlanetStrength } from "@/utils/astrology/strength";
import { houseInVarga, vargaPositionOf, VARGA_NAMES, type VargaId, type VargaSet } from "@/utils/astrology/varga";
import type { ChartData, PlanetId } from "@/utils/astrology/types";
import { ordinal } from "./synthesis";
import type { LifeAreaKey } from "./lifeAreas";

/**
 * Possibilities and best options for a life area.
 *
 * The area reports already say how strong an area is and when it activates.
 * What they could not say is the thing a reader actually wants: *which* of the
 * many things this area could mean is the one this chart is pointing at, and
 * what to do about it.
 *
 * The method is the one `career.ts` already uses for professions, generalised:
 * collect weighted votes for grahas from the classical significators of the
 * area (its house lords, its occupants, its karakas, the divisional chart the
 * tradition reads for that subject, the Jaimini karaka where one applies),
 * rank the grahas, then read each winner's classical significations for THAT
 * area off a table. A ranked possibility is therefore never a guess — it is a
 * named graha's own signification, surfaced because that graha won the vote.
 *
 * Sources: the per-graha significations are the consensus tabulations across
 * BPHS, Phaladeepika and Brihat Jataka, cited at work level (see SOURCES.md).
 * The area→varga pairings are BPHS Ch.6, where each varga is assigned its own
 * subject; the vote weights are this engine's own policy, not doctrine, and
 * are surfaced in the UI for exactly that reason.
 */

/**
 * The divisional chart the tradition reads for each area's subject.
 * Love is the one pairing that is a judgement call rather than a direct
 * assignment: the 5th house's own varga is the D-7, but the D-7's subject is
 * progeny rather than romance, so the D-9 — which governs relationship quality
 * generally — is used and the substitution is stated in the output.
 */
export const AREA_VARGA: Record<LifeAreaKey, VargaId> = {
  finance: "D2",
  health: "D30",
  love: "D9",
  marriage: "D9",
  career: "D10",
  children: "D7",
  property: "D4",
  spirituality: "D20",
};

export const AREA_VARGA_NOTE: Partial<Record<LifeAreaKey, string>> = {
  love:
    "The 5th house's own division is the D-7, but the D-7 is read for progeny rather than for romance, so the Navamsa — the general account of how this native does in relationship — stands in for it here.",
  health:
    "The Trimsamsa is the classical account of misfortune and its sources, which is how the tradition reads constitutional vulnerability; there is no dedicated health varga in the Shodasavarga.",
};

interface AreaOption {
  label: string;
  detail: string;
}

/**
 * What each graha classically offers inside each area. A graha absent from an
 * area's table simply casts no possibility there — Ketu offers nothing legible
 * about property, and inventing something for it would be worse than silence.
 */
export const AREA_OPTIONS: Record<LifeAreaKey, Partial<Record<PlanetId, AreaOption>>> = {
  finance: {
    Su: { label: "Authority-linked income", detail: "salary from government, public institutions or senior office; income that follows rank rather than volume, and rises in steps at promotions rather than continuously" },
    Mo: { label: "Public and cyclical income", detail: "earnings from the public, from food, liquids, hospitality, property rental or anything with a seasonal rhythm; income fluctuates by nature, so reserves matter more than for most" },
    Ma: { label: "Earned-by-effort income", detail: "land and construction, engineering, defence or technical services, and self-driven ventures; money arrives in bursts tied directly to exertion and risk taken" },
    Me: { label: "Trade and intellectual income", detail: "commerce, brokerage, writing, analytics, accounts, teaching and consulting; typically several concurrent streams rather than one, which is a strength here rather than a scatter" },
    Ju: { label: "Advisory and institutional wealth", detail: "finance, law, education, advisory work; also inheritance, endowment and the wealth that arrives through mentors and reputation rather than transaction" },
    Ve: { label: "Comfort and refinement income", detail: "design, media, luxury goods, hospitality, vehicles and beauty; earnings that scale with taste and relationships, and often through a partner or through partnership" },
    Sa: { label: "Slow-compounding wealth", detail: "long-cycle assets, industry, logistics, labour-intensive operations, and above all patience — Saturn's money is small early and substantial late, and it punishes shortcuts" },
    Ra: { label: "Unconventional and foreign income", detail: "technology, foreign trade or foreign postings, speculation, emerging industries; disproportionate returns that arrive suddenly and require managing the downside deliberately" },
    Ke: { label: "Detached or specialist income", detail: "research, niche technical expertise, spiritual or healing work; money is rarely the motivation and tends to arrive as a by-product of depth" },
  },
  health: {
    Su: { label: "Vitality, heart and constitution", detail: "core vitality, the heart, bones and eyes; strength here is stamina and recovery, weakness shows as low baseline energy and blood-pressure sensitivity" },
    Mo: { label: "Fluids, mind and digestion", detail: "bodily fluids, the stomach, the emotional-physical link; sleep, hydration and emotional regulation do more for this constitution than any regimen aimed at the body alone" },
    Ma: { label: "Blood, inflammation and injury", detail: "blood, muscle, inflammatory conditions and accident-proneness; this constitution needs a physical outlet, and denies itself one at its cost" },
    Me: { label: "Nerves, skin and speech", detail: "the nervous system, skin and respiratory tract; symptoms present as anxiety and dispersal before they present physically, so mental load is the leading indicator" },
    Ju: { label: "Liver, metabolism and expansion", detail: "liver, fat metabolism and anything that grows — the classical risk is excess rather than deficiency, and moderation is the whole remedy" },
    Ve: { label: "Reproductive and glandular", detail: "reproductive and urinary systems, kidneys, and the effects of indulgence; the body responds well to pleasure taken in measure and badly to it taken without" },
    Sa: { label: "Bones, joints and chronicity", detail: "bones, joints, teeth, and the tendency for complaints to become chronic rather than acute; early attention costs a fraction of late attention here" },
    Ra: { label: "Undiagnosed and toxic", detail: "conditions that resist diagnosis, allergies, poisoning and the effects of substances; a second opinion is worth more in this chart than in most" },
    Ke: { label: "Obscure and subtle", detail: "obscure complaints, immune dysregulation, and conditions with a psychosomatic component; alternative and constitutional medicine tends to reach what allopathy misses here" },
  },
  love: {
    Su: { label: "Attraction to authority and substance", detail: "drawn to people with standing, competence or presence; the relationship works when respect is mutual and fails when it becomes hierarchy" },
    Mo: { label: "Emotional attunement", detail: "romance is felt before it is thought; needs responsiveness and care above excitement, and mistakes intensity for depth if not careful" },
    Ma: { label: "Passion and pursuit", detail: "attraction runs hot and fast, driven by challenge and physicality; the pattern is decisive beginnings and short fuses, and it improves markedly with a slower first three months" },
    Me: { label: "Conversation as courtship", detail: "attracted through wit, talk and shared curiosity; needs a partner who is interesting more than one who is devoted, and cools when conversation stops" },
    Ju: { label: "Values-led romance", detail: "attraction follows shared belief, ethics and growth; tends toward relationships that teach, and toward partners older, wiser or from a different background" },
    Ve: { label: "Aesthetic and romantic", detail: "the classical significator itself — romance is a genuine talent here, with real charm and real appetite for beauty; the risk is preferring the feeling of love to the work of it" },
    Sa: { label: "Slow, durable attachment", detail: "attraction is slow to form and slow to leave; early romantic life is often sparse or delayed, and what does form tends to outlast livelier alternatives" },
    Ra: { label: "Unconventional attraction", detail: "drawn across the usual lines — culture, age, distance, circumstance; intense and fated-feeling, and the one pattern that most needs a deliberate reality check" },
    Ke: { label: "Ambivalent attachment", detail: "genuine capacity for love alongside a genuine pull toward solitude; relationships that end without conflict, and a recurring question of whether attachment is wanted at all" },
  },
  marriage: {
    Su: { label: "A partner of standing", detail: "spouse with authority, professional position or strong personality; the marriage works on mutual respect and struggles where either party needs to be the centre" },
    Mo: { label: "A nurturing partner", detail: "spouse who is caring, publicly attuned and emotionally expressive; the home becomes the emotional anchor of the marriage" },
    Ma: { label: "An energetic partner", detail: "spouse who is direct, capable and physically vigorous; friction is normal in this marriage and is not itself a sign of failure — unmanaged, it is" },
    Me: { label: "A communicative partner", detail: "spouse who is young in manner, articulate and commercially able; the marriage runs on conversation, and silence is its real warning sign" },
    Ju: { label: "A principled partner", detail: "spouse who is educated, ethical and often from a different community or place; the classical best-case indication for marriage, and it tends toward the fortunate" },
    Ve: { label: "A refined partner", detail: "the natural karaka — spouse who is attractive, sociable and comfort-oriented; the marriage is genuinely enjoyable and needs guarding against being merely pleasant" },
    Sa: { label: "A durable, later marriage", detail: "spouse who is serious, older or from a plainer background; delay is the classical signature, and so is the fact that what forms late here tends to hold" },
    Ra: { label: "An unconventional marriage", detail: "spouse from a different culture, country or community, or a marriage that departs from family expectation; intense, unusual, and requiring explicit agreements rather than assumed ones" },
    Ke: { label: "A detached bond", detail: "a spiritually inclined or self-contained spouse, or a marriage in which both parties keep considerable separateness; works well when that is chosen and badly when it is drifted into" },
  },
  career: {
    Su: { label: "Authority and administration", detail: "government service, administration, leadership, medicine, politics, senior management — work where the name on the decision matters" },
    Mo: { label: "Public-facing and care work", detail: "hospitality, healthcare and nursing, psychology, travel, marine and liquid trades, public relations — work mediated through people in numbers" },
    Ma: { label: "Technical and courage-driven work", detail: "engineering, defence and police, surgery, sport, real estate and construction, manufacturing — work with a physical or adversarial edge" },
    Me: { label: "Commerce and communication", detail: "business and trade, writing and journalism, accounting, IT and analytics, teaching, consulting — work that moves information or goods" },
    Ju: { label: "Advisory and knowledge work", detail: "law, finance and banking, academia, counselling, institutional and charitable leadership — work where judgement is the product" },
    Ve: { label: "Arts and refinement", detail: "design, entertainment and media, fashion and luxury, hospitality, diplomacy, beauty and wellness — work where taste is the differentiator" },
    Sa: { label: "Industry and endurance", detail: "heavy industry, mining, construction, logistics, labour management, long-cycle research — work that rewards showing up for a decade" },
    Ra: { label: "Unconventional and foreign", detail: "technology, foreign trade or postings, aviation, mass media, speculative ventures, emerging industries — work that did not exist a generation ago" },
    Ke: { label: "Depth and detachment", detail: "research, mathematics and statistics, spirituality, alternative healing, investigative and archival work — work done alone and deeply" },
  },
  children: {
    Su: { label: "Few children, strong bond", detail: "classically indicates a small number, often with a son prominent; the parental relationship is defined by authority and by expectation, which needs watching" },
    Mo: { label: "Emotionally close parenting", detail: "indicates fertility and closeness, with daughters often prominent; the parent-child bond is the emotional centre of the chart's domestic life" },
    Ma: { label: "Energetic children, some friction", detail: "vigorous, wilful children and a parenting style that must find an alternative to confrontation; also the classical marker for delay or difficulty needing medical attention" },
    Me: { label: "Bright, communicative children", detail: "intellectually quick children, often more than one, and a parenting relationship that works best as conversation between near-equals" },
    Ju: { label: "The classical blessing", detail: "the putra-karaka itself — indicates progeny readily, well-favoured children, and genuine ease in the parental role; also the strongest indicator for higher education" },
    Ve: { label: "Comfortable, artistic children", detail: "indicates daughters prominently, artistic aptitude, and a parenting relationship built on affection and enjoyment rather than instruction" },
    Sa: { label: "Delay, then durability", detail: "the classical signature of postponement — children later than planned, fewer than expected, and a parental bond that deepens with time rather than starting warm" },
    Ra: { label: "Unusual circumstances", detail: "adoption, children through unconventional routes, foreign-born or foreign-settled children; also the classical caution around medical intervention" },
    Ke: { label: "Spiritual or distant", detail: "children who are self-contained or physically distant, and a parental experience with a strong element of letting go; often indicates a spiritually inclined child" },
  },
  property: {
    Su: { label: "Government and inherited land", detail: "property through government allotment, employer or inheritance from the paternal line; typically fewer, larger holdings rather than many" },
    Mo: { label: "Water-adjacent and residential", detail: "residential homes, property near water, and holdings acquired through or with the mother; a strong pull toward owning rather than renting the primary residence" },
    Ma: { label: "Land and construction", detail: "the bhumi-karaka itself — raw land, plots, self-built or renovated property, and real estate as an active occupation rather than a passive holding" },
    Me: { label: "Commercial property and trading", detail: "commercial premises, property bought and sold rather than held, and multiple smaller transactions; documentation and negotiation are strengths here" },
    Ju: { label: "Large and auspicious holdings", detail: "spacious property, often acquired at an auspicious turn of life; also property connected to institutions, teaching or religious purpose" },
    Ve: { label: "Comfortable homes and vehicles", detail: "the vehicle karaka — well-appointed homes, good vehicles, and property acquired through or with a spouse; comfort is the deciding criterion over yield" },
    Sa: { label: "Old, slow and hard-won", detail: "older property, agricultural or industrial land, and acquisition that is delayed and effortful; what is bought here is held for a long time" },
    Ra: { label: "Foreign and unconventional", detail: "property abroad or far from birthplace, and acquisition through unconventional routes; the classical caution about title and documentation applies with force" },
  },
  spirituality: {
    Su: { label: "Devotional and solar practice", detail: "practice centred on discipline, the sun, and self-realisation as sovereignty; suits ritual observed daily and at dawn" },
    Mo: { label: "Devotional and bhakti", detail: "practice through feeling — chanting, devotional song, the mother-goddess traditions; the heart opens before the intellect does here" },
    Ma: { label: "Austere and disciplined", detail: "practice with an ascetic or martial edge — hatha yoga, fasting, physically demanding sadhana; force applied to oneself rather than others" },
    Me: { label: "Study and enquiry", detail: "practice through text, philosophy, debate and analysis; understanding is the doorway, and practice without study feels hollow here" },
    Ju: { label: "The guru path", detail: "the guru-karaka — practice through a living teacher, lineage and traditional scripture; this chart is well served by orthodoxy rather than improvisation" },
    Ve: { label: "Beauty as a path", detail: "practice through art, music, devotional aesthetics and relationship; the sacred is reached through delight rather than renunciation" },
    Sa: { label: "Renunciation and service", detail: "practice through discipline, simplicity, service and endurance; slow, unglamorous, and the most durable of the routes" },
    Ra: { label: "Unorthodox and tantric", detail: "practice outside inherited tradition — foreign systems, tantra, altered states; powerful and the one route that genuinely requires a teacher" },
    Ke: { label: "The moksha karaka", detail: "the classical significator of liberation — meditation, withdrawal, jnana and non-dual enquiry; renunciation comes naturally and needs balancing against ordinary life" },
  },
};

export interface AreaPossibility {
  planet: PlanetId;
  label: string;
  detail: string;
  /** 0–100 fit, normalised against the top-voted graha in this area. */
  fit: number;
  /** The classical reasons this graha won its votes. */
  reasons: string[];
}

export interface AreaLever {
  title: string;
  body: string;
  kind: "strength" | "timing" | "caution" | "corroboration";
}

export interface AreaOptionSet {
  possibilities: AreaPossibility[];
  levers: AreaLever[];
  corroboration: string[];
}

interface VoteContext {
  chart: ChartData;
  key: LifeAreaKey;
  primary: number[];
  supporting: number[];
  karakas: PlanetId[];
  strengths: Partial<Record<PlanetId, PlanetStrength>>;
  vargas: VargaSet | null;
  shadbala: ShadbalaSet | null;
  bhavaBala: BhavaBala[] | null;
  ashtakavarga: AshtakavargaResult | null;
  jaimini: JaiminiInfo | null;
}

/**
 * Rank the grahas that speak for this area, then read their significations.
 *
 * Weights follow the same ordering `career.ts` established: ruling the area's
 * primary house is the strongest single claim, occupying it is next, the
 * karaka's claim is structural rather than contingent, and the divisional
 * chart supplies an independent second vote so that a graha winning on the
 * Rashi alone cannot run away with the ranking.
 */
export function buildAreaOptions(ctx: VoteContext): AreaOptionSet {
  const { chart, key, primary, supporting, karakas } = ctx;
  const lagna = chart.ascendant.sign;
  const table = AREA_OPTIONS[key];

  const votes = new Map<PlanetId, { weight: number; reasons: string[] }>();
  const addVote = (id: PlanetId, weight: number, reason: string) => {
    if (!table[id]) return; // no signification for this graha in this area
    const cur = votes.get(id) ?? { weight: 0, reasons: [] };
    cur.weight += weight;
    cur.reasons.push(reason);
    votes.set(id, cur);
  };

  // 1. Lords of the primary houses.
  for (const h of primary) {
    const lord = SIGN_LORDS[(lagna + h - 1) % 12];
    addVote(lord, 30, `rules your ${ordinal(h)} house, the primary house for this area`);
  }
  // 2. Lords of the supporting houses, at a lower weight.
  for (const h of supporting) {
    const lord = SIGN_LORDS[(lagna + h - 1) % 12];
    addVote(lord, 10, `rules your ${ordinal(h)}, a supporting house here`);
  }
  // 3. Occupants of the primary houses.
  for (const h of primary) {
    for (const p of chart.planets.filter((q) => q.house === h)) {
      addVote(p.id, 20, `occupies your ${ordinal(h)} house directly`);
    }
  }
  // 4. The area's karakas — a structural claim, independent of placement.
  for (const k of karakas) {
    addVote(k, 18, "is the natural karaka (significator) for this area");
  }
  // 5. Drishti onto the primary houses.
  for (const h of primary) {
    const sign = (lagna + h - 1) % 12;
    for (const p of chart.planets) {
      if (p.sign === sign) continue;
      const offsets = [7, ...(p.id === "Ma" ? [4, 8] : p.id === "Ju" || p.id === "Ra" || p.id === "Ke" ? [5, 9] : p.id === "Sa" ? [3, 10] : [])];
      if (offsets.some((o) => (p.sign + o - 1) % 12 === sign)) {
        addVote(p.id, 8, `casts drishti on your ${ordinal(h)} house`);
      }
    }
  }
  // 6. The divisional chart the tradition reads for this subject.
  const vid = AREA_VARGA[key];
  if (ctx.vargas) {
    const vc = ctx.vargas.charts[vid];
    const vLagnaLord = SIGN_LORDS[vc.ascendant];
    addVote(vLagnaLord, 20, `rules the rising sign of your ${VARGA_NAMES[vid]} (${vid}), the divisional chart read for this subject`);
    // Occupants of the varga's own primary house are an independent second vote.
    for (const h of primary) {
      for (const p of vc.positions) {
        if (houseInVarga(vc, p.sign) === h) {
          addVote(p.id, 12, `sits in the ${ordinal(h)} house of your ${vid} — an independent second vote`);
        }
      }
    }
    // Vargottama grahas are more dependable wherever they act.
    for (const id of ctx.vargas.vargottama) {
      if (votes.has(id)) addVote(id, 6, "is vargottama, so it behaves the same way in the Rashi and the Navamsa");
    }
  }
  // 7. Jaimini: the Amatyakaraka for career, the Darakaraka for marriage/love,
  //    the Atmakaraka for spirituality — the karaka each area actually owns.
  if (ctx.jaimini) {
    const jk: Partial<Record<LifeAreaKey, [keyof JaiminiInfo["karakas"], string]>> = {
      career: ["AmK", "Amatyakaraka, the planet that classically shows where advancement comes from"],
      marriage: ["DK", "Darakaraka, the Jaimini significator of the spouse"],
      love: ["DK", "Darakaraka, the Jaimini significator of the partner"],
      spirituality: ["AK", "Atmakaraka, the planet carrying the soul's own agenda"],
      children: ["BK", "Bhratrikaraka, which Jaimini also reads for the guru and for what is taught forward"],
    };
    const entry = jk[key];
    if (entry) addVote(ctx.jaimini.karakas[entry[0]], 16, `is your ${entry[1]}`);
  }

  // ---- Rank, weighting each graha's raw vote by how capable it actually is --
  const scored = [...votes.entries()].map(([id, v]) => {
    const s = ctx.strengths[id];
    // A graha with a strong claim but no capacity to act on it should not top
    // the list: the composite strength scales the vote by ±35%.
    const capability = s ? 0.65 + (s.score / 100) * 0.7 : 1;
    return { id, raw: v.weight * capability, reasons: v.reasons };
  });
  scored.sort((a, b) => b.raw - a.raw);

  const top = scored[0]?.raw ?? 1;
  const possibilities: AreaPossibility[] = scored.slice(0, 5).map((e) => ({
    planet: e.id,
    label: table[e.id]!.label,
    detail: table[e.id]!.detail,
    fit: Math.max(20, Math.min(100, Math.round((e.raw / top) * 100))),
    reasons: e.reasons,
  }));

  return {
    possibilities,
    levers: buildLevers(ctx, possibilities),
    corroboration: buildCorroboration(ctx),
  };
}

/** The practical half: what to actually do, given what the ranking found. */
function buildLevers(ctx: VoteContext, possibilities: AreaPossibility[]): AreaLever[] {
  const { chart, primary } = ctx;
  const out: AreaLever[] = [];
  const planetOf = (id: PlanetId) => chart.planets.find((p) => p.id === id);

  if (possibilities.length === 0) return out;

  const best = possibilities[0];
  const bestPos = planetOf(best.planet);
  const bestStr = ctx.strengths[best.planet];

  // 1. Lead with the strongest option and say why it leads.
  out.push({
    kind: "strength",
    title: `Lead with ${best.label.toLowerCase()}`,
    body:
      `${PLANET_NAMES[best.planet]} is the graha this area answers to in your chart — it ${best.reasons.slice(0, 2).join(", and it ")}. ` +
      (bestPos
        ? `It sits in ${SIGNS[bestPos.sign]} in the ${ordinal(bestPos.house)} house${bestStr ? ` at ${bestStr.score}/100 composite strength (${bestStr.grade})` : ""}, so that is the arena where this area's results actually appear. `
        : "") +
      `Of everything this area could mean, this is the direction with the most classical backing behind it.`,
  });

  // 2. The second option, framed as the complement rather than the runner-up.
  if (possibilities.length > 1) {
    const second = possibilities[1];
    out.push({
      kind: "strength",
      title: `Pair it with ${second.label.toLowerCase()}`,
      body: `${PLANET_NAMES[second.planet]} comes second at ${second.fit}% fit, and second here means complement rather than fallback: charts that combine their top two do better than charts that pick one. Concretely — ${second.detail}.`,
    });
  }

  // 3. The weakest link worth repairing.
  const weakest = [...possibilities]
    .filter((p) => ctx.strengths[p.planet])
    .sort((a, b) => ctx.strengths[a.planet]!.score - ctx.strengths[b.planet]!.score)[0];
  if (weakest && ctx.strengths[weakest.planet]!.score < 45) {
    const s = ctx.strengths[weakest.planet]!;
    const worst = [...s.factors].sort((a, b) => a.delta - b.delta)[0];
    out.push({
      kind: "caution",
      title: `Shore up ${PLANET_NAMES[weakest.planet]} before relying on it`,
      body:
        `${PLANET_NAMES[weakest.planet]} has a real claim on this area but only ${s.score}/100 to act on it (${s.grade})` +
        (worst ? `, and the largest single drag is ${worst.label} at ${worst.delta}` : "") +
        `. This is the option that will disappoint if it is chosen on paper strength alone — it needs the supporting conditions built deliberately rather than assumed.`,
    });
  }

  // 4. Ashtakavarga on the area's own houses: the concrete "where transits pay".
  if (ctx.ashtakavarga) {
    const rows = primary.map((h) => {
      const sign = (chart.ascendant.sign + h - 1) % 12;
      return { h, sign, bindus: ctx.ashtakavarga!.sav[sign] };
    });
    const strongRow = rows.filter((r) => r.bindus >= 30);
    const weakRow = rows.filter((r) => r.bindus <= 24);
    const midRow = rows.filter((r) => r.bindus > 24 && r.bindus < 30);
    out.push({
      kind: "timing",
      title: "Where transits will actually pay here",
      body:
        rows.map((r) => `the ${ordinal(r.h)} (${SIGNS[r.sign]}) holds ${r.bindus} bindus`).join(", ") +
        " — the twelve signs share 337, so 28 is the average. " +
        (strongRow.length
          ? `Transits of benefics through ${strongRow.map((r) => SIGNS[r.sign]).join(" and ")} are worth planning around: above 30 bindus the classical reading is that the house gives its better results. `
          : "") +
        (weakRow.length
          ? `Below 25 bindus, ${weakRow.map((r) => SIGNS[r.sign]).join(" and ")} will under-deliver even on good transits, so this area should not be timed off that house. `
          : "") +
        (midRow.length
          ? `${midRow.map((r) => SIGNS[r.sign]).join(" and ")} ${midRow.length === 1 ? "sits" : "sit"} in the middle band, which means the field itself is neutral here — timing this area should follow the dasha of the grahas ranked above rather than the transit through the house.`
          : ""),
    });
  }

  return out;
}

/** The divisional / bala second opinion for the area as a whole. */
function buildCorroboration(ctx: VoteContext): string[] {
  const { chart, key, primary } = ctx;
  const out: string[] = [];
  const vid = AREA_VARGA[key];

  if (ctx.vargas) {
    const vc = ctx.vargas.charts[vid];
    const note = AREA_VARGA_NOTE[key];
    const lord = SIGN_LORDS[vc.ascendant];
    const lordInVarga = vargaPositionOf(vc, lord);
    out.push(
      `${VARGA_NAMES[vid]} (${vid}) is the divisional chart the tradition reads for this subject.` +
        (note ? ` ${note}` : "") +
        ` It rises in ${SIGNS[vc.ascendant]}; its lagna lord ${PLANET_NAMES[lord]}` +
        (lordInVarga
          ? ` sits in ${SIGNS[lordInVarga.sign]} there, ${lordInVarga.dignity === "exalted" || lordInVarga.dignity === "own" || lordInVarga.dignity === "moolatrikona" ? "well dignified — the divisional account backs what the Rashi promises" : lordInVarga.dignity === "debilitated" || lordInVarga.dignity === "greatEnemy" ? "poorly dignified, so the divisional account withholds part of what the Rashi promises" : "moderately placed, so the division neither confirms nor contradicts the birth chart"}.`
          : " could not be located in it."),
    );
  }

  if (ctx.bhavaBala) {
    const rows = primary
      .map((h) => ctx.bhavaBala!.find((b) => b.house === h))
      .filter((b): b is BhavaBala => Boolean(b));
    if (rows.length) {
      out.push(
        `Bhava Bala for this area's houses: ` +
          rows.map((r) => `the ${ordinal(r.house)} at ${r.rupas.toFixed(2)} rupas`).join(", ") +
          `. Eight rupas and above reads as well-funded, below five as needing conscious support.`
      );
    }
  }

  if (ctx.shadbala) {
    const lords = primary.map((h) => SIGN_LORDS[(chart.ascendant.sign + h - 1) % 12]);
    const parts: string[] = [];
    for (const l of [...new Set(lords)]) {
      const e = (ctx.shadbala.planets as Record<string, { rupas: number; ratio: number }>)[l];
      if (e) parts.push(`${PLANET_NAMES[l]} at ${e.rupas.toFixed(2)} rupas (${Math.round(e.ratio * 100)}% of its minimum)`);
    }
    if (parts.length) {
      out.push(
        `Shadbala of the house lords: ${parts.join(", ")}. A lord under 100% is promised but under-guaranteed — the classical signal that this area's affairs need the native's own effort rather than the chart's momentum.`
      );
    }
  }

  return out;
}
