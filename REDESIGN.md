# Output Format & Language Redesign — Proposal

**Date:** 2026-08-21 · **Status:** proposal only, no code written · **Inputs:** [AUDIT.md](AUDIT.md), [BENCHMARK.md](BENCHMARK.md)

Every "BEFORE" block in this document is **verbatim output from the live engine**, produced by running the builders against a real chart (Priya, 1994-03-11 06:15 IST, Pune — Aquarius Lagna, Saturn in moolatrikona in the 1st, Rahu debilitated in the 10th). Nothing is paraphrased or invented.

**Scope constraints applied:** consumer-first with an expert toggle · Speculation & Intimacy excluded · no SSR · monetisation out of scope.

---

## 0. The finding that shapes this whole proposal

**You already have half of the target structure, and it works.**

The six scored sections (career, wealth, marriage, foreign, cautions, lucky) are built on `SectionReport` in [report.ts](data/interpretations/report.ts), which already carries `headline`, `blocks`, `Evidence[]` reasoning with weights and citations, `confidence`, `verdict`, and `caveats`. Their prose is already conditional, already glosses Sanskrit via `plain()`, and already explains itself.

The **older layer does not**: personality profiles, house-by-house readings, yoga descriptions, and the year forecast are hand-written template strings with no structure, no confidence, no strength banding, and jargon that is glossed inconsistently or not at all.

So this is **not a rewrite. It is a promotion and a migration**:

1. Promote `SectionReport` from "the six scored sections" to **the universal contract every report type implements**.
2. Extend it with the three things it is missing (per-claim strength, integrated timing, structured reasoning).
3. Migrate the four legacy surfaces onto it.
4. Make the "why" data-driven — which is cheaper than it sounds, because **the tables it needs already exist**.

---

## 1. Defects found by running the live engine

These are not style problems. They are user-visible bugs, discovered by dumping real output. They must be fixed during migration or they will be carried forward.

| # | Defect | Location | Live evidence |
|---|---|---|---|
| **D1** | **`1th house` ordinal bug** — 7 sites use `${p.house}th` | [yogas.ts](utils/astrology/yogas.ts) lines 77, 102, 160, 176, 295, 358, 381 | *"Sun and Mercury conjoin in the **1th** house"* · *"Saturn … occupies the **1th** house, a kendra"* |
| **D2** | **Sentence-fragment bug** — `LAGNA_TEMPERAMENT[k].split("—")[0]` assumes an em-dash. **Only 5 of 12 strings have one**, so it fires for 7 of 12 signs | [personality.ts:231](data/interpretations/personality.ts#L231) | *"gives the soul's work a steady, sensual and immovable once settled, built for accumulation and endurance rather than speed. Comfort is sought sincerely and change resisted instinctively. **flavour**."* |
| **D3** | **Subject–verb disagreement** in the plural branch | [personality.ts:301](data/interpretations/personality.ts#L301) | *"3 combinations stamp **itself** directly on the character"* |
| **D4** | **Duplicate evidence, double-counted score** — one `addVote` per yoga *finding*, but `detectYogas` emits one Raja Yoga per lord-pair, so a planet in two pairs is credited twice with identical text | [career.ts:131](data/interpretations/career.ts#L131) | *"Raja Yoga (Kendra–Trikona link) forms in your chart and Mercury is part of it…"* appears **twice, identically, weight 8 each** |
| **D5** | **Duplicate names in a joined list** — no dedup before `.join(", ")` | [personality.ts](data/interpretations/personality.ts) resilience list | *"Neechabhanga Raja Yoga, Neechabhanga Raja Yoga"* |
| **D6** | **Zero-weight evidence renders as supportive** — `WhyList` tests `r.weight >= 0`, so weight `0` shows a green ▲ | [WhyList.tsx:24](components/panels/interpretation/WhyList.tsx#L24) | Marriage 7th-lord evidence has `weight: 0` and displays as positive |

**D2 and D4 are the serious ones.** D2 produces visibly broken English for a majority of charts. D4 silently inflates career scores.

---

# PART 3a — OUTPUT FORMAT

## 3a.1 The universal section contract

Your six required elements, mapped to fields. Everything marked **NEW** is what `SectionReport` is missing today.

| Required element | Field | Status |
|---|---|---|
| One-line headline verdict, plain language | `headline: string` | ✅ exists |
| Short "what this means for you" | `meaning: string` | **NEW** (today it's buried in `blocks[].paragraphs`) |
| Expandable "why we say this" | `because: Reason[]` | 🟡 exists as `Evidence[]` — needs to become **structured**, see §4 |
| Timing — when active/strongest | `timing?: TimingWindow[]` | 🟡 exists but as a **separate lazy function call**, not part of the contract |
| Practical guidance / remedies | `guidance: Guidance[]` | 🟡 exists as prose in some sections, absent in others |
| Strength indicator, not false certainty | `strength: "strong" \| "moderate" \| "weak"` | **NEW** — today only a 0–100 number and a section-level confidence |

### The card anatomy (applies to every report type)

```
┌──────────────────────────────────────────────────────────────┐
│ ▸  CAREER & WORK              ● Strong    ◐ High confidence  │  ← always visible
├──────────────────────────────────────────────────────────────┤
│ Your chart points clearly toward hands-on, technical work.    │  ← headline (1 line)
│                                                               │
│ Four separate parts of your chart agree on this, which is     │  ← meaning (2–4 sentences)
│ unusual. Work that involves building, fixing, or leading      │
│ under pressure will cost you less energy than work that       │
│ depends on persuasion.                                        │
│                                                               │
│ ▸ Why we say this                          (4 reasons)        │  ← collapsed by default
│ ▸ When this is strongest                   (3 windows)        │
│ ▸ What helps                               (2 suggestions)    │
└──────────────────────────────────────────────────────────────┘
```

**Three rules for the anatomy:**

1. **The headline and meaning are never collapsed.** A reader who expands nothing still gets a complete, honest answer.
2. **Strength and confidence are different things and both are always shown.** Strength = how forceful the chart's indication is. Confidence = how consistently the evidence agrees. A *strong* indication with *low* confidence is a real and important state; today the UI cannot express it.
3. **"Why" is one tap away, never zero and never three.** It is the differentiator (BENCHMARK §2) — it must be discoverable, but it must not be the first thing a nervous reader sees.

---

## 3a.2 Before → after, per report type

### Type 1 — Personality profile

**BEFORE** (verbatim, live output):

> **Lagna — the body and the bearing**
> Aquarius rises at 15°28', in Shatabhisha pada 3. The outward temperament is detached, systemic and unconventionally principled, thinking in groups and futures rather than individuals and moments. Independent to a fault, and warm in a way that surprises people.
> The Lagna lord Saturn sits in the 1st house in Aquarius — Moolatrikona, composite strength 69/100 (Strong). The life's centre of gravity therefore leans toward self: that agenda colours everything this chart attempts, and the native's sense of self is bound up in it.
> Venus (4th+9th) is the yogakaraka; Saturn protects as Lagna+12th lord. Jupiter (2nd+11th) works as a maraka-flavoured accumulator, the Moon (6th) and Mars (3rd+10th) demand dignity before their periods reward.

**Problems:** eight untranslated terms in three sentences (Lagna, pada, Shatabhisha, Moolatrikona, yogakaraka, maraka, dasha implied by "periods"). "Composite strength 69/100" is a number with no referent. The last sentence is a practitioner's shorthand note pasted into consumer prose. It never says *why* — Saturn's significations and the 1st house's remit are both assumed.

**AFTER** (structure; full voice rewrite in §3b Sample 1):

```
┌──────────────────────────────────────────────────────────────┐
│ ▸  WHO YOU ARE                ● Strong    ◐ High confidence  │
├──────────────────────────────────────────────────────────────┤
│ You come across as calm, self-contained and quietly           │
│ unconventional — and Saturn, your chart's strongest planet,   │
│ is what makes that stick.                                     │
│                                                               │
│ [Structured, not prose:]                                      │
│   How you come across   →  Detached, principled, independent  │
│   What steadies you     →  Saturn · very strong  ●●●          │
│   Your soft flank       →  Ketu · weak           ○○●          │
│                                                               │
│ ▸ Why we say this                                             │
│ ▸ What this looks like day to day                             │
└──────────────────────────────────────────────────────────────┘
```

**Key change:** the personality profile stops being nine paragraphs of prose and becomes **three or four claims, each with its own strength badge**. Prose expands beneath each.

---

### Type 2 — House-by-house reading

**BEFORE** (verbatim — this is a *single* house, one of twelve):

> **10th House — Scorpio**
> The 10th is ruled by Mars, placed in the 1st house at 9°02' Aquarius — Enemy Sign (Shatru). Counted from the 10th itself, Mars stands in the 4th — a kendra or trikona from its own house, so the lord actively supports what it rules. Its placement carries the 10th's agenda into self — that is where these significations actually play out. Composite strength 46/100 (Moderate) — Mars can carry the 10th, but results here track the native's effort closely and are not gifted.
> Rahu at 3°39' Scorpio: Rahu owns no sign and acts through its dispositor, nakshatra lord and conjunctions — a karmic agent rather than a functional lord. […] Note (Bhava Chalit): by Sripati cusps this planet actually operates from the 9th bhava — read its concrete, event-level results there, while its sign-based dignity stays as above.
> Saturn aspects this house from the 1st in Aquarius (in moolatrikona) — a natural malefic and a functional benefic for this Lagna. The glance is its tenth drishti, the aspect of imposed duty and scrutiny. […]
> Every drishti reaching this house is malefic. With no benefic counterweight, these significations need conscious defence…

**Problems:** ~450 words for one house — **×12 = 5,400 words the reader must wade through**. Terms used untranslated: dispositor, nakshatra lord, kendra, trikona, drishti, Bhava Chalit, Sripati, bhava, moolatrikona, malefic, benefic, significations, vakri. Sentences run to 45 words. Critically, the *technique* is foregrounded and the *answer* is buried — the reader learns how the lord was judged before learning what it means for their career.

**AFTER:**

```
┌──────────────────────────────────────────────────────────────┐
│ ▸  10 · CAREER & REPUTATION       ● Moderate   ◐ Moderate    │
├──────────────────────────────────────────────────────────────┤
│ Recognition comes late but is hard to take away once it does. │
│                                                               │
│ Your career house is intense and ambitious, but nothing here  │
│ is handed over. Progress tracks effort closely. The upside is │
│ that what you build tends to stay built.                      │
│                                                               │
│ ▸ Why we say this                          (5 reasons)        │
│ ▸ The technical detail            [Expert]                    │
└──────────────────────────────────────────────────────────────┘
```

**Key change — the biggest single presentation win in the app:**

- The **verdict comes first**, the technique goes into "Why".
- Degrees, dignity labels, Bhava Chalit notes, nakshatra-lord chains and drishti offsets move behind an **Expert** disclosure. Nothing is deleted — the practitioner still gets all 450 words.
- Houses get **plain-English names** ("Career & Reputation"), not bare ordinals.
- **Twelve collapsed cards, not twelve walls of text.** Occupied houses expand by default; vacant ones stay collapsed with a one-line verdict.

---

### Type 3 — Career (already close to target)

**BEFORE** (verbatim):

> **HEADLINE:** Your chart points most strongly toward technical & courage-driven — that is where the most independent factors agree.
> *why(30):* Mars rules your 10th house — the house of the work you are known for
> *why(8):* Raja Yoga (Kendra–Trikona link) forms in your chart and Mercury is part of it, which lifts everything that planet governs
> *why(8):* Raja Yoga (Kendra–Trikona link) forms in your chart and Mercury is part of it, which lifts everything that planet governs

**Problems:** the headline leaks an internal category label mid-sentence ("technical & courage-driven"). **D4 is visible** — the identical reason twice. `why(30)` gives the *what* and the *house's remit* but skips *what Mars signifies* — the chain is 3 links, not 4. Score is 95 while the visible weights sum to ~55, so the number the user sees is unexplained by the reasons shown.

**AFTER:**

| Change | Detail |
|---|---|
| Headline reads as English | "Your chart points clearly toward hands-on, technical work." |
| Reasons deduped | Fixes D4; identical `Because` values collapse with a "(×2)" marker if genuinely distinct |
| Full 4-link chain | Adds the missing "Mars is the planet of drive, courage and confrontation" link |
| Score reconciled | Either show the weight arithmetic in Expert mode, or drop the raw number and show only the strength band |
| Ranked options as cards | Currently `RankedList` collapses to one-line rows; a top-3 card treatment reads far better on mobile |

---

### Type 4 — Marriage (structurally strongest today)

**BEFORE** (verbatim):

> Your Upapada Lagna (the marriage pada — the arudha of the 12th house) falls in Pisces, and Jupiter rules it, sitting in your 9th house, Great Enemy's Sign (Adhi Shatru). This point describes marriage as a standing institution in your life rather than as romance — the household, the in-laws, the public fact of being married.
> *why(2):* Venus is your natural significator for marriage, and it stands Exalted (Parama Ucha) in your 2nd house. A significator in good condition shows up as ease in being close to someone…
> *why(0):* Your 7th house is ruled by Sun, and it sits in your 1st house, Great Enemy's Sign (Adhi Shatru). That is where your partnership life gets carried out…

**This is the closest to target already** — it glosses terms, explains itself, hedges appropriately, and the Mangal Dosha block is genuinely excellent (it states the affliction, states the cancellation, and refuses fatalism).

**Problems:** the gloss chain is doubled up ("Upapada Lagna (the marriage pada — the arudha of the 12th house)" glosses a term *using two more untranslated terms*). "Great Enemy's Sign (Adhi Shatru)" appears three times in one block — first-use glossing isn't tracked. **D6 is visible** — `why(0)` renders as supportive. `verdict` is `undefined`, so the card shows a confidence badge but no verdict chip while Career shows both.

**AFTER:** same structure, three fixes — recursive glossing banned (gloss resolves to plain English in one hop), first-use tracking per section, and `verdict` made **required** on `SectionReport` so cards are consistent.

---

### Type 5 — Year forecast / dasha

**BEFORE** (verbatim):

> Antardasha of Mercury: Mercury periods busy the calendar with commerce, communication, study, documentation and travel. Multiple income streams and multiple browser tabs. The nervous system is the period's working capital — protect it with routine. Mercury sits natally in your 1st house in Aquarius — Enemy Sign (Shatru). As lord of the 5th and 8th, its period activates intelligence and longevity. Because the period lord is natally strained, its results arrive discounted and delayed; double the diligence on its portfolios and treat windfalls with suspicion.

**Problems:** "Antardasha", "natally", "lord of the 5th and 8th", "portfolios" all untranslated. "Multiple browser tabs" is a good line in the wrong register next to "Enemy Sign (Shatru)". No strength badge, no confidence — a *weak* Mercury and a *strong* Saturn period are formatted identically. The transit text is **byte-identical across consecutive segments** (Jupiter and Saturn text repeats verbatim in segment 1 and 2) because segmentation is driven by dasha changes but transit text is re-emitted per segment.

**AFTER:**

```
2026  ────────────────────────────────────────────────────────
      Jan ──────────── May 24 ─── Jun 1 ─────────────── Dec
      │  Saturn / Mercury      │ Sat/Ketu │  Saturn / Venus  │
      │  ◐ busy, scattered     │ ○ quiet  │  ● favourable    │
      ─────────────────────────────────────────────────────────

┌──────────────────────────────────────────────────────────────┐
│  JAN – MAY          Saturn–Mercury      ◐ Moderate           │
├──────────────────────────────────────────────────────────────┤
│ A busy, scattered stretch — lots of movement, less to show    │
│ for it than the effort suggests.                              │
│                                                               │
│ ▸ Why we say this                                             │
│ ▸ What's moving overhead        (changes 24 May)              │
└──────────────────────────────────────────────────────────────┘
```

**Key changes:** a **visual timeline** instead of a stack of prose blocks; transit text emitted **once per transit-interval**, not repeated per dasha segment; a strength badge per period so a weak period is visibly weak.

---

### Type 6 — Panchang

Currently five flat cards, birth-instant only. Once T1.4 lands (today's Panchang + day-parts), the natural treatment is a **day strip**: a horizontal band showing Rahu Kaal / Gulika Kaal / Abhijit / Choghadiya blocks against the day's sunrise-to-sunset arc, with the five limbs and their end-times as a table below.

---

## 3a.3 Visual improvements

### Chart rendering — three styles

| Style | Layout | Effort | Note |
|---|---|:--:|---|
| **South Indian** (have) | 4×4 grid, **signs fixed**, planets move | — | Keep as default |
| **North Indian** | Diamond, **houses fixed**, signs move | **M** | Genuinely different geometry — needs SVG, not a CSS variant. The house number is fixed and the sign floats: the inverse of the current model. |
| **East Indian** | Square with diagonal corners, signs fixed | **S** | Closer to South Indian; mostly a border-geometry change |

**Recommended:** SVG for all three behind one `<Chakra chart={} style={} />` component, so the same renderer serves natal, varga (T1.3), and transit charts. Today `SouthIndianChart` takes `ChartData` specifically, which blocks varga reuse — the component should take a generic `{ ascendant, positions }` shape.

**Chart-cell content, mobile-first:** at ≤400 px, show glyph + degree only; move retro/combust/war flags to a legend row beneath. Current output packs `Ju 12°34' [R·C] →B9` into an ~80 px cell (AUDIT §5).

### Tables vs cards

| Content | Now | Proposed |
|---|---|---|
| Planet positions | Table, `min-w-[560px]` | **Table on desktop, cards on mobile** — one card per planet |
| Ashtakavarga | Table, `min-w-[720px]` | Table + **sticky first column**; add a bar-density view |
| Dasha tree | Nested list | Keep — it is genuinely hierarchical |
| Ranked career/income options | One-line rows | **Cards for top 3**, rows below |
| Timing windows | Rows | **Timeline strip** + cards |
| Life areas | Cards | Keep — already right |

**Rule:** a table earns its place when the reader **compares across rows**. Where they read one item at a time, use cards. Ashtakavarga is a real table. "Career options" is not.

### Colour coding — benefic / malefic

Current: `text-good` / `text-bad-strong` / `text-fg-2`, applied **by dignity only**, and **colour-only** (AUDIT §7).

Proposed, with two corrections:

| Meaning | Colour | **Glyph (required)** | Applies to |
|---|---|---|---|
| Strongly supportive | green | `▲▲` | exalted, moolatrikona, own |
| Supportive | green-soft | `▲` | great friend, friend |
| Neutral | grey | `–` | neutral |
| Straining | amber | `▼` | enemy, great enemy |
| Strongly straining | red | `▼▼` | debilitated |

1. **Never colour alone.** Every dignity/benefic marker carries a glyph. `WhyList` already does this correctly (`▲`/`▼`) — the pattern exists, it just isn't applied in `PlanetTable`, `SouthIndianChart`, or `AshtakavargaTable`.
2. **Separate *natural* from *functional* benefic.** These conflict constantly and the current UI shows only one. Live example from the house-10 reading: *"Saturn … a natural malefic and a functional benefic for this Lagna."* Saturn should render as **red by nature, green by role**, not one colour. Proposed: glyph = natural, background tint = functional.

### Mobile layout

| Fix | Detail |
|---|---|
| Tab bar | 9 tabs × icon+label wraps to 3 rows. → horizontal scroll strip with snap, icon-only under 400 px |
| Chart cells | Reduce to glyph + degree; flags to legend |
| Wide tables | `position: sticky` first column |
| `grid-cols-2` | → `grid-cols-1 sm:grid-cols-2` in both input forms |
| Manual planet table | → card-per-planet under `sm` |
| Touch targets | Several buttons are ~28 px; raise to 44 px |
| Section cards | Default-collapse all but the first on mobile |

### Print / PDF layout

Zero print CSS exists today. Proposed: a **dedicated print route/view**, not a print stylesheet over the app — the tab structure is fundamentally wrong for paper (only one tab's content exists in the DOM at a time).

```
Page 1   Cover — name, birth data, chart (chosen style), key facts
Page 2   Chart + planet table + dignities
Page 3   Who you are (personality)
Page 4–5 Life areas summary + strength bars
Page 6–8 Career · Wealth · Marriage · Foreign — headline + meaning + why
Page 9   Timing windows (life timeline)
Page 10  Year forecast
Page 11  Cautions + guidance
Page 12  Method, ayanamsha, sources, disclaimer
```

Rules: `break-inside: avoid` on cards · all disclosures force-expanded · colour → glyph + greyscale-safe · every page footed with name + birth data + ayanamsha + generation date. **No new dependency** — browser print-to-PDF over a real print view.

---

# PART 3b — INTERPRETATION LANGUAGE

## 3b.1 Voice rules, operationalised

Your rules restated as things that can be **checked mechanically**, so they can be enforced by a lint script rather than by vigilance.

| # | Rule | Enforceable check |
|---|---|---|
| **V1** | Grade 8 reading level | Flesch–Kincaid ≤ 8.0 per `headline` and `meaning`; ≤ 10 in Expert blocks |
| **V2** | Short sentences | Mean ≤ 18 words; **no sentence over 30**; ≤ 2 clauses |
| **V3** | No untranslated jargon | Every term in `GLOSSARY` must be wrapped in `plain()` on first use **per section**; a term not in the glossary may not appear at all |
| **V4** | Glosses resolve in one hop | A gloss may not itself contain a glossary term (kills "Upapada Lagna (the marriage pada — the arudha of the 12th house)") |
| **V5** | Always explain the why | Every `Claim` must carry ≥1 `Reason`; a claim with zero reasons fails the build |
| **V6** | Conditional, agency-preserving | Ban list: *will, must, never, always, destined, fated, guaranteed, cannot*. Prefer: *tends to, may, often, this period favours, you may find* |
| **V7** | Warm, not hollow | Every `challenging`-polarity claim must carry ≥1 `Guidance`. No caution without a counter-measure |
| **V8** | Faithful to the chart | Voice changes may never change a score, verdict, or window. **Enforced by golden-output tests** (Phase 4 requirement) |

**V6 needs a stated exception.** Astronomy is not a prediction: *"Jupiter enters Cancer on 3 June 2026"* is a fact and should stay in the indicative. The ban applies to **claims about the person**, not to ephemeris statements.

## 3b.2 The WHY chain

Your four-link format, adopted verbatim as the contract:

```
[placement]  →  [what that planet signifies]  →  [what the house/sign governs]  →  [therefore this effect]
```

**The key architectural insight: every link already exists as data in the repo.**

| Link | Source | Status |
|---|---|---|
| 1. Placement | `chart.planets[]` | ✅ computed |
| 2. Planet signifies | — | ❌ **new table needed** (~9 rows) |
| 3. House governs | `HOUSE_SIGNIFICATIONS` in `constants.ts` | 🟡 exists, needs a plain-English column |
| 4. Therefore | `planetInHouse.ts` — **108 curated entries** | ✅ **already written** |

So the "why" is **~9 new rows plus a plain-English column** away from being fully data-driven. That is the cheapest high-value refactor in this proposal.

---

## 3b.3 Five full rewritten samples

---

### Sample 1 — Personality profile

**BEFORE** (verbatim):

> Aquarius rises at 15°28', in Shatabhisha pada 3. The outward temperament is detached, systemic and unconventionally principled, thinking in groups and futures rather than individuals and moments. Independent to a fault, and warm in a way that surprises people.
> The Lagna lord Saturn sits in the 1st house in Aquarius — Moolatrikona, composite strength 69/100 (Strong). The life's centre of gravity therefore leans toward self: that agenda colours everything this chart attempts, and the native's sense of self is bound up in it.
> Venus (4th+9th) is the yogakaraka; Saturn protects as Lagna+12th lord. Jupiter (2nd+11th) works as a maraka-flavoured accumulator, the Moon (6th) and Mars (3rd+10th) demand dignity before their periods reward.

**AFTER:**

> ### Who you are
> **● Strong indication · ◐ High confidence**
>
> **You come across as calm, self-contained and quietly unconventional — and that's built on solid ground.**
>
> People tend to read you as steady before they read you as warm. You think in systems and long timeframes rather than in moments, which can make you seem detached when you're simply working at a different pace. You're independent by instinct, and the warmth is real — it just arrives later than people expect.
>
> <details><summary><b>Why we say this</b></summary>
>
> ▲▲ **Aquarius was rising when you were born.** The rising sign describes how you meet the world — your bearing, your first impression, the version of you a stranger sees. Aquarius is the sign of systems, groups and independent thinking. So you tend to lead with detachment and principle rather than with warmth.
>
> ▲▲ **Saturn rules Aquarius, and your Saturn is exceptionally well placed** — in its own preferred sign, sitting in your 1st house. Saturn is the planet of patience, structure and earned authority; the 1st house governs your body, your temperament and your sense of self. So the steadiness isn't a mood you're in. It's structural, and it holds under pressure.
>
> ▲ **Saturn is the strongest planet in your chart** (69 of 100). Its qualities — endurance, organisation, the long view — are what you reach for by default and what you're genuinely reliable at.
>
> ▼ **Ketu is your weakest planet** (12 of 100), in your 4th house of home and inner security. This is the soft flank: the area you're most likely to avoid or quietly hand to someone else.
> </details>
>
> <details><summary><b>What this looks like day to day</b></summary>
>
> Growth here probably isn't about adding to Saturn — that side needs no help. It's about not letting the Ketu side set the terms, because that's exactly the area you'll be tempted to route around.
> </details>

**What changed:** 8 untranslated terms → 0 (Lagna, pada, Shatabhisha, Moolatrikona, yogakaraka, maraka, dasha, "native" all gone or glossed). Mean sentence 34 → 16 words. The 4-link chain is explicit twice. "The native's sense of self" → "your". The practitioner's lordship shorthand moves to Expert mode. **The reading is unchanged** — same planets, same strengths, same conclusion.

---

### Sample 2 — House-by-house reading (10th house)

**BEFORE** (verbatim, abridged from ~450 words):

> The 10th is ruled by Mars, placed in the 1st house at 9°02' Aquarius — Enemy Sign (Shatru). Counted from the 10th itself, Mars stands in the 4th — a kendra or trikona from its own house, so the lord actively supports what it rules. […] Composite strength 46/100 (Moderate) — Mars can carry the 10th, but results here track the native's effort closely and are not gifted.
> Rahu at 3°39' Scorpio: Rahu owns no sign and acts through its dispositor, nakshatra lord and conjunctions — a karmic agent rather than a functional lord. […] Rahu is debilitated (neecha): its confidence is structurally undermined […] Note (Bhava Chalit): by Sripati cusps this planet actually operates from the 9th bhava.
> Every drishti reaching this house is malefic.

**AFTER:**

> ### 10 · Career & Reputation
> **◐ Moderate indication · ◐ Moderate confidence**
>
> **Recognition tends to come late here — but once it arrives, it's hard to take away.**
>
> This is an ambitious, intense corner of your chart, and nothing in it is handed over. Progress tracks the effort you put in quite closely. That cuts both ways: you may find early career slower than peers, and you may also find that what you build stays built.
>
> <details><summary><b>Why we say this</b></summary>
>
> ▲ **Mars rules your 10th house, and sits in your 1st.** Mars is the planet of drive, courage and confrontation; the 10th house governs career, status and how the public sees you. With Mars carrying that from your 1st house — the house of self — your work and your identity tend to be the same project. You may find it hard to switch off from what you do.
>
> ▼ **Mars isn't comfortable where it sits** (46 of 100, moderate). It can carry the 10th house's business, but it won't do it easily. This is the "results track effort" part.
>
> ▼▼ **Rahu sits in your 10th, and is weak there.** Rahu is the planet of hunger, ambition and unconventional routes; in the career house it often shows up as strong drive for recognition and a pull toward technology, media or foreign systems. Because it's weak, that ambition may run ahead of the ground under it — reputation can build faster than the foundation supporting it.
>
> ▲ **Saturn casts a strong glance on this house.** Saturn is the planet of patience and earned authority. Its influence on career usually reads as slow, durable advancement: seniority through endurance rather than through a breakthrough. It's demanding, but it's the reason the "hard to take away" part holds.
>
> **One honest caveat:** every influence reaching this house is a demanding one. There's no easy benefic support here, so this area tends to mature through difficulty rather than through luck.
> </details>
>
> <details><summary><b>The technical detail</b> <i>(Expert)</i></summary>
>
> 10th lord Mars in the 1st at 9°02' Aquarius, Enemy Sign (Shatru), composite 46/100. Counted from the 10th, Mars occupies the 4th — a kendra from its own house, so the lord supports what it rules.
> Rahu at 3°39' Scorpio, debilitated, retrograde, in Anuradha pada 1 (lord Saturn, a natural friend). Rahu owns no sign and acts through its dispositor and nakshatra lord.
> **Bhava Chalit note:** by Sripati cusps Rahu operates from the 9th bhava — read event-level results there; sign-based dignity stays as above.
> Drishti received: Saturn (10th aspect, imposed duty) from the 1st; Ketu (7th aspect) from the 4th. Both malefic; no benefic counterweight.
> </details>

**What changed:** 450 → 190 words in the default view, with the full 450 preserved in Expert. 12 untranslated terms → 0 in the default view. The verdict leads instead of the technique. The honest caveat is kept, not softened.

---

### Sample 3 — Career section

**BEFORE** (verbatim):

> **HEADLINE:** Your chart points most strongly toward technical & courage-driven — that is where the most independent factors agree.
> *why(30):* Mars rules your 10th house — the house of the work you are known for
> *why(15):* Mars rules the 10th counted from your Moon, so this direction also suits you emotionally
> *why(8):* Raja Yoga (Kendra–Trikona link) forms in your chart and Mercury is part of it, which lifts everything that planet governs
> *why(8):* Raja Yoga (Kendra–Trikona link) forms in your chart and Mercury is part of it, which lifts everything that planet governs

**AFTER:**

> ### Career & Work
> **● Strong indication · ◉ High confidence**
>
> **Your chart points clearly toward hands-on, technical work.**
>
> Four separate parts of your chart agree on this, which doesn't happen often. Work that involves building, fixing, competing or leading under pressure is likely to cost you less energy than work that depends mainly on persuasion. Engineering, defence, surgery, sport, construction and manufacturing all sit in this grain.
>
> Read this as the grain of the wood, not as a list of job titles. Work that runs with the grain is cheaper to sustain — over twenty years that matters more than any single choice of role.
>
> **Best fit** ●●● Technical & hands-on · **Possible** ●●○ Commerce & communication · **Uphill** ●○○ Advisory & knowledge
>
> <details><summary><b>Why we say this</b></summary>
>
> ▲▲ **Mars rules your 10th house.** Mars is the planet of drive, courage and physical confrontation; the 10th house governs the work you become known for. So the work that suits you tends to involve direct action rather than diplomacy.
>
> ▲ **Mars also rules the 10th counted from your Moon.** The Moon shows what you actually feel at home doing, so this direction suits you emotionally as well as practically — not just a job you're capable of, but one you're likely to settle into.
>
> ▲ **And from your Sun**, which shows who you take yourself to be. Three independent readings agreeing is what raises confidence here from moderate to high.
>
> ▲ **Jupiter is your career-support planet** (the planet that classically shows where help and advancement reach you from), sitting in your 9th house of mentors and fortune. Doors are more likely to open through people who know you than through cold applications.
> </details>
>
> <details><summary><b>Job or business?</b></summary>
>
> These sit almost level in your chart — that's a real result, not a fence-sit. A hybrid tends to work best: salaried work that quietly builds toward your own practice, or a business steadied by one anchor client. The thing worth avoiding is jumping between the two every few years without letting either compound.
> </details>

**What changed:** headline no longer leaks the internal category label. **D4 fixed** — duplicate reason removed. The 4-link chain is complete (adds "Mars is the planet of drive, courage and physical confrontation"). Raw scores replaced with three-dot strength; the number stays in Expert. Fit ranking is scannable in one line.

---

### Sample 4 — Marriage & Mangal Dosha

**BEFORE** (verbatim):

> Your Upapada Lagna (the marriage pada — the arudha of the 12th house) falls in Pisces, and Jupiter rules it, sitting in your 9th house, Great Enemy's Sign (Adhi Shatru). This point describes marriage as a standing institution in your life rather than as romance […]
> Mars sits in your 1st house, which technically forms Mangal Dosha from the Lagna and from the Moon — but your chart cancels it: Jupiter aspects Mars — the classical benefic override. That means the heat is there without the affliction the tradition warns about.

**AFTER:**

> ### Marriage & Partnership
> **◐ Mixed indication · ◐ Moderate confidence**
>
> **Warm signs on one side, some classical delay markers on the other — so for your chart, the timing matters much more than the average does.**
>
> Your chart doesn't give a single clean verdict on marriage, and that's worth saying plainly rather than smoothing over. Venus, the planet of affection, is exceptionally well placed. Some of the traditional delay indicators are also present. In a chart like this the useful question isn't "will it go well" — it's "when is the ground most favourable", which the timing section below answers.
>
> <details><summary><b>Why we say this</b></summary>
>
> ▲▲ **Venus is exceptionally strong in your chart, in your 2nd house.** Venus is the planet of affection, attraction and give-and-take; the 2nd house governs family, resources and what you gather around you. So closeness is likely to come naturally to you, and partnership tends to get easier with time rather than heavier.
>
> ▲ **Mercury is your spouse-indicator** — the planet that classically describes the person you marry. It sits in your 1st house, so your partner's temperament is likely to feel familiar rather than foreign: quick, communicative, adaptable. Look for it in how someone behaves under stress, not in how they present at first.
>
> ▼ **The lord of your 7th house of marriage is the Sun, and it's uncomfortable where it sits.** The Sun is the planet of authority and self; the 7th house governs partnership. When that lord is strained, partnership matters tend to require more deliberate effort than they do for most people.
>
> ▼ **Your marriage-institution point sits in Pisces, ruled by Jupiter — and Jupiter is strained.** This point describes marriage as a standing arrangement, rather than as romance: the household, the wider family, the public fact of being married. Its condition suggests the *institutional* side may feel less settled than the *personal* side.
> </details>
>
> <details><summary><b>Mars in your 1st house (Mangal Dosha) — and why it doesn't apply</b></summary>
>
> **● Present, but cancelled.**
>
> Mars sits in your 1st house. That placement technically forms what's traditionally called Mangal Dosha — the Mars placement checked before marriage in Indian tradition.
>
> **Your chart cancels it.** Jupiter aspects Mars, which is the classical override the same texts specify. This is not us being reassuring: the cancellation rule is as much a part of the tradition as the warning is, and it applies here.
>
> What's left is the heat without the harm. In practice it tends to read as directness — you say the difficult thing early, which is usually kinder than the alternative.
> </details>
>
> <details><summary><b>What actually helps</b></summary>
>
> The standard advice is to strengthen Venus the traditional way — Friday observances, white clothing, courtesy toward your partner. Of those, the last one carries the weight. Attention paid to the relationship is what the practice is really training.
> </details>

**What changed:** recursive gloss killed (V4) — "Upapada Lagna (the marriage pada — the arudha of the 12th house)" becomes "your marriage-institution point", explained in plain English. "Great Enemy's Sign (Adhi Shatru)" ×3 → "uncomfortable where it sits". The mixed verdict is stated honestly and redirected to something actionable. The Mangal Dosha treatment — already the best-written thing in the app — is kept almost intact.

---

### Sample 5 — Year forecast / dasha period

**BEFORE** (verbatim):

> Antardasha of Mercury: Mercury periods busy the calendar with commerce, communication, study, documentation and travel. Multiple income streams and multiple browser tabs. The nervous system is the period's working capital — protect it with routine. Mercury sits natally in your 1st house in Aquarius — Enemy Sign (Shatru). As lord of the 5th and 8th, its period activates intelligence and longevity. Because the period lord is natally strained, its results arrive discounted and delayed; double the diligence on its portfolios and treat windfalls with suspicion.
>
> Sade Sati is in its closing (setting) phase this year — Saturn in the 2nd from the natal Moon. The audit's ledger is being ruled off; burdens visibly lighten as the phase completes.

**AFTER:**

> ### January – 24 May 2026 · Saturn–Mercury
> **◐ Moderate · mixed**
>
> **A busy, scattered stretch — a lot of movement, with less to show for it than the effort suggests.**
>
> This period favours communication, study, paperwork and short travel, and you may find several things running at once. The catch is that Mercury isn't comfortable in your chart, so results tend to arrive later and smaller than the work you put in. That's not a reason to avoid starting things. It's a reason to start fewer of them and to protect your routine, because your attention is the real currency of this stretch.
>
> <details><summary><b>Why we say this</b></summary>
>
> ▲ **You're in a Mercury sub-period, inside a longer Saturn period.** In the Indian timing system, whichever planet is "running" colours that stretch of life. Mercury is the planet of commerce, communication, study and travel — so those are the themes likely to be live.
>
> ▼ **Mercury is uncomfortably placed in your chart** (54 of 100). A period run by a strained planet usually delivers its themes at a discount: things take longer, cost more, and arrive smaller than expected.
>
> ▲ **Mercury rules your 5th house** — intelligence, creativity and study. That side of the period is likely to be the productive one.
>
> ▼ **Mercury also rules your 8th house** — upheaval and things that arrive suddenly. Treat windfalls in this stretch with more caution than usual.
> </details>
>
> <details><summary><b>What's moving overhead</b> · changes 24 May</summary>
>
> **Jupiter** is passing through a favourable position relative to your Moon — one of the better transits for creativity, romance and honest risk-taking. A good stretch to start things.
>
> **Saturn** is in the closing stretch of its seven-and-a-half-year passage around your Moon (Sade Sati). This last phase presses on money and family conversations. Budget conservatively and settle debts. What survives this stretch is genuinely yours — and the weight lifts as it completes.
> </details>
>
> <details><summary><b>What helps</b></summary>
>
> Protect your routine and your sleep — with a strained Mercury running, your attention is the resource under pressure. Prefer finishing to starting. Get agreements in writing.
> </details>

**What changed:** "Antardasha", "natally", "lord of the 5th and 8th", "portfolios" all glossed or removed. Strength badge added, so a weak period looks weak. Register unified (the "browser tabs" line goes; the useful idea survives as "several things running at once"). Sade Sati explained on first use per your worked example. **Transit text now emitted once per transit-interval**, not repeated per dasha segment.

---

# PART 4 — The reusable schema

This is the part that makes the voice **durable** rather than a one-time rewrite, and it is what satisfies your Phase 4 rules (structured data, translatable, interpretation separate from calculation and presentation).

## 4.1 The problem with today's approach

```ts
// career.ts — the reasoning is a hardcoded English sentence
addVote(l10, `${PLANET_NAMES[l10]} rules your 10th house — the house of the work you are known for`, 30);
```

The reasoning is **prose at the point of computation**. Consequences: untranslatable · unlintable · inconsistent between authors · impossible to render differently for beginner vs expert · and the same fact gets phrased six different ways across six files.

## 4.2 The proposed shape — reasoning as data

```ts
/** WHY a claim holds — a structured fact about the chart, never a sentence. */
type Because =
  | { via: "lordship";     planet: PlanetId; houses: number[] }
  | { via: "occupancy";    planet: PlanetId; house: number }
  | { via: "aspect";       planet: PlanetId; house: number; offset: number }
  | { via: "karaka";       planet: PlanetId; theme: ThemeKey }
  | { via: "dignity";      planet: PlanetId; dignity: Dignity }
  | { via: "varga";        planet: PlanetId; varga: VargaId; house: number }
  | { via: "yoga";         yoga: YogaKey; planets: PlanetId[] }
  | { via: "strength";     planet: PlanetId; band: StrengthBand; score: number }
  | { via: "ashtakavarga"; planet: PlanetId; sign: number; bindus: number }
  | { via: "dasha";        level: 1 | 2 | 3; lord: PlanetId }
  | { via: "transit";      planet: PlanetId; house: number; from: "moon" | "lagna" }
  | { via: "lordFrom";     planet: PlanetId; house: number; from: "moon" | "sun" };

interface Reason {
  because: Because;
  weight: number;                    // signed contribution
  source?: Citation;                 // classical citation
}
```

**Rendering is a separate, pure function:**

```ts
function explain(r: Reason, chart: ChartData, depth: "plain" | "expert"): string;
```

It builds the 4-link chain from lookup tables:

```
{ via: "occupancy", planet: "Ma", house: 10 }

  → PLANET_NAME.Ma                    "Mars"
  → PLANET_SIGNIFIES.Ma.plain         "the planet of drive, courage and confrontation"
  → HOUSE_GOVERNS[10].plain           "career, status and how the public sees you"
  → PLANET_IN_HOUSE[Ma][10]           (already written — 108 curated entries)

  = "Mars sits in your 10th house. Mars is the planet of drive, courage and
     confrontation; the 10th house governs career, status and how the public
     sees you. So you're likely to push hard at work, and you may clash with
     authority figures."
```

**Three tables are needed. Two already exist.**

| Table | Status |
|---|---|
| `PLANET_IN_HOUSE` — the "therefore" | ✅ **exists**, 108 entries, `planetInHouse.ts` |
| `HOUSE_GOVERNS` — what the house governs | 🟡 exists as `HOUSE_SIGNIFICATIONS`; needs a plain-English column |
| `PLANET_SIGNIFIES` — what the planet stands for | ❌ **new — 9 rows** |

## 4.3 The claim and section shapes

```ts
type Strength = "strong" | "moderate" | "weak";
type Polarity = "supportive" | "mixed" | "challenging";

interface Claim {
  id: string;
  headline: string;        // ≤ 90 chars, plain, one line     [V1, V2]
  meaning: string;         // 2–4 sentences, "what this means for you"
  because: Reason[];       // ≥ 1 required                    [V5]
  strength: Strength;      // NOT a raw number                [rule 6]
  confidence: number;      // 5–95, distinct from strength
  polarity: Polarity;
  timing?: TimingWindow[]; // now part of the contract
  guidance?: Guidance[];   // required when polarity === "challenging"  [V7]
  expert?: ExpertBlock;    // degrees, dignities, Bhava Chalit, drishti offsets
}

interface Section {
  key: string;
  title: string;           // plain-English, e.g. "Career & Reputation"
  headline: string;
  strength: Strength;
  confidence: number;
  verdict: Verdict;        // REQUIRED (today optional → inconsistent cards)
  claims: Claim[];
  caveats: string[];
  hasDasha: boolean;
}
```

**`SectionReport` becomes `Section`, and *every* report type implements it** — personality, houses, yogas, year forecast, panchang included.

## 4.4 How this satisfies the Phase 4 rules

| Phase 4 rule | How |
|---|---|
| Interpretation separate from calculation | `Because` references chart facts by id; builders never format prose |
| Interpretation separate from presentation | `explain()` and components are the only places English exists |
| Structured data, not hardcoded HTML | `Claim`/`Section` are plain serialisable objects — JSON-safe |
| Translatable later | Swap the lookup tables per locale; `Because` values are language-free. **This is what makes T2.16 (Hindi) affordable** |
| Don't break calculation logic | Nothing here touches `utils/astrology/` |
| Golden-output tests | `Because[]` is comparable across a refactor — assert the *reasoning* is identical before/after, not the prose |

## 4.5 Where prose still gets hand-written

Honesty about the limit: **`PLANET_IN_HOUSE` and its siblings stay curated.** They are 108 hand-written interpretations and should be. What becomes data-driven is the **chain that connects them to the chart** — links 1–3 — plus which claims fire, their weight, strength and ordering.

Realistic target: **~80% of "why" text generated from structure, ~20% curated leaf text.** Claiming 100% would mean either a combinatorial explosion of tables or generic, hollow output — the exact failure mode your brief warns against.

---

## 5. Suggested migration order (detail belongs to Phase 4)

| Step | Why first |
|---|---|
| 0 | **Fix D1–D6.** Small, isolated, and they'd otherwise be carried into the new layer |
| 1 | Add `PLANET_SIGNIFIES` + plain column on `HOUSE_GOVERNS`; write `explain()` |
| 2 | Add `Strength`/`Polarity`/`Claim`; make `verdict` required |
| 3 | Migrate **one** section (Career) end to end as the reference implementation |
| 4 | Golden-output tests capturing `Because[]` for all six scored sections |
| 5 | Migrate the remaining five scored sections |
| 6 | Migrate the legacy four — houses, personality, yogas, year forecast |
| 7 | Expert-mode toggle |
| 8 | Visual work — chart styles, mobile, print |

Steps 0–3 are the ones that de-risk everything after.

---

## 6. Four questions before Phase 4

1. **Reading level vs. the expert tier.** Grade 8 in the default view is settled. Should the **Expert** view also be constrained (say Grade 10–12), or is it explicitly allowed to keep today's practitioner register — dignity labels, drishti offsets, virupas, Bhava Chalit notes — untouched?

2. **Raw scores.** Rule 6 asks for strength bands instead of false certainty. Should the raw numbers (`46/100`, `9.16 rupas`, `confidence 75`) be **removed entirely from the default view and kept in Expert**, or shown alongside the band? My recommendation is Expert-only: a number implies a precision the model doesn't have.

3. **"Native" → "you".** The legacy layer writes in third person ("the native"), the scored sections in second ("your chart"). Second person throughout is the consumer-first choice, but it makes the tool read less like a practitioner's worksheet. Confirm second person everywhere in the default view?

4. **House names.** I've proposed plain-English house titles ("10 · Career & Reputation"). Should the classical name (Karma Bhava) appear alongside, in Expert only, or not at all?

None of these blocks Phase 4 planning — I'll assume Expert-only numbers, second person, and plain names with the Sanskrit in Expert unless you say otherwise.
