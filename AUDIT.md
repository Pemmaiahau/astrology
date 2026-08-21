# Codebase Audit — Jyotisha Studio

**Date:** 2026-08-21 · **Branch:** `age-banded-windows-and-voice` @ `28148fc` · **Mode:** read-only, no code changed.

---

## 0. Method and baseline

### What was examined

All 96 source files (~22,000 lines) across `app/`, `components/`, `data/`, `utils/`, plus `ENGINE.md` (82 KB), `README.md`, and `data/interpretations/SOURCES.md` (33 KB).

### What was actually run

| Check | Command | Result |
|---|---|---|
| Numeric verification harness | `verify.ts` via jiti | **228 checks, ALL PASS** |
| Type check | `npx tsc --noEmit` | **Clean, exit 0** |
| Production build | `npx next build` | **Clean, exit 0** |
| Compute benchmarks | custom harness | see §4 |
| Bundle analysis | built chunk inspection | see §4 |

### Baseline judgement

**This is a strong codebase.** The astronomy is correct and pinned by 228 regression checks. Every interpretive rule is cited in `SOURCES.md`, and the disagreement log documents ~40 convention choices with reasoning. `ENGINE.md §19` is itself a 20-item self-audit of known precision decisions.

**This audit therefore deliberately does not repeat what is already documented.** Items already recorded in `ENGINE.md §19` or the `SOURCES.md` disagreement log are referenced, not re-litigated. Everything below is either (a) not documented anywhere, or (b) documented as a scope boundary but worth re-costing now that the product ambition has grown.

### One structural observation up front

The **calculation layer is production-grade; the delivery layer is a developer tool.** Every weakness below is downstream of one fact: this is a single client-rendered page with no persistence, no URL state, no server-rendered content, and no export. The engine is worth far more than the shell currently lets a user extract from it.

---

## 1. Executive summary

| # | Finding | Severity | Effort |
|---|---|---|---|
| 1 | Zero SEO surface — no indexable content, no metadata, no sitemap/robots/OG | **Critical** | M |
| 2 | No chart persistence or URL state — refresh destroys everything, nothing is shareable | **Critical** | M |
| 3 | No PDF/print/export path — the primary deliverable of every competitor | **High** | M |
| 4 | Gender-gated content (151 KB source) ships to 100% of visitors | **High** | S |
| 5 | Birth date accepted with no bounds, silently exceeding ayanamsha validity | **High** | S |
| 6 | No "birth time unknown" path — excludes the majority of real Indian users | **High** | M |
| 7 | Geocoding API is a single point of failure with no fallback and a silent catch | **High** | S |
| 8 | Manual mode accepts astronomically impossible charts with no warning | **Medium** | S |
| 9 | Chart failure is a silent `catch → null` — user sees an empty page, no error | **Medium** | S |
| 10 | Only South Indian chart style; no North or East Indian | **Medium** | M |
| 11 | Mobile: 9-tab bar wraps to 3 rows; chart cells ~80 px on a 360 px screen | **Medium** | S |
| 12 | Accessibility: no landmarks, no focus-visible, 11 aria attributes total, no tab semantics | **Medium** | M |
| 13 | 11 dead exports; `predictions.ts` is 74% unreachable | **Low** | S |
| 14 | Vedic coverage gaps — see §8 (matching, Panchang day-parts, dashas, Ashtakavarga refinements) | **Varies** | — |

---

## 2. Dead code

### 2a. Never-referenced exports (11 confirmed)

Each appears exactly once in the repo — at its own definition site.

| Symbol | File |
|---|---|
| `CHARA_KARAKA_NAMES` | [utils/astrology/jaimini.ts](utils/astrology/jaimini.ts) |
| `HIGH_RESOLUTION_VARGAS` | [utils/astrology/rectification/types.ts](utils/astrology/rectification/types.ts) |
| `MEAN_DAILY_MOTION` | [utils/astrology/constants.ts](utils/astrology/constants.ts) |
| `NOCTURNAL_PLANETS` | [utils/astrology/constants.ts](utils/astrology/constants.ts) |
| `RiseInfo` | [utils/astrology/ephemeris.ts](utils/astrology/ephemeris.ts) |
| `VARGA_SIGNIFICATIONS` | [utils/astrology/varga.ts](utils/astrology/varga.ts) |
| `fmtLongitude` | [utils/astrology/math.ts](utils/astrology/math.ts) |
| `naturalMalefics` | [utils/astrology/aspects.ts](utils/astrology/aspects.ts) |
| `primaryHousesFor` | [utils/astrology/rectification/rectify.ts](utils/astrology/rectification/rectify.ts) |
| `buildYearlyPrediction` | [data/interpretations/predictions.ts](data/interpretations/predictions.ts) |
| `buildMonthlyPrediction` | [data/interpretations/predictions.ts](data/interpretations/predictions.ts) |

Not dead despite matching the pattern: `GET` in [app/api/rectify/route.ts](app/api/rectify/route.ts) (route handler) and `metadata` in [app/layout.tsx](app/layout.tsx) (Next.js convention).

Several of these are *latent assets rather than junk* — `VARGA_SIGNIFICATIONS` and `CHARA_KARAKA_NAMES` are exactly the plain-English glosses Phase 3 will need. Recommend keeping those two and deleting the rest.

### 2b. `predictions.ts` is 74% unreachable

[data/interpretations/predictions.ts](data/interpretations/predictions.ts) is 128 lines. Only `dashaLordAssessment` (lines 1–33) is imported anywhere — by [yearForecast.ts:13](data/interpretations/yearForecast.ts#L13). The remaining 95 lines (`buildYearlyPrediction`, `buildMonthlyPrediction`) were superseded when `yearForecast.ts` took over the Predictions tab and are now unreachable.

`ENGINE.md §20` still routes "New prediction cadence (weekly, N-year outlook)" to this file — a stale pointer to dead code. **Recommendation:** move `dashaLordAssessment` into `yearForecast.ts`, delete `predictions.ts`, update the §20 index row.

### 2c. Not dead — deliberate

- `utils/astrology/__checks__/*` are never imported by the app *by design* (documented in the file header). Keep.
- The `GET` handler returns a 405 with a schema hint. Keep.

### 2d. Machinery built but never surfaced

Not dead code, but valuable work reachable from only one panel:

- **Sudarshana Chakra** and **Muntha** are fully implemented in [rectify.ts:365-411](utils/astrology/rectification/rectify.ts#L365-L411) but are only used as rectification evidence. Both are standard natal/annual features on every competitor site. Near-zero cost to surface.
- **Yoni-kuta tables** exist in [nakshatraTraits.ts](data/interpretations/nakshatraTraits.ts) — half the input needed for compatibility matching (see §8f).

---

## 3. Missing validation

### 3a. Birth date has no bounds — and silently exceeds ayanamsha validity · **High**

[AutoInput.tsx](components/inputs/AutoInput.tsx) renders `<input type="date" required>` with no `min` or `max`. A user can enter `0001-01-01` or `9999-12-31` and receive a confidently-formatted chart.

This directly contradicts a documented precision boundary. `ayanamsha.ts` states accuracy "degrades slowly outside roughly ±150 years of J2000" — i.e. valid ~1850–2150. `ENGINE.md §19` says to "flag any request involving historical charts far outside that window." Nothing flags it.

The inconsistency is sharp: [PredictionPanel.tsx](components/panels/PredictionPanel.tsx) clamps the *forecast* year to `MIN_YEAR = 1850` / `MAX_YEAR = 2150` — the correct bounds — while the *birth date* that everything else derives from is unbounded.

**Fix:** `min="1850-01-01" max="2150-12-31"` on the input, plus a soft warning band at the edges. Same bounds in `ManualInput`'s anchor and the `/api/rectify` validator.

### 3b. No "birth time unknown" path · **High**

Both input modes require an exact `HH:mm`. `AutoInput` defaults to `12:00` — so a user who does not know their birth time gets a **noon chart presented with full confidence**: a Lagna, houses, Bhava Chalit cusps, Shadbala, D-60, and dasha dates precise to the day, none of which are meaningful.

Most Indian users do not know their birth minute. This is the single largest correctness-of-presentation gap in the product. Competitors handle it with a "time unknown" toggle that switches to a Chandra-lagna (Moon-as-ascendant) reading and suppresses house-dependent claims.

The Rectification tab addresses the adjacent problem but requires 5+ dated life events — a much higher bar than "I don't know the time."

**Fix:** a `timeKnown: boolean` on the input state; when false, suppress the ascendant-dependent surfaces, read from the Moon, and label every panel accordingly. The engine already has everything needed — `transits.ts` already computes `houseFromMoon`, and `computeShadbala` already returns `null` without a birth anchor and falls back transparently.

### 3c. Geocoding is a single point of failure with a silent catch · **High**

[CitySearch.tsx:57](components/inputs/CitySearch.tsx#L57):

```ts
} catch {
  setResults([]);
}
```

A network failure, an Open-Meteo outage, a corporate proxy, or the Great Firewall produces **an empty dropdown indistinguishable from "no city matched."** There is no error message, no retry, and — critically — **no manual latitude/longitude/timezone entry anywhere in the app.**

Because `place` is required for `ready` in `AutoInput`, a geocoding failure makes the entire ephemeris mode unusable with no diagnosis and no workaround. This is the app's only external runtime dependency and it has no fallback.

**Fix:** (1) surface the error state; (2) add a manual lat/lon/IANA-timezone fallback panel; (3) cache recent lookups in `localStorage`.

### 3d. Chart computation failure is silent · **Medium**

[ChartContext.tsx:104-110](components/context/ChartContext.tsx#L104-L110):

```ts
try {
  return committed.kind === "auto" ? computeAutoChart(...) : computeManualChart(...);
} catch {
  return null;
}
```

`chart === null` renders the "Cast a chart to begin" empty state — the same UI as never having submitted. A user who *did* submit sees their input apparently ignored, with no error and nothing in the UI to indicate anything went wrong.

**Fix:** distinguish `null` (nothing submitted) from `{ error }` (submitted and failed), and render the error.

### 3e. Manual mode accepts astronomically impossible charts · **Medium**

`ManualInput` lets each graha be placed in any house at any degree with no cross-planet constraints. The engine will compute, score, and confidently interpret charts that cannot physically exist:

- **Mercury more than 28° from the Sun** (max elongation ~27.8°)
- **Venus more than 48° from the Sun** (max elongation ~47.8°)
- **Rahu and Ketu not exactly 180° apart** — including both in the same house
- **A retrograde Sun or Moon** (correctly blocked in the UI) but no equivalent guard on the impossible elongations

Rahu/Ketu is the worst of these: nothing in `computeManualChart` derives Ketu from Rahu, so a user who mis-enters one node gets a chart where the nodal axis is broken — and `detectYogas` will then evaluate Kala Sarpa against a nonsense arc.

**Fix:** a `validateManualChart()` returning warnings (not hard blocks — hand-copied charts from an almanac sometimes disagree slightly). Auto-derive Ketu from Rahu with an override.

### 3f. Smaller validation gaps

| Gap | Location | Note |
|---|---|---|
| No DST-gap detection | [time.ts](utils/astrology/time.ts) `localToUtc` | A non-existent civil time (spring-forward gap) converges silently to a nearby instant. `tzOffsetMinutes` exists precisely to judge this and *is* used in rectification's `timezoneWarnings` — but the main input path never calls it. |
| No polar-latitude notice | [houses.ts](utils/astrology/houses.ts) | `bhavaMethod: "equal"` fallback is correct and flagged in the data, but only surfaces in the chart centre block *when Chalit mode is on*. A high-latitude birth in Rashi mode shows nothing. |
| No name-length/charset validation | `AutoInput`, `ManualInput` | Feeds `nameNumber()`; non-Latin scripts silently score 0 letters → `namank: null` with no explanation. |
| `/api/rectify` has no rate limit or body-size cap | [route.ts](app/api/rectify/route.ts) | `force-dynamic`, unauthenticated, and each call costs ~170 ms of CPU. Fine today; a liability the moment the site is public. |

---

## 4. Performance

### 4a. Compute is not the problem — measured

Benchmarked on this machine (Node 24, 1990-06-15 07:42 Mumbai):

| Stage | Time |
|---|---|
| `computeAutoChart` | 6.8 ms |
| `computeShadbala` | 2.0 ms |
| `computePanchang` | 0.8 ms |
| `interpretFullChart` | 0.4 ms |
| `computeVargaSet` | 0.4 ms |
| `vimshottariTree`, `currentTransits`, `detectYogas`, `allStrengths`, `computeJaimini`, `computeAshtakavarga`, `computeBhavaBala`, `buildPersonalityProfile` | ≤0.3 ms each |
| **Total always-on cascade** | **~11 ms** |

Section builders are effectively free (0.1–0.2 ms each). The lazy work is the expensive part:

| Lazy / on-demand | Time |
|---|---|
| `careerTimingWindows` | 56 ms |
| `marriageTimingWindows` | 53 ms |
| `buildYearForecast` (1 year) | 10 ms |
| `solarReturn` | 0.1 ms |

**Verdict:** the architecture's decision to gate timing scans behind `SectionCard`'s first-expand is correct and load-bearing. Without it the Interpretation tab would cost ~250 ms.

**Remaining issue:** those 50 ms run **synchronously on the main thread inside a render**, with no `useTransition` and no pending indicator. Expanding a card produces a visible ~50 ms jank on desktop and 150–250 ms on a mid-range phone. Wrapping in `startTransition` with a skeleton is a small, high-value fix.

### 4b. Bundle is the problem — measured

```
Route (app)                     Size    First Load JS
┌ ○ /                          192 kB          294 kB
+ First Load JS shared by all           102 kB
```

Raw chunk: `app/page-*.js` = **498 KB uncompressed / 163 KB gzipped**. Total static JS gzipped: **430 KB**.

294 KB First Load JS for a page whose above-the-fold content is a form is heavy — roughly 2–3× a typical content site, and it is all blocking because everything is client-rendered.

### 4c. Gender-gated content ships to every visitor · **High**

[page.tsx](app/page.tsx) statically imports `SpeculationPanel` and `IntimacyPanel` at module top-level, even though `GENDER_TABS` are only appended when `chart.meta.gender === "other"`.

Verified by grepping the built chunk: the strings `"shayana sukha"` and `"Yoni kuta"` — both unique to `intimacy.ts` — are present in `page-*.js`.

`speculation.ts` (87 KB) + `intimacy.ts` (64 KB) = **151 KB of source that the overwhelming majority of visitors can never reach**, downloaded and parsed on every first load.

**Fix:** `next/dynamic` on both panels. One-line change per panel, no logic touched, and it should remove a large fraction of the 192 KB route size.

### 4d. Other performance notes

| Issue | Detail |
|---|---|
| No code-splitting at all | Every panel — Rectification, Ashtakavarga, Dasha, Life Areas — is statically imported. Only one is visible at a time. |
| `now` frozen at page load | `const [now] = useState(() => new Date())` in ChartContext. Documented in `ENGINE.md §19` as deliberate; correct for determinism, but a tab left open overnight shows yesterday's "current" dasha with no indication. |
| Repeated `chart.planets.find()` | The `find(p => p.id === X)` idiom appears ~200× across the codebase. Each is O(9) and irrelevant in isolation, but a `Map<PlanetId, PlanetPosition>` on `ChartData` would simplify a lot of call sites. Cosmetic, not urgent. |
| `ChartContext` value memo has 24 dependencies | Any state change (year selector, chart style, theme) re-creates the whole context value and re-renders every consumer. Splitting settings state from computed state would help, but nothing measured is slow enough to justify it yet. |
| No `next.config.ts` optimisation | Empty config. No `compress`, no `optimizePackageImports` for `lucide-react` (which imports fine as-is via ESM, but worth confirming), no image config (no images exist). |

---

## 5. Mobile responsiveness

Breakpoint usage is very thin — **12 files use any responsive prefix at all**, and 10 of those use it once or twice:

```
SouthIndianChart.tsx : 10      (all font-size bumps)
SpeculationPanel.tsx : 3
RectificationPanel   : 2
IntimacyPanel        : 2
...9 more files      : 1 each
```

### Concrete problems

| Problem | Location | Effect at 360–390 px |
|---|---|---|
| **Tab bar wraps to 3 rows** | [page.tsx](app/page.tsx) — `flex flex-wrap` over 7 (or 9) tabs with icon + label | Consumes ~120 px of vertical space before any content. Needs a horizontal scroll strip or a select. |
| **Chart cells are ~80 px wide** | [SouthIndianChart.tsx](components/charts/SouthIndianChart.tsx) — `grid-cols-4`, `min-h-[92px]` | A cell with 3 occupants renders `Ju 12°34' [R·C]` at `text-[9px]` in ~80 px. Effectively unreadable; the primary visual of the entire app. |
| **Four tables force horizontal scroll** | `AshtakavargaTable` (`min-w-[720px]`), `PlanetTable` (`min-w-[560px]`), `CandidateTable` (`min-w-[520px]`), `AyanamshaCompare` (`min-w-[420px]`) | `overflow-x-auto` is correctly applied so the page body does not scroll — but a 720 px table in a 360 px viewport is a 2× scroll with no sticky first column, so the reader loses the row label. |
| **`grid-cols-2` never collapses** | `AutoInput` (date/time), `ManualInput` (×3), `page.tsx` (mode toggle) | Two `type="date"`/`type="time"` inputs side by side at ~160 px each; native pickers are cramped on iOS. |
| **Manual planet table is 4 columns of controls** | [ManualInput.tsx](components/inputs/ManualInput.tsx) | A `<select>` with `H7 — Libra` plus a number input plus a checkbox, 9 rows, in 360 px. Barely usable. |

### What is already right

- The main layout `lg:grid-cols-[minmax(380px,460px)_1fr]` degrades correctly to single-column.
- `PredictionPanel`'s month grid uses `md:grid-cols-2`.
- `SouthIndianChart` does scale its type at `sm:`.
- No horizontal body overflow anywhere — all wide content is in `overflow-x-auto` containers.

### Not present at all

- No print stylesheet (`@media print` appears zero times).
- No `viewport` export in `layout.tsx` (Next.js supplies a default, but `themeColor` and `maximumScale` are unset).
- No touch-target audit — several buttons are `px-2 py-1` (~28 px), below the 44 px recommendation.

---

## 6. SEO

**This is the largest gap in the audit, and it is close to total.**

### 6a. There is no indexable content

`app/page.tsx` is `"use client"` in its entirety. The static HTML Next.js prerenders contains: the header, the ayanamsha/node toggles, the disclaimer, the input form, and the "Cast a chart to begin" empty state. **That is the complete crawlable surface of the site.**

Every one of the app's real assets — 108 planet-in-house readings, 35 conjunction dynamics, the 9×12 aspect matrix, 27 nakshatra profiles, 16 divisional charts, yoga descriptions, house significations — exists only as JavaScript-generated output for a chart that only the user's own input can produce. Google indexes one page: a form.

### 6b. Metadata is two fields

[layout.tsx](app/layout.tsx) sets only `title` and `description`. Absent:

- `openGraph` / `twitter` cards — every share on WhatsApp, X, or LinkedIn renders as a bare URL
- `metadataBase`, `alternates.canonical`
- `keywords`, `authors`, `robots`
- `viewport` / `themeColor`
- JSON-LD structured data (`WebApplication`, `FAQPage`, `BreadcrumbList`)

### 6c. No routing surface

There is exactly one route (`/`) plus one API endpoint. Missing:

- `app/sitemap.ts`, `app/robots.ts`
- `app/icon.tsx` / `favicon` / `apple-icon` — no favicon exists at all
- `app/opengraph-image.tsx`
- `error.tsx`, `not-found.tsx`, `loading.tsx` (the `/_not-found` route in the build output is Next.js's default, not a custom one)

### 6d. No URL state — the compounding failure

Nothing in the app reads or writes the URL (`useSearchParams` and `useRouter` appear zero times). Consequences:

1. **A chart cannot be linked, shared, or bookmarked.** The single most natural viral action in this product category is impossible.
2. **Refresh destroys the chart.** No `localStorage` persistence either — the only things persisted are the theme, the disclaimer dismissal, and rectification events.
3. **Browser back/forward do nothing** — tab state is `useState`.
4. **No analytics can attribute anything**, because every session is one pageview of `/`.

### 6e. What a competitive SEO posture needs

> **DECISION (2026-08-21): the site stays a single-page app.** Server-rendered content routes are **out of scope**. The findings in §6a–§6d stand as a factual record of the trade-off being accepted, and the page families below are recorded as *forgone opportunity*, not as planned work.
>
> **Still in scope, because none of it requires server rendering:** metadata (`openGraph`, `twitter`, `canonical`, `metadataBase`), favicon and `opengraph-image`, `robots.ts`/`sitemap.ts` for the single route, JSON-LD `WebApplication`, `error.tsx`/`not-found.tsx`, and — most valuable — **client-side URL state (§6d), which makes charts shareable and bookmarkable without any architectural change.** Those are carried forward.

Every major competitor ranks on hundreds of static, evergreen, per-entity pages. This engine already *contains* the content for those pages; it just has no route to render them at. Candidates, in value order:

| Page family | Count | Content source (already exists) |
|---|---|---|
| `/nakshatra/[name]` | 27 | `nakshatraTraits.ts`, `NAKSHATRA_QUALITIES` |
| `/planet-in-house/[planet]-[house]` | 108 | `planetInHouse.ts` |
| `/sign/[sign]` (Lagna profiles) | 12 | `lordships.ts`, `personality.ts` |
| `/yoga/[name]` | ~15 | `yogas.ts` descriptions |
| `/divisional-chart/[id]` | 16 | `VARGA_SIGNIFICATIONS` (currently dead code — §2a) |
| `/panchang/[date]` (+ today) | daily | `panchang.ts` + `panchangTexts.ts` |
| `/dasha/[planet]` | 9 | `DASHA_THEMES` in `transitTexts.ts` |

That is ~190 static pages from content already written and cited, requiring server components over existing pure functions and no new astronomy. This is the highest-leverage work available in the entire repo.

---

## 7. Accessibility

Not requested explicitly, but it materially affects both UX and SEO, so it is recorded briefly.

| Issue | Detail |
|---|---|
| **Tabs are not tabs** | [page.tsx](app/page.tsx) renders `<button>`s with no `role="tab"`, `aria-selected`, `aria-controls`, or `tabpanel`. Screen readers announce nine unlabelled buttons. |
| **Collapsibles are not disclosures** | `SectionCard`, `LifeAreasPanel`, `RankedList`, `DashaPanel` all toggle with `useState` and no `aria-expanded` / `aria-controls`. |
| **11 aria attributes in the entire app** | Concentrated in `PredictionPanel`, `ThemeToggle`, `Disclaimer`, `EventForm`. |
| **No landmarks** | One `<header>`, one `<main>`, one `<footer>` in `page.tsx`; no `<nav>`, no skip link, no `aria-label` on regions. |
| **No `:focus-visible` styling** | Every interactive element uses `outline-none` on inputs; buttons have no focus ring at all. Keyboard navigation is invisible. |
| **`CitySearch` combobox has no ARIA** | A custom autocomplete with no `role="combobox"`, `aria-autocomplete`, `aria-activedescendant`, and no arrow-key navigation — mouse only. |
| **Colour-only signalling** | `WhyList` uses `▲`/`▼` (good — a glyph, not only colour), but `PlanetTable` dignity, `AshtakavargaTable` SAV bands, and `SouthIndianChart` dignity chips are colour-only. |
| **Dark-theme contrast unverified** | The light theme's WCAG-AA check is claimed in `README.md`; the dark theme uses many `rgb(… / 0.x)` values over a gradient body, which cannot be statically verified. |

---

## 8. Vedic astrology principle coverage

The question asked was *"missing validation as per Vedic astrology principles, covering all aspects."* Read two ways — (a) is what is implemented **correct**, and (b) what **principles are absent**.

### 8a. Correctness of what IS implemented — verdict: sound

I found **no calculation defect** not already known and pinned. The 228-check harness covers the areas where errors would be most damaging: graha yuddha across sign boundaries, nodal retrogression, polar-latitude bhava degeneracy, `fmtDeg` truncation over 20,000 samples, Vimshopaka weight totals, dasha tree translation rates, and a null-calibrated false-positive rate for rectification.

Two things deserve explicit praise because they are unusual: the **rectification module's statistical honesty** (an empirically-measured 5.0% FPR against a random-event null, rather than an asserted threshold), and the **refusal to implement D-30 "chastity" readings**, documented in the disagreement log with reasoning.

**Convention choices I would raise for discussion but not call defects** (all documented, all defensible):

| Topic | Current | Note |
|---|---|---|
| Nodal drishti | Rahu/Ketu given 5/7/9 | A large minority tradition denies nodal aspects entirely. Consider a toggle, since it changes yoga detection. |
| Partial aspects | Not modelled (binary drishti) | Classical Parashari 3/4, 1/2, 1/4 strengths are omitted. Correctly documented as a scope boundary; worth revisiting because a *strength indicator* is exactly what Phase 3 asks for. |
| Conjunction = whole sign | Two planets 3° apart across a cusp are not conjunct | Consistent with the engine's whole-sign stance, but diverges from every commercial tool. |
| Ayanamsha count | Lahiri + Pushya only | Raman, KP/Krishnamurti, Fagan-Bradley, True Chitra are all standard elsewhere. `ENGINE.md §20` already routes this as a 3-file change. |

### 8b. Missing — Dashas

**Vimshottari only.** All of these are standard on competitor sites and several are load-bearing in real practice:

- **Yogini** (8 periods, 36-year cycle) — very common in North India
- **Ashtottari** (108-year) — used conditionally
- **Kalachakra** — nakshatra-pada driven, a different logic family
- **Chara dasha (Jaimini)** — the natural pairing for the Jaimini layer *already implemented* in `jaimini.ts`; this is the cheapest high-value dasha to add
- **Conditional dashas** (Shashtihayani, Dwadashottari, etc.) — low priority
- **Sookshma / Prana levels** — `dasha.ts` stops at Pratyantar (level 3). `ENGINE.md §20` notes extending `buildSubPeriods` is a small change.

### 8c. Missing — Upagrahas (shadow planets) · notable gap

**Completely absent.** No `Gulika`, `Mandi`, `Dhuma`, `Vyatipata`, `Parivesha`, `Indrachapa`, `Upaketu`, `Kala`, `Mrityu`, `Ardhaprahara`, `Yamaghantaka`.

**Gulika/Mandi in particular** is not an exotic technique — it is used routinely for maraka analysis, longevity, and event timing, and appears on every major Indian astrology site. It is computable from data the engine already has: the sunrise/sunset arcs (`sunriseFor`, `sunsetFor`, `nextSunrise` all exist in `ephemeris.ts`) divided into eighths by weekday. **Low effort, high classical credibility.**

### 8d. Missing — Panchang day-parts · notable gap

`computePanchang` returns the five limbs correctly (Tithi, Vara, Nakshatra, Yoga, Karana) — but the *practical* Panchang that users actually consult daily is absent:

- **Rahu Kaal**, **Gulika Kaal**, **Yamaganda** (the three inauspicious day-eighths)
- **Abhijit Muhurta** (the auspicious mid-day window)
- **Choghadiya** (8 day + 8 night segments)
- **Hora** (planetary hours)
- **Dur Muhurtam**, **Varjyam**, **Amrit Kaal**
- **Tithi/Nakshatra/Yoga end-times** — the panel shows only the value at birth, not when each began or ends
- **Sunrise/sunset/moonrise/moonset** — sunrise is computed but only used internally for Vara

All of these derive from the sunrise/sunset arcs already computed. This is the single densest cluster of missing-but-cheap classical features in the repo, and it is also the highest-traffic content category in the entire vertical.

### 8e. Missing — Ashtakavarga refinements

BAV grid and SAV row are correct (total 337 verified). Absent:

- **Trikona Sodhana** and **Ekadhipatya Sodhana** (the two classical reductions)
- **Shodhya Pinda** (the reduced total used for longevity/wealth inference)
- **Kakshya** — the 8 sub-divisions of each sign, which is *the* classical mechanism for Ashtakavarga-based transit timing
- **Prastarashtakavarga** (the full expanded tables)
- **Ashtakavarga transit rules** — the engine uses Jupiter's bindus as a scoring input in `scan.ts` but does not present "Saturn transits a sign where you have 2 bindus" to the reader

`ENGINE.md §20` already anticipates this as a layer over existing `bav`/`sav`.

### 8f. Missing — Compatibility matching (Kundali Milan) · **the largest feature gap**

**Absent entirely.** No two-chart input, no synastry, no matching.

This is worth calling out separately because it is (a) the single highest-traffic feature on every Indian astrology site, and (b) **half-built already**:

- Yoni-kuta tables exist in `nakshatraTraits.ts` (27-row assignment + 7 enemy pairs)
- Gana classification exists
- Mangal Dosha with cancellations exists in `marriage.ts` (`checkMangalDosha`)
- Nakshatra, pada, Rashi, Nakshatra-lord all available per chart

What is missing is the eight-kuta scoring (Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, Nadi = 36 guna), Nadi dosha with exceptions, Bhakoot dosha, and a two-chart input path.

`SOURCES.md` correctly records the current refusal ("Yoni kuta is a *pair* technique; running it against a hypothetical partner would be inventing the other half of the input") — that refusal is right for *single-chart* mode and dissolves the moment a second chart is a real input.

### 8g. Missing — Transit (Gochara) technique

`transits.ts` computes house-from-Moon and house-from-Lagna for 6 bodies. Missing:

- **Vedha** (obstruction points) — implemented for *rectification* (`VEDHA_TABLE` in `transitFitness.ts`) but not exposed in the Predictions tab
- **Tara Bala** (the 9-fold nakshatra cycle from the birth star: Janma, Sampat, Vipat, Kshema, Pratyari, Sadhaka, Vadha, Mitra, Ati-Mitra)
- **Chandrashtama** (Moon transiting the 8th from natal Moon) — a widely-watched monthly marker
- **Kakshya transit** (see §8e)
- **Ashtama Shani**, **Kantaka/Ardhashtama Shani** — Sade Sati is handled; its siblings are not
- **Mercury and Venus transits** — explicitly not tracked (`ENGINE.md §19`)

### 8h. Missing — Varshaphal / Tajika

`solarReturn()` computes a sidereal solar return, and `ENGINE.md §19` is explicit that this is *not* Varshaphal. Missing for a real annual chart: **Muntha** (implemented in `rectify.ts` but not surfaced — §2d), **year lord** (5-candidate Panchadhikari procedure), **Sahams** (Arabic-part analogues), **Mudda dasha**, **Tajika aspects** (Ithasala, Ishrafa, etc.), **Panchavargiya bala**, **Tri-pataki chakra**.

### 8i. Missing — Yogas

~15 yoga families detected. Two specific gaps stand out beyond raw count:

1. **Asymmetry around the Moon.** `Kemadruma` (the *negative* lunar isolation yoga) is detected, but its three positive counterparts — **Sunapha**, **Anapha**, **Durudhara** — are not. Same rule family, same data, opposite polarity. Detecting only the bad one skews every chart's reading pessimistically. This is the clearest interpretive imbalance I found.

2. **Parivartana is computed but never reported.** `inExchange()` in [yogas.ts](utils/astrology/yogas.ts) detects sign exchange and uses it for Raja/Dhana yoga, but **Parivartana Yoga itself** (Maha, Khala, Dainya) is never emitted as a finding, despite `report.ts`'s glossary already defining "parivartana".

Also absent: Adhi, Chatussagara, Pushkala, Kahala, Shrinatha, Vasumati, Chamara, Sarala/Vimala as standalone, Grahan/Chandal (Sun/Moon + node), Angarak (Mars + Rahu), Guru Chandal, Vish yoga, Punarphoo, Sarpa, Pravrajya, Sanyasa.

### 8j. Missing — other frameworks

| Framework | Status |
|---|---|
| **KP (Krishnamurti Paddhati)** | Absent — no sub-lords, no cusp sub-lords, no KP ayanamsha, no ruling planets |
| **Muhurta** (electional) | Absent — no auspicious-time finder |
| **Prashna** (horary) | Absent |
| **Ayurveda / Prakriti** | Absent — no dosha (Vata/Pitta/Kapha) from chart |
| **Longevity (Ayurdaya)** | Absent — no Pindayu/Nisargayu/Amshayu; deliberate and probably correct on ethical grounds, but should be a *stated* refusal like the D-30 one |
| **Naisargika/Sthira karakas** | Chara karakas implemented; the fixed natural karakas (Sun=father, Moon=mother, …) are used implicitly in text but not modelled as a queryable table |
| **Sudarshana Chakra** | Implemented in `rectify.ts` only (§2d) |
| **Bhava Chalit-driven dignity** | Deliberately excluded (`ENGINE.md §19`) — correct as documented |

### 8k. Remedies

Gemstones (`PLANET_GEMSTONES`) and colours (`PLANET_COLOURS`) exist as constants and surface in `LuckyCard`. Remedial *prose* appears in `cautions.ts`, `marriage.ts`, `synthesis.ts`, `conjunctions.ts` and `yogas.ts`. But there is **no structured remedy engine** — no per-planet mantra/deity/donation/fasting-day table, no "which planet needs propitiation" ranking derived from Shadbala/Ishta-Kashta, and no rudraksha/yantra data. Competitors monetise this heavily.

---

## 9. Scope decisions and what carries forward

### 9a. Decisions taken 2026-08-21

These were confirmed after the audit and constrain Phases 2–4.

| Decision | Consequence for this audit |
|---|---|
| **Consumer-first, with an expert-mode toggle** | Plain-English output becomes the default; the existing technical surfaces (Shadbala virupas, varga tables, evidence weights, Jaimini, rectification) move behind "Advanced" rather than being removed. Nothing in §8's depth work is wasted — it becomes the expert tier. |
| **Speculation & Intimacy stay silently gated** | Excluded from the Phase 2 benchmark and the Phase 3 voice rewrite. The §4c bundle fix still applies — lazy-loading them changes no visibility behaviour. |
| **No monetisation planned** | Paywalls, consultation booking, stores and report-purchase flows are benchmarked for context only and are **never Tier 1**. |
| **Stays a single-page app** | §6a–§6c content routes are out of scope. §6e's ~190 static pages are recorded as forgone. Metadata, OG, favicon, robots/sitemap, JSON-LD and **client-side URL state remain in scope** — none need server rendering. |

### 9b. Carried forward

**Cheap and high-value (engine already has the inputs):**
1. Panchang day-parts — Rahu Kaal / Gulika Kaal / Choghadiya / Hora / Abhijit (§8d)
2. Gulika & Mandi upagrahas (§8c)
3. Sunapha / Anapha / Durudhara + Parivartana yoga reporting (§8i) — fixes a genuine interpretive imbalance
4. Surface Muntha + Sudarshana Chakra from `rectify.ts` (§2d)
5. `next/dynamic` on the two gated panels (§4c)
6. Birth-date bounds (§3a)
7. Metadata / OG / favicon / JSON-LD — SPA-compatible subset of §6

**Expensive but decisive:**
8. **Client-side URL state + chart persistence + share links (§6d)** — now the highest-value non-astrology item on the list, since it is the only shareability mechanism left once SSR is off the table
9. Kundali Milan / two-chart matching (§8f)
10. "Birth time unknown" mode (§3b)
11. PDF / print report (§1)
12. North & East Indian chart styles (§1)
13. Mobile pass — tab bar, chart legibility, sticky table columns (§5)

**Do not touch:**
- The astronomy in `utils/astrology/` beyond additive modules — 228 checks pass and the conventions are documented and deliberate.
- The `SOURCES.md` refusals (D-30 chastity, single-chart yoni matching, unbanded intimacy). They are correct and well-reasoned.

**Explicitly accepted as a cost:** organic search acquisition. With no server-rendered content, traffic must come from direct, social, or referral. §6e records what was given up.

---

## Appendix — reproduction

```bash
# Verification harness (228 checks)
npx tsx utils/astrology/__checks__/verify.ts

# Type check
npx tsc --noEmit

# Production build + bundle sizes
npx next build

# Confirm gated content ships to everyone
grep -c "shayana sukha" .next/static/chunks/app/page-*.js   # → 1
```

*Note: `tsx` is not installed in this repo. The harness was run via the bundled `jiti` with an `@` → repo-root alias. Adding `tsx` as a devDependency, or a `"verify"` npm script, would make the documented command work as written.*
