# Competitive Benchmark — Jyotisha Studio

**Date:** 2026-08-21 · **Method:** live feature-page research (Aug 2026) + code-verified self-assessment against [AUDIT.md](AUDIT.md).

**Scope constraints applied** (decisions of 2026-08-21, recorded in `AUDIT.md §9a`):
- **Monetisation is benchmarked for context only** and never appears in Tier 1.
- **Server-rendered SEO content routes are out of scope**; features whose value is mostly organic-search are down-weighted and flagged.
- **Speculation and Intimacy panels are excluded** from comparison and from the gap list.

---

## 0. Who we are comparing against

| Site | Position | Why it's in the set |
|---|---|---|
| **AstroSage** | The feature superset. Free Kundli includes Shodashvarga, Shadbala & Bhavbala, Ashtakavarga + Prastarashtakavarga, KP (significators, ruling planets, sub-sub), Lal Kitab, Tajik Varshaphal (Muntha/Saham/Mudda), Yogini & Chara dasha, 36-guna matching, N/S/E Indian chart styles, PDF+image export | The depth ceiling. Nobody in this vertical ships more calculation. |
| **GaneshaSpeaks** | Structured content + consultation. Janampatri, Panchang/Choghadiya/Hora, remedy reports, heavy paid-report catalogue | The content-and-packaging benchmark. |
| **AstroTalk** | Consultation-led, calculator-dense. ~25 named calculators, full Panchang suite, dosha calculators, free Kundli with yogas/doshas/remedies + PDF | The engagement/acquisition benchmark. |
| **Cafe Astrology** | Western, plain-English, article-driven. Natal report, synastry, transits, house/aspect interpretation libraries | **The voice benchmark**, per your brief. Not a Vedic competitor. |

### Measured note on Cafe Astrology's voice

I pulled real interpretation text to calibrate Phase 3. Verbatim, from their Mars-in-houses page:

> "With Mars in the seventh house of your natal chart, you need a partner who challenges you, and your close personal relationships can be especially passionate, active, or physical."

**Assessment:** ~12–18 word sentences, roughly 7th–8th grade, consistently hedged ("may", "tend to", "likely", "possibly").

**But — and this matters for Phase 3 — Cafe Astrology does *not* explain the why.** The reasoning is absent; interpretations are asserted as observations, never connected back to Mars's significations or the house's remit. **So the "always explain the why" requirement in your Phase 3 brief is not something you are copying from Cafe Astrology. It is something none of the four competitors do, and something this codebase already has the data structures for.** That is the single most defensible differentiator in this benchmark.

---

## 1. Feature matrix

**Legend:** ✅ present · 🟡 partial · ❌ missing · ⬜ out of scope (per decisions) · **n/a** not applicable to that tradition

Rows marked **🔓** = the capability already exists in your codebase and is simply not surfaced.

### 1a. Core calculations

| Feature | AstroSage | Ganesha | AstroTalk | Cafe Astro | **MY SITE** |
|---|:--:|:--:|:--:|:--:|:--:|
| Sidereal (Vedic) engine | ✅ | ✅ | ✅ | n/a | ✅ |
| Tropical (Western) engine | ✅ | 🟡 | ❌ | ✅ | ❌ |
| Ayanamsha options | ✅ 4+ | 🟡 | 🟡 | n/a | 🟡 2 (Lahiri, Pushya) |
| Ephemeris precision | ✅ | ✅ | ✅ | ✅ | ✅ ~arcmin |
| D-1 Rashi chart | ✅ | ✅ | ✅ | ✅ | ✅ |
| Navamsa D-9 | ✅ | ✅ | ✅ | ❌ | 🟡 **🔓** computed, not drawn |
| All 16 vargas (Shodashvarga) | ✅ | ❌ | ❌ | ❌ | 🟡 **🔓** computed, not drawn |
| Bhava Chalit | ✅ | 🟡 | 🟡 | n/a | ✅ Sripati |
| Chart styles N / S / E Indian | ✅ all 3 | ✅ | ✅ | n/a | ❌ **South only** |
| Shadbala (six-fold strength) | ✅ | ❌ | ❌ | ❌ | ✅ full classical |
| Bhava Bala | ✅ | ❌ | ❌ | ❌ | 🟡 **🔓** computed, never rendered |
| Ashtakavarga BAV + SAV | ✅ | ❌ | ✅ | ❌ | ✅ |
| Prastarashtakavarga | ✅ | ❌ | ❌ | ❌ | ❌ |
| Sodhana / Shodhya Pinda / Kakshya | ✅ | ❌ | ❌ | ❌ | ❌ |
| KP system (sub-lords, significators, RP) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Jaimini (chara karakas, arudha, argala) | 🟡 | ❌ | 🟡 AK/DK only | ❌ | ✅ **deeper than all** |
| Upagrahas (Gulika, Mandi) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Panchang — five limbs | ✅ | ✅ | ✅ | 🟡 | ✅ birth only |
| Panchang day-parts (Rahu Kaal, Choghadiya, Hora) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Sunrise / sunset display | ✅ | ✅ | ✅ | ✅ | 🟡 **🔓** computed internally only |
| Planetary states (retro, combust, dignity) | ✅ | 🟡 | 🟡 | 🟡 | ✅ compound dignity |
| Graha Yuddha | 🟡 | ❌ | ❌ | ❌ | ✅ |
| Whole-sign drishti | ✅ | ✅ | ✅ | n/a | ✅ |
| Western aspects w/ orbs | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Birth-time rectification** | ❌ | ❌ | ❌ | ❌ | ✅ **unique in the set** |

### 1b. Reports

| Feature | AstroSage | Ganesha | AstroTalk | Cafe Astro | **MY SITE** |
|---|:--:|:--:|:--:|:--:|:--:|
| Full life report | ✅ | ✅ | ✅ | 🟡 | 🟡 fragmented across tabs |
| **PDF download** | ✅ | ✅ | ✅ | ✅ | ❌ |
| Save chart as image | ✅ | 🟡 | 🟡 | ❌ | ❌ |
| House-by-house reading | ✅ | ✅ | ✅ | ✅ | ✅ all 12 incl. vacant |
| Personality profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Career report | ✅ | ✅ | ✅ | 🟡 | ✅ ranked + scored |
| Wealth / income report | ✅ | ✅ | ✅ | 🟡 | ✅ ranked + % split |
| Marriage report | ✅ | ✅ | ✅ | 🟡 | ✅ + Mangal Dosha w/ cancellations |
| Health report | ✅ | ✅ | ✅ | 🟡 | 🟡 via Life Areas + Cautions |
| Children / education | ✅ | ✅ | ✅ | ❌ | 🟡 via Life Areas |
| Foreign travel & settlement | ✅ | 🟡 | 🟡 | ❌ | ✅ scored 3 ways |
| Structured remedies | ✅ | ✅ | ✅ | ❌ | 🟡 prose only, no engine |
| Gemstone recommendation | ✅ | ✅ | ✅ | ❌ | 🟡 in Lucky card only |
| Lal Kitab | ✅ | ❌ | ❌ | ❌ | ❌ |
| Hindi / multi-language | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Cited classical sources** | ❌ | ❌ | ❌ | ❌ | ✅ **unique in the set** |

### 1c. Predictive tools

| Feature | AstroSage | Ganesha | AstroTalk | Cafe Astro | **MY SITE** |
|---|:--:|:--:|:--:|:--:|:--:|
| Vimshottari dasha | ✅ | ✅ | ✅ | n/a | ✅ 3 levels, day-precise |
| Yogini dasha | ✅ | ❌ | ❌ | n/a | ❌ |
| Chara dasha (Jaimini) | ✅ | ❌ | ❌ | n/a | ❌ |
| Ashtottari / Kalachakra | ✅ | ❌ | ❌ | n/a | ❌ |
| **Transit today** | ✅ | ✅ | ✅ | ✅ | 🟡 **🔓 computed, never rendered** |
| **Sade Sati report** | ✅ | ✅ | ✅ | n/a | 🟡 **🔓 computed, never rendered** |
| Kaal Sarp | ✅ | ✅ | ✅ | n/a | ✅ as yoga |
| Mangal Dosha | ✅ | ✅ | ✅ | n/a | ✅ + cancellations |
| Pitra Dosha | 🟡 | 🟡 | ✅ | n/a | ❌ |
| Annual chart / Varshaphal (Tajika) | ✅ full | 🟡 | 🟡 | 🟡 solar return | 🟡 sidereal return only; Muntha **🔓** exists in rectify |
| Year forecast (selectable year) | ✅ | ✅ | ✅ | ✅ | ✅ **strongest in set** — segmented timeline + month grid, any year 1850–2150 |
| **Life-event timing windows** | 🟡 | 🟡 | 🟡 | ❌ | ✅ **unique** — age-banded, scored, past + future |
| Muhurta / electional | ✅ | ✅ | ✅ | 🟡 Good Days | ❌ |
| Prashna / horary | ✅ | ❌ | ❌ | ❌ | ❌ |
| Transit Vedha / Tara Bala / Chandrashtama | ✅ | 🟡 | 🟡 | n/a | ❌ (Vedha **🔓** exists in rectify) |

### 1d. Matchmaking — **total gap**

| Feature | AstroSage | Ganesha | AstroTalk | Cafe Astro | **MY SITE** |
|---|:--:|:--:|:--:|:--:|:--:|
| Two-chart input | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ashtakoot 36-guna | ✅ | ✅ | ✅ | n/a | ❌ |
| Mangal Dosha comparison | ✅ | ✅ | ✅ | n/a | 🟡 single-chart only |
| Nadi / Bhakoot dosha + exceptions | ✅ | ✅ | ✅ | n/a | ❌ |
| Dashakoot (South Indian) | ✅ | 🟡 | 🟡 | n/a | ❌ |
| Western synastry | ❌ | 🟡 | ❌ | ✅ | ❌ |
| Sign-level compatibility | ✅ | ✅ | ✅ | ✅ | ❌ |
| Novelty calculators (love/flames/name) | ✅ | ✅ | ✅ | 🟡 | ❌ |

**Partial credit worth noting:** Yoni-kuta tables, gana classification and Mangal Dosha with cancellations already exist. Roughly **three of the eight kutas have their reference data in the repo.**

### 1e. Daily-engagement content

| Feature | AstroSage | Ganesha | AstroTalk | Cafe Astro | **MY SITE** |
|---|:--:|:--:|:--:|:--:|:--:|
| Daily horoscope by sign | ✅ | ✅ | ✅ | ✅ | ❌ |
| Yesterday / tomorrow | 🟡 | 🟡 | ✅ | 🟡 | ❌ |
| Weekly / monthly / yearly by sign | ✅ | ✅ | ✅ | ✅ | ❌ |
| Today's Panchang | ✅ | ✅ | ✅ | 🟡 | ❌ |
| Rahu Kaal / Choghadiya today | ✅ | ✅ | ✅ | ❌ | ❌ |
| Festival & Hindu calendar | ✅ | ✅ | 🟡 | 🟡 | ❌ |
| Tarot | ❌ | ✅ | ✅ | ✅ | ❌ |
| Chinese astrology | ❌ | ✅ | 🟡 | 🟡 | ❌ |
| Celebrity charts | ✅ | 🟡 | 🟡 | 🟡 | ❌ |
| Baby names | ✅ | ✅ | 🟡 | ❌ | ❌ |
| Learn / article library | ✅ | ✅ | ✅ | ✅ **best** | ❌ |

⚠️ **The SPA decision changes the value of this whole category.** Daily-horoscope and article content earn their keep almost entirely through organic search. With server-rendered routes off the table, these features return engagement value only — not acquisition. They are still table-stakes, but the ROI is materially lower than the matrix alone suggests.

### 1f. Personalisation

| Feature | AstroSage | Ganesha | AstroTalk | Cafe Astro | **MY SITE** |
|---|:--:|:--:|:--:|:--:|:--:|
| Save / persist chart | ✅ | ✅ | ✅ | 🟡 | ❌ **refresh destroys it** |
| Multiple saved profiles | ✅ | ✅ | ✅ | ❌ | ❌ |
| User accounts | ✅ | ✅ | ✅ | 🟡 | ❌ |
| **Shareable chart link** | ✅ | ✅ | ✅ | 🟡 | ❌ |
| Language toggle | ✅ | ✅ | ✅ | ❌ | ❌ |
| Gender-aware classical rules | 🟡 | 🟡 | 🟡 | ❌ | ✅ + documented ethics |
| Live ayanamsha / node toggle | 🟡 | ❌ | ❌ | n/a | ✅ |
| Dark mode | ❌ | ❌ | 🟡 | ❌ | ✅ |
| Beginner ↔ expert toggle | ❌ | ❌ | ❌ | ❌ | ❌ *(planned — Phase 3)* |

### 1g. Monetisation — ⬜ **out of scope, recorded for context only**

| Feature | AstroSage | Ganesha | AstroTalk | Cafe Astro | **MY SITE** |
|---|:--:|:--:|:--:|:--:|:--:|
| Paid detailed reports | ✅ | ✅ | ✅ | ✅ | ⬜ |
| Astrologer chat / call | ✅ | ✅ | ✅ **core model** | ❌ | ⬜ |
| Consultation booking | ✅ | ✅ | ✅ | 🟡 | ⬜ |
| Store (gems, yantra, books) | ✅ | ✅ | ✅ | ❌ | ⬜ |
| Advertising | ✅ | ✅ | ✅ | ✅ | ⬜ |
| Free-first-consult hook | 🟡 | ✅ | ✅ | ❌ | ⬜ |

*Observation, not a recommendation: all three Indian competitors treat free calculation as customer acquisition for human consultation. Their free tools are loss-leaders. That is why their calculation depth is so high — and it means you are competing against tools funded by a business model you have opted out of.*

### 1h. UX / presentation

| Feature | AstroSage | Ganesha | AstroTalk | Cafe Astro | **MY SITE** |
|---|:--:|:--:|:--:|:--:|:--:|
| Mobile-first responsive | ✅ | ✅ | ✅ | 🟡 | ❌ *(AUDIT §5)* |
| Native mobile apps | ✅ | ✅ | ✅ | ❌ | ❌ |
| PDF / print layout | ✅ | ✅ | ✅ | ✅ | ❌ |
| Plain-English output | 🟡 | ✅ | ✅ | ✅ | ❌ **too technical** |
| **Explains the astrological "why"** | ❌ | ❌ | ❌ | ❌ | ✅ **unique — `Evidence`/`WhyList` already built** |
| **Confidence / strength indicator** | ❌ | ❌ | ❌ | ❌ | ✅ **unique — `ConfidenceBadge`, scores, verdicts** |
| Honest caveats & degradation notices | ❌ | ❌ | ❌ | 🟡 | ✅ `SectionReport.caveats` |
| Colour-coded benefic / malefic | ✅ | 🟡 | 🟡 | 🟡 | 🟡 colour-only, no glyph |
| Chart style choice | ✅ | ✅ | ✅ | n/a | ❌ |
| Accessibility | 🟡 | 🟡 | 🟡 | 🟡 | ❌ *(AUDIT §7)* |
| SEO content surface | ✅ | ✅ | ✅ | ✅ **best** | ⬜ out of scope |

---

## 2. Where you already win

Before the gap list, the honest scorecard — because the gaps read worse than the product is.

| Capability | Status vs. field |
|---|---|
| **Explains its reasoning** | **Unique.** No competitor does this. Cafe Astrology, the plain-English benchmark, explicitly does not. |
| **Confidence + strength instead of false certainty** | **Unique.** Every competitor asserts. |
| **Cited classical sources + disagreement log** | **Unique.** Nobody else publishes their convention choices. |
| **Birth-time rectification** | **Unique in this set**, and statistically honest (null-calibrated 5% FPR). AstroSage doesn't ship it. |
| **Life-event timing windows** | Age-banded, scored, showing past *and* future windows. Competitors give vague "favourable periods". |
| **Jaimini depth** | Chara karakas + Karakamsa + Arudha + Upapada + Argala beats everyone except AstroSage's partial coverage. |
| **Shadbala + full Shodashvarga** | Matches AstroSage; beats the other three outright. |
| **Year forecast** | Segmented dasha∩transit timeline with month grid over any year 1850–2150 — better structured than anything in the set. |
| **Ethical guardrails** | Documented refusals (D-30 chastity readings, single-chart yoni matching). Nobody else even discusses this. |

**The strategic read:** you are not behind on *astrology*. You are behind on *delivery* — export, persistence, mobile, matching, and plain language. Four of the five are presentation problems, not engine problems.

---

## 3. Gap list

Effort scale against **this** architecture: **S** = ≤1 day · **M** = 2–5 days · **L** = 1–2 weeks · **XL** = 3+ weeks.

### Tier 1 — table-stakes every major site has that you are missing

Ordered by value-to-effort.

| # | Gap | Effort | Reuses | Notes |
|---|---|:--:|---|---|
| **T1.1** | **Transit Today panel** | **S** | `transits.ts` (`currentTransits`), `transitTexts.ts` (`TRANSIT_TABLES`), `ChartContext.transits` | **Pure surfacing.** `transits` is already computed on every chart and consumed by no component. A panel is the only missing piece. All 4 competitors have this. |
| **T1.2** | **Sade Sati report** | **S** | `transits.ts` (`sadeSatiPhase`), `ChartContext.sadeSati`, `yearForecast.ts` phase text | **Pure surfacing.** `sadeSati` is computed and never rendered. AstroSage sells a whole product on this. |
| **T1.3** | **Divisional chart display (D-9 first, then all 16)** | **S–M** | `varga.ts` (`computeVargaSet`, `VARGA_NAMES`, `VARGA_SIGNIFICATIONS`), `SouthIndianChart.tsx` | All 16 already computed. Needs a chart component that takes `VargaChart` instead of `ChartData`. `VARGA_SIGNIFICATIONS` is currently dead code (AUDIT §2a) and is exactly the caption text. |
| **T1.4** | **Today's Panchang + Rahu Kaal / Gulika Kaal / Yamaganda / Choghadiya / Hora / Abhijit** | **M** | `panchang.ts`, `ephemeris.ts` (`sunriseFor`, `sunsetFor`, `nextSunrise`), `constants.ts` (`VARA_LORDS`) | All derive from sunrise/sunset arcs already computed for Kala bala. Highest-traffic category in the vertical; all three Indian sites have the full suite. Also needs Panchang to accept "today" not just birth instant. |
| **T1.5** | **Chart persistence + shareable URL** | **M** | `ChartContext`, `AutoInputState`/`ManualInputState` | Client-side `searchParams` — **no SSR needed**, so unaffected by the architecture decision. Fixes "refresh destroys everything". The only shareability mechanism left. |
| **T1.6** | **PDF / print layout** | **M** | Every panel; `SectionReport` structure | `@media print` appears zero times. Browser print-to-PDF over a print stylesheet avoids a new dependency. Structured `SectionReport` data makes a dedicated print view straightforward. **All 4 competitors have this.** |
| **T1.7** | **North & East Indian chart styles** | **M** | `SouthIndianChart.tsx`, `ChartData` | Diamond (North) is house-fixed/sign-floating — inverse of the current sign-fixed layout, so it needs real SVG work, not a CSS variant. AstroSage ships all three. |
| **T1.8** | **Mobile responsiveness pass** | **M** | All panels | Tab bar → scroll strip; chart legibility at 360px; sticky first column on the 4 wide tables; `grid-cols-2` collapse. AUDIT §5. |
| **T1.9** | **Plain-English default output** | **L** | `report.ts` (`SectionReport`, `Evidence`, `plain()`), all `data/interpretations/*` | **This is Phase 3.** Largest Tier 1 item and the one that most changes perceived quality. |
| **T1.10** | **Kundli Matching (Ashtakoot 36-guna)** | **L** | `nakshatraTraits.ts` (yoni, gana), `marriage.ts` (`checkMangalDosha`), `chart.ts`, `constants.ts` | ~3 of 8 kutas have data already. Needs: 8-kuta scoring, Nadi/Bhakoot dosha + exceptions, and a **two-chart input path** (the real work). Highest-traffic feature in the vertical. |
| **T1.11** | **Structured remedies engine** | **M** | `constants.ts` (`PLANET_GEMSTONES`, `PLANET_COLOURS`), `shadbala.ts` (Ishta/Kashta), `cautions.ts` | Currently prose-only. Needs a per-planet mantra/deity/donation/fasting table + "which planet needs propitiation" ranked off Shadbala. |
| **T1.12** | **Daily/weekly/monthly horoscope by sign** | **M** | `transits.ts`, `transitTexts.ts` | ⚠️ **Down-weighted.** Table-stakes, but its value is ~80% organic search, which the SPA decision forgoes. Recommend deferring behind everything above. |

**Deliberately NOT in Tier 1**, despite competitors having them:

- KP system, Lal Kitab, Prashna, Tarot, Chinese astrology, baby names, celebrity charts — different traditions or novelty content, not table-stakes for *your* positioning.
- Anything monetisation-related — out of scope by decision.
- Native apps — out of scope by architecture.

### Tier 2 — high-value differentiators

Split into **(a) sharpen what you uniquely have** and **(b) net-new depth**.

#### 2a. Sharpen existing advantages — cheapest high-value work in the repo

| # | Gap | Effort | Reuses | Why it matters |
|---|---|:--:|---|---|
| **T2.1** | **Fix the pessimism bias: add Sunapha / Anapha / Durudhara** | **S** | `yogas.ts` | `Kemadruma` (the negative lunar yoga) is detected; its three positive counterparts are not. Same rule family, same data. **Every chart currently reads more negatively than the classical rules warrant.** For a consumer product this is a correctness *and* tone bug. |
| **T2.2** | **Report Parivartana Yoga** | **S** | `yogas.ts` (`inExchange` already written), `report.ts` glossary (already defines it) | Detected internally for Raja/Dhana yogas but never emitted as its own finding. |
| **T2.3** | **Surface Sudarshana Chakra + Muntha** | **S** | `rectify.ts:365-411` | **Fully implemented already**, trapped in the rectification panel. Both are standard natal/annual features. |
| **T2.4** | **Promote rectification as a headline feature** | **S** | `RectificationPanel` | It is buried as tab 7 of 7 and is the single most defensible thing you own — **no competitor in this set has it.** |
| **T2.5** | **Lead with "why" + confidence in the UI hierarchy** | **S–M** | `WhyList`, `ConfidenceBadge`, `Evidence` | The unique differentiator is currently collapsed inside expandable cards. Phase 3 should make it the visible spine of every section. |
| **T2.6** | **Beginner ↔ Expert toggle** | **M** | `ChartContext`, every panel | Enables the consumer-first decision without deleting practitioner depth. Nobody in the set has this. |
| **T2.7** | **Bhava Bala display** | **S** | `shadbala.ts` (`computeBhavaBala`), `ChartContext.bhavaBala` | Computed on every chart, rendered nowhere. |

#### 2b. Net-new depth

| # | Gap | Effort | Reuses | Why it matters |
|---|---|:--:|---|---|
| **T2.8** | **"Birth time unknown" mode** | **M** | `transits.ts` (`houseFromMoon` exists), `chart.ts`, `shadbala.ts` (already null-safe) | Most Indian users don't know their birth minute; today they silently get a noon chart at full confidence (AUDIT §3b). Handled honestly, this is a **trust differentiator**, not just a fix. |
| **T2.9** | **Gulika & Mandi upagrahas** | **S–M** | `ephemeris.ts` sunrise/sunset arcs, `constants.ts` (`VARA_LORDS`) | Routine practice, not exotic. Cheap given the arcs already exist. Only AstroSage has them. |
| **T2.10** | **Chara dasha (Jaimini)** | **M** | `jaimini.ts` (karakas, arudha already built), `dasha.ts` structure, `DashaPanel` | The natural pairing for the Jaimini layer you already have. Cheapest second dasha system. |
| **T2.11** | **Yogini dasha** | **S–M** | `dasha.ts` (same tree shape), `constants.ts` | 8 periods / 36-year cycle. Very common in North India. Mostly a table + reuse of `buildSubPeriods`. |
| **T2.12** | **Ayanamsha expansion (Raman, KP, True Chitra)** | **S** | `ayanamsha.ts`, `types.ts`, header toggle | `ENGINE.md §20` already routes this as a 3-file change. Competitors offer 4+. |
| **T2.13** | **Ashtakavarga Kakshya + Sodhana + Shodhya Pinda** | **M** | `ashtakavarga.ts` (`bav`/`sav` already correct) | Kakshya is *the* classical mechanism for Ashtakavarga transit timing. `ENGINE.md §20` anticipates this as a layer. |
| **T2.14** | **Full Varshaphal / Tajika** | **L** | `scan.ts` (`solarReturn`), Muntha (**🔓** in rectify) | Needs year-lord (Panchadhikari), Sahams, Mudda dasha, Tajika aspects. AstroSage ships all of it. |
| **T2.15** | **Transit Vedha / Tara Bala / Chandrashtama** | **M** | `transitFitness.ts` (`VEDHA_TABLE` **🔓** already exists), `transits.ts` | Vedha table is written and used only for rectification scoring. |
| **T2.16** | **Multi-language (Hindi first)** | **L** | Phase 4's structured-text requirement | Only becomes cheap *if* Phase 4's "interpretation text as structured data, not hardcoded HTML" rule is honoured. Recorded here as the payoff for that constraint. |
| **T2.17** | **Prastarashtakavarga** | **M** | `ashtakavarga.ts` | Only AstroSage has it. Low user demand; high credibility with practitioners. |

---

## 4. Recommended sequencing signal for Phase 4

Not the plan (that's Phase 4) — just what this benchmark says about ordering.

**Do first — "surfacing sprint".** T1.1, T1.2, T1.3, T2.1, T2.2, T2.3, T2.7. Every one of these is code that **already exists and is already correct**, needing only a component or a table. Collectively they close 7 matrix rows for roughly 2–3 days of work and zero astronomy risk. There is no better value-to-effort anywhere in this document.

**Do second — the delivery gap.** T1.5 (URL state), T1.6 (PDF), T1.8 (mobile). These are what separate "impressive engine" from "usable product", and T1.5 is now load-bearing given the SPA decision.

**Do third — Phase 3's voice work (T1.9).** Largest single item, and the one that most changes how the product is perceived. Everything above makes it more valuable; nothing above depends on it.

**Do fourth — matching (T1.10).** Highest-traffic feature in the vertical, largest genuinely-new build, and partially data-backed already.

**Defer.** T1.12 (daily horoscopes — value gutted by the SPA decision), T2.14 (Tajika), T2.17 (Prastarashtakavarga), and everything in §1g.

---

## 5. Two risks this benchmark surfaces

1. **You are competing against loss-leaders.** AstroSage, GaneshaSpeaks and AstroTalk fund free calculation depth from consultation and store revenue. With monetisation out of scope, matching them feature-for-feature is not a winnable race — which argues for leaning hard on the four things none of them have (why-reasoning, confidence, citations, rectification) rather than chasing their calculator counts.

2. **The SPA decision removes the standard acquisition path in this vertical.** All four competitors acquire primarily through organic search over static content. With that closed, features whose value is search-driven (daily horoscopes, article libraries, per-entity pages) should be weighted down — which is why T1.12 sits last in Tier 1 despite being on all four competitors.

---

## Sources

- [AstroSage — Free Astrology Software & Reports](https://www.astrosage.com/free/)
- [AstroSage — Free Birth Chart / Kundli Software](https://www.astrosage.com/freechart/)
- [AstroSage — Download / Save Kundli as image](https://www.astrosage.com/free/download-kundli-save-kundli-as-image.asp)
- [GaneshaSpeaks](https://www.ganeshaspeaks.com/)
- [Astrotalk](https://astrotalk.com/)
- [Astrotalk — Free Kundli](https://astrotalk.com/freekundli)
- [Cafe Astrology](https://cafeastrology.com/)
- [Cafe Astrology — Mars in the Houses (voice sample)](https://cafeastrology.com/natal/marsinhouses.html)
