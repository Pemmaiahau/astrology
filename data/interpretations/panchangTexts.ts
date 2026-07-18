/** Practical implications of the five limbs of time at birth. */

/** Tithi groups repeat in cycles of five. */
export const TITHI_GROUP_TEXT: Record<string, string> = {
  Nanda:
    "born on a Nanda tithi — a joy-natured lunar day: sociable, pleasure-affirming temperament that recruits others easily; celebration is a native language.",
  Bhadra:
    "born on a Bhadra tithi — a health-and-work natured day: practical, service-oriented instincts; wellbeing and productivity rise and fall together.",
  Jaya:
    "born on a Jaya tithi — a victory-natured day: competitive spirit that performs best with a visible objective; conflict is metabolised into achievement.",
  Rikta:
    "born on a Rikta tithi — an emptying-natured day: detachment runs in the temperament; excellent for cutting losses and endings, requiring conscious effort at accumulation.",
  Purna:
    "born on a Purna tithi — a fullness-natured day: completion-oriented, generous disposition; projects and relationships are carried to their natural finish.",
};

export function tithiGroup(tithiIndex: number): keyof typeof TITHI_GROUP_TEXT {
  const groups = ["Nanda", "Bhadra", "Jaya", "Rikta", "Purna"] as const;
  return groups[tithiIndex % 5];
}

export const VARA_TEXT: string[] = [
  "Sunday, ruled by the Sun: a sovereignty imprint — vitality, dignity and a constitutional need to matter; authority themes run through the life.",
  "Monday, ruled by the Moon: a receptive imprint — adaptable, nurturing, publicly attuned; the emotional weather is the operating system.",
  "Tuesday, ruled by Mars: a warrior imprint — courage, urgency and technical drive; energy must be pointed at something worthy or it points at someone nearby.",
  "Wednesday, ruled by Mercury: a merchant-scholar imprint — verbal, adaptable, commercially quick; learning and trade are lifelong reflexes.",
  "Thursday, ruled by Jupiter: a counsellor imprint — wisdom-seeking, generous, growth-oriented; teachers and teaching mark the road.",
  "Friday, ruled by Venus: an artist imprint — relational, aesthetic, comfort-literate; harmony is pursued as a life-skill.",
  "Saturday, ruled by Saturn: a karma-yogi imprint — dutiful, enduring, slow-burning; time is an ally once respected.",
];

export const KARANA_TEXT: Record<string, string> = {
  Bava: "Bava karana: constructive, auspicious half-day — a doer's imprint suited to beginnings.",
  Balava: "Balava karana: studious, dharmic imprint — strength through learning and legitimate means.",
  Kaulava: "Kaulava karana: relational imprint — alliances, friendship and popularity carry the work.",
  Taitila: "Taitila karana: pragmatic imprint — steady gains through known, well-trodden channels.",
  Gara: "Gara karana: builder's imprint — agriculture, construction and patient material craft favoured.",
  Vanija: "Vanija karana: merchant's imprint — trade, negotiation and exchange are natural profit centres.",
  Vishti: "Vishti (Bhadra) karana: an obstructive imprint — friction attends beginnings; strategy and timing matter more than force for this native.",
  Shakuni: "Shakuni karana: shrewd, tactical imprint — negotiation, medicine and mantra favoured; guile must be kept ethical.",
  Chatushpada: "Chatushpada karana: grounded imprint — animals, land and foundational matters reward attention.",
  Naga: "Naga karana: intense, serpentine imprint — depth, persistence, and karmic entanglements that resolve through patience.",
  Kimstughna: "Kimstughna karana: auspicious for inner work — an imprint of quiet, concentrated benefic force.",
};

export const YOGA_TEXT: string[] = [
  "Vishkambha — supported obstruction: obstacles early, dominance later; the native outlasts what blocks them.",
  "Priti — affection: a well-liked, harmonising imprint; cooperation comes easily.",
  "Ayushman — longevity: vital endurance and good recuperative capacity.",
  "Saubhagya — good fortune: an auspicious, enjoyment-friendly baseline.",
  "Shobhana — brilliance: lustre, enthusiasm and ceremonial flair.",
  "Atiganda — knots: early friction and hurdles; resilience becomes a signature skill.",
  "Sukarma — good works: merit through right action; ethical labour pays visibly.",
  "Dhriti — steadiness: patience and staying power in the temperament.",
  "Shula — the spear: a piercing, contentious edge; argument and austerity both come naturally.",
  "Ganda — knots again: complications at thresholds; care at beginnings pays disproportionately.",
  "Vriddhi — growth: whatever is tended, grows; a compounding imprint.",
  "Dhruva — fixity: constancy, reliability, slow permanent gains.",
  "Vyaghata — the strike: sudden reversals teach flexibility; crisis-competence develops.",
  "Harshana — delight: cheerfulness and humour as durable assets.",
  "Vajra — the diamond-thunderbolt: hardness of will; brilliant but inflexible moments.",
  "Siddhi — accomplishment: an achievement-friendly imprint; undertakings tend to complete.",
  "Vyatipata — calamity yoga: turbulence at birth-time; remedial devotion traditionally advised, and adaptability becomes armour.",
  "Variyan — comfort: ease-seeking, luxury-friendly disposition.",
  "Parigha — the iron bar: obstruction that trains strategy; success by going around, not through.",
  "Shiva — auspiciousness: calm, benevolent, spiritually tilted baseline.",
  "Siddha — the accomplished: mantra, ritual and skill-mastery are favoured.",
  "Sadhya — the achievable: goals within reach when pursued methodically.",
  "Shubha — the auspicious: general benefic support; health and radiance.",
  "Shukla — the bright: clarity, articulacy and luminous intellect.",
  "Brahma — the creator: sacred knowledge, trustworthiness and gravitas.",
  "Indra — the king: leadership, resourcefulness and command instincts.",
  "Vaidhriti — the divergent: a contrary, powerful imprint; energy misapplied scatters, well-applied transforms.",
];
