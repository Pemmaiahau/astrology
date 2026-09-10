import { aspectedSigns } from "@/utils/astrology/aspects";
import { AYANAMSHA_LABELS } from "@/utils/astrology/ayanamsha";
import {
  AV_PLANETS,
  type AshtakavargaResult,
} from "@/utils/astrology/ashtakavarga";
import {
  NAKSHATRAS,
  PLANETS,
  PLANET_NAMES,
  PLANET_SANSKRIT,
  SIGNS,
  SIGNS_SANSKRIT,
  SIGN_LORDS,
  SHADBALA_PLANETS,
  type PlanetId7,
} from "@/utils/astrology/constants";
import {
  computeDayParts,
  computeLimbTimings,
  nightKaalas,
  type DayParts,
  type TimeSpan,
} from "@/utils/astrology/dayParts";
import {
  CHARA_KARAKA_NAMES,
  type CharaKarakaId,
  type JaiminiInfo,
} from "@/utils/astrology/jaimini";
import { norm360 } from "@/utils/astrology/math";
import { naturalRelation, temporalRelation, DIGNITY_LABELS } from "@/utils/astrology/states";
import type { ActiveDasha } from "@/utils/astrology/dasha";
import type { BhavaBala, ShadbalaSet } from "@/utils/astrology/shadbala";
import {
  VARGA_IDS,
  VARGA_NAMES,
  VARGA_SIGNIFICATIONS,
  houseInVarga,
  type VargaId,
  type VargaSet,
} from "@/utils/astrology/varga";
import type {
  AyanamshaId,
  ChartData,
  DashaPeriod,
  NodeMode,
  PlanetId,
  TransitInfo,
  YogaFinding,
} from "@/utils/astrology/types";
import { FUNCTIONAL_ROLES, marakasFor, badhakaFor } from "@/data/interpretations/lordships";
import { checkMangalDosha } from "@/data/interpretations/marriage";
import { traitOf } from "@/data/interpretations/nakshatraTraits";
import type { SpeculationReport } from "@/data/interpretations/speculation";
import type { IntimacyReport } from "@/data/interpretations/intimacy";

/**
 * The whole chart as one Markdown document, for handing to an AI assistant.
 *
 * Everything here is a *rendering* of values the app has already computed —
 * this module runs no astronomy of its own beyond the two panchang day-part
 * calls, which the Panchang tab makes the same way at render time. If a number
 * appears in the file it appears on screen too, so the export can never drift
 * into asserting something the app does not show.
 *
 * The document is deliberately tables-only: no interpretive prose blocks, no
 * paragraph readings. A model consuming it should get positions, strengths,
 * periods and detected combinations as data, and be left to do the reading.
 * Where a computed row carries a one-line label (a yoga's description, an
 * axis's reading) that line stays, because dropping it would leave a bare
 * score with nothing saying what was scored.
 *
 * Sections degrade individually. A manual chart with no birth anchor has no
 * dasha, no Shadbala and no day parts; each of those sections then states what
 * was missing rather than being silently absent, so a reader can tell an
 * unavailable section from an empty one.
 */

export interface MarkdownReportInput {
  chart: ChartData;
  ayanamsha: AyanamshaId;
  nodeMode: NodeMode;
  dashaTree: DashaPeriod[] | null;
  activeDasha: ActiveDasha | null;
  transits: TransitInfo[] | null;
  sadeSati: "rising" | "peak" | "setting" | null;
  ashtakavarga: AshtakavargaResult | null;
  yogas: YogaFinding[];
  vargas: VargaSet | null;
  jaimini: JaiminiInfo | null;
  shadbala: ShadbalaSet | null;
  bhavaBala: BhavaBala[] | null;
  /** Built by the caller only when the advanced gate is open; null otherwise. */
  speculation: SpeculationReport | null;
  intimacy: IntimacyReport | null;
  generatedAt: Date;
}

// ---------------------------------------------------------------------------
// Formatting primitives
// ---------------------------------------------------------------------------

const DASH = "—";

/**
 * Degrees as D°MM'SS". Arcminutes and seconds are truncated rather than
 * rounded, for the same reason `math.fmtDeg` truncates: every value passed here
 * is a degree-in-sign, and rounding 29°59'59.6" up would print an impossible
 * 30°00'00" inside a sign, contradicting the sign printed beside it.
 */
function fmtDMS(deg: number): string {
  const d = Math.floor(deg);
  const restMin = (deg - d) * 60 + 1e-9;
  const m = Math.min(59, Math.floor(restMin));
  const s = Math.min(59, Math.floor((restMin - m) * 60));
  return `${d}°${String(m).padStart(2, "0")}'${String(s).padStart(2, "0")}"`;
}

/** Absolute sidereal longitude plus its degree-in-sign, e.g. 103°44'22" (13°44'22" Cancer). */
function fmtAbsolute(longitude: number): string {
  const lon = norm360(longitude);
  return `${fmtDMS(lon)} (${fmtDMS(lon % 30)} ${SIGNS[Math.floor(lon / 30)]})`;
}

/** Cell text: pipes escaped and newlines flattened, so no value can break the table. */
function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return DASH;
  return String(v).replace(/\r?\n+/g, " ").replace(/\|/g, "\\|").trim();
}

function table(headers: string[], rows: (string | number | null | undefined)[][]): string[] {
  if (rows.length === 0) return ["_None._", ""];
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
    "",
  ];
}

function heading(level: number, text: string): string[] {
  return [`${"#".repeat(level)} ${text}`, ""];
}

/** Date as YYYY-MM-DD in UTC — stable, sortable, and timezone-argument-free. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function clockIn(d: Date, timeZone?: string): string {
  return d.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
}

function dateIn(d: Date, timeZone?: string): string {
  return d.toLocaleDateString("en-GB", { timeZone, day: "numeric", month: "long", year: "numeric" });
}

function spanIn(s: TimeSpan, timeZone?: string): string {
  return `${clockIn(s.start, timeZone)} – ${clockIn(s.end, timeZone)}`;
}

const planetName = (id: PlanetId): string => `${PLANET_NAMES[id]} (${PLANET_SANSKRIT[id]})`;
const signName = (sign: number): string => `${SIGNS[sign]} (${SIGNS_SANSKRIT[sign]})`;
const nakshatraName = (n: number): string => NAKSHATRAS[n];
const round1 = (x: number): string => x.toFixed(1);
const round2 = (x: number): string => x.toFixed(2);

/** House 1–12 that a sign occupies, counted whole-sign from the Lagna. */
const houseOfSign = (sign: number, lagna: number): number => ((sign - lagna + 12) % 12) + 1;

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function birthDetails(input: MarkdownReportInput): string[] {
  const { chart } = input;
  const tzName = chart.meta.timezone;
  const [datePart, timePart] = (chart.meta.localDateTime ?? "").split(" ");

  const rows: (string | number)[][] = [
    ["Name", chart.meta.name ?? DASH],
    [
      "Date of Birth",
      datePart ? dateIn(new Date(`${datePart}T12:00:00Z`)) : DASH,
    ],
    ["Time of Birth", timePart ?? DASH],
    ["Place of Birth", chart.meta.place ?? DASH],
    ["Latitude", chart.lat !== undefined ? `${Math.abs(chart.lat).toFixed(5)}° ${chart.lat >= 0 ? "N" : "S"}` : DASH],
    ["Longitude", chart.lon !== undefined ? `${Math.abs(chart.lon).toFixed(5)}° ${chart.lon >= 0 ? "E" : "W"}` : DASH],
    ["Timezone", tzName ?? DASH],
    ["Birth instant (UTC)", chart.birthUtc ? chart.birthUtc.toISOString() : "not known — dasha and Shadbala unavailable"],
    ["Gender", chart.meta.gender ?? "not stated"],
  ];

  return [
    ...heading(2, "1. Birth Details"),
    ...table(["Field", "Value"], rows),
    ...heading(3, "Calculation settings"),
    ...table(
      ["Setting", "Value"],
      [
        ["Chart source", chart.meta.mode === "auto" ? "Ephemeris (astronomy-engine)" : "Manual placement entry"],
        ["Ayanamsha", `${AYANAMSHA_LABELS[input.ayanamsha]} — ${chart.meta.ayanamshaValue.toFixed(4)}°`],
        ["Zodiac", "Sidereal"],
        ["House system", "Whole sign (Rashi) with Sripati Bhava Chalit alongside"],
        ["Bhava frame", chart.meta.bhavaMethod ?? "not computed"],
        ["Rahu/Ketu", input.nodeMode === "mean" ? "Mean node" : "True (osculating) node"],
        ["Reference date (transits, running dasha)", input.generatedAt.toISOString()],
      ]
    ),
  ];
}

function panchangSection(input: MarkdownReportInput): string[] {
  const { chart, ayanamsha, nodeMode } = input;
  const out = heading(2, "2. Panchang at Birth");

  if (!chart.birthUtc) {
    return [...out, "_The birth instant is unknown, so the panchang of the birth moment cannot be computed._", ""];
  }

  const tzName = chart.meta.timezone;
  const limbs = computeLimbTimings(chart.birthUtc, ayanamsha, nodeMode);
  const moon = chart.planets.find((p) => p.id === "Mo");
  const parts: DayParts | null =
    chart.lat !== undefined && chart.lon !== undefined
      ? computeDayParts(chart.birthUtc, chart.lat, chart.lon, tzName)
      : null;

  const paksha = limbs.tithi.index < 15 ? "Shukla Paksha" : "Krishna Paksha";
  const rows: (string | number)[][] = [
    ["Weekday (Vara)", parts ? `${parts.varaName} — ruled by ${PLANET_NAMES[parts.varaLord]}` : DASH],
    ["Tithi", `${paksha.split(" ")[0]} ${limbs.tithi.name} (${(limbs.tithi.index % 15) + 1})`],
    ["Paksha", paksha],
    [
      "Nakshatra",
      moon ? `${nakshatraName(moon.nakshatra)} (Pada ${moon.pada})` : limbs.nakshatra.name,
    ],
    ["Yoga", `${limbs.yoga.name} (${limbs.yoga.index + 1})`],
    ["Karana", limbs.karana.name],
    ["Rasi Lord (lord of the Moon's sign)", moon ? PLANET_NAMES[SIGN_LORDS[moon.sign]] : DASH],
  ];

  if (parts) {
    const night = nightKaalas(parts);
    rows.push(
      ["Sunrise", clockIn(parts.sunrise, tzName)],
      ["Sunset", clockIn(parts.sunset, tzName)],
      ["Moonrise", parts.moonrise ? clockIn(parts.moonrise, tzName) : "did not occur on this day"],
      ["Moonset", parts.moonset ? clockIn(parts.moonset, tzName) : "did not occur on this day"],
      [
        "Abhijit Muhurta",
        parts.abhijitApplies
          ? spanIn(parts.abhijit, tzName)
          : `${spanIn(parts.abhijit, tzName)} — not observed on Wednesday`,
      ],
      ["Rahu Kaal", spanIn(parts.rahuKaal, tzName)],
      ["Gulika Kaal", spanIn(parts.gulikaKaal, tzName)],
      ["Yamaganda", spanIn(parts.yamaganda, tzName)],
      ["Night Gulika", spanIn(night.gulika, tzName)],
      ["Night Yamaganda", spanIn(night.yamaganda, tzName)],
      ["Birth fell in", parts.isDay ? "the day arc (sunrise to sunset)" : "the night arc (sunset to sunrise)"],
      ["Choghadiya at birth", parts.currentChoghadiya ? `${parts.currentChoghadiya.name} (${parts.currentChoghadiya.quality})` : DASH],
      ["Hora at birth", parts.currentHora ? `${PLANET_NAMES[parts.currentHora.lord]} hora` : DASH]
    );
  }

  out.push(...table(["Element", "Value"], rows));

  out.push(...heading(3, "Limb boundaries (when each running limb began and ends)"));
  out.push(
    ...table(
      ["Limb", "Value", "Began", "Ends"],
      [
        ["Tithi", limbs.tithi.name, `${dateIn(limbs.tithi.start, tzName)} ${clockIn(limbs.tithi.start, tzName)}`, `${dateIn(limbs.tithi.end, tzName)} ${clockIn(limbs.tithi.end, tzName)}`],
        ["Nakshatra", limbs.nakshatra.name, `${dateIn(limbs.nakshatra.start, tzName)} ${clockIn(limbs.nakshatra.start, tzName)}`, `${dateIn(limbs.nakshatra.end, tzName)} ${clockIn(limbs.nakshatra.end, tzName)}`],
        ["Yoga", limbs.yoga.name, `${dateIn(limbs.yoga.start, tzName)} ${clockIn(limbs.yoga.start, tzName)}`, `${dateIn(limbs.yoga.end, tzName)} ${clockIn(limbs.yoga.end, tzName)}`],
        ["Karana", limbs.karana.name, `${dateIn(limbs.karana.start, tzName)} ${clockIn(limbs.karana.start, tzName)}`, `${dateIn(limbs.karana.end, tzName)} ${clockIn(limbs.karana.end, tzName)}`],
      ]
    )
  );

  if (!parts) {
    out.push(
      "_Day parts (Rahu Kaal, Gulika, Yamaganda, Abhijit, choghadiya, hora) need birth coordinates and a Sun that both rose and set on the date; they are omitted rather than approximated._",
      ""
    );
  }

  return out;
}

function coreSignatures(input: MarkdownReportInput): string[] {
  const { chart } = input;
  const asc = chart.ascendant;
  const moon = chart.planets.find((p) => p.id === "Mo");
  const sun = chart.planets.find((p) => p.id === "Su");
  const lagnaLord = SIGN_LORDS[asc.sign];
  const roles = FUNCTIONAL_ROLES[asc.sign];
  const badhaka = badhakaFor(asc.sign);

  const rows: (string | number)[][] = [
    ["Ascendant (Lagna)", signName(asc.sign)],
    ["Ascendant Degree", fmtAbsolute(asc.longitude)],
    ["Ascendant Nakshatra", `${nakshatraName(asc.nakshatra)}, Pada ${asc.pada}`],
    ["Ascendant Lord", planetName(lagnaLord)],
  ];

  if (moon) {
    const trait = traitOf(moon.nakshatra);
    rows.push(
      ["Moon Sign (Janma Rashi)", signName(moon.sign)],
      ["Moon Sign Lord", planetName(SIGN_LORDS[moon.sign])],
      ["Janma Nakshatra", `${nakshatraName(moon.nakshatra)}, Pada ${moon.pada}`],
      ["Janma Nakshatra Lord", planetName(moon.nakshatraLord)],
      ["Gana", trait.gana],
      ["Yoni", `${trait.yoni} (${trait.yoniSex})`]
    );
  }
  if (sun) {
    rows.push(["Sun Sign (Surya Rashi)", signName(sun.sign)]);
  }
  rows.push(
    ["Yogakaraka for this Lagna", roles.yogakaraka ? planetName(roles.yogakaraka) : "none (no single planet rules both a kendra and a trikona)"],
    ["Functional benefics", roles.benefics.map((p) => PLANET_NAMES[p]).join(", ")],
    ["Functional malefics", roles.malefics.map((p) => PLANET_NAMES[p]).join(", ")],
    ["Functional neutrals", roles.neutrals.length ? roles.neutrals.map((p) => PLANET_NAMES[p]).join(", ") : DASH],
    ["Marakas (2nd/7th lords)", marakasFor(asc.sign).map((p) => PLANET_NAMES[p]).join(", ")],
    ["Badhaka", `${PLANET_NAMES[badhaka.lord]} (lord of the ${badhaka.house}th)`]
  );

  return [...heading(2, "3. Core Chart Signatures"), ...table(["Signature", "Value"], rows)];
}

function houseLords(input: MarkdownReportInput): string[] {
  const lagna = input.chart.ascendant.sign;
  const rows = Array.from({ length: 12 }, (_, i) => {
    const sign = (lagna + i) % 12;
    return [i + 1, signName(sign), planetName(SIGN_LORDS[sign])];
  });
  return [
    ...heading(2, "4. House Signs & Lords (Lagna Chart / D1)"),
    ...table(["House", "Sign", "Lord"], rows),
  ];
}

function functionalNatureOf(id: PlanetId, lagna: number): string {
  if (id === "Ra" || id === "Ke") return "N/A (shadow graha)";
  const roles = FUNCTIONAL_ROLES[lagna];
  if (roles.yogakaraka === id) return "Yogakaraka";
  if (roles.benefics.includes(id)) return "Functional Benefic";
  if (roles.malefics.includes(id)) return "Functional Malefic";
  return "Functional Neutral";
}

function planetaryPositions(input: MarkdownReportInput): string[] {
  const { chart } = input;
  const lagna = chart.ascendant.sign;
  const hasChalit = Boolean(chart.cusps);

  const rows = chart.planets.map((p) => [
    planetName(p.id),
    signName(p.sign),
    p.house,
    hasChalit ? p.bhava : DASH,
    fmtDMS(p.degInSign),
    fmtDMS(norm360(p.longitude)),
    nakshatraName(p.nakshatra),
    p.pada,
    PLANET_NAMES[p.nakshatraLord],
    p.nakshatraRelation,
    DIGNITY_LABELS[p.dignity],
    p.retrograde ? "Retrograde" : "Direct",
    p.id === "Su" || p.id === "Ra" || p.id === "Ke" ? "N/A" : p.combust ? "Combust" : "Not combust",
    p.warWith ? `${p.warWinner ? "won" : "lost"} vs ${PLANET_NAMES[p.warWith]}` : DASH,
    `${p.speed.toFixed(4)}°/day`,
    functionalNatureOf(p.id, lagna),
  ]);

  const grouping = Array.from({ length: 12 }, (_, i) => {
    const house = i + 1;
    const sign = (lagna + i) % 12;
    const occupants = chart.planets
      .filter((p) => p.house === house)
      .map((p) => `${PLANET_NAMES[p.id]}${p.retrograde ? " (R)" : ""}${p.combust ? " (C)" : ""}`);
    if (house === 1) occupants.unshift("Ascendant");
    return [house, signName(sign), occupants.length ? occupants.join(", ") : DASH];
  });

  const out = [
    ...heading(2, "5. Planetary Positions — Rashi Chart (D1)"),
    ...table(
      [
        "Planet", "Sign", "House", "Bhava (Chalit)", "Degree in Sign", "Absolute Longitude",
        "Nakshatra", "Pada", "Nakshatra Lord", "Relation to Nakshatra Lord", "Dignity",
        "Motion", "Combustion", "Graha Yuddha", "Speed", "Functional Nature",
      ],
      rows
    ),
  ];

  if (hasChalit) {
    const shifted = chart.planets.filter((p) => p.bhava !== p.house);
    out.push(
      `**Bhava Chalit (Sripati) shifts:** ${
        shifted.length === 0
          ? "no planet changes house structurally — the Rashi reading holds as-is."
          : shifted.map((p) => `${PLANET_NAMES[p.id]} H${p.house} → B${p.bhava}`).join("; ")
      }`,
      ""
    );
  }

  out.push(...heading(3, "House-wise Planetary Grouping"));
  out.push(...table(["House", "Sign", "Planets Present"], grouping));

  if (chart.cusps) {
    out.push(...heading(3, "Bhava Cusps (Sripati madhya)"));
    out.push(
      ...table(
        ["House", "Cusp (madhya)", "Sign at cusp"],
        chart.cusps.map((c, i) => [i + 1, fmtDMS(norm360(c) % 30), SIGNS[Math.floor(norm360(c) / 30)]])
      )
    );
  }

  return out;
}

function aspectsSection(input: MarkdownReportInput): string[] {
  const { chart } = input;
  const lagna = chart.ascendant.sign;

  const rows = chart.planets.map((p) => {
    const signs = aspectedSigns(p.id, p.sign);
    const houses = signs.map((s) => houseOfSign(s, lagna)).sort((a, b) => a - b);
    const hit = signs
      .flatMap((s) => chart.planets.filter((q) => q.sign === s && q.id !== p.id))
      .map((q) => PLANET_NAMES[q.id]);
    return [
      planetName(p.id),
      p.house,
      houses.join(", "),
      signs.map((s) => SIGNS[s]).join(", "),
      hit.length ? Array.from(new Set(hit)).join(", ") : DASH,
    ];
  });

  return [
    ...heading(2, "6. Planetary Aspects (Graha Drishti)"),
    "Whole-sign Parashari drishti: every graha aspects the 7th from itself; Mars adds the 4th and 8th, Jupiter the 5th and 9th, Saturn the 3rd and 10th, Rahu and Ketu the 5th and 9th. Occupancy is not counted as an aspect.",
    "",
    ...table(["Planet", "In House", "Houses Aspected", "Signs Aspected", "Planets Aspected"], rows),
  ];
}

/** The four vargas the reader asked to see in full, in the order BPHS lists them. */
const DETAILED_VARGAS: VargaId[] = ["D2", "D7", "D9", "D10"];

function vargaSection(input: MarkdownReportInput): string[] {
  const out = heading(2, "7. Divisional Charts (Shodasavarga)");
  const { vargas } = input;
  if (!vargas) {
    return [...out, "_Divisional charts could not be computed for this chart._", ""];
  }

  out.push(
    "D1 is given in full in section 5. D2, D7, D9 and D10 are given below with house and dignity; the remaining vargas list the sign each graha falls in.",
    ""
  );

  for (const id of DETAILED_VARGAS) {
    const vc = vargas.charts[id];
    out.push(...heading(3, `${id} — ${VARGA_NAMES[id]} (${VARGA_SIGNIFICATIONS[id]})`));
    out.push(`Varga Lagna: **${signName(vc.ascendant)}**, lord ${PLANET_NAMES[SIGN_LORDS[vc.ascendant]]}.`, "");
    out.push(
      ...table(
        ["Planet", "Sign", "House", "Sign Lord", "Dignity", id === "D9" ? "Vargottama" : "Note"],
        vc.positions.map((p) => [
          planetName(p.id),
          signName(p.sign),
          houseInVarga(vc, p.sign),
          PLANET_NAMES[SIGN_LORDS[p.sign]],
          DIGNITY_LABELS[p.dignity],
          id === "D9" ? (p.vargottama ? "Vargottama" : DASH) : DASH,
        ])
      )
    );
  }

  const compact = VARGA_IDS.filter((id) => id !== "D1" && !DETAILED_VARGAS.includes(id));
  out.push(...heading(3, "Remaining vargas — sign placements"));
  for (const id of compact) {
    const vc = vargas.charts[id];
    out.push(`**${id} — ${VARGA_NAMES[id]}** (${VARGA_SIGNIFICATIONS[id]}); varga Lagna ${SIGNS[vc.ascendant]}.`, "");
    out.push(
      ...table(
        ["Planet", "Sign"],
        vc.positions.map((p) => [PLANET_NAMES[p.id], SIGNS[p.sign]])
      )
    );
  }

  out.push(...heading(3, "Vargottama planets"));
  out.push(
    vargas.vargottama.length
      ? `${vargas.vargottama.map((p) => PLANET_NAMES[p]).join(", ")} — the same sign in D1 and D9.`
      : "_No planet is vargottama in this chart._",
    ""
  );

  out.push(...heading(3, "Vimshopaka Bala (composite dignity across the vargas)"));
  out.push(
    ...table(
      ["Planet", "Shadvarga /20", "Saptavarga /20", "Dashavarga /20", "Shodashavarga /20"],
      SHADBALA_PLANETS.map((id) => {
        const v = vargas.vimshopaka[id];
        return [PLANET_NAMES[id], round2(v.shad), round2(v.sapta), round2(v.dasha), round2(v.shodasha)];
      })
    )
  );

  return out;
}

/** Yoga keys that classical practice reads as afflictions rather than blessings. */
const DOSHA_YOGA_KEYS = ["kemadruma", "shakata", "daridra", "kala-sarpa"];

function isDoshaYoga(y: YogaFinding): boolean {
  const key = y.key.toLowerCase();
  return DOSHA_YOGA_KEYS.some((k) => key.includes(k));
}

function doshaSection(input: MarkdownReportInput): string[] {
  const { chart, yogas, sadeSati } = input;
  const mangal = checkMangalDosha(chart);
  const rows: (string | number)[][] = [];

  rows.push([
    "Mangal Dosha (Kuja Dosha)",
    mangal.present ? (mangal.effective ? "Present, uncancelled" : "Present but cancelled") : "Absent",
    [
      mangal.fromLagna ? "forms from the Lagna" : null,
      mangal.fromMoon ? "forms from the Moon" : null,
      mangal.cancellations.length ? `cancellations: ${mangal.cancellations.join("; ")}` : null,
    ]
      .filter(Boolean)
      .join("; ") || DASH,
  ]);

  for (const y of yogas.filter(isDoshaYoga)) {
    rows.push([y.name, y.name.includes("cancelled") ? "Present but cancelled" : "Present", y.description]);
  }

  rows.push([
    "Sade Sati",
    sadeSati ? `Running — ${sadeSati} phase` : "Not running at the report date",
    "Saturn's transit over the 12th, 1st and 2nd signs from the natal Moon.",
  ]);

  return [
    ...heading(2, "8. Doshas Present"),
    ...table(["Dosha", "Status", "Detail"], rows),
  ];
}

function yogaSection(input: MarkdownReportInput): string[] {
  const auspicious = input.yogas.filter((y) => !isDoshaYoga(y));
  return [
    ...heading(2, "9. Yogas Present"),
    ...table(
      ["Yoga", "Planets Involved", "Description"],
      auspicious.map((y) => [y.name, y.planets.map((p) => PLANET_NAMES[p]).join(", ") || DASH, y.description])
    ),
  ];
}

const FIVEFOLD_LABELS = ["Bitter Enemy", "Enemy", "Neutral", "Friend", "Intimate Friend"];

function friendshipSection(input: MarkdownReportInput): string[] {
  const { chart } = input;
  const signs: Partial<Record<PlanetId, number>> = {};
  for (const p of chart.planets) signs[p.id] = p.sign;

  const natural = PLANETS.map((a) => [
    planetName(a),
    PLANETS.filter((b) => b !== a && naturalRelation(a, b) === 1).map((b) => PLANET_NAMES[b]).join(", ") || DASH,
    PLANETS.filter((b) => b !== a && naturalRelation(a, b) === 0).map((b) => PLANET_NAMES[b]).join(", ") || DASH,
    PLANETS.filter((b) => b !== a && naturalRelation(a, b) === -1).map((b) => PLANET_NAMES[b]).join(", ") || DASH,
  ]);

  const compound = PLANETS.map((a) => {
    const buckets: PlanetId[][] = [[], [], [], [], []];
    const aSign = signs[a];
    for (const b of PLANETS) {
      if (b === a) continue;
      const bSign = signs[b];
      if (aSign === undefined || bSign === undefined) continue;
      const score = naturalRelation(a, b) + temporalRelation(aSign, bSign);
      buckets[score + 2].push(b);
    }
    return [
      planetName(a),
      ...buckets
        .slice()
        .reverse()
        .map((ids) => (ids.length ? ids.map((b) => PLANET_NAMES[b]).join(", ") : DASH)),
    ];
  });

  return [
    ...heading(2, "10. Planetary Friendship"),
    ...heading(3, "Naisargika (natural, permanent) relations"),
    "The classical tables are asymmetric — the Moon calls Mercury a friend while Mercury calls the Moon an enemy — so each row is read outward from the planet named in it.",
    "",
    ...table(["Planet", "Friends", "Neutrals", "Enemies"], natural),
    ...heading(3, "Panchadha Maitri (five-fold: natural combined with temporal)"),
    "Temporal friendship comes from this chart's own placements: a planet in the 2nd, 3rd, 4th, 10th, 11th or 12th sign from another is its temporal friend, everywhere else a temporal enemy.",
    "",
    ...table(["Planet", ...FIVEFOLD_LABELS.slice().reverse()], compound),
  ];
}

function shadbalaSection(input: MarkdownReportInput): string[] {
  const out = heading(2, "11. Shadbala — six-fold planetary strength");
  const { shadbala } = input;
  if (!shadbala) {
    return [
      ...out,
      "_Shadbala needs a real birth anchor (date, time and place) plus a Sun that rose and set on the date. It could not be computed for this chart._",
      "",
    ];
  }

  out.push("All values in virupas (60 virupas = 1 rupa). A planet at or above its classical requirement is deemed strong enough to protect its significations.", "");
  out.push(
    ...table(
      ["Planet", "Sthana", "Dig", "Kala", "Cheshta", "Naisargika", "Drik", "Total (virupas)", "Rupas", "Required", "Ratio", "Ishta Phala", "Kashta Phala"],
      SHADBALA_PLANETS.map((id) => {
        const s = shadbala.planets[id];
        const sum = (fs: { virupas: number }[]) => fs.reduce((a, f) => a + f.virupas, 0);
        return [
          PLANET_NAMES[id],
          round1(sum(s.sthana)),
          round1(sum(s.dig)),
          round1(sum(s.kala)),
          round1(sum(s.cheshta)),
          round1(sum(s.naisargika)),
          round1(sum(s.drik)),
          round1(s.totalVirupas),
          round2(s.rupas),
          s.required,
          round2(s.ratio),
          round1(s.ishta),
          round1(s.kashta),
        ];
      })
    )
  );
  out.push(
    `Strongest: **${PLANET_NAMES[shadbala.strongest]}** · weakest: **${PLANET_NAMES[shadbala.weakest]}**.`,
    ""
  );

  out.push(...heading(3, "Sub-bala breakdown"));
  const subRows: (string | number)[][] = [];
  for (const id of SHADBALA_PLANETS) {
    const s = shadbala.planets[id];
    for (const [group, factors] of [
      ["Sthana", s.sthana],
      ["Dig", s.dig],
      ["Kala", s.kala],
      ["Cheshta", s.cheshta],
      ["Naisargika", s.naisargika],
      ["Drik", s.drik],
    ] as const) {
      for (const f of factors) subRows.push([PLANET_NAMES[id], group, f.label, round1(f.virupas)]);
    }
  }
  out.push(...table(["Planet", "Bala", "Sub-bala", "Virupas"], subRows));

  return out;
}

function bhavaBalaSection(input: MarkdownReportInput): string[] {
  const out = heading(2, "12. Bhava Bala — house strength");
  const { bhavaBala, chart } = input;
  if (!bhavaBala) {
    return [...out, "_Bhava Bala is derived from Shadbala, which could not be computed for this chart._", ""];
  }
  const lagna = chart.ascendant.sign;
  const ranked = [...bhavaBala].sort((a, b) => b.totalVirupas - a.totalVirupas);

  out.push(
    ...table(
      ["House", "Sign", "Lord", "Bhavadhipati", "Bhava Dig", "Bhava Drishti", "Total (virupas)", "Rupas", "Rank"],
      bhavaBala.map((b) => {
        const sign = (lagna + b.house - 1) % 12;
        const find = (label: string) => b.factors.find((f) => f.label.startsWith(label));
        return [
          b.house,
          SIGNS[sign],
          PLANET_NAMES[SIGN_LORDS[sign]],
          round1(find("Bhavadhipati")?.virupas ?? 0),
          round1(find("Bhava Dig")?.virupas ?? 0),
          round1(find("Bhava Drishti")?.virupas ?? 0),
          round1(b.totalVirupas),
          round2(b.rupas),
          ranked.findIndex((r) => r.house === b.house) + 1,
        ];
      })
    )
  );
  return out;
}

function ashtakavargaSection(input: MarkdownReportInput): string[] {
  const out = heading(2, "13. Ashtakavarga");
  const { ashtakavarga, chart } = input;
  if (!ashtakavarga) {
    return [...out, "_Ashtakavarga needs all seven classical planets placed; it could not be computed for this chart._", ""];
  }
  const lagna = chart.ascendant.sign;

  out.push(...heading(3, "Bhinnashtakavarga (bindus per planet per sign)"));
  out.push(
    ...table(
      ["Chart", ...SIGNS.map((s) => s.slice(0, 3))],
      [...AV_PLANETS.map((p) => p as string), "As"].map((id) => [
        id === "As" ? "Ascendant" : PLANET_NAMES[id as PlanetId],
        ...ashtakavarga.bav[id],
      ])
    )
  );

  out.push(...heading(3, "Sarvashtakavarga (total bindus per sign, 337 across the zodiac)"));
  out.push(
    ...table(
      ["House", "Sign", "SAV Bindus"],
      Array.from({ length: 12 }, (_, i) => {
        const sign = (lagna + i) % 12;
        return [i + 1, SIGNS[sign], ashtakavarga.sav[sign]];
      })
    )
  );
  return out;
}

function jaiminiSection(input: MarkdownReportInput): string[] {
  const out = heading(2, "14. Jaimini — Chara Karakas, Padas and Argala");
  const { jaimini, chart, shadbala } = input;
  if (!jaimini) {
    return [...out, "_Jaimini primitives could not be computed for this chart._", ""];
  }
  const lagna = chart.ascendant.sign;

  const karakaRows = (Object.keys(CHARA_KARAKA_NAMES) as CharaKarakaId[]).map((k) => {
    const id = jaimini.karakas[k];
    const p = chart.planets.find((q) => q.id === id);
    const bala = shadbala ? shadbala.planets[id as PlanetId7] : null;
    return [
      k,
      CHARA_KARAKA_NAMES[k],
      planetName(id),
      p ? signName(p.sign) : DASH,
      p ? p.house : DASH,
      p ? fmtDMS(p.degInSign) : DASH,
      p ? DIGNITY_LABELS[p.dignity] : DASH,
      bala ? `${round1(bala.totalVirupas)} virupas (${round2(bala.ratio)}× required)` : "Shadbala unavailable",
    ];
  });

  out.push("Chara karakas are ranked by degree-in-sign among the seven classical planets — highest degree is the Atmakaraka, lowest the Darakaraka (seven-karaka scheme).", "");
  out.push(
    ...table(
      ["Karaka", "Role", "Planet", "Sign", "House", "Degree", "Dignity", "Strength"],
      karakaRows
    )
  );

  out.push(
    ...table(
      ["Pada / Point", "Sign", "House from Lagna", "Lord"],
      [
        ["Karakamsa (AK's Navamsa sign)", signName(jaimini.karakamsa), houseOfSign(jaimini.karakamsa, lagna), PLANET_NAMES[SIGN_LORDS[jaimini.karakamsa]]],
        ["Arudha Lagna (AL)", signName(jaimini.arudhaLagna), houseOfSign(jaimini.arudhaLagna, lagna), PLANET_NAMES[SIGN_LORDS[jaimini.arudhaLagna]]],
        ["Upapada Lagna (UL)", signName(jaimini.upapada), houseOfSign(jaimini.upapada, lagna), PLANET_NAMES[SIGN_LORDS[jaimini.upapada]]],
      ]
    )
  );

  out.push(...heading(3, "Argala (intervention) and Virodha (obstruction) per house"));
  out.push(
    ...table(
      ["House", "Sign", "Intervening (2nd/4th/11th)", "Obstructing (12th/10th/3rd)"],
      jaimini.argala.map((a, i) => [
        i + 1,
        SIGNS[(lagna + i) % 12],
        a.intervening.map((p) => PLANET_NAMES[p]).join(", ") || DASH,
        a.obstructing.map((p) => PLANET_NAMES[p]).join(", ") || DASH,
      ])
    )
  );
  return out;
}

function dashaSection(input: MarkdownReportInput): string[] {
  const out = heading(2, "15. Vimshottari Dasha");
  const { dashaTree, activeDasha } = input;
  if (!dashaTree) {
    return [...out, "_Vimshottari dasha needs the birth instant and the Moon's longitude; it could not be computed for this chart._", ""];
  }

  if (activeDasha) {
    out.push(...heading(3, "Running period at the report date"));
    out.push(
      ...table(
        ["Level", "Lord", "Start", "End"],
        [
          ["Mahadasha", PLANET_NAMES[activeDasha.maha.lord], isoDate(activeDasha.maha.start), isoDate(activeDasha.maha.end)],
          ["Antardasha", PLANET_NAMES[activeDasha.antar.lord], isoDate(activeDasha.antar.start), isoDate(activeDasha.antar.end)],
          ["Pratyantardasha", PLANET_NAMES[activeDasha.pratyantar.lord], isoDate(activeDasha.pratyantar.start), isoDate(activeDasha.pratyantar.end)],
        ]
      )
    );
  }

  out.push(...heading(3, "Mahadasha sequence (whole 120-year cycle)"));
  out.push(
    ...table(
      ["#", "Mahadasha", "Start", "End", "Status"],
      dashaTree.map((md, i) => [
        i + 1,
        PLANET_NAMES[md.lord],
        isoDate(md.start),
        isoDate(md.end),
        activeDasha && activeDasha.maha === md
          ? "Current"
          : md.end < input.generatedAt
            ? "Past"
            : "Future",
      ])
    )
  );

  out.push(...heading(3, "Full three-level tree (Mahadasha → Antardasha → Pratyantardasha)"));
  for (const md of dashaTree) {
    out.push(
      ...heading(
        4,
        `${PLANET_NAMES[md.lord]} Mahadasha — ${isoDate(md.start)} to ${isoDate(md.end)}`
      )
    );
    const rows: (string | number)[][] = [];
    for (const ad of md.children ?? []) {
      for (const pd of ad.children ?? []) {
        rows.push([
          `${PLANET_NAMES[md.lord]}–${PLANET_NAMES[ad.lord]}`,
          PLANET_NAMES[pd.lord],
          isoDate(pd.start),
          isoDate(pd.end),
        ]);
      }
    }
    out.push(
      ...table(["Antardasha", "Pratyantardasha", "Start", "End"], rows)
    );
  }

  return out;
}

function transitSection(input: MarkdownReportInput): string[] {
  const out = heading(2, "16. Transits at the report date");
  const { transits, sadeSati, generatedAt } = input;
  if (!transits) {
    return [...out, "_Transits could not be computed for this chart._", ""];
  }
  out.push(`Positions for ${isoDate(generatedAt)}, read against the natal chart.`, "");
  out.push(
    ...table(
      ["Planet", "Sign", "Degree", "Motion", "House from Lagna", "House from Moon"],
      transits.map((t) => [
        planetName(t.id),
        signName(t.sign),
        fmtDMS(t.degInSign),
        t.retrograde ? "Retrograde" : "Direct",
        t.houseFromLagna,
        t.houseFromMoon,
      ])
    )
  );
  out.push(
    `**Sade Sati:** ${sadeSati ? `running, ${sadeSati} phase` : "not running at this date"}.`,
    ""
  );
  return out;
}

function speculationSection(report: SpeculationReport, sectionNumber: number): string[] {
  const out = heading(2, `${sectionNumber}. Speculation`);
  out.push(
    ...table(
      ["Field", "Value"],
      [
        ["Headline", report.headline],
        ["Score", report.score !== undefined ? `${Math.round(report.score)}/100` : DASH],
        ["Verdict", report.verdict ?? DASH],
        ["Confidence", `${Math.round(report.confidence)}%`],
      ]
    )
  );
  out.push(...heading(3, "Axes"));
  out.push(...table(["Axis", "Score", "Reading"], report.axes.map((a) => [a.label, Math.round(a.score), a.reading])));
  out.push(...heading(3, "Instrument fit"));
  out.push(...table(["Instrument", "Score", "Verdict"], report.instruments.map((i) => [i.label, Math.round(i.score), i.verdict])));
  out.push(...heading(3, "Suggested split"));
  out.push(...table(["Instrument", "Percent"], report.split.map((s) => [s.label, `${s.percent}%`])));
  out.push(...heading(3, "Significators"));
  out.push(
    ...table(
      ["Planet", "Roles", "Sign", "House", "Dignity", "Nakshatra", "Nakshatra Lord", "Relation", "Gandanta"],
      report.significators.map((s) => [
        PLANET_NAMES[s.id],
        s.roles.join("; "),
        SIGNS[s.sign],
        s.house,
        DIGNITY_LABELS[s.dignity],
        nakshatraName(s.nakshatra),
        PLANET_NAMES[s.nakshatraLord],
        s.relation,
        s.gandanta ? "Yes" : "No",
      ])
    )
  );
  return out;
}

function intimacySection(report: IntimacyReport, sectionNumber: number): string[] {
  const out = heading(2, `${sectionNumber}. Intimacy`);
  out.push(
    ...table(
      ["Field", "Value"],
      [
        ["Headline", report.headline],
        ["Score", report.score !== undefined ? `${Math.round(report.score)}/100` : DASH],
        ["Verdict", report.verdict ?? DASH],
        ["Confidence", `${Math.round(report.confidence)}%`],
      ]
    )
  );
  out.push(...heading(3, "Facets"));
  out.push(...table(["Facet", "Score", "Reading"], report.facets.map((f) => [f.label, Math.round(f.score), f.reading])));
  out.push(...heading(3, "Yoni reading (from the Moon's nakshatra)"));
  out.push(
    ...table(
      ["Field", "Value"],
      [
        ["Nakshatra", nakshatraName(report.yoni.nakshatra)],
        ["Yoni", report.yoni.yoni],
        ["Gana", report.yoni.gana],
        ["Appetite", report.yoni.appetite],
        ["Style", report.yoni.style],
        ["Clashing nakshatras", report.yoni.clashesWith.join(", ") || DASH],
      ]
    )
  );
  out.push(...heading(3, "Combinations detected"));
  out.push(...table(["Combination", "Weight", "Effect"], report.combinations.map((c) => [c.name, c.weight, c.text])));
  out.push(...heading(3, "Drishti on the desire houses"));
  out.push(
    ...table(
      ["Target", "From", "Aspect (inclusive count)", "Strength (virupas)"],
      report.drishti.map((d) => [d.target, PLANET_NAMES[d.from], d.offset, round1(d.strength)])
    )
  );
  return out;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function buildMarkdownReport(input: MarkdownReportInput): string {
  const name = input.chart.meta.name?.trim() || "Unnamed chart";

  const lines: string[] = [
    `# Vedic Birth Chart — ${name}`,
    "",
    "Generated by Jyotisha Studio. Sidereal positions from an astronomy-engine ephemeris; every table below is the same computation the app displays on screen.",
    "",
    ...birthDetails(input),
    "---",
    "",
    ...panchangSection(input),
    "---",
    "",
    ...coreSignatures(input),
    "---",
    "",
    ...houseLords(input),
    "---",
    "",
    ...planetaryPositions(input),
    "---",
    "",
    ...aspectsSection(input),
    "---",
    "",
    ...vargaSection(input),
    "---",
    "",
    ...doshaSection(input),
    "---",
    "",
    ...yogaSection(input),
    "---",
    "",
    ...friendshipSection(input),
    "---",
    "",
    ...shadbalaSection(input),
    "---",
    "",
    ...bhavaBalaSection(input),
    "---",
    "",
    ...ashtakavargaSection(input),
    "---",
    "",
    ...jaiminiSection(input),
    "---",
    "",
    ...dashaSection(input),
    "---",
    "",
    ...transitSection(input),
  ];

  let nextSection = 17;
  if (input.speculation) {
    lines.push("---", "", ...speculationSection(input.speculation, nextSection));
    nextSection += 1;
  }
  if (input.intimacy) {
    lines.push("---", "", ...intimacySection(input.intimacy, nextSection));
  }

  lines.push(
    "---",
    "",
    "_For guidance, not determinism. Classical rules are implemented as published; where sources disagree the app's choice is documented in ENGINE.md._",
    ""
  );

  return lines.join("\n");
}

/** Filename for the downloaded document: slugged name plus the birth date. */
export function markdownReportFilename(chart: ChartData): string {
  const slug = (chart.meta.name?.trim() || "chart")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "chart";
  const date = chart.meta.localDateTime?.split(" ")[0] ?? "undated";
  return `vedic-chart-${slug}-${date}.md`;
}
