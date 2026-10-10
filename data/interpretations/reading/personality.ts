import { aspectedSigns } from "@/utils/astrology/aspects";
import { NAKSHATRA_QUALITIES, SIGN_LORDS } from "@/utils/astrology/constants";
import { activeDashaAt } from "@/utils/astrology/dasha";
import { norm360 } from "@/utils/astrology/math";
import type { PlanetId } from "@/utils/astrology/types";
import { CONJUNCTION_TEXT, conjunctionKey } from "../conjunctions";
import { LAGNA_TEMPERAMENT, MOON_MIND, SUN_CORE } from "../personality";
import { PLANET_IN_HOUSE } from "../planetInHouse";
import { HOUSE_GOVERNS, PLANET_SIGNIFIES } from "../significations";
import { functionalRole } from "../synthesis";
import {
  aspectorsOfSign, avasthaOf, cap, conjuncts, deg, DIGNITY_WORD, fmtRatio, isGandanta, isStrongDignity,
  isVargottama, isWeakDignity, joinAnd, lordQuality, lordshipBullet, name, names, nakOf, ord, planet, PLANETS, ratio,
  ratioRanking, savOrder, sav, sentences, SIGNS, strengthRankPhrase, vargaHighlights, vargaPos, vimshopaka,
  vimshopakaRank, within, type ReadingContext, type ReadingPart, type ReadingSubsection,
} from "./context";
import {
  KARAKAMSA_PLANET, LAGNA_LORD_IN_HOUSE, LAGNA_PHYSIQUE, LAGNA_SHADOW, MERCURY_STRONG, MERCURY_WEAK,
  PLANET_ON_LAGNA_BODY, SIGN_TONE,
} from "./tables";

const MALEFICS: PlanetId[] = ["Su", "Ma", "Sa", "Ra", "Ke"];

/** Short form of a yoga description: its first sentence. */
const yogaLine = (text: string) => sentences(text, 1)[0] ?? text;

export function personalityPart(rc: ReadingContext): ReadingPart {
  const { chart } = rc;
  const asc = chart.ascendant;
  const lagnaSign = asc.sign;
  const lagnaNak = nakOf(asc.longitude);
  const covered = new Set<PlanetId>();
  const subsections: ReadingSubsection[] = [];

  // ---- 1. The foundation: the Lagna and anything on it -----------------------
  {
    const occ = chart.planets.filter((p) => p.house === 1).map((p) => p.id);
    const onDegree = occ.filter((id) => within(planet(rc, id)!.longitude, asc.longitude, 3));
    const heading = onDegree.length
      ? `The foundation: ${SIGNS[lagnaSign]} Lagna with ${names(onDegree)} on the Ascendant degree`
      : occ.length
        ? `The foundation: ${SIGNS[lagnaSign]} Lagna with ${names(occ)} in the 1st house`
        : `The foundation: ${SIGNS[lagnaSign]} Lagna`;
    const lead = [`Your Lagna is at ${deg(asc.longitude)} ${SIGNS[lagnaSign]} in ${lagnaNak.name} pada ${lagnaNak.pada}.`];
    for (const id of occ) {
      const p = planet(rc, id)!;
      const closeness = onDegree.includes(id)
        ? ", almost exactly on the rising degree"
        : within(p.longitude, asc.longitude, 8) ? ", close to the rising degree" : "";
      const rank = strengthRankPhrase(rc, id);
      lead.push(
        `${name(id)} sits at ${deg(p.longitude)}${closeness}.${rank ? ` ${name(id)} is also ${rank} and is ${DIGNITY_WORD[p.dignity]}.` : ` It is ${DIGNITY_WORD[p.dignity]}.`}`
      );
      covered.add(id);
    }
    if (!occ.length) {
      const asp = aspectorsOfSign(rc, lagnaSign, aspectedSigns);
      lead.push(asp.length ? `No planet occupies the 1st house; ${names(asp)} ${asp.length > 1 ? "aspect" : "aspects"} it.` : "No planet occupies or aspects the 1st house — its lord carries the whole of it.");
    }

    const bullets = [`Your outward nature is ${LAGNA_TEMPERAMENT[lagnaSign]}`];
    bullets.push(`${lagnaNak.name} nakshatra on the rising degree adds ${NAKSHATRA_QUALITIES[lagnaNak.index]}.`);
    for (const id of occ) {
      const p = planet(rc, id)!;
      const n = nakOf(p.longitude);
      bullets.push(`${name(id)} in ${n.name} (a ${name(n.lord)} nakshatra): ${sentences(PLANET_IN_HOUSE[id][0], 2).join(" ")}`);
      const l = lordshipBullet(rc, id);
      if (l) bullets.push(l);
    }
    const harsh = occ.filter((id) => MALEFICS.includes(id));
    bullets.push(`The shadow side is ${LAGNA_SHADOW[lagnaSign]}${harsh.length ? `, sharpened by ${names(harsh)} on the Lagna` : ""}. People feel your energy immediately.`);
    bullets.push(
      `Physically: ${LAGNA_PHYSIQUE[lagnaSign]}${occ.length ? `. ${names(occ)} on the Lagna add${occ.length > 1 ? "" : "s"} ${occ.map((id) => PLANET_ON_LAGNA_BODY[id]).join("; and ")}` : ""}.`
    );
    subsections.push({ heading, lead, bullets });
  }

  // ---- 2. The Lagna lord -----------------------------------------------------
  const lagnaLord = SIGN_LORDS[lagnaSign];
  {
    const p = planet(rc, lagnaLord);
    if (p) {
      const n = nakOf(p.longitude);
      const heading = `${name(lagnaLord)}, the Lagna lord, in the ${ord(p.house)} house (${SIGNS[p.sign]}, ${n.name})`;
      const lead = [
        `${name(lagnaLord)} is at ${deg(p.longitude)} ${SIGNS[p.sign]} in ${n.name} pada ${n.pada}, ${DIGNITY_WORD[p.dignity]}${p.retrograde ? ", retrograde" : ""}${p.combust ? ", combust" : ""}.`,
      ];
      const bullets = [LAGNA_LORD_IN_HOUSE[p.house - 1]];
      bullets.push(`${SIGNS[p.sign]} and ${n.name} make this ${SIGN_TONE[p.sign]}: ${NAKSHATRA_QUALITIES[n.index]}.`);
      const llRule = lordshipBullet(rc, lagnaLord);
      if (llRule) bullets.push(llRule);
      const r = ratio(rc, lagnaLord);
      const rank = ratioRanking(rc);
      if (r !== null) {
        if (rank[rank.length - 1] === lagnaLord || r < 1) {
          bullets.push(
            `${name(lagnaLord)} is ${rank[rank.length - 1] === lagnaLord ? "the weakest planet" : "below its requirement"} in Shadbala (${fmtRatio(r)}). At times you may doubt your own judgement, over-commit, or lean on others' validation more than you show; this strength matures with age.`
          );
        } else if (rank[0] === lagnaLord || r >= 1.3) {
          bullets.push(`${name(lagnaLord)} is ${rank[0] === lagnaLord ? "the strongest planet" : "well above its requirement"} in Shadbala (${fmtRatio(r)}): your health, confidence and sense of direction hold up under pressure.`);
        } else {
          bullets.push(`${name(lagnaLord)} meets its Shadbala requirement (${fmtRatio(r)}) — enough to deliver what it promises.`);
        }
      }
      const vh = vargaHighlights(rc, lagnaLord);
      if (vh.good.length) {
        const weakInD1 = isWeakDignity(p.dignity) || (r !== null && r < 1);
        bullets.push(
          `${name(lagnaLord)} is ${joinAnd(vh.good)}.${weakInD1 ? " The inner quality of your Lagna lord is far better than its D1 strength suggests — values, ethics and dharma are strong underneath." : " Its inner quality confirms the outer promise."}`
        );
      }
      if (vh.bad.length) bullets.push(`${name(lagnaLord)} is ${joinAnd(vh.bad)}, so what it promises outwardly needs more work to hold up inwardly.`);
      if (!covered.has(lagnaLord)) covered.add(lagnaLord);
      subsections.push({ heading, lead, bullets });
    }
  }

  // ---- 3. The mind: the Moon --------------------------------------------------
  const moon = planet(rc, "Mo");
  if (moon) {
    const n = nakOf(moon.longitude);
    const conj = conjuncts(rc, "Mo");
    const asp = aspectorsOfSign(rc, moon.sign, aspectedSigns);
    const heading = `The mind: Moon in ${SIGNS[moon.sign]}${conj.length ? ` with ${names(conj)}` : ""} in the ${ord(moon.house)} house`;
    const lead = [
      `The Moon is at ${deg(moon.longitude)} ${SIGNS[moon.sign]} in ${n.name} pada ${n.pada}${conj.length ? `, joined by ${names(conj)}` : ""}.${asp.length ? ` ${names(asp)} ${asp.length > 1 ? "aspect" : "aspects"} ${conj.length ? "them" : "it"}.` : ""}`,
    ];
    const bullets = [`With the Moon in ${SIGNS[moon.sign]}, the mind ${MOON_MIND[moon.sign]}`];
    bullets.push(`${n.name} gives ${NAKSHATRA_QUALITIES[n.index]}.`);
    for (const id of conj) {
      const text = CONJUNCTION_TEXT[conjunctionKey("Mo", id)];
      if (text) bullets.push(`${name(id)} with the Moon${id === "Ra" || id === "Ke" ? " (a Grahan influence)" : ""}: ${sentences(text, 2).join(" ")}`);
      covered.add(id);
    }
    for (const id of asp) {
      if (id === "Ke") bullets.push("Ketu's aspect gives sudden detachment: you can become intensely involved and then emotionally withdraw.");
      else if (id === "Ra") bullets.push("Rahu's aspect feeds an overactive, restless mind and sharp intuition.");
      else if (id === "Sa") bullets.push("Saturn's aspect adds seriousness and a tendency to carry worry quietly; feelings are held in check.");
      else if (id === "Ju") bullets.push("Jupiter's aspect steadies the mind with optimism and good judgement — a protective influence.");
      else if (id === "Ma") bullets.push("Mars's aspect makes feelings quick and fiery; reactions come before reflection.");
      else bullets.push(`${name(id)}'s aspect brings ${PLANET_SIGNIFIES[id].phrase} into your emotional life.`);
    }
    const sun = planet(rc, "Su");
    if (sun) {
      const elong = norm360(moon.longitude - sun.longitude);
      bullets.push(
        elong < 180
          ? `The Moon is waxing (${Math.round(elong)}° from the Sun), so the mind gathers strength and confidence over time.`
          : `The Moon is waning (${Math.round(360 - elong)}° short of the Sun), so emotional energy is more inward and needs deliberate replenishing.`
      );
    }
    const lunar = rc.yogas.find((y) => ["sunapha", "anapha", "durudhara", "kemadruma", "gajakesari"].some((k) => y.key === k));
    if (lunar) bullets.push(`${lunar.name}: ${yogaLine(lunar.description)}`);
    const order = savOrder(rc);
    const moonSav = sav(rc, moon.house);
    if (order.length && moonSav !== null) {
      if (order[0] === moon.house) bullets.push(`The ${ord(moon.house)} house has only ${moonSav} SAV bindus, the lowest in the chart. This is where you carry your stress: ${HOUSE_GOVERNS[moon.house].phrase}.`);
      else if (order[order.length - 1] === moon.house) bullets.push(`The ${ord(moon.house)} house has ${moonSav} SAV bindus, the highest in the chart — the mind is well supported here.`);
    }
    const d9 = vargaPos(rc, "Mo", "D9");
    if (d9?.dignity === "debilitated") bullets.push(`The Moon is debilitated in the Navamsa (${SIGNS[d9.sign]}). Inwardly you are more sensitive and easily hurt than your outer self shows.`);
    else if (d9 && isStrongDignity(d9.dignity)) bullets.push(`The Moon is ${DIGNITY_WORD[d9.dignity]} in the Navamsa (${SIGNS[d9.sign]}): emotional resilience holds up under pressure.`);
    if (rc.jaimini) {
      const al = rc.jaimini.arudhaLagna;
      const alHouse = ((al - lagnaSign + 12) % 12) + 1;
      const alOcc = chart.planets.filter((p) => p.sign === al).map((p) => p.id);
      bullets.push(
        `Your Arudha Lagna (public image) is ${SIGNS[al]} in the ${ord(alHouse)}${alOcc.length ? `, with ${names(alOcc)}` : ""}. The world sees you as ${SIGN_TONE[al]}${alOcc.length ? `, coloured by ${alOcc.map((id) => PLANET_SIGNIFIES[id].short).join(", ")}` : ""}.`
      );
    }
    covered.add("Mo");
    subsections.push({ heading, lead, bullets });
  }

  // ---- 4. The soul: the Atmakaraka --------------------------------------------
  if (rc.jaimini) {
    const ak = rc.jaimini.karakas.AK;
    const p = planet(rc, ak);
    if (p) {
      const n = nakOf(p.longitude);
      const vo = isVargottama(rc, ak);
      const heading = `The soul: ${name(ak)} (Atmakaraka) in ${SIGNS[p.sign]} in the ${ord(p.house)} house${vo ? ", vargottama" : ""}`;
      const lead = [`${name(ak)} is at ${deg(p.longitude)} ${SIGNS[p.sign]} in ${n.name} pada ${n.pada}, ${DIGNITY_WORD[p.dignity]}.`];
      const bullets: string[] = [];
      const absStrongest = rc.shadbala ? rc.shadbala.strongest === ak : false;
      const akLordship = lordshipBullet(rc, ak);
      const hs = akLordship ? [akLordship] : [];
      bullets.push(
        `${name(ak)} is ${absStrongest ? "the strongest planet in absolute Shadbala" : ratio(rc, ak) !== null ? `at ${fmtRatio(ratio(rc, ak)!)} its Shadbala requirement` : "your Atmakaraka"}${vo ? " and vargottama" : ""}. The soul's lesson runs through ${PLANET_SIGNIFIES[ak].phrase}.`
      );
      bullets.push(...hs);
      bullets.push(ak === "Su" ? `In ${SIGNS[p.sign]}, the will is ${SUN_CORE[p.sign]}` : `In ${SIGNS[p.sign]}, the soul seeks what is ${SIGN_TONE[p.sign]}.`);
      bullets.push(
        isGandanta(p.longitude)
          ? `At ${deg(p.longitude)} in ${n.name} pada ${n.pada}, the Atmakaraka sits at a gandanta junction. This points to a karmic theme of endings and new beginnings and a life that matures through transformation; in later life it often turns toward the spiritual.`
          : `${n.name} colours the soul's work: ${NAKSHATRA_QUALITIES[n.index]}.`
      );
      const kk = rc.jaimini.karakamsa;
      const inKK = rc.vargas ? rc.vargas.charts.D9.positions.filter((q) => q.sign === kk).map((q) => q.id) : [];
      const others = inKK.filter((id) => id !== ak);
      bullets.push(
        `Your Karakamsa is ${SIGNS[kk]}${others.length ? `, and ${names(others)} ${others.length > 1 ? "are" : "is"} also there in the Navamsa` : ""}. By Jaimini principles this points to ${others.length ? joinAnd(others.map((id) => KARAKAMSA_PLANET[id])) : `a soul's work that is ${SIGN_TONE[kk]}`}.`
      );
      covered.add(ak);
      subsections.push({ heading, lead, bullets });
    }
  }

  // ---- 5. Intellect: Mercury ----------------------------------------------------
  {
    const me = planet(rc, "Me");
    if (me) {
      const meYogas = [...rc.yogas, ...rc.extended].filter(
        (y) => y.planets.includes("Me") && (y.key === "budhaditya" || y.key.startsWith("raja-") || y.key === "mahapurusha-Me" || y.key === "saraswati" || y.key.startsWith("parivartana-") || y.key === "jaimini-raja-ak-amk")
      );
      const adj = me.dignity === "debilitated" ? "a debilitated" : me.dignity === "exalted" ? "an exalted" : isStrongDignity(me.dignity) ? "a dignified" : "";
      const heading = meYogas.length
        ? `Intellect: ${joinAnd([...new Set(meYogas.map((y) => y.name.replace(/ \(.*\)$/, "")))])} with ${adj || "Mercury in"} ${adj ? "Mercury" : SIGNS[me.sign]}`
        : `Intellect: Mercury in ${SIGNS[me.sign]} in the ${ord(me.house)} house`;
      const lead = [`Mercury is at ${deg(me.longitude)} ${SIGNS[me.sign]} (${nakOf(me.longitude).name}) in the ${ord(me.house)} house, ${DIGNITY_WORD[me.dignity]}${me.combust ? ", combust" : ""}.`];
      const bullets = meYogas.map((y) => `${y.name}: ${yogaLine(y.description)}`);
      const av = avasthaOf(rc, "Me");
      const vRank = vimshopakaRank(rc);
      const v = vimshopaka(rc, "Me");
      const weak = isWeakDignity(me.dignity) || me.combust || (ratio(rc, "Me") ?? 1) < 1;
      const parts: string[] = [];
      if (me.dignity === "debilitated") parts.push(`Mercury is debilitated at ${deg(me.longitude)}`);
      if (av && /^(Bala|Mrita)/.test(av.baladi.state)) parts.push(`a ${av.baladi.state.split(" ")[0] === "Bala" ? "very early degree (an \"infant\" state)" : "\"dead\" degree"}`);
      if (v !== null && vRank[vRank.length - 1] === "Me") parts.push(`the lowest Vimshopaka score (${v.toFixed(2)})`);
      if (vRank[0] === "Me" && v !== null) parts.push(`the highest Vimshopaka score (${v.toFixed(2)})`);
      bullets.push(`${parts.length ? `${cap(joinAnd(parts))}. ` : ""}${weak ? MERCURY_WEAK : MERCURY_STRONG}`);
      const nb = rc.yogas.find((y) => y.key === "nbrj-Me");
      if (nb) bullets.push(`Neecha Bhanga applies: ${yogaLine(nb.description).replace(/^Mercury's debilitation is cancelled because /, "")} The weakness repairs itself over time, and Mercury's results improve noticeably with age and experience.`);
      const l = lordshipBullet(rc, "Me");
      if (l) bullets.push(l);
      covered.add("Me");
      subsections.push({ heading, lead, bullets });
    }
  }

  // ---- 6. Every remaining planet -----------------------------------------------
  for (const id of PLANETS) {
    if (covered.has(id)) continue;
    const p = planet(rc, id);
    if (!p) continue;
    const n = nakOf(p.longitude);
    const vo = isVargottama(rc, id);
    const ownNak = n.lord === id;
    const heading = `${name(id)}${p.retrograde && id !== "Ra" && id !== "Ke" ? " retrograde" : ""} in the ${ord(p.house)} (${SIGNS[p.sign]}, ${n.name}${vo ? ", vargottama" : ""})`;
    const r = ratio(rc, id);
    const lead = [`${name(id)} is at ${deg(p.longitude)} in ${n.name} pada ${n.pada}, ${DIGNITY_WORD[p.dignity]}${p.combust ? ", combust" : ""}${ownNak ? ", in its own nakshatra" : ""}${r !== null ? `, at ${fmtRatio(r)} its Shadbala requirement` : ""}.`];
    const bullets = sentences(PLANET_IN_HOUSE[id][p.house - 1], 3);
    const l = lordshipBullet(rc, id);
    if (l) bullets.push(l);
    if (vo || ownNak) bullets.push(`Being ${joinAnd([vo ? "vargottama" : "", ownNak ? "in its own nakshatra" : ""].filter(Boolean))}, ${name(id)} is reliable: ${id === "Sa" ? "it takes slowly but gives lasting results" : "what it shows on the surface is what it delivers"}.`);
    const nb = rc.yogas.find((y) => y.key === `nbrj-${id}`);
    if (nb) bullets.push(`Neecha Bhanga: ${yogaLine(nb.description)}`);
    const rank = strengthRankPhrase(rc, id);
    if (rank) bullets.push(`${name(id)} is ${rank}.`);
    subsections.push({ heading, lead, bullets });
  }

  // ---- Summary -----------------------------------------------------------------
  const summary: string[] = [];
  {
    const occ = chart.planets.filter((p) => p.house === 1).map((p) => p.id);
    const ak = rc.jaimini?.karakas.AK;
    const akSign = ak ? planet(rc, ak)?.sign : undefined;
    const surface = `At the surface you are ${SIGN_TONE[lagnaSign]}${occ.length ? `, energised by ${names(occ)} on the Lagna` : ""}.`;
    const under = moon && ak && akSign !== undefined
      ? akSign === moon.sign
        ? ` Underneath, the mind and the soul (${name(ak)}) are both ${SIGN_TONE[moon.sign]}.`
        : ` Underneath, the mind is ${SIGN_TONE[moon.sign]}, and the soul (${name(ak)}) is ${SIGN_TONE[akSign]}.`
      : moon ? ` Underneath, the mind is ${SIGN_TONE[moon.sign]}.` : "";
    summary.push(surface + under);
    const rank = ratioRanking(rc);
    if (rank.length) {
      const strong = rank[0];
      const weak = rank[rank.length - 1];
      summary.push(
        `Your strongest planet is ${name(strong)} (${fmtRatio(ratio(rc, strong)!)} by Shadbala) and your weakest is ${name(weak)} (${fmtRatio(ratio(rc, weak)!)}). The main lessons run through ${PLANET_SIGNIFIES[weak].phrase}, and through managing ${LAGNA_SHADOW[lagnaSign].split(",")[0]}.`
      );
    }
    const lift = strongerPeriodAhead(rc);
    if (lift) summary.push(lift);
  }

  return { key: "personality", number: 1, title: "Personality", subsections, summary };
}

/**
 * "The chart clearly gets stronger with age, especially from 2028" — the next
 * Mahadasha (within 40 years) whose lord is a functional benefic, the
 * yogakaraka or the Lagna lord AND meets its Shadbala requirement.
 */
export function strongerPeriodAhead(rc: ReadingContext): string | null {
  if (!rc.dashaTree || !rc.chart.birthUtc) return null;
  const lagna = rc.chart.ascendant.sign;
  const now = rc.now.getTime();
  const horizon = now + 40 * 365.25 * 86400000;
  const good = (id: PlanetId) => lordQuality(rc, id, functionalRole(id, lagna)).q === "strong";
  const current = activeDashaAt(rc.dashaTree, rc.now);
  const next = rc.dashaTree.find((md) => md.start.getTime() > now && md.start.getTime() < horizon && good(md.lord));
  if (current && good(current.maha.lord)) {
    return `You are already in a supportive main period — the ${name(current.maha.lord)} Mahadasha runs to ${current.maha.end.getUTCFullYear()}${next ? `, and the ${name(next.lord)} Mahadasha from ${next.start.getUTCFullYear()} is the next strong stretch` : ""}.`;
  }
  return next
    ? `The chart gets clearly stronger from ${next.start.getUTCFullYear()}, when the ${name(next.lord)} Mahadasha begins — ${name(next.lord)} is ${lordQuality(rc, next.lord, functionalRole(next.lord, lagna)).why}.`
    : null;
}
