import { naturalBenefics } from "./aspects";
import { PLANET_NAMES, SIGNS } from "./constants";
import { ordinal } from "./format";
import { rashiDrishti, type JaiminiInfo } from "./jaimini";
import type { ChartData, PlanetId } from "./types";

/**
 * Classical combinations the expert export reports in addition to
 * `detectYogas`.
 *
 * Kept out of `detectYogas` on purpose: that list feeds the scored
 * Interpretation sections (career, wealth, life areas…), and adding a dozen
 * new keys there would silently move every score. These findings are data for
 * the reader of the Markdown export; promoting any of them into the scored
 * layer is a separate, deliberate decision.
 *
 * Every finding states the rule it tested. Where texts differ, the condition
 * used is the common one and is named in the description.
 */

export interface ExtendedFinding {
  key: string;
  name: string;
  kind: "yoga" | "dosha";
  planets: PlanetId[];
  description: string;
}

const NATURAL_MALEFICS: PlanetId[] = ["Su", "Ma", "Sa", "Ra", "Ke"];
const KENDRA_TRIKONA_2 = [1, 2, 4, 5, 7, 9, 10];

const names = (ids: PlanetId[]): string => ids.map((id) => PLANET_NAMES[id]).join(", ");

export function detectExtendedYogas(chart: ChartData, jaimini: JaiminiInfo | null): ExtendedFinding[] {
  const out: ExtendedFinding[] = [];
  const at = (id: PlanetId) => chart.planets.find((p) => p.id === id);
  const inSign = (sign: number, exclude: PlanetId[] = []) =>
    chart.planets.filter((p) => p.sign === sign && !exclude.includes(p.id)).map((p) => p.id);
  const benefics = naturalBenefics(chart);
  const moon = at("Mo");
  const sun = at("Su");

  // --- Shubha / Papa Kartari on the Lagna and on the Moon: hemmed by
  // benefics (or malefics) occupying BOTH the 12th and the 2nd from it.
  const kartari = (label: string, sign: number, self: PlanetId[]) => {
    const before = inSign((sign + 11) % 12, self);
    const after = inSign((sign + 1) % 12, self);
    const mal = (ids: PlanetId[]) => ids.filter((id) => NATURAL_MALEFICS.includes(id) || (id === "Mo" && !benefics.includes("Mo")));
    const ben = (ids: PlanetId[]) => ids.filter((id) => benefics.includes(id));
    if (mal(before).length && mal(after).length) {
      out.push({
        key: `papa-kartari-${label}`, name: `Papa Kartari on the ${label === "lagna" ? "Lagna" : "Moon"}`, kind: "dosha",
        planets: [...mal(before), ...mal(after)],
        description: `Malefics on both sides — ${names(mal(before))} in the 12th and ${names(mal(after))} in the 2nd from the ${label === "lagna" ? "Lagna" : "Moon"} — hem it in (scissors of malefics): constriction of ${label === "lagna" ? "the self and vitality" : "the mind and peace"}.`,
      });
    }
    if (ben(before).length && ben(after).length) {
      out.push({
        key: `shubha-kartari-${label}`, name: `Shubha Kartari on the ${label === "lagna" ? "Lagna" : "Moon"}`, kind: "yoga",
        planets: [...ben(before), ...ben(after)],
        description: `Benefics on both sides — ${names(ben(before))} in the 12th and ${names(ben(after))} in the 2nd from the ${label === "lagna" ? "Lagna" : "Moon"} — protect it.`,
      });
    }
  };
  kartari("lagna", chart.ascendant.sign, []);
  if (moon) kartari("moon", moon.sign, ["Mo"]);

  // --- Adhi Yoga: natural benefics (Mercury, Jupiter, Venus) in the 6th, 7th
  // and 8th from the Moon. Condition used: at least two of the three there and
  // no natural malefic sharing those houses (full form when all three houses
  // are tenanted by benefics).
  if (moon) {
    const houses = [6, 7, 8].map((h) => (moon.sign + h - 1) % 12);
    const bens = (["Me", "Ju", "Ve"] as PlanetId[]).filter((id) => houses.includes(at(id)?.sign ?? -1));
    const mals = NATURAL_MALEFICS.filter((id) => houses.includes(at(id)?.sign ?? -1));
    if (bens.length >= 2 && mals.length === 0) {
      const full = houses.every((s) => bens.some((id) => at(id)?.sign === s));
      out.push({
        key: "adhi", name: full ? "Adhi Yoga (full)" : "Adhi Yoga (partial)", kind: "yoga", planets: bens,
        description: `${names(bens)} occupy the 6th/7th/8th from the Moon with no malefic there — leadership, protection from enemies and rise to authority${full ? "; all three houses are tenanted" : ""}.`,
      });
    }
  }

  // --- Solar yogas: planets other than the Moon and the nodes in the 2nd
  // (Vesi), 12th (Vasi) or both (Ubhayachari) from the Sun (BPHS).
  if (sun) {
    const excl: PlanetId[] = ["Su", "Mo", "Ra", "Ke"];
    const second = inSign((sun.sign + 1) % 12, excl);
    const twelfth = inSign((sun.sign + 11) % 12, excl);
    if (second.length && twelfth.length) {
      out.push({ key: "ubhayachari", name: "Ubhayachari Yoga", kind: "yoga", planets: [...twelfth, ...second],
        description: `${names(twelfth)} in the 12th and ${names(second)} in the 2nd from the Sun — eloquence, balance and standing.` });
    } else if (second.length) {
      out.push({ key: "vesi", name: "Vesi Yoga", kind: "yoga", planets: second,
        description: `${names(second)} in the 2nd from the Sun — steady effort and truthfulness; the planet's nature colours it.` });
    } else if (twelfth.length) {
      out.push({ key: "vasi", name: "Vasi Yoga", kind: "yoga", planets: twelfth,
        description: `${names(twelfth)} in the 12th from the Sun — skill and charity; the planet's nature colours it.` });
    }
  }

  // --- Saraswati (Phaladeepika 6): Jupiter, Venus and Mercury all in kendras,
  // trikonas or the 2nd, with Jupiter in its own, exaltation or a friend's sign.
  {
    const trio = (["Ju", "Ve", "Me"] as PlanetId[]).map(at);
    const ju = at("Ju");
    if (trio.every((p) => p && KENDRA_TRIKONA_2.includes(p.house)) && ju &&
        ["exalted", "moolatrikona", "own", "greatFriend", "friend"].includes(ju.dignity)) {
      out.push({ key: "saraswati", name: "Saraswati Yoga", kind: "yoga", planets: ["Ju", "Ve", "Me"],
        description: `Jupiter, Venus and Mercury all occupy kendras, trikonas or the 2nd (houses ${trio.map((p) => p!.house).join(", ")}), with Jupiter dignified — learning, eloquence and the arts.` });
    }
  }

  // --- Jaimini Raja Yoga: Atmakaraka and Amatyakaraka conjoined or in mutual
  // rashi drishti.
  if (jaimini) {
    const ak = at(jaimini.karakas.AK);
    const amk = at(jaimini.karakas.AmK);
    if (ak && amk) {
      const how = ak.sign === amk.sign ? "conjoin" : rashiDrishti(ak.sign).includes(amk.sign) ? "aspect each other by rashi drishti" : null;
      if (how) {
        out.push({ key: "jaimini-raja-ak-amk", name: "Jaimini Raja Yoga (AK–AmK)", kind: "yoga", planets: [ak.id, amk.id],
          description: `The Atmakaraka ${PLANET_NAMES[ak.id]} and Amatyakaraka ${PLANET_NAMES[amk.id]} ${how} — status through one's own work, active in their Chara dasha periods.` });
      }
    }
  }

  // --- Conjunction doshas (same sign).
  const pair = (a: PlanetId, b: PlanetId) => {
    const pa = at(a);
    const pb = at(b);
    return pa && pb && pa.sign === pb.sign ? pa : null;
  };
  const conj: [PlanetId, PlanetId, string, string, string][] = [
    ["Ju", "Ra", "guru-chandala-ra", "Guru-Chandala Dosha", "Jupiter with Rahu — judgment and teachers questioned; unorthodox beliefs"],
    ["Ju", "Ke", "guru-chandala-ke", "Guru-Chandala Dosha (Ketu variant)", "Jupiter with Ketu — counted by some schools; detachment from conventional guidance"],
    ["Su", "Ra", "grahan-surya-ra", "Surya Grahan Dosha", "Sun with Rahu — father, authority and vitality eclipsed"],
    ["Su", "Ke", "grahan-surya-ke", "Surya Grahan Dosha", "Sun with Ketu — father, authority and vitality eclipsed"],
    ["Mo", "Ra", "grahan-chandra-ra", "Chandra Grahan Dosha", "Moon with Rahu — mind and mother eclipsed; anxiety"],
    ["Mo", "Ke", "grahan-chandra-ke", "Chandra Grahan Dosha", "Moon with Ketu — mind and mother eclipsed; detachment"],
    ["Sa", "Ra", "shrapit", "Shrapit Dosha", "Saturn with Rahu — delays that feel inherited"],
    ["Ma", "Ra", "angarak", "Angarak Dosha", "Mars with Rahu — anger, accidents, impulsive risk"],
    ["Mo", "Sa", "vish", "Vish Dosha", "Moon with Saturn — melancholy and heaviness of mind"],
  ];
  for (const [a, b, key, name, gloss] of conj) {
    const p = pair(a, b);
    if (p) out.push({ key, name, kind: "dosha", planets: [a, b],
      description: `${gloss}. Both in ${SIGNS[p.sign]}, the ${ordinal(p.house)} house.` });
  }

  // --- Gandanta: the last 3°20' of a water sign or the first 3°20' of the
  // following fire sign (the nakshatra junctions Ashlesha/Magha,
  // Jyeshtha/Mula, Revati/Ashwini).
  const gandanta = (lon: number) => {
    const sign = Math.floor(lon / 30) % 12;
    const d = lon % 30;
    return ([3, 7, 11].includes(sign) && d >= 30 - 10 / 3) || ([0, 4, 8].includes(sign) && d < 10 / 3);
  };
  if (gandanta(chart.ascendant.longitude)) {
    out.push({ key: "gandanta-lagna", name: "Gandanta Lagna", kind: "dosha", planets: [],
      description: `The Lagna at ${chart.ascendant.degInSign.toFixed(2)}° ${SIGNS[chart.ascendant.sign]} sits in a water–fire junction — birth-time sensitive; rectification is advisable.` });
  }
  for (const p of chart.planets) {
    if (!gandanta(p.longitude)) continue;
    out.push({ key: `gandanta-${p.id}`, name: `${PLANET_NAMES[p.id]} in Gandanta`, kind: "dosha", planets: [p.id],
      description: `${PLANET_NAMES[p.id]} at ${p.degInSign.toFixed(2)}° ${SIGNS[p.sign]} sits in a water–fire junction — its significations pass through a knot${p.id === "Mo" ? "; for the Moon this is the classical Gandanta birth" : ""}.` });
  }

  return out;
}
