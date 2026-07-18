import { SIGN_LORDS } from "@/utils/astrology/constants";
import type { PlanetId } from "@/utils/astrology/types";

export interface FunctionalRoles {
  yogakaraka: PlanetId | null;
  benefics: PlanetId[];
  malefics: PlanetId[];
  neutrals: PlanetId[];
  note: string;
}

/**
 * Functional classification per Lagna, following the Parashari scheme as
 * published in the standard literature (kendra/trikona lordships weighed
 * against trishadaya and dusthana lordships). Marakas are derived
 * programmatically from 2nd/7th lordship.
 */
export const FUNCTIONAL_ROLES: FunctionalRoles[] = [
  {
    // Aries
    yogakaraka: null,
    benefics: ["Ju", "Su", "Ma"],
    malefics: ["Sa", "Me", "Ve"],
    neutrals: ["Mo"],
    note: "Jupiter as 9th lord is the premier benefic; the Sun as 5th lord supports it. Mars protects as Lagna lord despite 8th lordship. Saturn (10th+11th), Mercury (3rd+6th) and Venus (2nd+7th, the maraka) require dignity before they deliver cleanly.",
  },
  {
    // Taurus
    yogakaraka: "Sa",
    benefics: ["Sa", "Me", "Su"],
    malefics: ["Mo", "Ju", "Ma"],
    neutrals: ["Ve"],
    note: "Saturn, lord of the 9th and 10th, is the textbook yogakaraka — its strong periods build career and fortune together. Jupiter (8th+11th) and the Moon (3rd) work against the grain; Mars carries maraka charge as 7th lord.",
  },
  {
    // Gemini
    yogakaraka: null,
    benefics: ["Ve", "Sa", "Me"],
    malefics: ["Ma", "Ju", "Su"],
    neutrals: ["Mo"],
    note: "Venus (5th+12th) is the finest planet here; Saturn as 9th lord supports dharma. Mars (6th+11th) is the sharpest functional malefic, and Jupiter suffers kendradhipati dosha as 7th+10th lord with maraka duty.",
  },
  {
    // Cancer
    yogakaraka: "Ma",
    benefics: ["Ma", "Ju", "Mo"],
    malefics: ["Ve", "Me"],
    neutrals: ["Su", "Sa"],
    note: "Mars, lord of the 5th and 10th, is the yogakaraka — intelligence converted into achievement. Jupiter as 9th lord blesses. Venus (4th+11th) and Mercury (3rd+12th) run counter; Saturn as 7th+8th lord is a maraka needing watchfulness.",
  },
  {
    // Leo
    yogakaraka: "Ma",
    benefics: ["Ma", "Su", "Ju"],
    malefics: ["Me", "Ve", "Sa"],
    neutrals: ["Mo"],
    note: "Mars owns the 4th and 9th — a yogakaraka pairing home, property and fortune. Jupiter as 5th lord is a clean benefic. Saturn (6th+7th) doubles as maraka and obstacle-setter; Venus and Mercury need strength to behave.",
  },
  {
    // Virgo
    yogakaraka: null,
    benefics: ["Ve", "Me"],
    malefics: ["Ma", "Ju", "Mo"],
    neutrals: ["Su", "Sa"],
    note: "Venus, lord of the 2nd and 9th, is the wealth-and-fortune engine (with maraka duty riding along). Mercury protects as Lagna lord. Mars (3rd+8th) is the harshest malefic; Jupiter's 4th+7th kendra lordship dilutes its natural grace.",
  },
  {
    // Libra
    yogakaraka: "Sa",
    benefics: ["Sa", "Me", "Ve"],
    malefics: ["Ju", "Su", "Ma"],
    neutrals: ["Mo"],
    note: "Saturn (4th+5th) is the yogakaraka — patient, structural rise. Mercury as 9th lord carries fortune. Jupiter (3rd+6th) is the chief functional malefic; Mars as 2nd+7th lord is the working maraka.",
  },
  {
    // Scorpio
    yogakaraka: null,
    benefics: ["Ju", "Mo", "Su", "Ma"],
    malefics: ["Me", "Ve"],
    neutrals: ["Sa"],
    note: "The Moon as 9th lord and Jupiter as 2nd+5th lord are the principal benefics; the Sun as 10th lord adds authority. Venus (7th+12th) and Mercury (8th+11th) are the working malefics/marakas.",
  },
  {
    // Sagittarius
    yogakaraka: null,
    benefics: ["Ma", "Su", "Ju"],
    malefics: ["Ve", "Sa"],
    neutrals: ["Mo", "Me"],
    note: "Mars (5th+12th) and the Sun (9th lord) drive dharma and initiative; Jupiter protects as Lagna lord. Venus (6th+11th) and Saturn (2nd+3rd, maraka) are the planets to audit before trusting their dashas.",
  },
  {
    // Capricorn
    yogakaraka: "Ve",
    benefics: ["Ve", "Me", "Sa"],
    malefics: ["Ma", "Ju", "Mo"],
    neutrals: ["Su"],
    note: "Venus (5th+10th) is the yogakaraka — creativity crowned with career. Mercury as 9th lord blesses. Mars (4th+11th) is the sharpest malefic; Jupiter (3rd+12th) leaks resources, and the Moon as 7th lord holds maraka duty.",
  },
  {
    // Aquarius
    yogakaraka: "Ve",
    benefics: ["Ve", "Sa"],
    malefics: ["Ju", "Mo", "Ma"],
    neutrals: ["Su", "Me"],
    note: "Venus (4th+9th) is the yogakaraka; Saturn protects as Lagna+12th lord. Jupiter (2nd+11th) works as a maraka-flavoured accumulator, the Moon (6th) and Mars (3rd+10th) demand dignity before their periods reward.",
  },
  {
    // Pisces
    yogakaraka: null,
    benefics: ["Mo", "Ma", "Ju"],
    malefics: ["Ve", "Sa", "Su", "Me"],
    neutrals: [],
    note: "The Moon as 5th lord and Mars as 2nd+9th lord are the wealth-dharma pair; Jupiter guards as Lagna lord. Venus (3rd+8th), Saturn (11th+12th) and Mercury (4th+7th kendradhipati, maraka) all carry functional friction.",
  },
];

/** Marakas = lords of the 2nd and 7th houses, computed for any lagna. */
export function marakasFor(lagnaSign: number): PlanetId[] {
  const second = SIGN_LORDS[(lagnaSign + 1) % 12];
  const seventh = SIGN_LORDS[(lagnaSign + 6) % 12];
  return second === seventh ? [second] : [second, seventh];
}
