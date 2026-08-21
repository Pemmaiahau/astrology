import { ageYearsAt } from "@/utils/astrology/ageBands";
import { PLANET_COLOURS, PLANET_DIRECTION, PLANET_NAMES, SIGNS, VARA_LORDS, VARA_NAMES } from "@/utils/astrology/constants";
import type { ShadbalaSet } from "@/utils/astrology/shadbala";
import type { PlanetStrength } from "@/utils/astrology/strength";
import { periodsOverlapping } from "@/utils/astrology/scan";
import type { ChartData, DashaPeriod, PlanetId, YogaFinding } from "@/utils/astrology/types";
import { ownedHouses } from "@/utils/astrology/yogas";
import { badhakaFor, FUNCTIONAL_ROLES, marakasFor } from "./lordships";
import type { Evidence, SectionReport, TimingWindow } from "./report";
import { ordinal } from "./synthesis";

/**
 * "Things to avoid" — the cautions section.
 *
 * Sources: functional benefic/malefic scheme per Parashara (BPHS,
 * lagna-lordship chapters, as tabulated in the standard literature);
 * marakas from BPHS (Ayurdaya/Maraka adhyaya: 2nd and 7th lords);
 * badhaka per the standard movable/fixed/dual scheme (Prasna Marga
 * tradition); dusthana readings per Phaladeepika's house-lord placements.
 *
 * House rule enforced by the type below: a caution CANNOT be emitted
 * without a constructive counter-measure, and the wording avoids
 * fatalism — risk is stated as a tendency with a practical counter.
 */

export interface Caution {
  caution: Evidence;
  counterMeasure: string;
}

export interface CautionsReport extends SectionReport {
  cautions: Caution[];
  adverseWindows: TimingWindow[];
}

const DUSTHANA = [6, 8, 12];

export function buildCautionsReport(
  chart: ChartData,
  strengths: Partial<Record<PlanetId, PlanetStrength>>,
  shadbala: ShadbalaSet | null,
  yogas: YogaFinding[],
  dashaTree: DashaPeriod[] | null,
  now: Date
): CautionsReport {
  const lagna = chart.ascendant.sign;
  const roles = FUNCTIONAL_ROLES[lagna];
  const cautions: Caution[] = [];
  const caveats: string[] = [];

  const planetOf = (id: PlanetId) => chart.planets.find((p) => p.id === id);

  // --- 1. Functional malefics: instincts that work against this lagna ---
  for (const id of roles.malefics) {
    const p = planetOf(id);
    if (!p) continue;
    const s = strengths[id];
    const strong = s ? s.score >= 60 : false;
    cautions.push({
      caution: {
        text: `${PLANET_NAMES[id]} rules houses that pull against your interests for ${/^[AEIOU]/.test(SIGNS[lagna]) ? "an" : "a"} ${SIGNS[lagna]} rising chart, so its instincts tend to be the ones that get you into trouble. ${strong ? `Yours is strong, which is the awkward case: it works well enough to keep talking you into the wrong battles, particularly in ${PLANET_NAMES[id]}'s areas.` : `In your chart it sits in the ${ordinal(p.house)} house, so that is where its decisions get made — and where a second opinion pays for itself.`}`,
        weight: strong ? -6 : -3,
        source: { work: "BPHS", ref: "functional lordship scheme for the lagna" },
      },
      counterMeasure: `Give big commitments in ${PLANET_NAMES[id]}'s areas one extra day and one outside opinion — that single habit removes most of what this placement costs people. On its weekday (${VARA_NAMES[VARA_LORDS.indexOf(id) === -1 ? 6 : VARA_LORDS.indexOf(id)]}), lean toward routine rather than launches.`,
    });
  }

  // --- 2. Badhaka: the obstructor lord ---
  {
    const b = badhakaFor(lagna);
    const p = planetOf(b.lord);
    if (p) {
      cautions.push({
        caution: {
          text: `${PLANET_NAMES[b.lord]} is your obstructor — for your rising sign that role falls to the ${ordinal(b.house)} lord. Delays and snags with no obvious cause tend to cluster around its themes and its periods, and in your chart it works from the ${ordinal(p.house)} house. If you have ever wondered why one particular kind of plan keeps needing three attempts, this is usually the answer.`,
          weight: -4,
          source: { work: "Prasna Marga tradition", ref: "badhaka scheme: movable→11th, fixed→9th, dual→7th lord" },
        },
        counterMeasure:
          "Build slack into anything this planet touches: pad the timeline, avoid single points of failure, keep a fallback warm. When something obstructs three times, treat that as information and change route rather than pushing harder — this pattern responds far better to a different road than to more force.",
      });
    }
  }

  // --- 3. Marakas: framed as health-attention periods, never as fear ---
  {
    const ms = marakasFor(lagna);
    cautions.push({
      caution: {
        text: `${ms.map((m) => PLANET_NAMES[m]).join(" and ")} rule your 2nd and 7th houses, which classically makes them the planets whose main periods are worth a little extra care about health and energy. That is the whole of the claim — a prompt to keep up with the ordinary things, not a warning about anything dramatic.`,
        weight: -3,
        source: { work: "BPHS", ref: "maraka: lords of the 2nd and 7th" },
      },
      counterMeasure:
        "During these planets' main periods, keep routine check-ups current, insurance in force, and the basics — sleep, food, movement — non-negotiable. Prevention is the entire remedy here, and it is the kind that works whether or not you believe any of the astrology.",
    });
  }

  // --- 4. Dusthana lords carried into key houses ---
  for (const p of chart.planets) {
    if (p.id === "Ra" || p.id === "Ke") continue;
    const owned = ownedHouses(p.id, lagna);
    const dusthanaOwned = owned.filter((h) => DUSTHANA.includes(h));
    if (!dusthanaOwned.length) continue;
    if ([1, 4, 7, 10, 5, 9].includes(p.house) && !owned.some((h) => [1, 4, 7, 10, 5, 9].includes(h))) {
      cautions.push({
        caution: {
          text: `${PLANET_NAMES[p.id]} rules your ${dusthanaOwned.map(ordinal).join("/")} — one of the harder houses — and sits in your ${ordinal(p.house)}, carrying that friction into an area that matters to you. In practice, debt, disputes and loose ends have a way of turning up inside ${ordinal(p.house)}-house matters rather than staying where they started.`,
          weight: -4,
          source: { work: "Phaladeepika", ref: "house-lord placement chapters (dusthana lords in kendra/trikona)" },
        },
        counterMeasure: `Keep ${ordinal(p.house)}-house matters clean on paper: written agreements, no informal loans, explicit boundaries with the people involved. It feels excessive right up until the year it saves you, and it costs almost nothing to do.`,
      });
    }
  }

  // --- 5. Afflicted planets: debilitated / combust / war-losing ---
  for (const p of chart.planets) {
    if (p.dignity === "debilitated") {
      const cancelled = yogas.some((y) => y.key === `nbrj-${p.id}`);
      cautions.push({
        caution: {
          text: `${PLANET_NAMES[p.id]} is debilitated in ${SIGNS[p.sign]}${cancelled ? ", though your chart carries the cancellation that turns this into late-blooming strength" : ""}. Its areas tend to underdeliver early — the thing you are worst at in your twenties often sits right here. That makes it a poor foundation for a whole role${cancelled ? " until the cancellation has visibly matured, which it does" : ""}, and a perfectly good thing to grow into slowly.`,
          weight: cancelled ? -2 : -5,
          source: { work: "BPHS", ref: "exaltation/debilitation scheme" },
        },
        counterMeasure: cancelled
          ? "Give this area time. The classical reading is struggle first and unusual strength after, so invest steadily rather than betting on it early — this is the part of your chart most likely to surprise you later, in the good direction."
          : `Prop ${PLANET_NAMES[p.id]}'s areas up with skills and systems rather than willpower: a routine you do not have to decide on each morning, someone experienced to check your work, and modest expectations during its periods. Weak here is workable; unsupported here is not.`,
      });
    }
    if (p.combust && p.id !== "Su") {
      cautions.push({
        caution: {
          text: `${PLANET_NAMES[p.id]} sits too close to the Sun to shine on its own — what tradition calls combustion. Its qualities get overshadowed by ego or authority, sometimes yours and often someone else's, and your judgement in its areas gets noticeably worse once pride is in the room.`,
          weight: -3,
          source: { work: "BPHS", ref: "asta (combustion) orbs" },
        },
        counterMeasure: `Separate the decision from the ego. In ${PLANET_NAMES[p.id]}'s areas, write the reasoning down before you act and let someone with no stake read it back to you — that one step is usually enough to keep this from costing you anything.`,
      });
    }
    if (p.warWith && p.warWinner === false) {
      cautions.push({
        caution: {
          text: `${PLANET_NAMES[p.id]} and ${PLANET_NAMES[p.warWith]} sit within a degree of each other, and ${PLANET_NAMES[p.id]} loses that contest. Its agenda gets crowded out by ${PLANET_NAMES[p.warWith]}'s in ordinary life — the quieter need is the one that keeps getting postponed.`,
          weight: -2,
          source: { work: "Graha Yuddha convention", ref: "lower-longitude winner" },
        },
        counterMeasure: `Give ${PLANET_NAMES[p.id]}'s activities their own protected time, away from anything ${PLANET_NAMES[p.warWith]} governs. Left to compete, the weaker agenda simply never gets a turn — scheduling is the whole fix here.`,
      });
    }
  }

  // --- 6. Weak by Shadbala ---
  if (shadbala) {
    for (const pid of Object.keys(shadbala.planets) as (keyof typeof shadbala.planets)[]) {
      const sb = shadbala.planets[pid];
      if (sb.ratio < 0.85) {
        cautions.push({
          caution: {
            text: `${PLANET_NAMES[pid]} reaches only ${Math.round(sb.ratio * 100)}% of the strength the classical tables ask of it. A planet in that position tends to promise more than it delivers, so plans resting entirely on its themes are the ones most likely to need a second attempt.`,
            weight: -3,
            source: { work: "BPHS", ref: "Shadbala minimum-requirement table" },
          },
          counterMeasure: `Build a check into anything depending on ${PLANET_NAMES[pid]}'s themes — a review, a backup, a second quote. Tradition also suggests skipping its colour for important first impressions (${PLANET_COLOURS[pid].primary}${PLANET_DIRECTION[pid] ? `, and the ${PLANET_DIRECTION[pid]} direction for meetings that matter` : ""}); treat that as custom rather than mechanism, and it costs nothing to follow.`,
        });
      }
    }
  } else {
    caveats.push(
      "Shadbala, the classical strength measure, needs an exact birth time and place, so the weak-planet cautions here fall back on the quicker composite score. They are still worth reading; they are just less precisely graded."
    );
  }

  // --- 7. Adverse yogas already detected ---
  const ADVERSE = ["kemadruma", "shakata", "daridra", "kala-sarpa"];
  for (const y of yogas.filter((y) => ADVERSE.includes(y.key))) {
    const cancelled = y.name.includes("cancelled");
    cautions.push({
      caution: {
        text: `${y.name}: ${y.description.split(". ")[0]}.`,
        weight: cancelled ? -1 : -4,
        source: { work: "classical yoga literature", ref: y.name.replace(" (cancelled)", "") },
      },
      counterMeasure: cancelled
        ? "Your chart already cancels this one, so there is nothing to do beyond knowing it is there."
        : y.key === "kemadruma"
          ? "Build human anchors that do not depend on your mood: a standing weekly commitment with friends, a community you turn up to whether or not you feel like it. This combination is about isolation, and the counter is structural company rather than willpower."
          : y.key === "shakata"
            ? "Bank the good phases. Keep reserves and resist overextending at the peak, because this pattern is a cycle and the turn is part of it — the people it costs are the ones who treat the peak as the new baseline."
            : y.key === "daridra"
              ? "Automate saving so the money leaves before it can be spent, and get income arriving from more than one place. This one responds far better to plumbing than to discipline."
              : "Work with the chapter structure rather than against it: push hard when a door is open, and use the plateaus to consolidate instead of forcing. The flat stretches are doing something, even when it does not feel like it.",
    });
  }

  // --- 8. Adverse dasha windows: both lords functional malefics ---
  // Deliberately NOT age-banded: health and adversity are age-independent, and
  // an elapsed health window is not actionable. This section keeps the rolling
  // forward horizon and never shows a window that has already closed.
  const adverseWindows: TimingWindow[] = [];
  if (dashaTree && chart.birthUtc) {
    const birth = chart.birthUtc;
    const horizon = new Date(now.getTime() + 15 * 365.25 * 86400000);
    for (const md of periodsOverlapping(dashaTree, 1, now, horizon)) {
      for (const ad of md.children ?? []) {
        if (ad.end <= now || ad.start >= horizon) continue;
        const mahaBad = roles.malefics.includes(md.lord);
        const antarBad = roles.malefics.includes(ad.lord);
        if (mahaBad && antarBad) {
          const start = ad.start > now ? ad.start : now;
          const end = ad.end < horizon ? ad.end : horizon;
          adverseWindows.push({
            label: `${PLANET_NAMES[md.lord]}–${PLANET_NAMES[ad.lord]} period`,
            start,
            end,
            grade: "weak",
            confidence: 55,
            reasons: [
              `both period lords (${PLANET_NAMES[md.lord]}, ${PLANET_NAMES[ad.lord]}) are functional malefics for your rising sign — favour consolidation over expansion here`,
            ],
            ageRange: { from: ageYearsAt(birth, start), to: ageYearsAt(birth, end) },
            phase: ad.start > now ? "future" : "current",
          });
        }
      }
    }
    adverseWindows.splice(6); // keep the list actionable
  } else {
    caveats.push(
      "Without a birth time the period-based windows below cannot be computed, so this section reads your chart's standing tendencies only — the timing layer is simply absent rather than weak."
    );
  }

  // Rank the cautions: heaviest first, and cap to keep the section readable.
  cautions.sort((a, b) => a.caution.weight - b.caution.weight);
  const top = cautions.slice(0, 10);

  const netWeight = top.reduce((s, c) => s + c.caution.weight, 0);
  const confidence = Math.max(
    30,
    Math.min(85, 60 + (shadbala ? 10 : -5) + (chart.birthUtc ? 5 : -10))
  );

  return {
    key: "cautions",
    title: "Things to Watch",
    headline:
      top.length === 0
        ? "Nothing structural stands out to warn you about — ordinary prudence is enough for this chart."
        : `${top.length} areas in your chart deserve conscious handling rather than luck. Each one below comes with something practical to do about it, and none of them is a verdict.`,
    score: Math.max(5, Math.min(95, 60 + netWeight)),
    verdict: undefined,
    confidence,
    blocks: [
      {
        heading: "How to read this",
        paragraphs: [
          "These are tendencies, not sentences, and none of them is a verdict on your life. Classical astrology lists them for one reason: so you can steer. That is why every caution below arrives with the thing that actually helps — a caution without a counter-measure is just anxiety with a citation.",
          "Nothing here is medical, legal or financial advice, and none of it should stand in for a professional who can look at your actual situation.",
        ],
      },
    ],
    caveats,
    hasDasha: Boolean(dashaTree && chart.birthUtc),
    cautions: top,
    adverseWindows,
  };
}
