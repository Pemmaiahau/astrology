import type { SadeSatiPhaseKey } from "@/utils/astrology/sadeSati";

/**
 * Interpretation text for Sade Sati. Calculation lives in
 * `utils/astrology/sadeSati.ts`; nothing here computes anything.
 *
 * Voice follows the redesign rules (see REDESIGN.md §3b): the Sanskrit term is
 * glossed on first use, sentences stay short, and the language is conditional.
 * Saturn's passage is the single most fear-loaded idea in popular Jyotisha, and
 * a good deal of what is written about it is closer to a curse than a reading.
 * The classical position is more useful and less dramatic: this is a period
 * that removes what was not built properly. So every phase below names the
 * pressure honestly AND what actually helps — a caution without a
 * counter-measure is just anxiety with a citation.
 */

export interface PhaseCopy {
  /** Short label for a table row or timeline segment. */
  label: string;
  /** One-line plain-English verdict. */
  headline: string;
  /** "What this means for you" — 2-3 short sentences. */
  meaning: string;
  /** The reasoning chain: placement -> what Saturn signifies -> what the house governs -> effect. */
  why: string;
  /** Practical guidance. Always present. */
  guidance: string;
}

export const SADE_SATI_PHASES: Record<SadeSatiPhaseKey, PhaseCopy> = {
  rising: {
    label: "Opening phase — Saturn in the 12th from your Moon",
    headline: "The build-up: costs rise and sleep gets lighter before anything visible changes.",
    meaning:
      "This is the phase people notice least and feel most. Money tends to leak rather than crash — subscriptions, repairs, travel, obligations to other people. You may find yourself tired in a way that rest does not fix.",
    why: "Saturn is the planet of time, limits and unpaid dues. The 12th house from your Moon governs expenditure, sleep and what happens out of sight. So Saturn passing there tends to press on your reserves and your rest before it touches anything public.",
    guidance:
      "Front-load your savings now rather than later, and cut recurring commitments you have stopped valuing. Protect sleep as if it were a deadline. What you simplify in this phase is what you will not be carrying in the next one.",
  },
  peak: {
    label: "Peak phase — Saturn over your Moon",
    headline: "The heaviest stretch — and the one that does the actual work.",
    meaning:
      "Saturn is passing over the Moon itself, which is the emotional centre of your chart. Mood, health and motivation can all feel harder to reach than usual. Things that were being held together by effort alone tend to come apart in this phase — which is uncomfortable, and is also the point.",
    why: "Saturn is the planet of time and consequence; the Moon governs your mind, your mood and your sense of security. So a passage over the Moon tends to be felt inwardly first — as weight and fatigue — rather than as an external event.",
    guidance:
      "Where you can, defer decisions that are hard to reverse until the phase closes. Keep the basics deliberately boring: sleep, food, movement, one or two people you can be honest with. Ask for help earlier than feels necessary — this is the phase where waiting costs the most.",
  },
  setting: {
    label: "Closing phase — Saturn in the 2nd from your Moon",
    headline: "The ledger gets ruled off. Pressure moves to money and family, then lifts.",
    meaning:
      "The inner weight starts to lighten, and what remains tends to be practical: finances, family arrangements, things that need saying. This phase usually feels more manageable than the last one, because the difficulty is now in front of you rather than inside you.",
    why: "Saturn is the planet of consequence and settlement. The 2nd house from your Moon governs money, food, family and speech. So the closing phase tends to bring the accounting — literal and otherwise — into the open where it can be dealt with.",
    guidance:
      "Settle debts and finish the paperwork you have been avoiding. Speak carefully at home; this phase rewards a plain conversation and punishes a sharp one. What survives this stretch is genuinely yours to keep.",
  },
};

/** Framing for a passage as a whole, by where the reader stands relative to it. */
export const SADE_SATI_STATUS: Record<"past" | "current" | "future", string> = {
  past: "This passage is behind you. It is worth reading as a check on the method rather than as a prediction — if the years below matched a genuinely demanding stretch of your life, the rest of the chart's timing deserves more of your attention.",
  current: "You are inside this passage now. The phase highlighted below is the one currently running.",
  future: "This passage has not started yet. Nothing about it is fixed — knowing the dates is mainly useful for the decisions you get to make before it opens.",
};

/**
 * The honest caveat. Sade Sati is not a sentence and its reputation outruns
 * what the classical texts actually claim, so the panel says so in its own
 * copy rather than leaving the reader to infer it.
 */
export const SADE_SATI_CAVEAT =
  "Saturn's passage happens to everyone, roughly every thirty years, and it is not a verdict on your life. Its reputation is worse than the classical texts warrant: what these years tend to remove is what was not built on solid ground, which is painful at the time and useful afterwards. A strong, well-placed Saturn in your birth chart softens all of this considerably.";
