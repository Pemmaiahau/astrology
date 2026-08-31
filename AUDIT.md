# Codebase Audit — Jyotisha Studio

**Original audit:** 2026-08-21 · read-only, `age-banded-windows-and-voice` @ `28148fc`
**Last revised:** 2026-08-31 · **Mode:** revised after implementation — §8c/§8d/§9 now record shipped code, not proposals.

> **Revision note (2026-08-31).** Three things changed since the original audit, and they change how the rest of this document should be read:
> 1. **The audience decision was reversed.** This is a *personal tool*, not a consumer product (§9a). That retires the entire SEO section (§6) and demotes the consumer-onboarding items — depth is now the goal rather than something to hide behind an "Advanced" toggle.
> 2. **Kundali Milan is out of scope by decision** (§8f), not merely unbuilt.
> 3. **Panchang day-parts and the Raman ayanamsha shipped**, along with a depth layer on the Interpretation and Life Areas panels (§10). Findings they resolve are struck through rather than deleted, so the reasoning stays auditable.

---

## 0. Method and baseline

### What was examined

All 96 source files (~22,000 lines) across `app/`, `components/`, `data/`, `utils/`, plus `ENGINE.md` (82 KB), `README.md`, and `data/interpretations/SOURCES.md` (33 KB).

### What was actually run

| Check | Command | Result |
|---|---|---|
| Numeric verification harness | `verify.ts` via jiti | **463 checks, ALL PASS** (228 at first audit; +42 for the day-parts/Raman phase, +36 for the depth/options phase, remainder from interim work) |
| Golden snapshot | `golden.ts` via jiti | **Identical to `golden.snapshot.txt`** — the depth layer added fields without perturbing any existing output |
| Type check | `npx tsc --noEmit` | **Clean, exit 0** |
| Production build | `npx next build` | **Clean, exit 0** |
| Compute benchmarks | custom harness | see §4 |
| Bundle analysis | built chunk inspection | see §4 |

### Baseline judgement

**This is a strong codebase.** The astronomy is correct and pinned by 463 regression checks. Every interpretive rule is cited in `SOURCES.md`, and the disagreement log documents ~40 convention choices with reasoning. `ENGINE.md §19` is itself a 20-item self-audit of known precision decisions.

**This audit therefore deliberately does not repeat what is already documented.** Items already recorded in `ENGINE.md §19` or the `SOURCES.md` disagreement log are referenced, not re-litigated. Everything below is either (a) not documented anywhere, or (b) documented as a scope boundary but worth re-costing now that the product ambition has grown.

### One structural observation up front

The **calculation layer is production-grade; the delivery layer is a developer tool.** Every weakness below is downstream of one fact: this is a single client-rendered page with no persistence, no URL state, no server-rendered content, and no export. The engine is worth far more than the shell currently lets a user extract from it.

---

## 1. Executive summary

**Re-ranked 2026-08-31** after the audience reversal (§9a). The original table assumed a public product; two of its findings existed only because of that assumption and are struck through below. The severity column now answers *"how much does this cost the one person using it?"*

| # | Finding | Severity | Effort | Status |
|---|---|---|---|---|
| 1 | ~~Sixteen divisional charts computed, none rendered~~ | ~~High~~ | M | **fixed** — Vargas tab (§11a) |
| 2 | ~~Full Shadbala computed, no table renders it~~ | ~~High~~ | S | **fixed** — Strength tab (§11a) |
| 3 | ~~Jaimini layer computed, surfaced only inside prose~~ | ~~Medium~~ | S | **fixed** — Jaimini tab (§11a) |
| 4 | ~~Birth date accepted with no bounds~~ | ~~High~~ | S | **fixed** — 1850–2150 bound + soft band (§11c) |
| 5 | ~~Geocoding single point of failure with no fallback~~ | ~~High~~ | S | **fixed** — error state, cache, manual lat/lon (§11c) |
| 6 | ~~Gender-gated content ships in the main bundle~~ | ~~Medium~~ | S | **fixed** — 244→205 kB route (§11b) |
| 7 | ~~No chart persistence — refresh destroys the chart~~ | ~~Medium~~ | M | **fixed** — localStorage session (§11d) |
| 8 | ~~Manual mode accepts impossible charts~~ | ~~Medium~~ | S | **fixed** — elongation + nodal-axis checks (§11c) |
| 9 | ~~Chart failure is a silent `catch → null`~~ | ~~Medium~~ | S | **fixed** — error state distinguished (§11c) |
| 10 | No PDF/print/export path | ~~High~~ **Medium** | M | demoted — no client to deliver to |
| 11 | Only South Indian chart style; no North or East Indian | **Medium** | M | **open — largest remaining UI item** |
| 12 | No "birth time unknown" path | ~~High~~ **Low** | M | demoted — the operator knows their own data |
| 13 | Mobile: 9-tab bar wraps to 3 rows; chart cells ~80 px on a 360 px screen | **Low** | S | demoted — single known device |
| 14 | Accessibility: no landmarks, no focus-visible, no tab semantics | **Low** | M | demoted — single known user |
| 15 | ~~`predictions.ts` 74% unreachable~~; 9 micro-exports remain | ~~Low~~ | S | **mostly fixed** (§11e) |
| 16 | ~~Zero SEO surface~~ | ~~Critical~~ | — | **retired** — no audience (§9a) |
| 17 | ~~No compatibility matching (Kundali Milan)~~ | ~~Critical~~ | — | **retired** — decided against (§8f) |
| 18 | ~~Panchang day-parts absent~~ | ~~High~~ | — | **resolved 2026-08-31** (§8d, §10b) |
| 19 | Remaining Vedic coverage gaps — upagraha longitudes, additional dashas, Ashtakavarga refinements (§8) | **Varies** | — | open |

**The through-line has changed.** The original audit's one-sentence diagnosis was *"the calculation layer is production-grade; the delivery layer is a developer tool."* For a public product that was the central problem. For a personal tool it is mostly fine — except in one specific way that now tops the list: **the engine computes three major classical layers (all sixteen vargas, full Shadbala, the whole Jaimini apparatus) that no component renders.** That is not a delivery-polish issue; it is analysis the owner has already paid for and cannot look at.

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

### 2d. ~~Machinery built but never surfaced~~ · **RESOLVED 2026-08-31**

Not dead code — worse. This is complete, correct, tested analysis that no pixel displays.

| Layer | Computed in | Rendered by | Reaches the reader as |
|---|---|---|---|
| **All 16 divisional charts** (D-1…D-60, vargottama, four Vimshopaka schemes) | `varga.ts`, on every chart via `ChartContext` | **nothing** | prose sentences only |
| **Full Shadbala** (six limbs in rupas, Ishta/Kashta, minimum-requirement table) | `shadbala.ts` | **nothing** | prose sentences only |
| **Jaimini** (chara karakas AK…DK, Karakamsa, Arudha Lagna, Upapada, Argala) | `jaimini.ts` | **nothing** | prose sentences only |
| Bhava Bala | `shadbala.ts` | `BhavaBalaTable.tsx` | ✅ a real table |

`README.md` advertises all three as headline features (*"Shodasavarga divisional charts — all sixteen vargas…"*, *"Full classical Shadbala… with Ishta/Kashta and the minimum-requirement table"*, *"Jaimini layer — chara karakas, Karakamsa, Arudha Lagna and Upapada, Argala"*). **A reader following the README will look for tables that do not exist.** That is a documentation defect as much as a UI one, and it should be fixed in whichever direction is chosen.

**All three now render.** `VargaPanel` (with `VargaChartGrid`), `ShadbalaTable` and `JaiminiPanel` were built in the second pass — see §11a. The table above is kept as the record of what was wrong, not as an open finding; the "Rendered by" column now reads `VargaPanel.tsx`, `ShadbalaTable.tsx` and `JaiminiPanel.tsx` respectively. `README.md` no longer points at tables that do not exist.

**Resolved since the original audit:** ~~Sudarshana Chakra and Muntha reachable only as rectification evidence~~ — both are now surfaced.

Still standing: **Yoni-kuta tables** in [nakshatraTraits.ts](data/interpretations/nakshatraTraits.ts) are half the input for compatibility matching, which is now decided against (§8f). They continue to earn their place feeding the single-chart marriage reading.

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

## 6. SEO · **RETIRED 2026-08-31**

> **This entire section no longer applies.** The site is a personal tool with an audience of one (§9a), so there is no organic traffic to win and nothing here is worth acting on. It is kept verbatim rather than deleted because the analysis is accurate and would become relevant again if the audience decision were ever reversed — but **nothing in §6 should appear on any work list.**
>
> The one item worth rescuing is §6d's *client-side URL state*, which survives on its own merit — not for shareability, but so a chart outlives a page refresh. It is tracked as finding #7 in §1 at Medium.

*Original assessment, for the record:*

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

### 8c. Partly resolved — Upagrahas (shadow planets)

**Completely absent.** No `Gulika`, `Mandi`, `Dhuma`, `Vyatipata`, `Parivesha`, `Indrachapa`, `Upaketu`, `Kala`, `Mrityu`, `Ardhaprahara`, `Yamaghantaka`.

**Gulika/Mandi in particular** is not an exotic technique — it is used routinely for maraka analysis, longevity, and event timing, and appears on every major Indian astrology site.

**Partially resolved 2026-08-31.** `utils/astrology/dayParts.ts` now computes the **Gulika *kaala*** — the Saturn-ruled eighth of the day arc, and its night counterpart — derived rather than tabulated, and verified against the published weekday tables for all seven days. What is still missing is the step from that window to the **Gulika *longitude***: the classical upagraha is the Ascendant computed at the start (or, by the competing convention, the end) of that eighth, which is what makes Gulika usable as a chart point in maraka and longevity analysis. That is now a genuinely small addition — the window is computed, `tropicalAscMc` exists, and the only open question is which end of the window to take, which is a documented convention split rather than a calculation problem.

The other ten upagrahas (Dhuma, Vyatipata, Parivesha, Indrachapa, Upaketu, Kala, Mrityu, Ardhaprahara, Yamaghantaka) remain absent. They are simple arithmetic on the Sun's longitude and the day divisions, and would be a coherent single addition alongside the Gulika longitude.

### 8d. ~~Missing~~ **Resolved 2026-08-31** — Panchang day-parts

The original finding: `computePanchang` returned the five limbs correctly but none of the *practical* panchang — the part actually consulted daily.

**Now implemented** in `utils/astrology/dayParts.ts` (+ a rewritten `PanchangPanel.tsx`), covered by 42 checks in the harness:

| Item | Status | How it is derived |
|---|---|---|
| Rahu Kaal | ✅ | Tabulated by weekday — Rahu holds no weekday lordship, so it cannot be derived |
| Gulika Kaal (day + night) | ✅ | **Derived** as Saturn's eighth under the classical lordship rule; reproduces the published table for all 7 weekdays |
| Yamaganda | ✅ | **Derived** as Jupiter's eighth, same rule, same verification |
| Abhijit Muhurta | ✅ | 8th of the day's 15 muhurtas; asserted to be centred on the arc midpoint. Withheld on Wednesday per the common convention |
| Choghadiya (8 day + 8 night) | ✅ | Cycle entered at the weekday lord; all 14 published sequence-openings reproduced |
| Hora (24 planetary hours) | ✅ | Descending Chaldean from the weekday lord — **the same sequence `shadbala.ts` uses**, so the two can never disagree |
| Tithi / Nakshatra / Yoga / Karana **end-times** | ✅ | Coarse walk + bisection to the minute on the monotonic quantity behind each limb |
| Sunrise / sunset / moonrise / moonset | ✅ | Moon rise/set added to `ephemeris.ts`; a null moonrise is treated as a real astronomical answer, not an error |
| **Dur Muhurtam, Varjyam, Amrit Kaal** | ❌ **deliberately not implemented** | These need per-nakshatra vishaghati fractions, and published tables disagree on several nakshatras. Guessing them would put invented numbers beside derived ones — the one thing this engine does not do. Recorded here so the omission stays a decision rather than an oversight |

Two design points worth recording:

- **Every division is of the sunrise→sunset (or sunset→next-sunrise) arc, never of the civil clock.** That is the classical construction, and it is why these times drift through the year and differ by latitude.
- **Polar degradation is explicit.** Above the Arctic circle in midsummer there is no day arc to divide, so `computeDayParts` returns `null` and the panel says why, rather than inventing an eighth of a day that never ends. Asserted in the harness.

The panel also gained a **birth / today** scope switch, so the same machinery answers both "what was this native born into?" and "what is usable this afternoon?".

### 8e. Missing — Ashtakavarga refinements

BAV grid and SAV row are correct (total 337 verified). Absent:

- **Trikona Sodhana** and **Ekadhipatya Sodhana** (the two classical reductions)
- **Shodhya Pinda** (the reduced total used for longevity/wealth inference)
- **Kakshya** — the 8 sub-divisions of each sign, which is *the* classical mechanism for Ashtakavarga-based transit timing
- **Prastarashtakavarga** (the full expanded tables)
- **Ashtakavarga transit rules** — the engine uses Jupiter's bindus as a scoring input in `scan.ts` but does not present "Saturn transits a sign where you have 2 bindus" to the reader

`ENGINE.md §20` already anticipates this as a layer over existing `bav`/`sav`.

### 8f. ~~Missing~~ **Out of scope by decision 2026-08-31** — Compatibility matching (Kundali Milan)

**Not being built.** The owner has ruled it out (§9a). The finding is kept because the reasoning behind it is still sound and the decision should be visible as a *choice* rather than as a gap nobody noticed.

The original argument for it was that it is (a) the single highest-traffic feature on every Indian astrology site, and (b) **half-built already**:

- Yoni-kuta tables exist in `nakshatraTraits.ts` (27-row assignment + 7 enemy pairs)
- Gana classification exists
- Mangal Dosha with cancellations exists in `marriage.ts` (`checkMangalDosha`)
- Nakshatra, pada, Rashi, Nakshatra-lord all available per chart

What is missing is the eight-kuta scoring (Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, Nadi = 36 guna), Nadi dosha with exceptions, Bhakoot dosha, and a two-chart input path.

`SOURCES.md` correctly records the current refusal ("Yoni kuta is a *pair* technique; running it against a hypothetical partner would be inventing the other half of the input") — that refusal is right for *single-chart* mode and would dissolve the moment a second chart became a real input.

**Consequence of the decision:** point (a) — the traffic argument — was the whole weight behind ranking this "the largest feature gap", and it evaporates for a personal tool with an audience of one. Point (b) still stands: the half-built pieces (Yoni-kuta tables, Gana classification, Mangal Dosha with cancellations) remain in the codebase and are used by the single-chart marriage reading, so nothing is stranded. **No further action.**

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

### 9a. Decisions — current as of 2026-08-31

| Decision | Taken | Consequence for this audit |
|---|---|---|
| **Personal tool, not consumer-facing** | 2026-08-31 · *supersedes the 2026-08-21 "consumer-first with expert toggle" decision* | **Retires §6 (SEO) entirely** — there is no audience to acquire. Also retires the plain-English-by-default plan and the Advanced toggle: depth is now the product rather than something to hide. §8's classical depth work becomes the main line, not an expert tier. Onboarding, first-run explanation and shareability drop to low priority. |
| **Kundali Milan out of scope** | 2026-08-31 | §8f closed as a decision. The half-built pieces stay where they are, feeding the single-chart marriage reading. |
| **Speculation & Intimacy stay silently gated** | 2026-08-21 | Unchanged. Excluded from benchmarking and voice work. The §4c lazy-loading fix still applies — it changes no visibility behaviour. |
| **No monetisation planned** | 2026-08-21 | Unchanged. Paywalls, booking and report-purchase flows are benchmark context only. |
| **Stays a single-page app** | 2026-08-21 | Unchanged, and now moot for SEO purposes. Client-side URL state is still worth having — not for sharing, but so a chart survives a refresh. |

**What the audience reversal actually costs:** the original audit ranked "zero SEO surface" and "no shareability" as its two Critical findings. Both were downstream of an assumed public audience. For a tool with one user, the honest re-ranking puts **chart persistence across refresh** as the only surviving item from that pair — and it drops from Critical to Medium, because losing a chart costs a re-entry of three fields rather than a lost visitor.

### 9b. Carried forward — re-ranked for a personal tool

**Done since the original audit:**
- ~~Panchang day-parts (§8d)~~ — shipped 2026-08-31
- ~~Gulika *kaala* (§8c)~~ — shipped; the Gulika *longitude* is still open
- ~~Sunapha / Anapha / Durudhara + Parivartana yoga reporting (§8i)~~ — shipped in earlier work
- ~~Surface Muntha + Sudarshana Chakra (§2d)~~ — shipped in earlier work

**Completed in the second pass (§11):**
- ~~Divisional-chart viewer~~ · ~~Shadbala table~~ · ~~Jaimini panel~~ — all three shipped
- ~~Birth-date bounds~~ · ~~geocoding fallback~~ · ~~manual-chart plausibility~~ · ~~silent chart failure~~ · ~~DST detection~~
- ~~`next/dynamic` on the gated panels~~ — route down 244 → 205 kB
- ~~Chart persistence across refresh~~
- ~~`predictions.ts` dead code~~

**Now top of the list:**
1. **North & East Indian chart styles** — the largest remaining astrologer-facing gap. The North Indian diamond is a different geometry (fixed houses, moving signs), so it is a real build rather than a restyle.
2. **Gulika/Mandi longitude + the remaining upagrahas (§8c)** — small now that the day-parts ship, but it needs a deliberate convention decision (start vs end of Saturn's eighth).
3. **Additional dasha systems (§8b)** — Yogini and Chara would change readings most; Vimshottari sookshma/prana levels would sharpen rectification.
4. Ashtakavarga refinements — Trikona/Ekadhipatya shodhana and the Kakshya subdivision (§8e).

**Lower priority:**
5. PDF / print report (§1).
6. "Birth time unknown" mode (§3b).
7. Mobile pass (§5) — slightly worse than before: the two new tabs make the tab bar wrap sooner.

**Retired:**
- Everything in §6 (SEO, metadata for discovery, sitemap/robots/JSON-LD, the ~190 static pages) — no audience.
- Kundali Milan (§8f) — decided against.
- The consumer voice rewrite and the Advanced toggle — the audience reversal removed the reason for both.

**Do not touch:**
- The astronomy in `utils/astrology/` beyond additive modules — 228 checks pass and the conventions are documented and deliberate.
- The `SOURCES.md` refusals (D-30 chastity, single-chart yoni matching, unbanded intimacy). They are correct and well-reasoned.

**Explicitly accepted as a cost:** organic search acquisition. With no server-rendered content, traffic must come from direct, social, or referral. §6e records what was given up.

---

## 10. Implementation log — 2026-08-31

What changed in the repo since the original audit, with the findings each item closes.

### 10a. Raman ayanamsha

`AyanamshaId` gains `"raman"`; `ramanAyanamsha()` is Lahiri offset by a constant **1.446704°**, the Swiss Ephemeris epoch gap (Lahiri 22.460148° − Raman 21.013444° at 1900 Jan 0.5). Both are anchored at the same instant and carried by the same precession, so the offset is constant by construction — the same reasoning the existing Pushya implementation uses, and the harness asserts it holds to 1e-9 across 1800–2200.

Practical effect: every sidereal longitude moves ~1°26' relative to Lahiri, which is enough to change a Lagna, a Moon nakshatra (and therefore the **Vimshottari starting lord**), or a varga sign for any body near a boundary. On the canonical chart it moves the Moon from Dhanishta p4 to Shatabhisha p1 — a different dasha sequence, not a cosmetic shift.

**Ordering matters and is easy to get backwards:** Raman < Pushya < Lahiri. Raman is ~0.32° *beyond* Pushya, not between the two. The rectification panel's copy was written to say this explicitly, because the rectifier is a deliberate two-way Lahiri-vs-Pushya sweep and a reader could otherwise assume Raman sat inside the tested span.

**Not changed:** the rectifier still sweeps exactly two ayanamshas. `RectifyResult` has named `lahiri`/`pushya` fields and the A/B comparison is the design, not an accident of two being available.

**Inherited caveat:** Raman carries the same sub-arcminute bias as `lahiriAyanamsha` (~13" against the Swiss Ephemeris value at 1900). That is the documented precision budget of this layer, and correcting it would move every existing chart — a separate decision, deliberately not taken here.

### 10b. Panchang day-parts

See §8d for the full table. Design points that are audit-relevant:

- **Derived over tabulated wherever the derivation is sound.** Gulika and Yamaganda are computed as Saturn's and Jupiter's eighths under the classical lordship rule, not copied from a table — and then *checked against* the published tables for all seven weekdays, day and night. Rahu Kaal stays tabulated because Rahu holds no weekday lordship and the derivation genuinely does not exist.
- **One hora sequence, two consumers.** `dayParts.ts` uses the same descending-Chaldean run as the Hora sub-bala in `shadbala.ts`. The harness asserts the 25th hora lands on the next weekday's lord, which is the property that would break first if the two ever drifted.
- **Refusals recorded.** Varjyam, Amrit Kaal and Dur Muhurtam are not implemented, and the panel says so in reader-facing copy rather than only in a code comment.

### 10c. Interpretation depth layer

`interpretHouse` now takes an optional context bundle (vargas, Shadbala, Bhava Bala, Ashtakavarga, Jaimini) and emits a separate **`depth[]`** array alongside the existing Rashi prose. Per house it reports:

1. **Sarvashtakavarga** bindus on the house's sign, against the classical 25/30 thresholds
2. **Bhava Bala** in rupas, *ranked against the other eleven houses*, with the lord/drishti split called out when the two disagree
3. The lord's **Shadbala** against its classical minimum, with Ishta/Kashta
4. **Navamsa corroboration** — and, where the tradition assigns one, the house's own varga (D-2 for the 2nd, D-10 for the 10th, D-4 for the 4th, and so on)
5. **Argala** and its virodha
6. A **convergence line** stating how many of the independent measures agree and which one dissents

The convergence line is the point of the whole layer. A 10th house strong in the D-1 and collapsed in the D-10 is a different life from one strong in both, and the previous prose could not distinguish them.

**Everything degrades independently.** Remove the varga set and no house claims a Navamsa reading; remove Shadbala and no house quotes a rupa figure; supply nothing and `depth` is empty and the Rashi prose is byte-identical. All three are asserted in the harness — which is what let the golden snapshot stay unchanged.

**Ordering fix required in `ChartContext`:** `houseReadings` was computed *before* `vargas`/`shadbala`/`bhavaBala`, so it had to be moved after them. Worth recording because that memo's dependency array is now what keeps the depth layer in sync with an ayanamsha change.

### 10d. Life Areas — possibilities and best options

New module `data/interpretations/lifeAreaOptions.ts`. It generalises the weighted-vote pattern `career.ts` already used for professions and applies it to all eight areas:

- **Votes** come from the area's primary and supporting house lords, its occupants, its karakas, drishti onto its houses, the divisional chart the tradition reads for that subject, and the relevant Jaimini karaka.
- **Each graha's vote is scaled by its composite strength** (±35%), so a graha with a strong claim and no capacity to act on it cannot top the ranking.
- **The winner's own classical signification for that area** is then read off a table — so a ranked possibility is never a guess; it is a named graha's documented signification, surfaced because that graha won the vote.
- **Levers** turn the ranking into action: what to lead with, what to pair it with, what to repair first, and where transits will actually pay (from Sarvashtakavarga on the area's own houses).
- **Corroboration** gives the divisional / Bhava Bala / Shadbala second opinion for the area as a whole.

**One honest judgement call, recorded in the code and in the rendered output:** the 5th house's own varga is the D-7, but the D-7's subject is progeny rather than romance, so the **love** area substitutes the D-9 and says so in the text. Similarly **health** uses the D-30, since the Shodasavarga has no dedicated health varga.

**Vote weights are policy, not doctrine.** They are this engine's own ranking heuristic, and the UI surfaces the reasons behind every score for exactly that reason — a reader can see *why* a graha ranked where it did, and disagree with the weighting without disagreeing with the astrology.

### 10e. Verification

| Check | Result |
|---|---|
| `verify.ts` | **463 checks, ALL PASS** at the end of the first pass; **496** after the second (§11g) |
| `golden.ts` | **Identical** to the committed snapshot |
| `npx tsc --noEmit` | Clean, exit 0 |
| `npx next build` | Clean, exit 0 — `/` at 244 kB, 346 kB first-load JS |

The bundle grew with the new prose tables. §4b's finding stands and is now marginally worse, which moves **§4c (lazy-loading the two gated panels)** up as the cheapest remaining bundle win.

---

## 11. Implementation log — 2026-08-31 (second pass)

The §1 re-ranking was acted on immediately. This records what was built, what it closes, and the two places the fix differed from the recommendation.

### 11a. The three unsurfaced layers — §2d, findings #1–#3

The top finding was analysis the engine already produced and no component rendered. All three now have a surface.

| Layer | New component | What it shows |
|---|---|---|
| **Sixteen vargas** | `components/panels/VargaPanel.tsx` + `charts/VargaChartGrid.tsx` | Any of the sixteen as a South Indian grid, **always beside the D-1** — a varga read without the Rashi next to it is not a reading. Plus a per-graha D-1↔varga movement table, the vargottama set, and all four Vimshopaka schemes with their classical bands. |
| **Shadbala** | `components/charts/ShadbalaTable.tsx` | Six limbs in rupas, expandable per graha to every sub-bala, Ishta/Kashta, and — the column usually missing from published tables — the **ratio against each graha's own minimum**, since BPHS requires 7 rupas of Mercury and only 5 of Saturn. |
| **Jaimini** | `components/panels/JaiminiPanel.tsx` | Chara karakas with degrees, Karakamsa, Arudha Lagna, Upapada, and the full 12-house Argala table with its virodha and a net verdict per house. |

Two new tabs (**Vargas**, **Jaimini**); the old *Ashtakavarga* tab became **Strength** and now hosts Shadbala, Ashtakavarga and Bhava Bala together — they are three answers to the same question from different directions, and the disagreements between them are the finding.

**Side effect worth noting:** this also fixed a documentation defect. `README.md` advertised all three as headline features, so a reader following it was looking for tables that did not exist.

### 11b. Bundle — §4c, finding #6

`next/dynamic` on `SpeculationPanel` and `IntimacyPanel`. The gate is untouched and still decides whether the tabs exist at all; splitting only stops the payload being downloaded by sessions that can never open it.

| | Route size | First Load JS |
|---|---|---|
| Before this pass | 244 kB | 346 kB |
| After | **205 kB** | **308 kB** |

That is a 39 kB reduction *while adding three new panels and a validation layer* — the split recovered more than everything added.

### 11c. Validation — §3a, §3c, §3d, §3e, §3f, findings #4, #5, #8, #9

New module `utils/astrology/validate.ts`, covered by 33 harness checks. The design rule is that everything is a **warning** except structurally impossible input, because a chart hand-copied from an almanac can legitimately disagree with the ephemeris and refusing it would break a real workflow.

- **§3a birth-date bounds** — `min`/`max` of 1850–2150 on both date inputs, matching the bounds `PredictionPanel` already used for forecasts, plus a soft warning band outside 1900–2100 where the ayanamsha is no longer sub-arcminute. The same bound now applies in the `/api/rectify` validator, so the API cannot rectify a minute against a zodiac the engine cannot place.
- **§3c geocoding** — the silent `catch` is gone. Failures are now distinct from "no match" and say so; successful lookups are cached in `localStorage` so a previously-used place still resolves offline; and there is a **manual latitude/longitude/IANA-timezone panel** that bypasses the network entirely. The zone field is validated against the runtime's own zone database, because an abbreviation or a raw offset silently discards the historical rules a birth chart depends on.
- **§3d silent failure** — `ChartContext` now returns `{ chart, error }`. "Nothing submitted" and "submitted and failed" no longer render the same placeholder.
- **§3e impossible manual charts** — Mercury beyond 28° and Venus beyond 48° from the Sun are flagged, as are duplicate grahas and degrees outside their sign. The broken nodal axis — the worst of the set, because `detectYogas` will evaluate Kala Sarpa against a nonsense arc — gets a one-click **"derive Ketu from Rahu"** fix.
- **§3f DST** — `checkLocalTime` detects both a clock change near the recorded time and a civil time that does not exist. `tzOffsetMinutes` already existed for this and was used by rectification's `timezoneWarnings`; it had simply never been called on the main input path.
- **§3f polar** — a latitude past the polar circle now warns at input, naming which surfaces degrade, rather than only appearing in the chart centre block and only in Chalit mode.

### 11d. Persistence — §6d, finding #7

The input (never the computed chart) plus the ayanamsha, node mode, chart style and entry mode are stored in `localStorage`. The engine is deterministic, so re-deriving on load is cheaper than serialising a `ChartData` full of `Date`s — and immune to a stored chart going stale against an engine change. The restored payload is field-validated on read so an older shape cannot inject a bad ayanamsha id.

Both entry forms seed from the restored input: showing a restored chart beside a form full of defaults would have been worse than not restoring at all. A "Clear" control is offered beside the mode switch.

### 11e. Dead code — §2a, §2b, finding #15

**Two of the eleven dead exports resolved themselves:** `VARGA_SIGNIFICATIONS` and `CHARA_KARAKA_NAMES` are the glosses the new Varga and Jaimini panels needed — exactly as §2a predicted when it recommended keeping them.

`predictions.ts` is **deleted**. It was 128 lines of which 95 were unreachable; its one live export, `dashaLordAssessment`, moved into `yearForecast.ts` beside its only caller. `ENGINE.md` §17 has been rewritten as a tombstone and its index row, which routed "new prediction cadence" work at the dead file, now points at `yearForecast.ts`.

**Deliberately not done:** the remaining nine micro-exports (`HIGH_RESOLUTION_VARGAS`, `MEAN_DAILY_MOTION`, `NOCTURNAL_PLANETS`, `RiseInfo`, `fmtLongitude`, `naturalMalefics`, `primaryHousesFor`) are left in place. They are sourced constant tables and obvious complements to symbols that *are* used; deleting them costs nothing at runtime (they tree-shake) and risks losing referenced classical data to save nothing.

### 11f. What is still open

| Finding | Why it was not done |
|---|---|
| **North & East Indian chart styles** (#11) | Genuine astrologer-facing want and the largest remaining UI item, but a real piece of work — the North Indian diamond is a different geometry (fixed houses, moving signs), not a restyle of the existing grid. |
| **PDF / print report** (#10) | Medium effort, and demoted anyway once there is no client to hand a report to. |
| **"Birth time unknown" mode** (#12) | Demoted to Low: the operator knows their own birth data. The rectifier already covers the harder version of the problem. |
| **Mobile (#13) and accessibility (#14)** | Both demoted to Low by the audience decision. The two new tabs make the tab-bar wrap worse on a narrow screen — noted rather than fixed. |
| **Gulika/Mandi longitude and the other upagrahas** (§8c) | Small now that the day-parts ship, but it needs a convention decision (Gulika is the Ascendant at the *start* or the *end* of Saturn's eighth — sources differ) that should be made deliberately rather than by me picking one. |
| **`/api/rectify` rate limiting** (§3f) | Correctly a non-issue for a personal tool; it becomes real only if the site is ever exposed. |

### 11g. Verification

| Check | Result |
|---|---|
| `verify.ts` | **496 checks, ALL PASS** (+33 for the validation phase) |
| `golden.ts` | **Identical** to the committed snapshot |
| `npx tsc --noEmit` | Clean, exit 0 |
| `npx next build` | Clean, exit 0 — 205 kB route, 308 kB first load |

---

## Appendix — reproduction

```bash
# Verification harness (496 checks)
node utils/astrology/__checks__/run.mjs verify

# Golden snapshot (regression on rendered output)
node utils/astrology/__checks__/run.mjs golden

# Type check
npx tsc --noEmit

# Production build + bundle sizes
npx next build

# Confirm gated content ships to everyone
grep -c "shayana sukha" .next/static/chunks/app/page-*.js   # → 1
```

*Note: `tsx` is not installed in this repo, so the `npx tsx ...` command in `README.md` does not work as written. The working entry point is `run.mjs`, which drives the same files through the bundled `jiti` with an `@` → repo-root alias. **`README.md` should be corrected to match** — or better, `"verify"` and `"golden"` npm scripts added, since the harness is this repo's only test suite and is currently reachable only by a path nobody would guess.*
