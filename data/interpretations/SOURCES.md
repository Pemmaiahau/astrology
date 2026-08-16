# Classical Sources & Rule Audit

Every interpretive rule in this app traces to a classical source or is explicitly
labelled a modern synthesis. Citation policy: **work + chapter/topic only when
verified; never a fabricated verse number.** Where a chapter is named, the
reference follows the topic organisation common to the Santhanam and Sharma
translations of BPHS (their chapter *numbers* differ between editions, so rules
cite the adhyaya by subject, not number).

Abbreviations: **BPHS** = Brihat Parashara Hora Shastra.

## Module → rules → sources

| Module | Rule | Source |
|---|---|---|
| `utils/astrology/varga.ts` | All sixteen varga definitions (D-1…D-60), incl. odd/even rules for Hora, Saptamsa, Dasamsa; movable/fixed/dual starts for D-16/20/45; elemental starts for D-27; unequal Trimsamsa; D-60 half-degree count | BPHS, Shodasavarga adhyaya |
| | Vimshopaka weight tables (Shad/Sapta/Dasha/Shodasha-varga, each totalling 20) and the 20/18/15/10/7/5-twentieths dignity grading | BPHS, Vimshopaka bala adhyaya |
| | Vargottama (same sign in D-1 and D-9) | BPHS / Brihat Jataka (standard rule) |
| `utils/astrology/shadbala.ts` | Six-fold scheme: Sthana (Uchcha, Saptavargaja, Ojha-Yugma, Kendradi, Drekkana), Dig, Kala (Nathonnatha, Paksha, Tribhaga, Abda/Masa/Vara/Hora, Ayana, Yuddha), Cheshta, Naisargika, Drik; rupas; minimum-requirement table (Su 390 … Sa 300 virupas); Ishta/Kashta | BPHS, Shadbala adhyaya (values as tabulated in B.V. Raman, *Graha and Bhava Balas*) |
| | Sputa-drishti piecewise virupa curve + special-aspect bonuses | BPHS, drishti chapters (implementation variants exist; see disagreement log) |
| | Bhava Bala: Bhavadhipati + Bhava Dig (60 − 10/house from the strong house) + Bhava Drishti | BPHS Bhava-bala adhyaya; graded dig-bala per Raman, *Graha and Bhava Balas* |
| `utils/astrology/jaimini.ts` | Chara karakas (7-scheme, by descending degree), Karakamsa, Arudha rule with the 1st/7th → 10th exception, Upapada (arudha of the 12th), Argala from 2/4/11 with virodha from 12/10/3 | Jaimini Upadesa Sutras, Adhyaya 1; BPHS Karakadhyaya / Padadhyaya |
| | Double-transit (Saturn+Jupiter) activation gate | **Modern applied-Parashari synthesis**, not a classical sutra — labelled as such in code |
| `utils/astrology/yogas.ts` | Neechabhanga, Vipareeta (Harsha/Sarala/Vimala), Gajakesari, Budhaditya, Chandra-Mangala, Pancha Mahapurusha, Yogakaraka | BPHS yoga chapters / Phaladeepika (pre-existing detectors) |
| | Raja Yoga (kendra-lord + trikona-lord association by conjunction/mutual aspect/exchange) | BPHS, Raja Yoga adhyaya |
| | Dhana Yogas (2nd–11th lord links; trine-lord links to the wealth axis), Lakshmi Yoga | BPHS, Dhana Yoga adhyaya |
| | Kemadruma (bare 2nd/12th-from-Moon rule) + reported cancellations | Standard Chandra-yoga literature (Phaladeepika tradition) |
| | Shakata, Daridra, Amala | Phaladeepika / standard yoga literature |
| | Kala Sarpa (all seven within the nodal axis) | **Later tradition**, not in BPHS — presented with that framing in the prose |
| `data/interpretations/career.ts` | Profession judged from the 10th lord counted from Lagna, Moon AND Sun | Phaladeepika, karmajiva chapter |
| | D-10 Dasamsa for career; Amatyakaraka | BPHS Shodasavarga adhyaya; Jaimini Upadesa Sutras |
| | Per-planet profession lists | Consensus significations across BPHS / Phaladeepika / Brihat Jataka (work-level) |
| | 6th = service vs 7th = business balance | Standard house significations (BPHS house chapters) |
| `data/interpretations/wealth.ts` | Dhana houses 2/5/9/11 (+10, 6, 8, 4, 12 supporting); D-2 Hora (Sun's hora = self-earned, Moon's = accumulation) | BPHS Dhana Yoga adhyaya; Shodasavarga adhyaya (Hora) |
| `data/interpretations/marriage.ts` | 7th house/lord; Venus as kalatra karaka; Jupiter additionally for female charts | BPHS / Phaladeepika marriage chapters; Saravali tradition (Jupiter for female charts) |
| | Upapada and its lord's dignity for the standing of the union | Jaimini Upadesa Sutras / BPHS Padadhyaya |
| | Navamsa lagna lord, 7th-of-D9, Venus-in-D9 | BPHS Shodasavarga adhyaya |
| | Mangal Dosha (houses 1/4/7/8/12 from Lagna and Moon) + cancellations (dignified Mars; Jupiter aspect/conjunction; house-sign exemption list) | **Matching tradition**, not a BPHS sutra — framed as tradition in the output |
| | Timing = dasha of 7th/UL/Venus/DK lords ∩ Jupiter transit over 7th/Moon/UL ∩ double transit ∩ Ashtakavarga | Vimshottari per BPHS dasha adhyaya; gochara per standard transit practice; intersection method is a modern synthesis (labelled) |
| `data/interpretations/foreign.ts` | 12th = foreign residence, 9th = long journeys, 3rd = short; weak/afflicted 4th = leaving homeland; lagna lord in 12th | BPHS / Phaladeepika house chapters |
| | Rahu as videsha (foreign) karaka; Saturn–Rahu for long stints | Standard literature (work-level) |
| | Movable-sign emphasis for mobility | BPHS sign taxonomy |
| | Direction of settlement from the digpati of the strongest foreign significator | Digpati scheme — **weakest technique here; confidence capped** |
| `data/interpretations/cautions.ts` | Functional benefic/malefic scheme per lagna | BPHS lagna-lordship scheme (as tabulated in the standard literature) |
| | Marakas = 2nd and 7th lords | BPHS, Maraka adhyaya |
| | Badhaka: movable→11th, fixed→9th, dual→7th lord | Prasna Marga tradition |
| | Dusthana lords in kendra/trikona; debilitation/combustion/graha-yuddha flags | Phaladeepika house-lord chapters; BPHS asta orbs; Graha Yuddha convention |
| `data/interpretations/lucky.ts` + `utils/astrology/numerology.ts` | Number→planet map (1 Su, 2 Mo, 3 Ju, 4 Ra, 5 Me, 6 Ve, 7 Ke, 8 Sa, 9 Ma); Moolank/Bhagyank digit roots; Chaldean letter values (no 9); Pythagorean toggle | Cheiro/Vedic numerology convention (modern tradition, labelled) |
| | Kua number (male 11−root, female root+4, 5→2/8) and direction sets | Eight Mansions (Feng Shui) convention (modern tradition, labelled) |
| | Planet→colour, planet→direction (digpati), planet→day (vara lords), gemstones | BPHS graha descriptions + standard tradition; gemstones informational only |
| `data/interpretations/personality.ts` | Lagna/Moon/Sun triple reading; Atmakaraka & Karakamsa; Navamsa lagna; Arudha vs Lagna | BPHS; Jaimini Upadesa Sutras |
| `data/interpretations/speculation.ts` | Speculation house scheme: 5th (purva punya, the wager, intuition), 11th (labha — gains realised), 8th (sudden/other people's money, leverage), with the 2nd (accumulation), 6th (debt and borrowed capital), 9th (bhagya) and 12th (loss) supporting | BPHS bhava-phala and Dhana Yoga adhyayas; Phaladeepika house chapters |
| | 5th-lord ↔ 11th-lord association (conjunction / mutual aspect / parivartana) as the strongest single positive signature | BPHS, Dhana Yoga adhyaya (the standard lord-association construction, applied to the 5/11 pair) |
| | 8th lord tied to 5/11 = windfall; tied to 6/12 = the margin-call signature; 6th-lord influence on 5/11 = trading on borrowed capital | Phaladeepika, house-lord placement chapters (dusthana lord associations) |
| | Retention drains: 11th lord in the 12th, 2nd lord in a dusthana, 5th lord in 6/8/12, Ketu in the 2nd/11th | Phaladeepika house-lord chapters; Ketu-as-loss is **later tradition**, labelled in the output |
| | Karakas: Rahu = speculation, leverage, novelty and the unregulated; Mars = aggression and decisive loss-cutting; Saturn = patience, structure and duration; Mercury = calculation and commerce; Jupiter = expansion; Venus = valuation; Sun = ego and policy exposure | BPHS Karakadhyaya for the seven grahas; the **nodal** speculation attributions are **later tradition**, labelled at each use |
| | Vipareeta Raja Yoga (Harsha/Sarala/Vimala) read as the contrarian / distressed / short-side signature | Yoga = BPHS; **the market application is a modern synthesis** and is labelled as such in the code, the Evidence row and the UI |
| | Mars–Rahu contact touching 5/8/11 as the leverage blow-up signature | **Later tradition / modern synthesis** — labelled at the point of use |
| | Judgement axis: combust Mercury = judgement burnt by ego; vakri Mercury = re-entry and execution error; Bhadra and Budhaditya = analytical edge; unrestrained Jupiter = over-optimism | BPHS asta (combustion) orbs, vakri motion, Pancha Mahapurusha and Budhaditya; the trading-behaviour reading of each is modern synthesis |
| | Risk axis: Lagna/Lagna lord for survival of a drawdown; the Moon (dignity, paksha bala, malefic contact, Kemadruma) for behaviour under loss | BPHS (Chandra as manas-karaka; Paksha bala); Kemadruma per standard Chandra-yoga literature |
| | Divisionals: D-2 Hora (self-earned vs accumulated), D-9 (does the promise survive magnification), D-30 (loss exposure only), D-4 (fixed assets), Vimshopaka composite | BPHS, Shodasavarga adhyaya |
| | Ashtakavarga: SAV ≥ 30 supportive / ≤ 25 weak for the 2nd, 5th, 8th and 11th signs; Jupiter's BAV in its transited sign | BPHS Sarvashtakavarga; the 30/25 cut-offs are the **common applied convention**, not a sutra |
| | Jaimini: Amatyakaraka's connection to 5/11; A2 (wealth pada); the 11th from the Arudha Lagna as the seat of material gain | Jaimini Upadesa Sutras, Adhyaya 1 (karakas, arudha padas) |
| | Timing: dasha (Maha > Antar > Pratyantar) ∩ gochara **from the natal Moon first, the Lagna second, with the classical vedha table applied** ∩ the Saturn+Jupiter double transit ∩ Ashtakavarga | Vimshottari per BPHS dasha adhyaya; gochara + vedha per Phaladeepika ch. 26 (the table is **reused from `rectification/transitFitness.ts`**, not duplicated); double transit is the labelled modern synthesis |
| | Sade Sati / Kantaka / Ashtama Shani as capital-preservation flags | BPHS Gochara adhyaya (the flags are classical; "capital preservation" is the modern gloss) |
| | Mercury/Venus/Mars retrograde as adverse markers for trading | **Modern market-astrology convention, NOT a Parashari rule** — see the disagreement log; labelled in the reason text the reader sees |
| | Eclipse within 5° of a natal speculation significator as a volatility marker | **Modern synthesis.** Eclipses are classical omens; the 5° orb and the "volatility, not direction" reading are this app's |
| `data/interpretations/intimacy.ts` | Kama trikona (3rd, 7th, 11th) as the desire trine, from the purushartha classification (dharma 1/5/9, artha 2/6/10, kama 3/7/11, moksha 4/8/12) | BPHS bhava chapters; Phaladeepika |
| | **12th = `shayana sukha`**, the pleasures of the bed, weighted as the primary house for sexual pleasure proper; Venus in the 12th read as the classical best placement for it | BPHS bhava-phala; Phaladeepika, 12th-house chapter |
| | 7th = the sanctioned union and appetite expressed with another; 8th = sexual energy, the reproductive organs, intensity and secrecy; 5th = romance, magnetism, purva punya; 1st/2nd = body, vitality, face and voice; 4th = emotional safety and the bedroom; 6th = friction and health-adjacent themes | BPHS / Phaladeepika house chapters |
| | Venus as kama karaka (the centre of the section); Mars for physical drive; Moon for emotional receptivity; Saturn for restraint, delay and durability; Jupiter's ethical frame cooling raw heat on the 7th | BPHS Karakadhyaya; Phaladeepika (Jupiter on the 7th). Rahu/Ketu attributions (insatiability, detachment) are **later tradition**, labelled |
| | Named combinations: Venus–Mars (the primary high-libido signature), Venus–Rahu / –Saturn / –Ketu, Venus combust, Venus debilitated with Neechabhanga cross-check, Mars in 7/8/12, Rahu in 7/12, Ketu in 7/12, Saturn in the 12th, 7th↔12th lord link, 5th lord ↔ 7th/12th link, 8th/12th interchange, Malavya and Ruchaka | BPHS / Phaladeepika association and yoga chapters; Mangal Dosha is reused from `marriage.ts` and stays framed as matching tradition |
| | Drishti weighted by the **sputa-drishti** curve rather than treated as binary; Saturn's 3rd/7th/10th, Mars's 4th/7th/8th and Jupiter's 5th/7th/9th special aspects named individually | BPHS drishti chapters (curve shared with `shadbala.ts`). A *house* has no single longitude, so the sign midpoint is used as the target — an approximation, commented in code and stated in the UI |
| | Divisionals: D-9 (private texture of partnered life, vargottama Venus), D-16 Shodasamsa (comforts and sensual pleasure), D-7 (procreative capacity, kept factual), D-30 (**vulnerability only** — see the disagreement log), D-60 for karmic depth, Vimshopaka for Venus | BPHS, Shodasavarga adhyaya |
| | Jaimini: Darakaraka; **the 7th from the Karakamsa** as the seat of the character of partnered and sexual life; Upapada and the arudha of the 7th for the institution; Arudha Lagna vs Lagna for perceived magnetism vs lived desire | Jaimini Upadesa Sutras, Karakamsa and Padadhyaya material |
| `data/interpretations/nakshatraTraits.ts` | **Yoni (animal) per nakshatra and the yoni's sex**, and the seven enemy pairs (horse–buffalo, elephant–lion, goat–monkey, serpent–mongoose, dog–deer, cat–rat, cow–tiger) | Yoni-kuta limb of the ashtakuta matching scheme — Muhurta Chintamani / Jataka Parijata tradition, as reproduced across the standard matching literature. Rows checked against that published table; the mongoose appearing only once is a property of the classical table and is left as it stands |
| | **Gana** (Deva / Manushya / Rakshasa), 9 nakshatras each | Standard nakshatra taxonomy (ashtakuta gana limb) |
| | Per-nakshatra **speculative temperament** and **sensual/relational character** (the two prose columns) | **Modern synthesis.** No classical text assigns a trading temperament or a sensual character to a nakshatra. Each string is read off that nakshatra's classical symbol, deity, dispositor and published quality (the same material `NAKSHATRA_QUALITIES` summarises) and written for the subject at hand |
| | **Appetite tier** (high / moderate / reserved) | **Derived, not asserted**: taken from the yoni's size-and-vigour ordering used in Yoni-kuta scoring, which is classical; reading that ordering as "appetite" is this app's gloss. See the disagreement log |
| | Gandanta at the water/fire junctions (last pada of Ashlesha/Jyeshtha/Revati, first pada of Magha/Mula/Ashwini) | BPHS / standard Muhurta literature |
| `utils/astrology/ageBands.ts` | Age bands bounding the probable-window scans (marriage 22–45, career entry 22–30, career change 28–50, wealth 25–65, foreign 18–55) and the 0–1 `agePrior` weighting inside them | **Modern demographic convention — NOT classical.** No Parashari text fixes these ages; see the disagreement log below. Labelled as such in the module docstring and surfaced as a caveat on every banded card |
| `data/rectification/eventRules.ts` | Event → bhava mapping (marriage 7th, childbirth 5th, career 10th, father 9th, mother 4th, …); supporting and negating bhavas; Bhavat Bhavam derivations ("the 6th and 12th from the 7th" for separation, "the 8th from the 9th" for the father's maraka) | BPHS bhava-phala chapters; Bhavat Bhavam is a standard Parashari device |
| | Naisargika karakas per event (Venus marriage — with Jupiter added for a woman's chart; Jupiter progeny; Sun father; Moon mother; Mars land/surgery; Saturn longevity/labour; Rahu the foreign; Ketu severance) | BPHS Karakadhyaya; Phaladeepika ch. 19–20 |
| | Which varga each event is read in (D-9 marriage, D-7 progeny, D-10 career, D-4 property, D-24 learning, D-20 initiation, D-30 misfortune, D-60 throughout) | BPHS, Shodasavarga adhyaya (varga significations) |
| `utils/astrology/rectification/dashaFitness.ts` | A dasha lord gives the results of the bhavas it owns, occupies and aspects; of the bhava owned/occupied by its nakshatra dispositor; and of its naisargika karaka role. An event fires when the Maha, Antar and Pratyantar lords jointly signify | BPHS, Dasha-phala adhyayas (ch. 46–52 in the Santhanam numbering); Phaladeepika ch. 19–20; Jataka Parijata |
| | Rahu and Ketu, owning no sign, act for their dispositor and for planets conjoining them | BPHS (nodal delegation rule) |
| | Results arrive with the onset of the period that carries them (opening-stretch bonus) | Phaladeepika ch. 19 |
| `utils/astrology/rectification/transitFitness.ts` | Transits judged **from the natal Moon first, from the Lagna second** | BPHS Gochara adhyaya; Phaladeepika ch. 26 |
| | Gochara **vedha** table — the auspicious transit house per graha and the house whose occupation cancels it; Sun↔Saturn and Moon↔Mercury exempt from mutual vedha | Phaladeepika ch. 26; the same table appears in the BPHS Gochara chapter |
| | Sade Sati (Saturn 12th/1st/2nd from the Moon); Kantaka/Ashtama Shani (4th/8th/10th) | BPHS Gochara adhyaya |
| | Saturn+Jupiter double transit as the strongest event gate | **Modern applied-Parashari synthesis** (shared with `jaimini.ts`), labelled in code |
| `utils/astrology/rectification/score.ts` | Component weights, precision/reliability multipliers, and the determinate/indeterminate thresholds | **Engineering, not shastra.** The thresholds are calibrated against a measured null (see the disagreement log and the ledger) |

## Disagreement log — variants and the default chosen

| Topic | Variants | Default implemented |
|---|---|---|
| D-2 Hora | BPHS Sun/Moon hora vs cyclical (Kashinatha) hora | BPHS Sun/Moon |
| Trimsamsa | BPHS unequal (Ma5/Sa5/Ju8/Me7/Ve5, reversed for even) vs equal Parivritti | BPHS unequal |
| Chara karakas | 7-karaka vs 8-karaka (with Rahu at 30°−long.) | 7-karaka |
| Saptavargaja virupa ladder | 45/30/22.5/15/7.5/3.75/1.875 (PVR/JHora) vs minor edition variants | 45/30/22.5/15/7.5/3.75/1.875 |
| Kendradi bala houses | Whole-sign house vs cusp-based | Whole-sign (consistent with the app's rashi-house convention) |
| Nathonnatha/Tribhaga time | Ghatis from apparent midnight vs temporal (seasonal) hours | Temporal hours anchored on real sunrise/sunset (approximation, commented) |
| Cheshta bala | Full seeghrocca ephemeris vs speed proxy | Seeghrocca via J2000 mean elements (JHora-style) |
| Sputa drishti special aspects | Continuous ramps vs step bonuses | Step bonuses on the special-aspect arcs, capped at 60 |
| Kemadruma | Bare rule vs long cancellation lists | Bare rule, standard cancellations *reported* inside the finding |
| Mangal Dosha | House sets ±2nd, also from Venus; cancellation lists vary widely | 1/4/7/8/12 from Lagna + Moon; conservative cancellations (dignified Mars, Jupiter link, house-sign exemptions) |
| Badhaka | Standard scheme vs lagna-specific exceptions | Standard movable/fixed/dual scheme |
| Rahu/Ketu | Mean node (classical convention) vs true node | Mean by default; true node available as a toggle |
| Rahu/Ketu retrogression | Report the nodes as direct, or as vakri | **Vakri**, read from the computed speed rather than asserted. The mean node regresses continuously (≈ −0.053°/day), which is why the tradition calls the nodes permanently retrograde; the true node briefly turns direct, and reading it from the speed is the only way that distinction survives the mean/true toggle |
| Graha Yuddha tie-break | Lower degree-in-sign vs lower sidereal longitude vs the northern/brighter graha | **Lower sidereal longitude** — the graha behind in zodiacal order. Identical to degree-in-sign inside a single sign; the two diverge only across a sign boundary, where degree-in-sign gives the wrong answer outright. The northern/brighter variant needs ecliptic latitude and is not implemented |
| Bhava frame when quadrants degenerate | Trisect anyway, or fall back | **Equal houses from the Ascendant**, flagged as `bhavaMethod: "equal"`. Trisecting a quadrant arc wider than 180° (polar latitudes; manual Lagna far from the real Ascendant) produces overlapping sandhi arcs and leaves whole bhavas unreachable |
| Ayana bala overflow | Moon's declination can exceed ±23.98° | Clamped to [0, 60] |
| Abda/Masa lords | Kali-ahargana epoch conventions differ by a day between texts | JD 588466 epoch; treated as approximate (low-weight sub-bala) |
| Kua year boundary | Solar-year (Feb 4) boundary for January births | Not applied; caveat shown instead |
| Bounding the timing scans | (a) a rolling "now → now + 15 years" horizon; (b) age bands derived from when these events commonly occur; (c) no bound at all — the whole 120-year dasha cycle | **(b) age bands.** (a) was the previous implementation and is simply wrong for anyone not at the start of the relevant life stage: it showed a 52-year-old marriage windows at ages 52–67 and hid the 22–30 window entirely. (c) buries the reader in windows that no life stage makes plausible. The bands are a **modern demographic convention, not a shastric rule** — the chart supplies the timing, the band only supplies the plausibility, and the two are weighted separately (±15 of ~100) so a reader whose life ran on a different clock can discount the band without discarding the reading. `cautions.ts` is deliberately **unbanded**: health and adversity are age-independent, and an elapsed health window is not actionable |
| Showing elapsed windows | Forward-only (only what is still ahead) vs past + future | Both, phase-labelled. A window that has passed is a check on the reading rather than a prediction, and the selection quota reserves half the slots for non-past windows so retrospect cannot crowd out what is actionable |
| Rectification search space | (a) sweep the Lagna sign boundaries only; (b) a fixed ±N-minute window at 1-minute steps; (c) optimise continuously | **(b)**, ±15 min / 1 min, both bounds exposed as `RECTIFY_WINDOW_MIN` / `RECTIFY_STEP_MIN`. (a) assumes the record is wrong by up to two hours, which is a different problem; (c) invents precision the evidence cannot support — the D-60 amsha, the sharpest signal available, only changes every ~2 minutes, so sub-minute steps would return noise |
| Which evidence discriminates inside ±15 min | Rashi (D-1) house placement, as most rectification tools assume | **The vargas, chiefly D-60.** Measured on the canonical charts, the rashi Lagna moves 0.26–0.30°/min, so its *sign* does not change inside the window at all unless the record sits on a sandhi — D-1 house placement is near-constant and contributes almost nothing. The D-60 Lagna amsha changes every ~1.7–1.9 min and is weighted heaviest; the Sripati **bhava** (not the whole-sign house) does move, so occupancy is scored on both and rewarded when they agree |
| Vimshottari displacement per minute | "≈0.0686% of each boundary's elapsed offset", i.e. proportional — a 40-year boundary moving ~10 days while a 2-year one barely moves | **Uniform in absolute time.** `vimshottariTree` places its origin at `birthUtc − frac × DASHA_YEARS[firstLord]` and then walks *fixed* durations, so the whole 120-year tree is a rigid translation: every boundary moves by `Δfrac × DASHA_YEARS[openingLord]`, measured at 1.73 days/minute for a Ketu- or Mars-opening chart and ~4.8 for a Venus-opening one. Harness-checked. The practical conclusion is unchanged — Maha/Antar boundaries are unmoved at that scale while a nine-day Pratyantardasha is wholly replaceable — but boundary distance is therefore scored in **absolute days**, not as a fraction of the offset |
| Verdict threshold | A raw score cut-off, or "z > 1 over the median candidate" | **A null-calibrated joint test (z ≥ 2.4 AND margin ≥ 0.020).** The winner of a 31-candidate sweep is the maximum of 31 draws and sits ~1.9σ above the median *by construction*: 80 null sweeps driven by randomly generated events gave median z 1.86, p95 2.66, and a "z > 1" rule would have called essentially all of it significant. The pair chosen gives a measured 5.0% false-positive rate against that null, while a positive control — events generated from a known +7-minute chart — recovers the minute and passes at z 2.54 / margin 0.0238 |
| Margin denominator | Best vs runner-up minute | Best vs the best candidate **outside the tied interval**. Two adjacent minutes with identical scores are one peak, not two hypotheses; measuring them against each other reports a margin of zero for a perfectly clean result |
| **D-30 for "chastity" or moral character** | The older literature reads Trimsamsa to judge a native's morals — a rule applied overwhelmingly, and in some texts exclusively, to women's charts | **Refused outright.** `intimacy.ts` uses D-30 only for vulnerability and health-adjacent themes, and the refusal is stated in the panel's visible copy rather than left silent. The rule is not a description of a chart; it is a description of the social order the texts were written inside, and implementing it would make this app an instrument of that judgement. The same refusal applies to any other rule whose only content is a verdict on a person's sexual conduct. Note the asymmetry we *did* keep elsewhere — Jupiter as an additional marriage karaka for a female chart (`marriage.ts`) — which is retained because it changes which planet is read, not whether the native is virtuous |
| **Age-banding the speculation windows** | (a) band them the way marriage/career/wealth/foreign are banded; (b) leave them unbanded and scan the selected year only | **(b), unbanded.** Speculation is age-independent in exactly the way `cautions.ts` argues health and adversity are: there is no demographic window in which a chart's capacity to take risk switches on, an elapsed speculation window is not actionable, and a reader selects the year they care about themselves. The section therefore takes a user-chosen twelve-month window rather than a life stage, and `AGE_BANDS` is left with its five existing entries untouched |
| **Age-banding the intimacy reading** | Add an `intimacy` band (e.g. 18–70, peak 22–45) and run `findActivationWindows`, or describe the rhythm by period lord without dates | **The unbanded version.** A demographic "peak years for desire" band is a much stronger claim than the marriage or career bands — those describe when an *event* commonly happens, this would describe when a person is allowed to want something — and the evidence for it is a stereotype rather than a demographic fact. `intimacy.ts` instead describes how desire tends to move by which period lord is running, phrased as tendency, and points the reader at the Dasha tab for their own dates. This also keeps the five existing bands and `BandNote.tsx` untouched |
| **Mercury retrograde as an adverse trading marker** | Treat it as a real rule, omit it, or include it and say what it is | **Included and labelled.** It is a twentieth-century financial-astrology convention with no basis in Parashari gochara — BPHS scores vakri motion as *cheshta bala*, i.e. strength, not weakness. It is included because it is the single most widely-held belief in the subject this section is about, it is weighted as one adverse factor among a dozen rather than as a gate, and the reason text the reader sees names it as a modern convention rather than a classical rule |
| **The yoni appetite ranking** | Assert a "most sexual nakshatras" list, as much popular material does, or derive the claim | **Derived.** The classical Yoni-kuta scheme ranks its animals by size and vigour, and that ordering is what the appetite tier reads off. Calling the ordering "appetite" is labelled as this app's gloss in the table, in the module docstring and in the UI copy. An asserted per-nakshatra libido ranking has no source and is not implemented |
| **Yoni matching from a single chart** | Score compatibility anyway using assumed partner nakshatras, or read the native's own yoni only | **The native's own yoni only**, from the Moon's nakshatra (with Venus as a secondary layer). Yoni kuta is a *pair* technique; running it against a hypothetical partner would be inventing the other half of the input. The panel says so explicitly, and names the clashing yoni class as a friction to be aware of rather than as a verdict on anyone |
| **Speculation window polarity in the UI** | Reuse `TimingWindows.tsx` and render an adverse stretch as `grade: "weak"`, or build a second renderer | **A second renderer** (`SpeculationWindows.tsx`). `TimingWindow` has no concept of an adverse period, so a bad stretch would render as "a mildly good one" — a misreading in exactly the place it costs most. Polarity is a first-class property of `SpeculationWindow`, and `TimingWindows.tsx` is left byte-identical |
| Combining Lahiri and Pushya | Average them, or pick the higher-scoring school | **Neither, ever.** Both pipelines run fully independently and are reported side by side; their divergence in minutes is the confidence tier. Where the natal Moon changes nakshatra between them the two systems run different Vimshottari sequences entirely and are answering different questions, which is surfaced as a hard warning rather than reconciled. D-60 agreement across the two is explicitly *not* corroboration: 1.122° is 2.244 shashtiamsas |

## Verified-against ledger

Run `npx tsx utils/astrology/__checks__/verify.ts` to reproduce. Canonical test
chart: 1990-01-24 12:30 IST, New Delhi (Lahiri).

- **Vargas**: D-9 continuous count ≡ movable/fixed/dual rule (200 samples); D-30
  boundary values; D-2 restricted to Cancer/Leo; vargottama structural rule;
  all four Vimshopaka schemes total exactly 20.
- **Jaimini**: arudha exception rules unit-checked; karakas distinct + ordered.
- **Shadbala**: Naisargika ladder exact; benefic+malefic Paksha = 60; Moon's
  Paksha doubled; Vara lord agrees with the Panchang panel's weekday; totals in
  the published 2–12-rupa band; Ishta/Kashta bounded. *Not yet reconciled
  sub-bala-by-sub-bala against a published worked example (e.g. Raman's
  "Standard Horoscope") — expect small deltas from the approximations flagged
  above; the strongest/weakest ordering is the reliable output.*
- **True node**: Moon's longitude equals the osculating node at an
  independently-searched node crossing (Δ = 0.0000°); |true−mean| ≤ 1.9°.
- **Scanner**: Jupiter→sidereal-Taurus ingress 2024-05-01 reproduced after the
  root-finder refactor; occupancy intervals contiguous; all-house criteria
  reproduce the full antardasha list (superset property).
- **Sections**: every builder deterministic (double-run deep-equal); wealth
  split sums to exactly 100; degradation paths (manual chart, no anchor, no
  gender, no name) run clean. **Phrasing gate**: all six section builders plus
  their timing windows are concatenated and asserted free of `"you will "`,
  `"will definitely"`, `"is guaranteed"`, `"must marry"`, `"will get"` and
  `"will marry"` — timing language stays probabilistic by construction.
- **Age bands**: `agePrior` = 1 across the peak, 0 strictly outside the band,
  0.15 at both edges, monotone on each ramp; `dateAtAge`/`ageAt` round-trip
  exactly; marriage windows for the canonical chart all land inside ages 22–45;
  phase labels correct against a fixed `now`; the selection quota always keeps
  at least one non-past window when one exists; career output carries exactly
  two group headings and is chronological within each; natives below and above
  a band still receive it (all-future and all-past respectively); `cautions`
  windows are never retrospective.
- **Numerology**: Moolank/Bhagyank/Chaldean/Pythagorean/Kua hand-checks pass;
  Chaldean maps all 26 letters, none to 9.
- **Rectification**: the nakshatra fraction shifts by exactly `moonSpeed/1440 ÷
  13°20'` per minute (0.0678%/min measured, inside the 0.06–0.07% band the
  textbook 0.0686% figure implies); all nine Mahadasha boundaries shift by the
  *same* 1.735 days per minute, matching `dashaShiftDaysPerMinute`; the D-60
  Lagna amsha changes every 1.88 min = 0.5° ÷ the measured Lagna speed, while
  the rashi Lagna sign never changes across the window; every Pushya sidereal
  longitude is exactly Lahiri + 1.122° = 2.244 shashtiamsas = 8.415% of a
  nakshatra; Bhavat Bhavam resolutions hand-checked; the vedha table is
  well-formed and never self-obstructing; aggregation is a weighted mean, so
  adding events cannot inflate a score; month precision integrates 4 instants
  and year precision 12. **Null check**: randomly generated event sets never
  produce a determinate verdict, and their z-scores are asserted to sit high
  anyway — so the joint test, not z alone, is what excludes them. **Positive
  control**: events planted from a known +7-minute chart recover that minute
  and clear both thresholds. Timezone guards trip on a 1943 Indian birth
  (war-time +06:30) and on a clock change inside the search window, and stay
  silent on a clean modern record. A full dual-ayanamsha sweep (62 charts)
  runs in ~150 ms.
