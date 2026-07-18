import { PLANETS } from "@/utils/astrology/constants";
import type { PlanetId } from "@/utils/astrology/types";

/**
 * Two-planet conjunction dynamics (35 pairs; Rahu–Ketu cannot conjoin).
 * Keys are canonical: the two ids in PLANETS order joined by '-'.
 * Triple conjunctions are synthesised from their constituent pairs.
 */
export const CONJUNCTION_TEXT: Record<string, string> = {
  "Su-Mo": "Sun–Moon fuses will and feeling into one channel — a self-contained, subjective nature born near the new Moon. Decisiveness is high, but the inner counsel-chamber has one voice; this native benefits enormously from advisors they actually consult.",
  "Su-Ma": "Sun–Mars is a fire alliance of friends: commanding energy, executive courage, a temper with a short fuse and shorter memory. Superb for leadership under pressure; hard on subordinates and blood pressure alike.",
  "Su-Me": "Sun–Mercury (Budhaditya) welds intellect to authority — administrative brilliance and articulate command. When Mercury sits deep in combustion, cleverness serves ego; with distance, it advises it.",
  "Su-Ju": "Sun–Jupiter joins the king and the counsellor: dignified wisdom, ethical authority, teaching power. The native is asked to lead institutions or at least to bless them. Pride in one's principles is the only inflation risk.",
  "Su-Ve": "Sun–Venus pairs sovereign and artist — creative authority, refined presence, romance complicated by pride. Venus close to combustion strains marriage-significations; the remedy is letting the partner shine without auditing the wattage.",
  "Su-Sa": "Sun–Saturn is father and son sharing one room — authority and duty grinding against each other. Early friction with father-figures matures into formidable, sober leadership. Achievement is real; enjoyment of it must be learned separately.",
  "Su-Ra": "Sun–Rahu eclipses the ego periodically: outsized ambition for recognition shadowed by crises of legitimacy. The father-signification carries static. Matured, it gives unconventional authority that rewrites the org chart it was denied a place on.",
  "Su-Ke": "Sun–Ketu quietly detaches the ego from its throne — authority exercised without appetite for it. Identity questions run deep, often father-linked. The strength here is incorruptibility: what this native never craved cannot be used to buy them.",
  "Mo-Ma": "Moon–Mars (Chandra-Mangala) monetises instinct: entrepreneurial reflexes, protective passion, wealth built through decisive emotional intelligence. The same circuitry produces flash-flood tempers — profitable when dammed, destructive when not.",
  "Mo-Me": "Moon–Mercury blends feeling with articulation: persuasive, adaptable, commercially fluent minds. Mercury's enmity toward the Moon shows as overthinking of feelings; journaling and speech turn the churn into product.",
  "Mo-Ju": "Moon–Jupiter is grace upon the mind — optimism, ethical instincts and public trust. A protective combination that softens hardship everywhere it aspects. Its risk is generous complacency: promising the world because the heart genuinely believes in it.",
  "Mo-Ve": "Moon–Venus doubles the water of pleasure: aesthetic sensitivity, social charm, comfort-seeking on silk rails. Emotional and romantic needs intertwine until they are indistinguishable. Creative fields reward this pair richly.",
  "Mo-Sa": "Moon–Saturn chills the inner weather — seriousness, emotional self-rationing, a childhood that taught caution early. Vish-yoga by name, but its mature form is emotional professionalism: this native can hold others' grief without drowning.",
  "Mo-Ra": "Moon–Rahu magnifies the mind's appetites and its static alike — vivid imagination, mass-market intuition, and anxiety that arrives without an invoice. Media instincts are exceptional. Mental hygiene practices are not optional equipment.",
  "Mo-Ke": "Moon–Ketu unplugs the mind from common comforts: intuitive, otherworldly, prone to sudden emotional vacancies. The mother-bond carries karmic residue. Meditation converts the same wiring from dissociation into depth.",
  "Ma-Me": "Mars–Mercury sharpens language into instrument and argument into sport: technical brilliance, debate skill, engineering communication. The enemy-relationship shows as words fired before proofread — the edit button is this native's dharma.",
  "Ma-Ju": "Mars–Jupiter arms wisdom: righteous energy, principled combat, the crusader's combination (Guru-Mangala). Superb for law, defence of the weak, and enterprises requiring moral stamina. Zeal is the only export needing quality control.",
  "Ma-Ve": "Mars–Venus wires passion to aesthetics: magnetic charisma, artistic drive, romance conducted at high voltage. Relationships are pursued and dramatized with equal talent. Craft disciplines (dance, design, surgery) harness the current best.",
  "Ma-Sa": "Mars–Saturn yokes the accelerator to the brake — frustration as a chronic climate, and, matured, the rarest of engines: disciplined aggression. Nothing this native builds under pressure ever falls down. Injuries and grudges heal slowly; both need protocols.",
  "Ma-Ra": "Mars–Rahu is high-octane and unfiltered: explosive courage, technological daring, accident-adjacent ambition. In martial, surgical or startup theatres it is devastatingly effective. Unemployed, it manufactures conflict for the stimulation.",
  "Ma-Ke": "Mars–Ketu fights without a flag: energy applied in bursts toward goals the native cannot always name. Past-life warrior residue shows as instinctive tactical skill and equally instinctive disengagement. Best aimed at technical or spiritual conquest.",
  "Me-Ju": "Mercury–Jupiter joins the analyst to the philosopher: learning as lifestyle, teaching talent, judgment that scales from detail to doctrine. Their mutual tension (student versus tradition) resolves as productive scholarship rather than conflict.",
  "Me-Ve": "Mercury–Venus is the artist-craftsman alliance of friends: verbal charm, commercial creativity, taste with a business model. Media, design, finance and diplomacy all pay this pair. Depth is chosen, not default — pleasant surfaces come too easily.",
  "Me-Sa": "Mercury–Saturn slows thought to load-bearing speed: methodical intellect, legal precision, few words with long warranties. Learning may start late or hard and ends deep. The combination audits everything — including, exhaustingly, itself.",
  "Me-Ra": "Mercury–Rahu turbocharges the signal and the noise: genius for technology, marketing and unconventional analysis, with a susceptibility to clever self-deception. Verify sources, sleep the nervous system, and this is a code-breaking asset.",
  "Me-Ke": "Mercury–Ketu perceives past the syntax: intuitive analysis, mathematical or mystical shortcuts, speech that ends conversations by finishing them. Detail-tracking bores it. Best in research, jyotisha, code and any field where insight outranks paperwork.",
  "Ju-Ve": "Jupiter–Venus seats the two gurus together — wisdom and grace, ethics and art, the counsellor to kings and the counsellor to lovers. Abundant blessings in knowledge, wealth and refinement; their rivalry surfaces only as choosing between principle and pleasure.",
  "Ju-Sa": "Jupiter–Saturn pairs expansion with structure: the institution-builder's conjunction. Slow, ethical, unglamorous accumulation of authority that ends up governing whatever field it entered. Optimism and pessimism alternate until they synchronise as realism.",
  "Ju-Ra": "Jupiter–Rahu (Guru-Chandala) stress-tests belief: unorthodox philosophy, magnified fortune-hunger, teachers who disappoint or liberate. At its best, genuinely original wisdom outside every syllabus; at its worst, principle rented out to ambition.",
  "Ju-Ke": "Jupiter–Ketu distils faith to its concentrate: spontaneous metaphysical insight, disinterest in religious packaging, generosity without ledger. Classical texts call it a moksha combination — the wisdom here is remembered, not acquired.",
  "Ve-Sa": "Venus–Saturn disciplines desire: love delayed, tested or age-gapped; aesthetics stripped to durable elegance. The friendship of these planets means the tests pass — mature, loyal partnerships and wealth through patient craft are the settlement.",
  "Ve-Ra": "Venus–Rahu glamorises appetite: cinematic romance, luxury cravings, magnetic public appeal. The entertainment and beauty industries run on this fuel. Discernment in love is the tax; unpaid, the sweetness ferments.",
  "Ve-Ke": "Venus–Ketu detaches the heart mid-embrace: love alternating between intensity and evaporation, refined tastes with sudden renunciations. Past-life relationship karma completes itself here. Devotional art — where beauty serves the formless — is the reconciliation.",
  "Sa-Ra": "Saturn–Rahu (Shrapit combination in the classics) compounds shadow with structure: chronic pressures, karmic debts surfacing as institutional entanglements, and — once accepted — an unmatched capacity to succeed inside broken systems others flee.",
  "Sa-Ke": "Saturn–Ketu retires the ego's long-term projects: duty performed without attachment, austerity that arrives unforced. Delays feel fated rather than frustrating. This is the renunciate's ledger — closed accounts, no new borrowing.",
};

export function conjunctionKey(a: PlanetId, b: PlanetId): string {
  const ia = PLANETS.indexOf(a);
  const ib = PLANETS.indexOf(b);
  return ia < ib ? `${a}-${b}` : `${b}-${a}`;
}
