// Core shared types for the astrology engine.

export type PlanetId = "Su" | "Mo" | "Ma" | "Me" | "Ju" | "Ve" | "Sa" | "Ra" | "Ke";

export type AyanamshaId = "lahiri" | "pushya";

/** Natural relationship between a planet and the lord of the nakshatra it occupies. */
export type NakshatraRelation = "self" | "friend" | "neutral" | "enemy";

export type Dignity =
  | "exalted"
  | "moolatrikona"
  | "own"
  | "greatFriend"
  | "friend"
  | "neutral"
  | "enemy"
  | "greatEnemy"
  | "debilitated";

export interface PlanetPosition {
  id: PlanetId;
  /** Sidereal longitude 0–360 */
  longitude: number;
  /** 0–11, Aries = 0 */
  sign: number;
  /** Degree within the sign, 0–30 */
  degInSign: number;
  /** Whole-sign (Rashi) house from Lagna, 1–12 */
  house: number;
  /** Sripati Bhava Chalit house 1–12; equals `house` when cusps are unavailable */
  bhava: number;
  /** 0–26 */
  nakshatra: number;
  /** 1–4 */
  pada: number;
  /** Dispositor of the occupied nakshatra (Vimshottari lord of that nakshatra) */
  nakshatraLord: PlanetId;
  /** Natural relation of this planet to its nakshatra dispositor */
  nakshatraRelation: NakshatraRelation;
  retrograde: boolean;
  combust: boolean;
  /** degrees/day, sidereal (negative = retrograde) */
  speed: number;
  dignity: Dignity;
  /** Set when this planet is in Graha Yuddha with another */
  warWith?: PlanetId;
  /** True if this planet wins the war */
  warWinner?: boolean;
}

export interface AscendantInfo {
  longitude: number;
  sign: number;
  degInSign: number;
  nakshatra: number;
  pada: number;
}

export interface ChartMeta {
  name?: string;
  place?: string;
  mode: "manual" | "auto";
  ayanamsha: AyanamshaId;
  ayanamshaValue: number;
  timezone?: string;
  localDateTime?: string;
}

export interface ChartData {
  ascendant: AscendantInfo;
  /** Sidereal Midheaven longitude; undefined when birth time/place unknown (manual mode without anchor) */
  mc?: number;
  planets: PlanetPosition[];
  /** Sripati bhava madhya (cusp centres), 12 sidereal longitudes; undefined when not computable */
  cusps?: number[];
  /** Bhava sandhi (house boundaries); sandhi[i] is the start boundary of bhava i+1 */
  sandhis?: number[];
  /** UTC instant of birth — required for dasha; null when unknown */
  birthUtc: Date | null;
  /** Observer coordinates when known */
  lat?: number;
  lon?: number;
  meta: ChartMeta;
}

export interface DashaPeriod {
  lord: PlanetId;
  start: Date;
  end: Date;
  level: 1 | 2 | 3;
  children?: DashaPeriod[];
}

export interface PanchangData {
  tithiIndex: number; // 0–29
  tithiName: string;
  paksha: "Shukla" | "Krishna";
  varaIndex: number; // 0 = Sunday
  varaName: string;
  nakshatraIndex: number;
  nakshatraName: string;
  yogaIndex: number; // 0–26
  yogaName: string;
  karanaName: string;
  sunrise?: Date;
}

export interface TransitInfo {
  id: PlanetId;
  longitude: number;
  sign: number;
  degInSign: number;
  retrograde: boolean;
  houseFromMoon: number;
  houseFromLagna: number;
}

export interface GeoPlace {
  name: string;
  admin?: string;
  country?: string;
  lat: number;
  lon: number;
  timezone: string;
}

export interface BirthAnchor {
  dateISO: string; // YYYY-MM-DD
  time: string; // HH:mm
  place: GeoPlace | null;
}

export interface ManualPlanetInput {
  id: PlanetId;
  house: number; // 1–12
  deg: number; // 0–30 within sign
  retro: boolean;
}

export interface ManualInputState {
  lagnaSign: number; // 0–11
  ascDeg: number; // 0–30
  planets: ManualPlanetInput[];
  anchor: BirthAnchor;
}

export interface AutoInputState {
  name: string;
  dateISO: string;
  time: string;
  place: GeoPlace | null;
}

export interface YogaFinding {
  key: string;
  name: string;
  planets: PlanetId[];
  description: string;
}
