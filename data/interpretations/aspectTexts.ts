import type { PlanetId } from "@/utils/astrology/types";

/**
 * Graha drishti readings: what each planet's aspect does to each of the twelve
 * houses. 9 planets × 12 houses = 108 curated paragraphs, mirroring the shape
 * and voice of PLANET_IN_HOUSE — this is the content surface for "a planet
 * influences a house without occupying it", which is how the classics judge
 * every vacant house and how they qualify every occupied one.
 *
 * Index is house − 1. These paragraphs describe the aspect in the abstract;
 * synthesis.ts layers the aspecting planet's own dignity, its functional role
 * for the Lagna, and which drishti actually landed (see DRISHTI_CHARACTER) on
 * top of them.
 */
export const ASPECT_ON_HOUSE: Record<PlanetId, string[]> = {
  Su: [
    "The Sun's gaze on the Lagna lends the constitution heat, visibility and a spine that does not bend easily; the native is seen wherever they stand. It also dries the body's reserves — vitality runs hot and needs deliberate cooling.",
    "Sunlight on the 2nd dignifies speech and gives command over family resources, often through government, authority or the father's line. Wealth arrives with status attached, though pride can make the voice imperious and the accumulation ostentatious.",
    "The Sun's aspect on the 3rd steels courage and gives initiative that others follow; skills are pursued for recognition as much as for mastery. Younger siblings may live in the native's shade or compete with it.",
    "The Sun's glance on the 4th brings prestige to the home and property held in the native's own name, but it heats the domestic atmosphere: there is an authority in the house and a certain absence of softness. The mother's significations bear the father's or the state's imprint.",
    "Sunlight on the 5th dignifies intelligence and gives creative authority — this mind wants a platform, not a notebook. Children are a source of pride and, sometimes, of pressure to be worthy of the name.",
    "The Sun's aspect on the 6th is among its cleanest: it burns off enemies, wins litigation, and gives the constitution the heat to throw off illness. Service is rendered from a position of command rather than subordination.",
    "The Sun's gaze on the 7th brings a distinguished, capable partner and public dealings conducted with visible authority. The same heat can crowd the marriage — two sovereigns, one throne — and the partnership prospers only once the native learns to share the light.",
    "The Sun's aspect on the 8th illuminates what is usually hidden: research capacity, interest in the mechanics of transformation, and legacy or inheritance matters that surface publicly. Longevity is supported, though the vital fire can flare in sudden crises.",
    "Sunlight on the 9th strengthens dharma, fortune and the father-signification, granting a natural relationship to teachers, doctrine and purposeful long journeys. Conviction is the strength; certainty is the risk.",
    "The Sun's glance on the 10th is career-defining: status, visibility and authority in the public karma, with government, leadership or institutional recognition following. This native is unlikely to work in obscurity.",
    "The Sun's aspect on the 11th brings gains through authority and influential networks, often via the father's or the state's channels. Ambitions are large and largely fulfilled; friendship, however, is conducted at a slight elevation.",
    "The Sun's gaze on the 12th spends the ego's fuel on distant, private or institutional ends — foreign work, seclusion, hospitals, or genuine spiritual withdrawal. Expenditure is dignified rather than wasteful, but vitality and sleep need guarding.",
  ],
  Mo: [
    "The Moon's gaze on the Lagna gives an approachable, responsive temperament and a face people find easy to trust; the body and the mood, however, run on tides rather than on a schedule.",
    "The Moon's aspect on the 2nd softens speech into persuasion and ties wealth to emotional security — savings rise and fall with the native's state of mind. Family bonds, especially maternal ones, are the real inheritance here.",
    "Moonlight on the 3rd makes communication warm and instinctive and courage emotional rather than calculated; the native acts when moved. Siblings are close, and short journeys are undertaken on impulse.",
    "The Moon's glance on the 4th is its own ground by signification: domestic contentment, a nourishing mother-bond, property that genuinely feels like shelter. The interior life is rich, and its weather is felt by everyone in the house.",
    "The Moon's aspect on the 5th gives an imaginative, receptive intelligence and real tenderness toward children; creativity flows from feeling rather than technique. Romance is idealised and re-idealised.",
    "The Moon's gaze on the 6th makes health responsive to mood and gives genuine compassion in service — this native cares for people rather than processing them. Enemies are handled by absorption rather than confrontation, which works until it does not.",
    "Moonlight on the 7th gives a caring, emotionally attuned partnership and public dealings that read the room accurately. Dependency is the risk: the native's inner weather can end up outsourced to the partner.",
    "The Moon's aspect on the 8th opens intuitive access to the hidden — psychology, the occult, other people's inner lives — with a sensitivity to crisis that can either heal or flood. Inherited and in-law resources carry feeling, not just value.",
    "The Moon's glance on the 9th makes faith a felt thing rather than a doctrine; the native is drawn to teachers who move them and to journeys taken for the heart's reasons. Fortune arrives through the goodwill of women and elders.",
    "Moonlight on the 10th gives a public-facing career with genuine popular appeal — the reputation rests on how people feel about this native. Work touching the public, care, food, liquids or the mind prospers; consistency of output is the discipline to build.",
    "The Moon's aspect on the 11th builds income through networks that are personal before they are professional, and gains that ebb and flow with the native's circle. Desires are many and sincerely felt.",
    "The Moon's gaze on the 12th draws the mind inward and often abroad — imagination, sleep, private devotion and foreign shores all pull. Emotional expenditure needs a container, or the interior life quietly drains.",
  ],
  Ma: [
    "Mars's drishti on the Lagna gives physical courage, a competitive edge and a body built for exertion, along with a temper that arrives before the reasoning does. Scars, literal and otherwise, are collected early.",
    "Mars's aspect on the 2nd sharpens speech into a weapon and makes wealth something to be fought for and defended rather than inherited. Family relations carry friction; the tongue needs a guard rail.",
    "Mars on the 3rd is one of its best glances: raw courage, technical skill, physical stamina, and self-effort that actually converts into results. Rivalry with siblings is likely and, handled well, formative.",
    "Mars's aspect on the 4th disturbs the home's peace — a heated domestic atmosphere, property acquired or held through dispute, and a restlessness that resists settling. It does give real capacity with land, machinery and construction.",
    "Mars's glance on the 5th makes intelligence tactical and competitive, and romance a pursuit rather than a drift. Children are spirited; the native's own discipline with them decides whether that becomes strength or conflict.",
    "Mars on the 6th is a fighter's placement in the fighter's house: enemies are defeated, litigation is won, debts are attacked head-on, and the constitution has the heat to recover fast. Injury and inflammation are the standing risk.",
    "Mars's aspect on the 7th brings passion and friction into marriage in equal measure — a spirited partner, decisive business alliances, and a standing need to distinguish intensity from conflict. This is the classical Kuja influence on partnership, and it asks for maturity before commitment.",
    "Mars's glance on the 8th gives surgical capacity, courage in crisis and interest in what lies beneath — but it also makes transformations abrupt. Accidents, surgery and sudden reversals feature; longevity holds once the native stops treating risk as recreation.",
    "Mars's aspect on the 9th makes dharma a cause worth defending: principled combat, a militant relationship to belief, and long journeys undertaken with a mission. Friction with the father or the guru is common and eventually productive.",
    "Mars on the 10th carries its directional strength by signification: driving ambition, executive force, and a career built on decisive action — defence, surgery, engineering, sport, enterprise. Authority is seized rather than awaited, and subordinates feel the heat.",
    "Mars's aspect on the 11th makes gains the product of campaigns and networks the product of alliances. Income responds to aggression; elder siblings are strong presences — allies or rivals, sometimes both.",
    "Mars's gaze on the 12th burns resources in hidden places: expenditure on disputes, secret enemies, or exertion abroad. Well directed, it is the energy of the person who works hard where no one is watching; poorly directed, it is sleep lost to unfinished fights.",
  ],
  Me: [
    "Mercury's gaze on the Lagna gives a youthful, quick-witted presence and a nervous system that runs on information; the native is articulate long before they are settled. Adaptability is the strength, dispersion the risk.",
    "Mercury's aspect on the 2nd is the merchant's glance: fluent speech, commercial instinct, and wealth accumulated through trade, communication or intermediation. The family conversation is a clever one.",
    "Mercury on the 3rd doubles its own ground — skills, writing, media, short journeys and dexterous hands. Siblings are close and communicative, and the native's self-effort takes the form of learning.",
    "Mercury's aspect on the 4th brings books, conversation and mental activity into the home, and often property dealt with commercially. Domestic contentment depends on the mind being engaged, not just the heart.",
    "Mercury's glance on the 5th gives analytical intelligence, aptitude for mathematics, speculation and games of skill, and children who are bright and talkative. Romance is conducted through wit.",
    "Mercury on the 6th sharpens the handling of debts, contracts, litigation and daily systems — administrative competence in the house that most rewards it. Nervous complaints and overthinking are the health signature.",
    "Mercury's aspect on the 7th gives a communicative, youthful partner and real talent for negotiation, agency and business alliance. Partnerships are talked into being and, occasionally, talked out of it.",
    "Mercury's glance on the 8th gives an investigative mind — research, forensics, jyotisha, insurance, taxation, anything requiring the reading of hidden ledgers. In-law and inheritance matters come with paperwork.",
    "Mercury's aspect on the 9th makes higher learning systematic and doctrine something to be examined rather than swallowed; the native studies the tradition and then questions it. Teaching, publishing and scholarly travel are favoured.",
    "Mercury on the 10th gives a career built on intellect and communication — commerce, writing, analysis, brokerage, teaching, technology. Status comes from being the person who explains things, and the reputation is portable.",
    "Mercury's aspect on the 11th builds income through networks, information and intermediation; gains multiply through many small channels rather than one large one. The friend circle is wide, young and useful.",
    "Mercury's gaze on the 12th sends the intellect into private, foreign or research-bound territory — the scholar's cell, the offshore contract, the mind that works best unobserved. Nervous rest matters more here than the native usually admits.",
  ],
  Ju: [
    "Jupiter's drishti on the Lagna is among the finest protections in a chart: an optimistic, ethical temperament, a well-made body, and a habit of landing on one's feet. Weight, literal and metaphorical, is the only excess.",
    "Jupiter's aspect on the 2nd blesses wealth, family and speech together — resources accumulate, the family supports, and the native is believed when they speak. Generosity outruns budgeting.",
    "Jupiter's glance on the 3rd raises courage into principle and communication into teaching; skills are pursued for their meaning. Siblings are a source of support rather than rivalry.",
    "Jupiter's aspect on the 4th is a genuine blessing on the foundations: a peaceful home, a benevolent mother, property that arrives without struggle, and inner contentment that survives external weather. Education is well supported.",
    "Jupiter on the 5th is its own best signification — wisdom, sound counsel, children who are a blessing, and purva-punya that pays out in this life. Intelligence is broad rather than narrow, and the native teaches naturally.",
    "Jupiter's aspect on the 6th softens the house of trouble: enemies lose their appetite, litigation settles, debts stay manageable, and recovery from illness is good. The one caution is complacency — about health and about opponents.",
    "Jupiter's glance on the 7th is the classical protection of marriage: a principled, often wiser or older partner, ethical business alliances, and public dealings conducted in good faith. It steadies partnerships that other influences would strain.",
    "Jupiter's aspect on the 8th grants longevity, an easy relationship with mortality, and blessings through inheritance, in-laws or other people's resources. Occult and philosophical study is genuinely fruitful here.",
    "Jupiter on the 9th is the guru in the house of the guru: fortune, dharma, higher learning, a benevolent father, and long journeys that enlarge the native. Faith here is both inherited and earned.",
    "Jupiter's aspect on the 10th gives an ethical, respected career with advisory or institutional weight — the native is trusted with other people's decisions. Advancement comes through reputation more than manoeuvre.",
    "Jupiter's glance on the 11th expands gains and fills the network with people of standing; income grows steadily and desires are largely fulfilled. The risk is a portfolio inflated by optimism.",
    "Jupiter's aspect on the 12th makes expenditure meaningful — charity, pilgrimage, foreign study, real spiritual practice — and protects the native in hospitals, in exile and in sleep. The classics count this among the best of the 12th's influences, since it converts loss into liberation.",
  ],
  Ve: [
    "Venus's gaze on the Lagna gives personal charm, a pleasing appearance and an instinct for comfort; people warm to this native before they know why. Ease is the gift and, taken too far, the trap.",
    "Venus's aspect on the 2nd brings sweetness to speech and refinement to what is accumulated — wealth through art, luxury, beauty or partnership, and a pleasant family life. Indulgence in food and finery is the standing expense.",
    "Venus's glance on the 3rd makes communication graceful and skills artistic — music, design, performance, writing that pleases. Courage is diplomatic rather than confrontational; siblings, especially sisters, are close.",
    "Venus on the 4th gives a beautiful, comfortable home, vehicles and property acquired with taste, and an affectionate mother-bond. Domestic contentment is high; this native furnishes their peace as much as feels it.",
    "Venus's aspect on the 5th brings romance, artistic creativity and pleasure in children; the intelligence is aesthetic and the heart is easily engaged. Love affairs are a genuine theme, not an incidental one.",
    "Venus's glance on the 6th softens conflict — enemies are disarmed rather than defeated, disputes settle amicably, and service is rendered with grace. Health issues, when they come, tend toward the kidneys, sugar and the reproductive system.",
    "Venus on the 7th is the karaka aspecting the house it signifies: an attractive partner, harmonious marriage, and real talent for alliance and public dealing. Only its own excess — wanting to be pleased — unsettles this.",
    "Venus's aspect on the 8th brings gain through the partner's or others' resources, an interest in the esoteric side of love, and longevity supported by an appetite for living. Secret attachments are a recurring theme.",
    "Venus's glance on the 9th makes dharma aesthetic and fortune generous: travel for beauty and pleasure, a cultured father or guru, and a philosophy with room in it for joy. Foreign cultures attract.",
    "Venus's aspect on the 10th gives a career in beauty, art, media, luxury, diplomacy or partnership-based business, and a public image people find agreeable. Status is achieved with charm rather than force.",
    "Venus on the 11th brings gains through women, art, luxury and social connection; the network is wide, pleasant and profitable, and desires are fulfilled comfortably. Elder siblings are supportive.",
    "Venus's aspect on the 12th spends on comfort, beauty and private pleasures, and gives the classical blessing on the 12th's own significations — bed comforts, foreign residence, and the surrender that mature devotion requires. Discretion is the discipline.",
  ],
  Sa: [
    "Saturn's drishti on the Lagna sobers the temperament and slows the body's early flowering; the native seems older than their years and comes into their own late. What is built on this foundation does not fall down.",
    "Saturn's aspect on the 2nd disciplines wealth and speech alike — accumulation is slow, deliberate and permanent; words are few and load-bearing. Early family life carries constraint, later provision is secure.",
    "Saturn's glance on the 3rd converts courage into endurance: this native outlasts rather than outcharges. Effort is sustained over years and skills are mastered by repetition, while relations with siblings carry distance or duty.",
    "Saturn's aspect on the 4th chills the domestic foundations — an austere or burdened home, a mother carrying weight, property that comes late and through labour. Inner contentment is achieved, not received.",
    "Saturn's glance on the 5th delays and disciplines the 5th's promises: children come late or few, romance is serious, and intelligence is deep rather than quick. Purva-punya here is a debt repaid before it is drawn on.",
    "Saturn on the 6th is strong by signification: chronic enemies wear down, litigation is won by persistence, debts are serviced methodically, and daily discipline is genuinely available. Chronic rather than acute ailments are the health signature.",
    "Saturn's aspect on the 7th delays marriage, ages or sobers the partner, and makes partnership a matter of duty and durability rather than romance. What survives the delay tends to last for life.",
    "Saturn's glance on the 8th is the classical support for long life — slow, chronic processes rather than sudden ones, and a serious, patient capacity for occult and research work. Inheritance and shared resources arrive late and with conditions attached.",
    "Saturn's aspect on the 9th makes dharma a discipline rather than an inheritance: faith is tested, the father-signification carries distance or duty, and the guru is a hard taskmaster. Conviction here is earned and therefore holds.",
    "Saturn on the 10th carries its directional strength by signification, and is one of the strongest career glances in the chart: authority through service, seniority through endurance, and a reputation for reliability that compounds. Advancement is slow and essentially irreversible.",
    "Saturn's aspect on the 11th makes gains slow but cumulative and the network older, professional and useful — income from labour, systems, property or long-held positions. Elder siblings carry weight or distance.",
    "Saturn's glance on the 12th disciplines expenditure and gives real capacity for solitude, ascetic practice, and work inside institutions, hospitals or foreign postings. Sleep and isolation both need managing; the moksha significations are genuinely accessible.",
  ],
  Ra: [
    "Rahu's drishti on the Lagna amplifies the persona and blurs its edges: unusual magnetism, an unconventional self-presentation, and an identity assembled rather than inherited. Other people's projections stick to this native easily.",
    "Rahu's aspect on the 2nd creates hunger around wealth, family and speech — accumulation is driven, sometimes through unorthodox or foreign channels, and the voice can persuade past the facts. Family history carries something unresolved.",
    "Rahu's glance on the 3rd gives outsized ambition and boldness in self-effort, talent for media, technology and mass communication, and courage bordering on recklessness. Sibling relations are complicated or distant.",
    "Rahu's aspect on the 4th unsettles the foundations — a foreign or unconventional home, restlessness about property, and a mother-signification carrying static. Inner peace is a project here, not a starting condition.",
    "Rahu's glance on the 5th makes intelligence unconventional and speculative, romance intense and rule-breaking, and matters of children a site of either delay or unusual circumstance. Speculation attracts, and must be governed.",
    "Rahu on the 6th is one of its genuinely strong glances: enemies are overwhelmed, competition is relished, and the native prospers in litigation, service and the messier arenas others avoid. Diagnoses can be obscure.",
    "Rahu's aspect on the 7th brings an unconventional, foreign or socially unexpected partner, and intense, sometimes destabilising public dealings. Marriage asks for clear eyes — the fascination here is not the same thing as compatibility.",
    "Rahu's glance on the 8th opens the occult wide: real research capacity, interest in taboo and hidden mechanics, and sudden events that arrive without warning. In-law and inheritance matters carry entanglement.",
    "Rahu's aspect on the 9th unsettles inherited belief — unorthodox philosophy, foreign gurus, and a dharma the native has to build rather than receive. The father-signification carries distance or disruption.",
    "Rahu on the 10th is powerfully ambitious: unconventional careers, foreign or technological fields, and a rise that can outpace its own foundations. The reputation grows large and needs tending.",
    "Rahu's aspect on the 11th is classically excellent for gains — large, unusual, foreign-sourced income and a network far beyond the native's origins. Desires, however, refill as fast as they are met.",
    "Rahu's glance on the 12th points the life abroad and inward at once: foreign residence, large or opaque expenditure, hidden adversaries, and — properly directed — unusually deep meditative access. Sleep stays disturbed until the appetite is.",
  ],
  Ke: [
    "Ketu's drishti on the Lagna gives a detached, self-contained presence and a body the native does not much identify with; there is an otherworldliness people notice. Doubt about who one actually is remains the working difficulty.",
    "Ketu's aspect on the 2nd loosens attachment to wealth and family — resources come and go without gripping the native, and speech is spare and occasionally cutting. Dietary restriction and family distance both feature.",
    "Ketu's glance on the 3rd makes courage sporadic but instinctive: this native acts decisively in flashes and disengages between them. Skills are picked up intuitively; sibling ties are karmically loose.",
    "Ketu's aspect on the 4th empties the home of easy comfort — emotional self-sufficiency, indifference to property, and a mother-bond carrying past-life residue. The interior life turns naturally toward practice.",
    "Ketu's glance on the 5th gives intuitive, non-linear intelligence and a spiritual bent to creativity, alongside karmic complications around children or a romance that dissolves rather than concludes. Mantra and technical study both come easily.",
    "Ketu on the 6th is among its best glances: enemies simply fall away, debts resolve, and the native has an instinctive diagnostic gift in health and service. The ailments themselves can be hard to name.",
    "Ketu's aspect on the 7th introduces detachment into partnership — a spiritually inclined or distant partner, or a marriage the native is present for without being attached to. Public dealings are conducted without appetite for approval.",
    "Ketu's glance on the 8th is the moksha-karaka in the moksha house: genuine occult aptitude, ease with mortality and transformation, and sudden events that feel fated rather than accidental. Research runs deep.",
    "Ketu's aspect on the 9th detaches the native from inherited religion while deepening the actual practice — the form is discarded, the substance kept. The father or guru may be absent, renunciate, or simply outgrown.",
    "Ketu on the 10th gives a career pursued without hunger for its rewards, often technical, healing or spiritual, and a public standing the native is oddly indifferent to. Ambition arrives late, if at all, and the work is better for it.",
    "Ketu's aspect on the 11th thins the network to a few real connections and makes gains erratic — money arrives when needed rather than when pursued. Desires themselves lose their grip, which the native may mistake for failure.",
    "Ketu's glance on the 12th is its most natural station: expenditure that quietly serves liberation, ease in solitude and in foreign lands, a vivid inner life in sleep. Among all the aspects, this is the strongest single indicator of moksha-orientation.",
  ],
};

/**
 * Which drishti actually landed. The special aspects differ in character from
 * the universal 7th and from each other — Saturn's 3rd grinds where its 7th
 * blocks outright, Jupiter's 9th blesses more freely than its 5th — so the
 * offset is reported, not just the fact of an aspect.
 */
export const DRISHTI_CHARACTER: Partial<Record<PlanetId, Record<number, string>>> = {
  Ma: {
    4: "its fourth drishti, Mars at close range and the most disruptive of its three aspects",
    7: "its full seventh drishti, direct and unavoidable",
    8: "its eighth drishti, the sudden and wounding one that arrives without notice",
  },
  Ju: {
    5: "its fifth drishti, Jupiter's blessing on intelligence, counsel and progeny",
    7: "its full seventh drishti, Jupiter's direct protection",
    9: "its ninth drishti, the blessing on fortune and dharma and the most benevolent aspect in the chart",
  },
  Sa: {
    3: "its third drishti, Saturn's grinding aspect, which wears down rather than blocks outright",
    7: "its full seventh drishti, Saturn's direct weight and the one that delays",
    10: "its tenth drishti, the aspect of imposed duty and scrutiny",
  },
  Ra: {
    5: "its fifth drishti, Rahu's amplification of intelligence and desire",
    7: "its full seventh drishti, Rahu's direct and obsessive aspect",
    9: "its ninth drishti, Rahu's distortion of inherited fortune and belief",
  },
  Ke: {
    5: "its fifth drishti, Ketu's dissolving touch on intelligence and progeny",
    7: "its full seventh drishti, Ketu's direct detachment",
    9: "its ninth drishti, Ketu's refinement of dharma and fortune",
  },
};

/** Phrase naming the specific glance that landed; falls back to the universal 7th. */
export function drishtiCharacter(from: PlanetId, offset: number): string {
  return DRISHTI_CHARACTER[from]?.[offset] ?? "its full seventh drishti";
}
