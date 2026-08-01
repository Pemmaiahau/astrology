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
| Ayana bala overflow | Moon's declination can exceed ±23.98° | Clamped to [0, 60] |
| Abda/Masa lords | Kali-ahargana epoch conventions differ by a day between texts | JD 588466 epoch; treated as approximate (low-weight sub-bala) |
| Kua year boundary | Solar-year (Feb 4) boundary for January births | Not applied; caveat shown instead |

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
  split sums to exactly 100; marriage output contains no "will marry" phrasing;
  degradation paths (manual chart, no anchor, no gender, no name) run clean.
- **Numerology**: Moolank/Bhagyank/Chaldean/Pythagorean/Kua hand-checks pass;
  Chaldean maps all 26 letters, none to 9.
