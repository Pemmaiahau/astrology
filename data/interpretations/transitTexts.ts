import type { PlanetId } from "@/utils/astrology/types";

/**
 * Gochara (transit) readings for the slow movers, keyed by house from the
 * natal Moon (index = house - 1), per classical Chandra-lagna convention.
 */
export const SATURN_FROM_MOON: string[] = [
  "Saturn over the natal Moon — the peak of Sade Sati. Identity, health and emotional bandwidth are audited simultaneously. Simplify commitments, honour the body's limits, and let this period demolish only what was structurally unsound.",
  "Saturn in the 2nd from Moon — the closing chapter of Sade Sati presses on finances and family speech. Budget conservatively, speak sparingly at home, and settle debts; what survives this audit is genuinely yours.",
  "Saturn in the 3rd from Moon is a supportive transit: courage hardens, rivals tire, and persistent effort finally meets traction. Take on the demanding project — Saturn is briefly on your payroll.",
  "Saturn in the 4th from Moon (Kantaka Shani) presses on home, mother, property and inner peace. Domestic and workplace burdens peak together. Repair foundations literally and emotionally; avoid property gambles.",
  "Saturn in the 5th from Moon tests the heart's departments: children's responsibilities, creative droughts, romance under realism's lamp. Study and disciplined practice are favoured over speculation of every kind.",
  "Saturn in the 6th from Moon is one of its best transits: enemies weaken, debts amortise, chronic health issues become manageable routines. Grind pays visibly — press the advantage in disputes and competition.",
  "Saturn in the 7th from Moon (Kantaka Shani) weighs on partnerships: the marriage or key alliances get load-tested. Renegotiate rather than rupture; commitments that pass this inspection outlast decades.",
  "Saturn in the 8th from Moon (Ashtama Shani) is the deep audit: sudden obligations, health investigations, joint-finance entanglements. Insure, document, and treat the period as maintenance of the hull — no new voyages.",
  "Saturn in the 9th from Moon slows fortune's mail: delays with father, gurus, travel and institutional luck. Faith is stress-tested toward maturity. Fulfil dharmic duties without expecting receipts yet — they arrive in the 11th.",
  "Saturn in the 10th from Moon loads the career yoke: maximum professional demand, visible scrutiny, slow recognition. Work as if under review — because you are — and decline shortcuts; this transit remembers everything.",
  "Saturn in the 11th from Moon is its finest station: gains consolidate, networks mature into assets, long-delayed rewards clear customs. Harvest and bank — this is Saturn repaying documented effort with interest.",
  "Saturn in the 12th from Moon opens Sade Sati's first act: expenses climb, sleep thins, distant matters demand energy. Close draining commitments early, build reserves, and begin the inner housekeeping the next seven years will grade.",
];

export const JUPITER_FROM_MOON: string[] = [
  "Jupiter over the natal Moon inflates confidence and appetite alike. Blessings flow to self-image and new beginnings, but guard against over-commitment dressed as optimism.",
  "Jupiter in the 2nd from Moon is a wealth transit of the first rank: income, family fortunes and persuasive speech all expand. Invest in what compounds.",
  "Jupiter in the 3rd from Moon is classically muted: initiatives feel heavier than they should. Use it for study and sibling repair; postpone launches to a better station.",
  "Jupiter in the 4th from Moon blesses home, property, vehicles and the mother — domestic expansion in every register. A favoured window for real estate and reconciliation.",
  "Jupiter in the 5th from Moon is among the finest transits: children, creativity, romance, mantra-siddhi and honest speculation all receive grace. Conceive projects — and possibly heirs.",
  "Jupiter in the 6th from Moon sits low: health niggles, service burdens and quiet erosion of optimism. Serve, heal, and pay down obligations; expansion resumes on schedule next year.",
  "Jupiter in the 7th from Moon graces partnership: marriages form or mend, alliances bring fortune, and public dealings meet goodwill. Negotiate everything important now.",
  "Jupiter in the 8th from Moon expands the hidden ledger: inheritance, insurance and research gain, while vitality and reputation want conservative handling. Depth work over display.",
  "Jupiter in the 9th from Moon is the dharma jackpot: gurus appear, fortune compounds, journeys enlighten, father-figures bless. The single best window for higher study and pilgrimage.",
  "Jupiter in the 10th from Moon is classically mixed — career visibility rises while inner satisfaction lags. Accept the promotion but audit the ethics of every shortcut offered with it.",
  "Jupiter in the 11th from Moon opens the gain-gates: income, networks, elder-sibling fortunes and wish-fulfilment expand together. Ask for what you want — the answer skews yes.",
  "Jupiter in the 12th from Moon spends grace privately: charity, foreign matters, retreats and sleep improve; liquid gains defer. Fund the inner life — the outer resumes when Jupiter crosses your Moon.",
];

export const RAHU_FROM_MOON: string[] = [
  "Rahu over the natal Moon amplifies ambition and anxiety in the same current. Public image inflates; mental hygiene must be deliberate. Big swings, both directions.",
  "Rahu in the 2nd from Moon destabilises then re-engineers finances and family speech. Unconventional income appears; verify every document twice.",
  "Rahu in the 3rd from Moon supercharges daring: media, marketing and bold ventures pay. Courage is cheap fuel now — spend it on legitimate targets.",
  "Rahu in the 4th from Moon unsettles home and heart: relocations, property fog, maternal concerns. Anchor daily routines; defer emotional verdicts until the fog lifts.",
  "Rahu in the 5th from Moon intoxicates romance, speculation and politics. Creative originality peaks; gambling — financial or romantic — carries hidden margin calls.",
  "Rahu in the 6th from Moon is Rahu deployed: rivals collapse through their own overreach, and unconventional methods clear debts and diagnoses. A winning transit for competition.",
  "Rahu in the 7th from Moon glamorises and fogs partnership: exotic connections, contractual ambiguity. Every alliance formed now needs daylight and paperwork.",
  "Rahu in the 8th from Moon excavates: sudden events, occult pulls, joint-finance turbulence. Research and crisis-management skills appreciate; speculative depth-charges do not.",
  "Rahu in the 9th from Moon disrupts inherited belief: foreign teachers, unorthodox philosophy, fortune through the unconventional. Test every new guru against their own conduct.",
  "Rahu in the 10th from Moon is the fame accelerant: sudden visibility, technological career pivots, mass reach. Build the ethical guardrails before the audience arrives.",
  "Rahu in the 11th from Moon is materially voracious and largely successful: gains through platforms, networks and appetite. Bank the windfalls — Rahu's gifts prefer motion.",
  "Rahu in the 12th from Moon dissolves boundaries: foreign shores, hidden expenses, vivid dream-static. Guard sleep and subscriptions; fund genuine retreat over escapism.",
];

export const KETU_FROM_MOON: string[] = [
  "Ketu over the natal Moon vacuums emotional certainty: detachment arrives unrequested. Meditation converts the hollow into depth; distraction converts it into drift.",
  "Ketu in the 2nd from Moon loosens the grip on money and family narrative. Losses tend to be of things already outgrown. Speak less; the silence is doing work.",
  "Ketu in the 3rd from Moon gives headless courage — effort without appetite for applause. Technical and spiritual skills sharpen quietly. Sibling threads from the past resurface to be cut or blessed.",
  "Ketu in the 4th from Moon unroots comfort: home feels provisional, the past calls in dreams. Excellent for inner-life renovation; postpone verdicts on where you belong.",
  "Ketu in the 5th from Moon abstracts the heart: romance puzzles, children need subtle attention, and intuition outruns analysis. Mantra and jyotisha studies flourish; speculation starves.",
  "Ketu in the 6th from Moon quietly dissolves enemies and ailments — conflicts evaporate mid-sentence. Diagnostic mysteries respond to alternative approaches. A stealth-blessing transit.",
  "Ketu in the 7th from Moon detaches partnership scripts: relationships are audited for karmic completion. What remains after this transit is genuinely chosen.",
  "Ketu in the 8th from Moon opens trapdoors to depth: sudden endings, occult perception, research breakthroughs. Fear evaporates where it is faced directly.",
  "Ketu in the 9th from Moon composts old beliefs: disillusion with packaged dharma, real contact with the unpackaged kind. Let the framework fall; keep the faith.",
  "Ketu in the 10th from Moon detaches career from identity: recognition matters less, mastery more. Ideal for technical depth and terrible for status campaigns.",
  "Ketu in the 11th from Moon prunes the network and the wish-list together. Gains arrive through odd channels; desires examined closely tend to resign. Freedom is the dividend.",
  "Ketu in the 12th from Moon is a moksha window: solitude sweetens, foreign or ashram threads pull, sleep carries instruction. The most meditation-productive transit in its cycle.",
];

export const TRANSIT_TABLES: Partial<Record<PlanetId, string[]>> = {
  Sa: SATURN_FROM_MOON,
  Ju: JUPITER_FROM_MOON,
  Ra: RAHU_FROM_MOON,
  Ke: KETU_FROM_MOON,
};

/** Behavioural themes of each planet as a running dasha lord. */
export const DASHA_THEMES: Record<PlanetId, string> = {
  Su: "Sun periods centre authority, visibility, government dealings, the father, and the consolidation of identity. Health of heart, eyes and bones comes forward. The native is pushed onto stages — preparation determines whether that is promotion or exposure.",
  Mo: "Moon periods run on emotional currents: home, mother, public connection and frequent change of scene. Receptivity is high, and so is impressionability. Ventures touching the public — food, care, media, water — carry the period's best cargo.",
  Ma: "Mars periods ignite action: property, litigation, competition, surgery, sport and command. Energy arrives in surges that demand worthy targets. Accidents and disputes cluster where impulse goes unsupervised.",
  Me: "Mercury periods busy the calendar with commerce, communication, study, documentation and travel. Multiple income streams and multiple browser tabs. The nervous system is the period's working capital — protect it with routine.",
  Ju: "Jupiter periods expand whatever they touch: wisdom, wealth, children, teachers, faith and girth. Doors open through counsel and reputation. The single caution is over-extension blessed by optimism.",
  Ve: "Venus periods sweeten the ledger: relationships, luxury, arts, vehicles and negotiated wealth flow forward. Marriage and partnership matters mature. Overindulgence is the period's only tax collector.",
  Sa: "Saturn periods slow the film and raise the weights: duty, structure, chronic matters and long-postponed dues all present invoices. What is built now is built permanently. Health of joints, teeth and morale needs scheduled maintenance.",
  Ra: "Rahu periods accelerate ambition beyond the speed limit: foreign matters, technology, mass platforms, unconventional gains — and periodic fog banks of confusion or scandal. Verify everything; ride the wave with a keel of ethics.",
  Ke: "Ketu periods unplug the story: detachment, endings, spiritual openings and research depths. Material outcomes turn erratic while inner outcomes compound. The period rewards surrender and punishes grasping with unusual precision.",
};
