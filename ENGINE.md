# Jyotisha Studio — Calculation & Prediction Engine Reference

This document explains **how the astrology math and the astrology writing work**, file by file, so that future feature work (new charts, new dashas, new yogas, new prediction copy, new ayanamsha, etc.) can be scoped to the right file without re-deriving the whole pipeline from scratch.

It is a companion to [README.md](README.md) (which covers features/deploy) — this file goes one level deeper, into formulas, data shapes and "if you want to change X, edit Y" guidance.

Everything runs **client-side in the browser**, no backend, no API keys. The two external calls are Open-Meteo (geocoding, only during input) and the `astronomy-engine` npm package (ephemeris, bundled).

---

## 1. Mental model: the pipeline

```
Birth data (auto) or manual placements
        │
        ▼
utils/astrology/chart.ts          ← orchestrator: builds one ChartData object
        │  (calls ephemeris.ts, ayanamsha.ts, ascendant.ts, houses.ts, states.ts)
        ▼
ChartData  { ascendant, mc, planets[], cusps, sandhis, birthUtc, lat/lon, meta }
        │
        ├──► utils/astrology/dasha.ts        → Vimshottari tree + active period
        ├──► utils/astrology/panchang.ts     → Tithi/Vara/Nakshatra/Yoga/Karana at birth
        ├──► utils/astrology/ashtakavarga.ts → BAV/SAV bindu grids
        ├──► utils/astrology/transits.ts     → live gochara + Sade Sati phase
        ├──► utils/astrology/yogas.ts        → rule-based yoga detection
        ├──► utils/astrology/aspects.ts      → graha drishti (with offsets)
        ├──► utils/astrology/strength.ts     → composite strength + conjunction strength
        │
        ▼
data/interpretations/*  (pure text/composition layer, no astronomy)
        │
        ▼
components/panels/*.tsx  (renders the composed prose + tables)
```

`components/context/ChartContext.tsx` is the single place that wires all of the above together via `useMemo` — it is the **only** consumer that calls the util functions; every panel reads pre-computed results off `useChart()`. If you add a new computed artifact (a new chart type, a new dasha system, a new yoga set), it gets added to `ChartContextValue` here and threaded to whichever panel needs it.

---

## 2. Core types — [utils/astrology/types.ts](utils/astrology/types.ts)

The shapes everything else is built from:

- `PlanetId` — `"Su"|"Mo"|"Ma"|"Me"|"Ju"|"Ve"|"Sa"|"Ra"|"Ke"` (9 grahas; no outer planets — this is a classical Parashari engine, not a modern/Western one).
- `PlanetPosition` — one planet's full computed state: sidereal `longitude`, `sign` (0=Aries), `degInSign`, whole-sign `house`, Sripati `bhava`, `nakshatra`/`pada`, `retrograde`, `combust`, `speed`, `dignity`, and optional Graha Yuddha (`warWith`/`warWinner`).
- `ChartData` — the full chart: `ascendant`, `mc`, `planets[]`, Sripati `cusps`/`sandhis`, `birthUtc`, `lat`/`lon`, `meta` (name/place/mode/ayanamsha).
- `DashaPeriod` — recursive `{ lord, start, end, level, children? }`, level 1/2/3 = Mahadasha/Antardasha/Pratyantardasha.
- `PanchangData`, `TransitInfo`, `GeoPlace`, `BirthAnchor`, `ManualPlanetInput`/`ManualInputState`, `AutoInputState`, `YogaFinding`.

**If you add a new field to a planet or chart (e.g. a shadbala score, a varga position), add it here first** — everything downstream is typed off this file.

---

## 3. Reference tables — [utils/astrology/constants.ts](utils/astrology/constants.ts)

Static classical data, no computation:

- `SIGNS` / `SIGNS_SANSKRIT`, `PLANETS`, `PLANET_NAMES` / `PLANET_SANSKRIT`, `SIGN_LORDS`.
- `NAKSHATRAS` (27) and `NAKSHATRA_LORDS` — built by tiling a 9-lord `LORD_CYCLE` (Ke→Ve→Su→Mo→Ma→Ra→Ju→Sa→Me) three times, which is *why* Vimshottari's nakshatra-lord mapping and dasha sequence share one array.
- `DASHA_YEARS` / `DASHA_SEQUENCE` — the 120-year Vimshottari cycle (Ke7 Ve20 Su6 Mo10 Ma7 Ra18 Ju16 Sa19 Me17).
- `EXALTATION`, `MOOLATRIKONA`, `OWN_SIGNS`, `NATURAL_FRIENDS`, `NATURAL_ENEMIES` — dignity inputs (see §7).
- `COMBUSTION_ORBS` — classical asta orbs per planet, direct vs retrograde.
- `TITHI_NAMES` (30), `YOGA_NAMES` (27), `MOVABLE_KARANAS`/`FIXED_KARANAS`, `VARA_NAMES`/`VARA_LORDS` — Panchang vocabulary.
- `HOUSE_SIGNIFICATIONS` (12) and `NAKSHATRA_QUALITIES` (27) — short phrases reused by the interpretation layer for "what this house/nakshatra is about."

**To add a new dasha system (e.g. Yogini, Ashtottari)**: add its own year-table + sequence here, then a new file mirroring `dasha.ts`.
**To change dignity rules or add a new planet's exaltation/moolatrikona** (e.g. if you introduce Uranus/Neptune/Pluto for a KP-style variant): edit the relevant table here, `states.ts` picks it up automatically.

---

## 4. Angle/geometry helpers — [utils/astrology/math.ts](utils/astrology/math.ts)

Pure functions, no astrology-specific meaning beyond naming:

- `norm360`, `angleDiff` (signed, −180..180], `separation` (absolute 0–180), `inArc` (circular arc containment).
- `signOf`, `degInSign`, `nakshatraOf` (27 equal divisions), `padaOf` (108 equal divisions → 1–4 within nakshatra).
- `houseFromSign` — whole-sign house count from Lagna.
- `fmtDeg`/`fmtLongitude` — `14.372°` → `14°22'` display formatting.

Any new divisional-chart (varga) math belongs here or in a sibling file, since vargas are just different longitude→sign remapping functions.

---

## 5. Local↔UTC time conversion — [utils/astrology/time.ts](utils/astrology/time.ts)

`localToUtc(timeZone, dateISO, time)` converts a civil local birth time in an IANA zone to a UTC `Date`, using `Intl.DateTimeFormat` to read the **browser's ICU tz database** (handles historical DST transitions correctly, no external tz library). It iterates the offset lookup 3 times to converge (handles the rare case where the naive UTC guess lands on the wrong side of a DST boundary). `utcOffsetLabel` renders `UTC+05:30`-style strings for display.

This is one of the two "gotcha" areas flagged as tested/verified (see [[aipems-astrology]] memory) — if you change it, re-verify against a known historical-DST case, not just a modern one.

---

## 6. Ephemeris — [utils/astrology/ephemeris.ts](utils/astrology/ephemeris.ts)

Wraps the `astronomy-engine` npm package to get **tropical, geocentric, of-date ecliptic longitudes**:

- `tropicalLongitude(id, date)`:
  - Sun → `Astronomy.SunPosition(date).elon`
  - Moon → `Astronomy.EclipticGeoMoon(date).lon`
  - Mars/Mercury/Jupiter/Venus/Saturn → `Astronomy.GeoVector(...)` then `Astronomy.Ecliptic(vec).elon` (true-ecliptic-of-date, confirmed numerically against the 2024 equinox — see engine gotchas below)
  - Rahu → `meanLunarNode(date)` (Meeus mean-node polynomial, **not** true/osculating node)
  - Ketu → node + 180°
- `dailySpeed(id, date)` — central finite difference over ±0.5 day, used for retrograde detection and displayed speed.
- `isRetrograde` — speed < 0 (Sun/Moon/nodes are never retrograde by convention here).
- `obliquity(date)` — mean obliquity polynomial, feeds the ascendant formula.
- `gastDegrees(date)` — Greenwich Apparent Sidereal Time in degrees, via `Astronomy.SiderealTime`.
- `sunriseFor(date, lat, lon)` — searches backward/forward with `Astronomy.SearchRiseSet` to find the most recent sunrise ≤ the given instant (used by Panchang's sunrise-anchored Vara).

**Engine choice**: `astronomy-engine`, not Swiss Ephemeris — a deliberate accuracy/simplicity tradeoff (~arcminute accuracy, zero native deps, MIT-licensed, works in-browser). If a future requirement needs sub-arcsecond precision or asteroid/upagraha positions Swiss Ephemeris doesn't offer via this library, that's a real architecture decision, not a tweak — flag it before touching this file.

**Rahu/Ketu are mean, not true nodes.** If a feature request wants "true node" toggle, this is where a second `trueLunarNode()` implementation would go, alongside a settings flag threaded through `ChartMeta`.

---

## 7. Ayanamsha — [utils/astrology/ayanamsha.ts](utils/astrology/ayanamsha.ts)

Converts tropical → sidereal by subtracting the ayanamsha. Two supported:

- `lahiriAyanamsha(date)` — anchored at 23.85306° at J2000.0 + 1.3969713°/century + a tiny quadratic term. Verified to match the published ~24°11' for 2024.
- `pushyaAyanamsha(date)` — `lahiri − 1.122°` constant offset (PVR Narasimha Rao's Pushya Paksha, anchored so Delta Cancri sits at 106°00'). Constant offset is valid because both ayanamshas track the same precession rate.
- `getAyanamsha(id, date)` — dispatcher; `AYANAMSHA_LABELS` for UI display.

**Every sidereal longitude in the app is `tropicalLongitude(...) − getAyanamsha(...)`.** This subtraction happens in exactly two places: `chart.ts` (natal positions) and `transits.ts` (live positions) — those are the only two places ayanamsha choice takes effect.

**To add a new ayanamsha** (e.g. Raman, KP/Krishnamurti, True Chitrapaksha): add a function here following the `lahiriAyanamsha` pattern (either its own polynomial, or an offset from Lahiri if it shares the precession model), register it in `AyanamshaId` (types.ts), `getAyanamsha`, `AYANAMSHA_LABELS`, and the toggle UI in `app/page.tsx` Header.

---

## 8. Ascendant & Midheaven — [utils/astrology/ascendant.ts](utils/astrology/ascendant.ts)

`tropicalAscMc(date, lat, lonEast)` — standard spherical-astronomy formulas:
- RAMC = GAST + east longitude
- Ascendant from `atan2(cos(RAMC), −(sin(RAMC)·cos(ε) + tan(lat)·sin(ε)))`
- MC from `atan2(sin(RAMC), cos(RAMC)·cos(ε))`

where ε is obliquity from `ephemeris.ts`. Output is **tropical**; `chart.ts` subtracts ayanamsha to get the sidereal Lagna/MC used everywhere else.

---

## 9. Houses — Rashi vs Bhava Chalit — [utils/astrology/houses.ts](utils/astrology/houses.ts)

Two house systems coexist:

1. **Rashi (whole-sign)** — computed inline via `houseFromSign()` in math.ts; a planet's house = its sign's offset from the Lagna sign. This drives `PlanetPosition.house`, all dignity/yoga/lordship logic, and is the default chart view.
2. **Sripati Bhava Chalit** — `sripatiHouses(ascSidereal, mcSidereal)`:
   - The four angles (Asc, IC = MC+180, Dsc = Asc+180, MC) anchor bhavas 1/4/7/10.
   - Each quadrant between consecutive angles is trisected (Porphyry method) to get the remaining 8 bhava **madhya** (house middles).
   - **Sandhi** (house boundaries) are the midpoints between consecutive madhyas — this midpoint step is the specifically *Sripati* part of the convention (as opposed to Porphyry cusps being used directly as boundaries).
   - `bhavaOf(longitude, sandhi)` places a longitude into 1 of the 12 sandhi-bounded arcs → `PlanetPosition.bhava`.

**Why both exist simultaneously**: dignity/lordship/yoga logic in this app is intentionally whole-sign (the mainstream Parashari default), while Bhava Chalit is offered as a secondary, house-cusp-aware lens for "does this planet's *house* shift near a sign boundary." The synthesis engine (§13) explicitly separates these: dignity is always read from the Rashi sign, event-level house results are re-pointed to the bhava when they differ (see `ChartData.cusps`/`sandhis` and the "Note (Bhava Chalit)" sentence in `synthesis.ts`).

**To add a third house system** (Equal, Placidus, KP sub-lords): add a sibling function here returning madhya/sandhi (or direct cusps), a new `ChartMeta` flag, and a UI toggle next to the existing Rashi/Chalit one in `app/page.tsx`.

---

## 10. Planetary states — [utils/astrology/states.ts](utils/astrology/states.ts)

- **`computeDignity(id, longitude, allLongitudes)`** — the compound dignity used everywhere (`Dignity` enum: exalted → moolatrikona → own → greatFriend → friend → neutral → enemy → greatEnemy → debilitated):
  1. Exact sign match against `EXALTATION`/`MOOLATRIKONA` (degree-ranged for moolatrikona) short-circuits first.
  2. Otherwise: **naisargika** (natural, fixed per `NATURAL_FRIENDS`/`NATURAL_ENEMIES`) relationship to the sign's dispositor, combined with **tatkalika** (temporal — where the dispositor currently sits *relative to this planet*, houses 2/3/4/10/11/12 = temporal friendship) into a −2..+2 score, mapped to the 5 middle dignity grades.
  - This is the standard Parashari "compound relationship" method — natural + temporal, not natural alone.
- **`isCombust(id, longitude, sunLongitude, retro)`** — separation from Sun ≤ classical orb (`COMBUSTION_ORBS`, direct vs retrograde orbs differ per planet). Sun itself is never combust (checked at the call site in `chart.ts`).
- **`applyGrahaYuddha(planets)`** — mutates planets in place: among the five *tara grahas* (Ma/Me/Ju/Ve/Sa), any pair within 1° of each other is a "planetary war"; **lower degree-in-sign wins** by this app's convention (classical texts vary — flag if a different tie-break convention is wanted).
- `DIGNITY_LABELS` / `DIGNITY_SHORT` — display strings.

---

### 10a. Aspects (graha drishti) — [utils/astrology/aspects.ts](utils/astrology/aspects.ts)

Parashari drishti, **whole-sign** based (a drishti either lands on a sign or it doesn't — the classical partial aspects of 3/4, 1/2, 1/4 strength are deliberately not modelled):

- Every graha aspects the 7th sign from itself; `SPECIAL_DRISHTI` adds Mars 4/8, Jupiter 5/9, Saturn 3/10, and **Rahu/Ketu 5/9** (the BPHS reading — some traditions omit nodal drishti entirely; changing that is a one-line edit to `SPECIAL_DRISHTI`).
- `aspectedSigns(id, fromSign)` — signs receiving a planet's drishti. `aspectsOnSign` / `aspectsOnHouse` / `planetsAspecting` — the reverse lookups, returning bare `PlanetId[]`. **Occupancy is not an aspect**: a planet never "aspects" the sign it sits in (conjunction is handled separately in `conjunctions.ts`).
- `drishtiOnSign(chart, sign)` / `drishtiOnHouse(chart, house)` — the same reverse lookup but returning `Drishti[]` (`{ from, offset, special }`), i.e. carrying **which** aspect landed. Added for the interpretation layer, which reads Saturn's 3rd (grinding), 7th (delaying) and 10th (imposing duty) differently, and Jupiter's 5th differently from its 9th. The bare-id functions are deliberately left untouched so `strength.ts`/`lifeAreas.ts` are unaffected. A planet can never cast two drishtis on one sign (the offset sets are pairwise distinct), so entries are unique per `from`.
- `naturalBenefics(chart)` — Jupiter and Venus always; the **Moon only when waxing** (Shukla paksha, elongation < 180°); **Mercury only when not sharing a sign with a natural malefic** (Su/Ma/Sa/Ra/Ke). `naturalMalefics` is the complement. This is the classical conditional-benefic rule, so benefic/malefic drishti verdicts are chart-specific, not static.

### 10b. Composite planetary strength — [utils/astrology/strength.ts](utils/astrology/strength.ts)

A transparent 0–100 score per planet — **deliberately not Shadbala** (the full six-fold system needs hora/tribhaga/ayana time-math; if ever required it should be a separate `shadbala.ts`). Base 40 plus listed contributions, every one returned in `factors` for display:

| Factor | Delta |
|---|---|
| Dignity (exalted → debilitated) | +25 … −20 |
| Combustion | −15 |
| Retrograde (cheshta, tara grahas only) | +5 |
| Graha yuddha won / lost | +5 / −12 |
| Dig bala house (Su/Ma 10th, Ju/Me 1st, Mo/Ve 4th, Sa 7th) / opposite | +8 / −5 |
| House placement (kendra/trikona up, 6/8/12 down) | +8 … −8 |
| Each benefic / malefic drishti received | +6 / −5 |
| Nakshatra dispositor (self/friend/neutral/enemy) | +6/+4/0/−4 |
| Ashtakavarga bindus in occupied sign (7 planets) | ±2 per bindu from 4, capped ±8 |

Clamped 0–100 → grade: ≥75 Excellent, ≥60 Strong, ≥45 Moderate, ≥30 Weak, else Afflicted. `allStrengths(chart, av)` computes all nine at once.

`nakshatraRelation(id, nakshatra)` **now lives in `states.ts`** (re-exported here for existing callers) so that `chart.ts` can populate `PlanetPosition.nakshatraLord`/`.nakshatraRelation` without importing the strength/ashtakavarga dependency graph. `computeStrength` reads those fields off the planet rather than recomputing them.

**`conjunctionStrength(chart, strengths, members)` → `ConjunctionStrength | null`** — how forcefully a conjunction actually expresses, which the static per-pair text in `conjunctions.ts` cannot say on its own. Takes a **precomputed strengths map** (not an `AshtakavargaResult`) so a house with several conjunctions doesn't recompute composites. Returns `{ members, orb, score, tier, leader, factors }`:

- `orb` is the **widest pairwise separation** among members — the group's *span*. For a pair that is just the orb; for 3+ it measures real fusion (three grahas spread over 25° of one sign share a sign, not a blend).
- `score` = base 50 + each member's `(composite − 50) / memberCount` (so members contribute their mean) + an orb band (+12 at ≤1° down to −8 above 15°) + the two afflictions a *per-planet* score structurally cannot see: a graha yuddha fought **between two members** (−6) and a member burnt by a Sun that is **itself in the group** (−6). Individual dignity/retrogression/combustion are already inside each composite and are deliberately **not** re-charged.
- `tier`: `Dominant` (≥65 **and** orb ≤6°), `Balanced` (≥52), `Weak blend` (≥38), else `Afflicted`. A high-scoring but wide conjunction is Balanced, never Dominant — tightness is required for dominance.
- `leader` = highest composite among members ("who chairs the combination").

Weights and tier cut-offs here are tuning knobs of the same kind as the composite score itself — directionally classical, not shastra.

## 11. Chart orchestrator — [utils/astrology/chart.ts](utils/astrology/chart.ts)

The one file that assembles a full `ChartData`. Two entry points, called from `ChartContext.tsx`:

### `computeAutoChart(input: AutoInputState, ayanamsha)`
1. `localToUtc` the birth date/time/place → `utc`.
2. `getAyanamsha` at that instant.
3. `tropicalAscMc` → subtract ayanamsha → sidereal Asc/MC → `sripatiHouses`.
4. For each of the 9 `PLANETS`: `tropicalLongitude` − ayanamsha → sidereal longitude, then derive sign/degInSign/house/bhava/nakshatra/pada/retrograde/combust/speed/dignity.
5. `applyGrahaYuddha` over the assembled array (needs all longitudes at once).
6. Returns the full `ChartData`, including `meta` (mode `"auto"`, place string, timezone, local date/time string for display).

### `computeManualChart(input: ManualInputState, ayanamsha)`
- The user picks the Lagna sign + exact ascendant degree directly, and places each graha in a house + degree-in-sign + retro flag — **no ephemeris call for planet positions**.
- If (and only if) the user also supplies a birth anchor (date/time/place), the app computes the *real* MC from that anchor to build Sripati cusps around the user's manually-chosen Lagna, and stores `birthUtc` (which powers Vimshottari dasha downstream — dasha is otherwise unavailable in pure manual mode).
- Longitudes are back-solved as `sign*30 + degInSign` where `sign = (lagnaSign + house - 1) % 12`.
- Speed is **faked** (`retro ? -0.1 : 0.5`) since there's no ephemeris sampling — this value only feeds display, not any decision logic, but be aware if a new feature starts reading `speed` for manual charts.

**If adding a divisional chart (D9/Navamsha, D10/Dasamsha, etc.)**: this is the natural place for a `computeVargaChart(chart, vargaId)` that remaps each planet's sign per the varga's rule, reusing the existing sidereal longitudes already stored on `ChartData.planets[].longitude` — you do not need to touch the ephemeris layer.

---

## 12. Vimshottari Dasha — [utils/astrology/dasha.ts](utils/astrology/dasha.ts)

`vimshottariTree(moonSiderealLon, birthUtc)`:
1. Locate the Moon's nakshatra and the **elapsed fraction within it** (`frac`).
2. The nakshatra's lord (`NAKSHATRA_LORDS`) is the first Mahadasha lord; its **balance at birth** = `(1 − frac) × DASHA_YEARS[lord]`, so the first period's `start` is computed as `birthUtc − frac × fullDuration` (i.e., the period conceptually began before birth; only the remainder is "lived").
3. Walks all 9 Mahadashas forward in `DASHA_SEQUENCE` order from that starting lord, each with nested Antardashas (`buildSubPeriods`, level 2) and Pratyantardashas (level 3), recursively proportioned: a sub-period's duration = `parentDuration × DASHA_YEARS[subLord] / 120`.
4. A year is fixed at `365.25 days` (`YEAR_MS`); the full cycle is 120 years, matching the sum of `DASHA_YEARS`.

`activeDashaAt(tree, when)` — linear search down the tree for the maha/antar/pratyantar containing `when`. `openingBalanceYears` — convenience accessor for the birth chart's remaining first Mahadasha, in years.

**To add Antar-Antardasha (level 4, "Sookshma")**: extend `buildSubPeriods` to recurse one level deeper when `level === 3`, and widen `DashaPeriod.level` to `1|2|3|4` in types.ts.
**To add a different dasha system** (Yogini/Ashtottari/Kalachakra): these use different trigger conditions (not nakshatra-lord-based, in some cases), so treat this as a new sibling file rather than a parameter to this one — don't overload `vimshottariTree`.

---

## 13. Panchang — [utils/astrology/panchang.ts](utils/astrology/panchang.ts)

`computePanchang(sunSidereal, moonSidereal, utc, timeZone?, lat?, lon?)` computes the five limbs (Panchanga) for a given instant:

- **Tithi**: `floor((Moon − Sun) / 12°)`, 0–29; Shukla paksha for index < 15. Ayanamsha-independent (it's a pure elongation).
- **Karana**: half-tithi (`floor(elongation/6)`, 0–59): index 0 is the fixed Kimstughna, indices 57–59 are the fixed Shakuni/Chatushpada/Naga, everything between cycles the 7 movable karanas 8 times.
- **Yoga**: `floor((Sun + Moon) / (360/27))` — sidereal-dependent, unlike Tithi/Karana.
- **Nakshatra**: Moon's sidereal nakshatra.
- **Vara**: weekday **at the birth location**, using the Vedic sunrise-to-sunrise day convention — if the instant falls before local sunrise (found via `sunriseFor` in ephemeris.ts), the *previous* calendar weekday is used. Falls back to `utc.getUTCDay()` if lat/lon/timezone aren't available (manual mode without full anchor).

Only called with a chart that has `birthUtc` set (see `ChartContext.tsx`); manual charts without a birth anchor have no Panchang.

---

## 14. Ashtakavarga — [utils/astrology/ashtakavarga.ts](utils/astrology/ashtakavarga.ts)

Hard-coded classical Parashari **Bhinna Ashtakavarga (BAV) benefic-place tables** (`T`): for each of the 7 "contributor" grahas + Lagna, the fixed list of houses (counted from *that contributor's own sign*) where each of the 7 target planets receives a bindu (point).

`computeAshtakavarga(planetSigns, lagnaSign)`:
- For each target planet/Lagna-chart, sum bindus contributed by all 8 contributors into a 12-sign grid (`bav[target][sign]`).
- `sav[sign]` = sum of the 7 planetary BAV grids at that sign (Sarvashtakavarga; total across all signs is always 337, a classical invariant used as a sanity check).

This is a **static lookup table**, not a formula — if the requirement is "add Kaksha/Trikona reductions" or "Prastarashtakavarga (the sign-by-sign contributor breakdown, not just the summed bindus)" or "Shodhya Pinda", those are new functions layered on top of `bav`/`sav`, not changes to `T`.

---

## 15. Live transits (Gochara) — [utils/astrology/transits.ts](utils/astrology/transits.ts)

`currentTransits(chart, ayanamsha, now)` — recomputes tropical longitudes for `Ju, Sa, Ra, Ke, Su, Ma` at `now` (reusing `ephemeris.ts`), subtracts the *current* ayanamsha (not the birth-time one — ayanamsha itself drifts slowly), and reports each as houses-from-Moon and houses-from-Lagna.

`sadeSatiPhase(transits)` — Saturn's house-from-natal-Moon mapped to rising (12th)/peak (1st)/setting (2nd)/`null` otherwise. This 3-state phase feeds both `PredictionPanel` copy and the dasha-independent transit narrative.

**To extend to more transiting bodies** (e.g. transiting Venus/Mercury for finer monthly work, or transiting Lagna itself for horary-style techniques): add the id to `TRANSIT_BODIES` and make sure `TRANSIT_TABLES`/copy exists for it in `transitTexts.ts`, or the prediction text silently skips it (see `predictions.ts` — `if (t && table)`).

### 15a. Date-range scanning — [utils/astrology/scan.ts](utils/astrology/scan.ts)

Everything in §15 is a *snapshot* (one instant). The **year forecast** (§17a) needs to reason over a *span*, which is what this file adds — all pure functions of `(chart/tree, ayanamsha, date-window)`, so any past or future window works identically:

- `siderealLongitudeAt(id, ayanamsha, date)` — the ayanamsha subtraction from §7, exposed for arbitrary instants.
- `signChangeEvents(id, ayanamsha, start, end, stepDays=3)` — every sidereal **sign ingress** of a body within a window. Coarse-scans at `stepDays`, then **bisects each detected crossing to ~1-hour precision**. A 3-day step is safe for the slow movers (they can't cross a whole sign inside 3 days, even at a station). Retrograde loops near a cusp legitimately return multiple ingresses (enter → retro back → re-enter) — that's astronomically correct, not a bug.
- `solarReturn(chart, ayanamsha, year)` — the instant the transiting Sun returns to its **natal sidereal longitude** (the Varshaphal/solar-return anchor). Searches ±3 days around the birthday of `year` and bisects the zero-crossing. Returns `null` with no birth data. *Verified: consecutive returns are spaced one **sidereal** year (365.256 d) apart, as expected for a sidereal-longitude match.*
- `periodsOverlapping(tree, level, start, end)` — all dasha periods at a given level (1/2/3) overlapping the window (returns the *full* periods; callers clamp to the window for display).
- `boundariesWithin(tree, level, start, end)` — the start timestamps of level-`level` periods that begin *inside* the window (used to cut timeline segments at antardasha changes).

**Accuracy note**: `signChangeEvents` and `solarReturn` reuse the exact same `tropicalLongitude`/ayanamsha path as the natal engine, so ingress dates carry the same ~arcminute accuracy — verified numerically (e.g. Jupiter → sidereal Taurus on 2024-05-01, matching published Lahiri ingress tables).

---

## 16. Yoga detection — [utils/astrology/yogas.ts](utils/astrology/yogas.ts)

Rule-based, returns `YogaFinding[]` (key/name/planets/description — description text is generated *here*, inline, not in the `data/interpretations` layer, because it's conditional on which specific cancelling/activating condition fired):

- **Neechabhanga Raja Yoga** (debilitation cancellation) — checks up to 4 independent classical cancellation conditions (dispositor in kendra from Lagna; dispositor in kendra from Moon; the sign's own exalted-planet occupant in kendra; dispositor itself exalted) and lists whichever fired.
- **Vipareeta Raja Yoga** — a dusthana lord (6th/8th/12th) sitting in a dusthana house (any of 6/8/12), named Harsha/Sarala/Vimala by which house is owned.
- **Gajakesari Yoga** — Jupiter in a kendra (1/4/7/10) from the Moon.
- **Budhaditya Yoga** — Sun+Mercury conjunct (same sign).
- **Chandra-Mangala Yoga** — Moon+Mars conjunct.
- **Yogakaraka in Strength** — the lagna's yogakaraka (from `FUNCTIONAL_ROLES`, see §17) placed in a kendra or trikona (5/9).
- **Pancha Mahapurusha** (`mahapurusha-<id>`) — Ruchaka (Mars) / Bhadra (Mercury) / Hamsa (Jupiter) / Malavya (Venus) / Sasa (Saturn): the graha in its **own sign, moolatrikona or exaltation** *and* in a **kendra from the Lagna**. Read from the Rashi house like everything else here. Moolatrikona is accepted as own-sign for this test. These are the most personality-defining classical yogas and are consumed by the personality profile (§17c) as well as displayed.

`ownedHouses(id, lagnaSign)` is the shared helper (which houses a planet rules for this Lagna) — reused heavily by `lordships.ts`/`synthesis.ts`/`predictions.ts` too, so it effectively lives at the boundary between "calculation" and "interpretation."

**To add a new yoga**: add a detector function here following the existing pattern (read `chart.planets`/`chart.ascendant`, push a `YogaFinding` with a fully-formed description string), and call it from `detectYogas`. Keep the description-writing inline like the others — don't split it into `data/interpretations` unless the text is unconditional/static.

---

## 17. Interpretation & prediction layer — `data/interpretations/*`

This layer is **pure text composition** — no astronomy, only conditionals over an already-computed `ChartData`/`TransitInfo`/`ActiveDasha`. It's organized as curated content tables + small synthesis functions that stitch them together.

### [lordships.ts](data/interpretations/lordships.ts)
`FUNCTIONAL_ROLES[lagnaSign]` — one hand-written entry per of the 12 possible Lagnas, classifying each planet as `yogakaraka` / `benefics` / `malefics` / `neutrals` for *that* rising sign (per Parashari kendra/trikona-vs-dusthana theory), plus a prose `note` explaining the reasoning. `marakasFor(lagnaSign)` derives 2nd/7th lords programmatically (marakas aren't hand-curated since they're a pure formula).

**This table is the one place "which planets are good/bad for me" is decided** — if the user reports a functional-role classification they disagree with for a specific Lagna, this is the file to check line-by-line, not the synthesis engine.

### [planetInHouse.ts](data/interpretations/planetInHouse.ts)
`PLANET_IN_HOUSE[planet][house-1]` — the 9×12 = **108 curated core paragraphs**, one per planet-in-whole-sign-house combination, written in a consistent "professional astrologer" voice. This is the single largest content surface in the app and the most likely target for "the wording for X placement should say Y instead."

### [conjunctions.ts](data/interpretations/conjunctions.ts)
`CONJUNCTION_TEXT` — 35 hand-written two-planet conjunction readings (all pairs except Rahu-Ketu, which can't conjoin), keyed by `conjunctionKey(a,b)` (canonical order via `PLANETS` array index so `"Ma-Su"` and `"Su-Ma"` normalize to the same key). These texts are **static** — they say what a pairing means, never how strongly it fires. `synthesis.ts` appends a measured qualifier from `conjunctionStrength` (§10b) to each one; triple+ conjunctions are still not individually curated, but the group now gets a real scored verdict rather than a dignity-rank guess.

### [aspectTexts.ts](data/interpretations/aspectTexts.ts)
`ASPECT_ON_HOUSE[planet][house-1]` — **9 × 12 = 108 curated paragraphs**, the drishti counterpart to `planetInHouse.ts`: what each graha's aspect does to each house. This is the content surface that makes a *vacant* house readable and an occupied one properly qualified. `DRISHTI_CHARACTER[planet][offset]` + `drishtiCharacter(from, offset)` name the specific glance that landed (Saturn's 3rd vs 7th vs 10th, Jupiter's 5th vs 9th), falling back to the universal 7th for planets with no special drishti.

**This and `planetInHouse.ts` are the two biggest content surfaces in the app** — "the wording for X aspecting the Nth should say Y" is an edit here, not in the synthesis engine.

### [transitTexts.ts](data/interpretations/transitTexts.ts)
- `SATURN_FROM_MOON` / `JUPITER_FROM_MOON` / `RAHU_FROM_MOON` / `KETU_FROM_MOON` — 12 entries each (house-from-Moon 1–12), classical gochara phalam for the four slow/nodal transits, including the Sade Sati narrative baked into the Saturn table's own house-4/1/2/12 entries (`Kantaka Shani` etc.).
- `DASHA_THEMES[planet]` — one paragraph per planet describing what its Mahadasha/Antardasha "feels like" in general, independent of natal placement (the natal-specific qualifier is layered on separately in `predictions.ts`).

### [panchangTexts.ts](data/interpretations/panchangTexts.ts)
- `TITHI_GROUP_TEXT` — the 5 tithi *groups* (Nanda/Bhadra/Jaya/Rikta/Purna; `tithiGroup(tithiIndex)` = `index % 5`), not all 30 tithis individually.
- `VARA_TEXT` (7), `KARANA_TEXT` (11), `YOGA_TEXT` (27) — birth-panchang trait readings, consumed by `PanchangPanel.tsx`.

### [synthesis.ts](data/interpretations/synthesis.ts) — the house-by-house composer

`interpretHouse(chart, house, strengths?)` builds one house's full write-up. It returns a `HouseInterpretation` for **every** house 1–12 — it no longer returns `null` for vacant houses, because a house with no occupant is not unreadable, it is read *the classical way*: by its lord and by the drishti it receives. Layers, in order:

1. **The field** — sign + `HOUSE_SIGNIFICATIONS`, and whether the house is occupied, singly occupied, or vacant.
2. **The lord** — `SIGN_LORDS[sign]`, its placement/dignity/state flags, its house **counted from the house it rules** (`fromOwnHouse`; 1 = in its own house, dusthana-from-own = undermined from within), which house its placement carries the agenda into, and a strength-tiered verdict (uses composite strength when available, falls back to dignity bands when not).
3. **The lord's nakshatra** — star, pada, dispositor and the friend/enemy relation to it (`NAKSHATRA_QUALITIES` + `NAK_RELATION_TEXT`), i.e. *how* the house's results get transmitted.
4. **Per occupant** — `lordshipSentence` → curated `PLANET_IN_HOUSE` core → `stateSentences` → Bhava Chalit note when `p.bhava !== p.house` → **its own nakshatra sentence**.
5. **Nakshatra threads** — explicit call-outs when the house lord and an occupant, or two occupants, share a nakshatra dispositor (compounding signal: that dispositor's dasha activates the house twice over).
6. **Drishti** — one paragraph per incoming aspect: source house/sign/dignity/state, natural benefic-or-malefic **for this chart** (`naturalBenefics`, so it is paksha- and association-conditional), functional role for this Lagna, the curated `ASPECT_ON_HOUSE` text, and a qualifier that crosses benefic/malefic × dignity × functional role (including the "naturally benefic but functionally adverse" split). Closed by an aspect-balance sentence — including the genuine "no graha aspects this house" case.
7. **Conjunctions** — the static pair text plus a `conjunctionStrength` qualifier per tier; for 3+ occupants a scored committee verdict naming the leader, span and tier.
8. **Vacant-house close** — an explicit "in sum, this house rests on its lord and these aspects" judgement.

`interpretFullChart(chart, strengths?)` — all 12 houses, in order, none skipped.
`functionalRole(id, lagnaSign)` and `ordinal(n)` are exported helpers reused by `personality.ts`.

**This is the file to edit if you want to change *how* placements are described (structure/ordering/tone)**, as opposed to *what* they say (that's the data files above).

### 17c. Personality profile — [personality.ts](data/interpretations/personality.ts)

`buildPersonalityProfile(chart, strengths, yogas) → PersonalityProfile` (`{ headline, sections[], strongest, weakest }`). Character is read from the three classical seats at once and then modified by measured strength and by yoga:

1. **Lagna — the body and the bearing**: `LAGNA_TEMPERAMENT[12]` + the *rising nakshatra*, then the Lagna lord's house/sign/dignity/composite/nakshatra, then the `FUNCTIONAL_ROLES` note.
2. **Chandra — the mind and its weather**: `MOON_MIND[12]` + the Moon's nakshatra (flagged as the chart's most personal signature, since it also sets the Vimshottari sequence) + the house its emotional life orbits.
3. **Surya — the will and the self**: `SUN_CORE[12]` + the house the identity is staked on + the Sun's nakshatra.
4. **The strong / weak axis**: highest and lowest composite from `allStrengths`, each with its top ±3 contributing factors quoted, framed as the negotiation the personality actually is.
5. **Yoga signatures**: yogas partitioned into *temperament* (`mahapurusha-*`, `gajakesari`, `budhaditya`, `chandra-mangala`, `yk-*`) and *resilience* (`nbrj-*`, `vrj-*`), folded into narrative rather than listed. The no-yoga case is written copy, not an empty section.
6. **Functional weather**: yogakaraka/benefics/malefics/neutrals for the Lagna, each with placement, dignity and composite grade.

This **replaces `lagnaOverview()`**, which is gone from `synthesis.ts` — its content is absorbed into section 1. It is pure text composition; no astronomy, no new computation beyond what `strengths`/`yogas` already carry.

### [predictions.ts](data/interpretations/predictions.ts) — time-bound forecasting
Two entry points, both pure functions of already-computed state (no new astronomy):

- `buildYearlyPrediction(chart, active, transits, sadeSati, now)`:
  1. "Dasha Climate" section — `dashaLordAssessment` for the Mahadasha and Antardasha lords: combines `DASHA_THEMES` (generic) + the lord's **natal** house/sign/dignity (chart-specific) + owned-houses-activated sentence + a strength-based outlook sentence (three tiers: strong dignity → "delivers with interest"; weak dignity → "discounted and delayed"; neutral → "earned-outcome").
  2. "Gochara" section — one paragraph per slow transit body (`Sa/Ju/Ra/Ke`) using `TRANSIT_TABLES[id][houseFromMoon - 1]`, with the Sade Sati phase paragraph prepended when active.
  3. "Where the Year Concentrates" — names the houses the running dasha lords sit in natally, as the year's thematic focus.
- `buildMonthlyPrediction(chart, active, transits, now)`:
  1. "Operative Sub-Periods" — same `dashaLordAssessment` pattern but for the **Pratyantardasha** lord (the finest grain tracked).
  2. "Fast Transit Currents" — Sun and Mars house-from-Lagna for the month (the two bodies that move fast enough to matter monthly; the four slow ones are handled yearly).

`dashaLordAssessment(chart, lord, role)` is **exported** (not just internal) because the year-forecast engine (§17a) reuses it to describe each Mahadasha/Antardasha lord's natal strength inside a timeline segment.

**To add a new prediction cadence** (e.g. weekly, or a "next 5 years" long view): follow this file's pattern — it is entirely a function of `(chart, activeDasha, transits, sadeSati, now)`, so a new function here just picks a different level of the dasha tree and/or a different transit set.
**To add a new "kind" of prediction** (e.g. a Saturn-return report, a marriage-timing scan): this is likely a *new* file in `data/interpretations/`, since `predictions.ts` is scoped to "what's active right now," not scanning across time.

### 17a. Year forecast (selectable year, past or future) — [data/interpretations/yearForecast.ts](data/interpretations/yearForecast.ts)

This is the **"predict any selected year"** feature. Unlike `predictions.ts` (which snapshots "now"), it reasons over a whole 12-month **window** and tracks how dasha sub-periods and transits *change across* that window. Single entry point:

`buildYearForecast(chart, dashaTree, ayanamsha, start, end): YearForecast`, producing three layers:

1. **Year overview** — `mahaSegments[]`: the Mahadasha(s) covering the window (usually one, but if the maha changes mid-year both are listed with clamped date ranges), each with a `dashaLordAssessment` paragraph; plus the `sadeSati` phase/text for the window (assessed at its midpoint).
2. **Segmented timeline** — `timeline[]` (`TimelineSegment`): the window is cut at every **antardasha change** *and* every **slow-planet (Ju/Sa/Ra/Ke) sign ingress** (boundaries within 2 days are merged to avoid slivers; segments <12h are dropped). Each segment carries: the active maha/antar, the **antardasha assessment**, the **slow transits** active in that segment (sign + house-from-Moon/Lagna + gochara text from `TRANSIT_TABLES`), and the **pratyantardasha sequence** running inside it (each with a one-line theme). This is the concrete realisation of "predict based on dasha + antardasha + pratyantardasha *and* the transits in that year."
3. **Month-by-month** — `months[]` (`MonthBlock`, 12 entries via `buildMonthlyBreakdown`): each month's operative Maha–Antar–Pratyantar line + the **fast transits** (Sun/Mars house-from-Lagna) for that month.

Graceful degradation: no birth anchor → `hasDasha=false`, timeline segments become transit-only (cut on ingresses alone), months show only fast transits. A window entirely before birth sets `beforeBirth=true` (the UI shows a notice; the sky is still real, the personal predictions just haven't started).

**Window definition lives in the panel, not here** — this function takes raw `start`/`end` dates. The panel builds them two ways (see §18): calendar year (`Jan 1 → Jan 1`) or solar-return year (`solarReturn(year) → solarReturn(year+1)` from scan.ts).

**To add a new forecast layer** (e.g. a varga-transit overlay, or Ashtakavarga-weighted transit scoring per segment): add it to the `YearForecast` shape and compute it inside `buildYearForecast` — you already have the segment boundaries and per-segment midpoints to hang it on.

### 17b. Life-area analysis — [data/interpretations/lifeAreas.ts](data/interpretations/lifeAreas.ts)

The **"Life Areas" tab**: per-area verdicts for Finance, Health, Love, Marriage, Job/Career, Children & Education, Property & Vehicles, and Spirituality & Moksha. One entry point: `buildLifeAreaReports(chart, dashaTree, ashtakavarga, yogas, now)` → `LifeAreaReport[]`.

**Area definitions** live in `AREA_CONFIGS`: each area = `primary` houses (scored), `supporting` houses (mentioned only), and `karakas` (natural significators — e.g. Finance: houses 2/11 + Jupiter; Marriage: house 7 + Venus; Career: house 10 + Saturn/Sun). **Adding/removing an area or changing which houses/karakas define it is purely a config edit here** — the analysis pipeline is generic.

**Per-area pipeline** (all reusing §10a/§10b primitives):
1. Each primary house: sign, occupants (with functional role from `FUNCTIONAL_ROLES` and their strength), benefic/malefic drishti on the house (`aspectsOnHouse` × `naturalBenefics`).
2. Each primary-house lord: placement, dignity, composite strength, combust/retro/war flags, and its position **counted from the house it rules** (dusthana-from-own-house → caution).
3. Karakas under the same lens, with their top-2 strength factors quoted.
4. Nakshatra threads: each lord/karaka's nakshatra dispositor and friend/enemy relation.
5. Yogas from `detectYogas` whose participant planets intersect the area's lords/karakas/occupants.
6. Cautions collected along the way (combust/debilitated lords — with Neechabhanga cross-check against the yoga findings — malefic-heavy houses, etc.).

**Area score** = 0.5 × avg(primary lords' strength) + 0.35 × avg(karaka strength) + capped occupant adjustment (functional benefic/malefic ±4, yogakaraka +6, natural malefic in upachaya softened +2) + capped drishti adjustment (±3 per aspect) → verdict tiers: ≥68 Strong promise / ≥56 Supportive / ≥45 Mixed / ≥34 Needs effort / else Challenged.

**Dasha activation** (when a birth anchor exists): a planet is "connected" to an area if it *owns* a primary house, *occupies* one, is a *karaka*, or *aspects* one (`connectionReason`). The report lists (a) which currently running Maha/Antar/Pratyantar lords are connected, and (b) up to 8 upcoming **Maha–Antar windows over a 20-year horizon** whose lords connect — graded `strong` when both lords connect, `moderate` when one does.

Rendered by [LifeAreasPanel.tsx](components/panels/LifeAreasPanel.tsx) (expandable card per area, verdict chip + score bar), computed locally in the panel via `useMemo` (same pattern as the year forecast — off the global context cascade).

---

## 18. Wiring — [components/context/ChartContext.tsx](components/context/ChartContext.tsx)

`ChartProvider` holds all UI state (`mode`, `ayanamsha`, `chartStyle`, plus `predictionYear`/`predictionWindow` for the year-forecast selector) and the **committed** input (`commitAuto`/`commitManual` — the chart only recomputes when the user submits, not on every keystroke). Everything computed (`chart`, `dashaTree`, `activeDasha`, `transits`, `sadeSati`, `panchang`, `ashtakavarga`, `yogas`, `strengths`, `houseReadings`, `personality`) is a `useMemo` cascade off `committed`/`ayanamsha`/`now`.

`strengths` (`allStrengths`), `houseReadings` (`interpretFullChart`, all 12) and `personality` (`buildPersonalityProfile`) are computed **once here** and threaded to panels, rather than re-derived per panel — `houseReadings` and `personality` both consume `strengths`, so computing it in the provider avoids three separate composite passes. `LifeAreasPanel` still computes its own report locally (it is off the global cascade by design, like the year forecast); it could be pointed at `strengths` if that ever becomes a hot path. `now` is captured **once** at provider mount (`useState(() => new Date())`), not live-updating — "current transits" means "at page load," not a ticking clock.

**Year forecast wiring**: `predictionYear` (default = current year) and `predictionWindow` (`"calendar"` | `"solar"`, default calendar) live in context so they persist across tab switches. The actual forecast is *not* computed in the provider — [PredictionPanel.tsx](components/panels/PredictionPanel.tsx) does it locally with its own `useMemo`s: first it derives the `{start, end}` window (calendar bounds, or `solarReturn()` bounds when solar mode + birth data), then calls `buildYearForecast(chart, dashaTree, ayanamsha, start, end)`. This keeps the (potentially heavier, span-scanning) forecast off the global cascade so it only runs when the Predictions tab is open and its selector changes. Solar-return mode is disabled in the UI when there's no birth anchor.

Panels (`components/panels/*.tsx`) are pure consumers of `useChart()` — they contain no astrology math or lookup logic themselves, only layout/rendering of the already-composed strings and structured data. `components/charts/*.tsx` (South Indian chart, Planet table, Ashtakavarga table) similarly just render `ChartData`/`AshtakavargaResult`.

**If adding a feature that needs new computed state**: add the util function, call it in a new `useMemo` in `ChartContext.tsx`, add it to `ChartContextValue`, then consume it in a panel. This is the standard extension seam for the whole app.

---

## 19. Known precision decisions & caveats (read before "fixing" these)

These were deliberate, verified choices — see also the `aipems-astrology` memory record:

- **`astronomy-engine`, not Swiss Ephemeris.** ~Arcminute accuracy, chosen for zero native deps / in-browser use. If a request needs sub-arcsecond precision, that's a library swap, not a bugfix.
- **Rahu/Ketu are the *mean* lunar node** (Meeus polynomial), not the true/osculating node. Classical Vimshottari almost always uses the mean node anyway, so this matches convention — but if a user specifically wants "true node," it needs a second code path, not a replacement.
- **Lahiri ayanamsha is a linear+quadratic approximation** anchored at J2000, not a lookup against IAU precession tables. Verified against the published ~24°11' for 2024; accuracy degrades slowly outside roughly ±150 years of J2000 — flag any request involving historical charts far outside that window.
- **Pushya ayanamsha is Lahiri minus a constant** (−1.122°), which is valid *because* both share the same precession-rate model in this implementation — if Pushya were ever computed independently (its own anchor star), this shortcut would need revisiting.
- **Dignity, lordship, yogas and interpretation text are all whole-sign-house based.** Bhava Chalit only affects the *reported* house for narrative "where do results show up" purposes (`PlanetPosition.bhava` vs `.house`), never dignity/strength calculations. Don't let a "make Bhava Chalit affect yoga detection" request slip through without flagging this is a deliberate scope boundary, not an oversight.
- **Graha Yuddha winner = lower degree-in-sign.** This is one defensible convention among a few in classical literature; if a user cites a different tie-break rule they were taught, it's a one-line change in `applyGrahaYuddha` (states.ts), not a deep fix.
- **"Now" for the *current*-state computations is frozen at page load** (`now` in ChartContext), not a live clock. A request for "live updating countdown to dasha change" or similar needs an actual timer (`setInterval`/`Date.now()` re-read), which this architecture doesn't currently provide. Note this does **not** limit the year forecast (§17a) — that takes an explicit selected year and computes transits/dasha at arbitrary past/future instants via `scan.ts`.
- **Solar-return mode is a *sidereal* solar return** (Sun back to natal *sidereal* longitude), which is why consecutive returns are one sidereal year apart. It is **not** the full classical Varshaphal/Tajika annual-chart system (no muntha, year-lord, sahams, or mudda dasha) — it's the existing snapshot techniques re-based to a birthday-to-birthday window. A true Tajika build would be a separate, much larger feature.
- **Drishti is whole-sign and binary** — no Parashari partial aspects (3/4, 1/2, 1/4) and no degree-based orbs. **Rahu/Ketu are given 5/7/9 drishti** (BPHS reading); traditions that deny nodal aspects would edit `SPECIAL_DRISHTI` in aspects.ts. Conjunction (same sign) is intentionally *not* counted as an aspect anywhere. The *interpretation* layer now distinguishes **which** drishti landed (`Drishti.offset`), but that is narrative granularity only — it does not reintroduce partial-strength aspects into any calculation.
- **Conjunction orb is measured in degrees, but conjunction itself is still whole-sign.** `conjunctionStrength` uses real separation to grade how fused a combination is, yet two planets only *count* as conjunct when they share a sign (`interpretHouse` groups by house occupancy). Two planets 3° apart across a sign boundary are not treated as a conjunction. That is consistent with the rest of the engine's whole-sign stance; changing it would be a genuine convention change, not a refinement.
- **Every house is now interpreted, including vacant ones.** `interpretHouse` never returns `null`. A house with no occupant is read from its lord and its drishti — the classical method — so the Interpretation tab always renders 12 sections. If a future change wants the old "occupied only" behaviour, filter on `HouseInterpretation.occupied` at the panel, don't reintroduce the null return.
- **`PlanetPosition` carries `nakshatraLord`/`nakshatraRelation` as first-class fields**, populated in `chart.ts` from `states.ts`. `nakshatraRelation()` was moved out of `strength.ts` (which re-exports it) specifically so `chart.ts` need not depend on the strength/ashtakavarga graph. Don't move it back.
- **The strength score is a composite heuristic, not Shadbala.** It is transparent (every factor listed) and directionally classical, but its weights (+25 exalted, −15 combust, etc.) are engineering choices, not shastra. Don't present it as Shadbala; if true Shadbala is requested, that's a new `shadbala.ts` with real time-based sub-balas.
- **Life-area verdict thresholds (68/56/45/34) and score weights (0.5 lord / 0.35 karaka) are tuning knobs**, not classical constants — adjust freely in `lifeAreas.ts` if verdicts feel too harsh/generous. Marriage analysis is single-chart only (no synastry/kuta matching — that would be a separate feature taking two charts).
- **Year-forecast segmentation is driven by antardasha changes + slow-planet (Ju/Sa/Ra/Ke) ingresses only.** Fast planets (Sun/Mars) appear in the month grid, not as segment boundaries; Mercury/Venus transits are not tracked at all yet. Deeper dasha levels (pratyantar) are *listed within* segments but don't themselves create new segments (that would over-fragment the year). If a request wants finer segmentation, that's a deliberate change to the boundary set in `buildYearForecast`.
- **Manual mode fabricates planetary `speed`** (±0.1/0.5) since there's no ephemeris sampling for hand-entered placements — safe today because nothing decision-relevant reads `speed` in manual mode, but a future feature that does (e.g. showing exact speed-based combustion/retrograde-station copy) would need real numbers, which manual mode structurally cannot provide.

---

## 20. Quick "I want to add X" index

| Feature request | Primary file(s) |
|---|---|
| New/changed placement wording | `data/interpretations/planetInHouse.ts` (and `conjunctions.ts` for pairs) |
| New/changed **aspect** wording (planet aspecting a house) | `data/interpretations/aspectTexts.ts` (`ASPECT_ON_HOUSE`, 9×12) |
| Reword which drishti landed (Saturn's 3rd vs 10th, etc.) | `data/interpretations/aspectTexts.ts` (`DRISHTI_CHARACTER`) |
| Change house write-up structure/ordering, empty-house handling | `data/interpretations/synthesis.ts` (`interpretHouse`) |
| Change/extend the personality reading | `data/interpretations/personality.ts` (+ its 3 × 12 temperament tables) |
| Tune conjunction tiers, orb bands or conjunction scoring | `utils/astrology/strength.ts` (`conjunctionStrength`, `orbFactor`, `conjunctionTier`) |
| New/changed "who's good/bad for this Lagna" logic | `data/interpretations/lordships.ts` |
| New yoga (Raja Yoga variant, Dhana Yoga, etc. — Pancha Mahapurusha already present) | `utils/astrology/yogas.ts` |
| New ayanamsha | `utils/astrology/ayanamsha.ts` + `types.ts` (`AyanamshaId`) + `app/page.tsx` toggle |
| New divisional chart (D9, D10, D60…) | new file alongside `utils/astrology/chart.ts`, reusing stored sidereal longitudes |
| New dasha system (Yogini, Ashtottari…) | new file alongside `utils/astrology/dasha.ts` |
| Deeper dasha levels (Sookshma/Prana) | `utils/astrology/dasha.ts` — extend `buildSubPeriods` recursion + `DashaPeriod.level` |
| New house system (Placidus, Equal, KP) | `utils/astrology/houses.ts` — sibling to `sripatiHouses` |
| New transiting body tracked | `utils/astrology/transits.ts` (`TRANSIT_BODIES`) + `data/interpretations/transitTexts.ts` |
| New prediction cadence (weekly, N-year outlook) | `data/interpretations/predictions.ts` |
| Change year-forecast content/structure (selected-year predictions) | `data/interpretations/yearForecast.ts` |
| Change year-forecast selector/window (calendar vs solar) UI | `components/panels/PredictionPanel.tsx` |
| Finer/different timeline segmentation, more tracked transit bodies | `data/interpretations/yearForecast.ts` (boundary set) + `utils/astrology/scan.ts` |
| New date-range scan (ingress dates, returns, period overlaps) | `utils/astrology/scan.ts` |
| New life area, or change an area's houses/karakas | `data/interpretations/lifeAreas.ts` (`AREA_CONFIGS`) |
| Tune life-area scoring/verdict thresholds | `data/interpretations/lifeAreas.ts` (weights + `verdictOf`) |
| Change aspect rules (nodal drishti, partial aspects, orbs) | `utils/astrology/aspects.ts` |
| Change planetary strength factors/weights | `utils/astrology/strength.ts` |
| Full classical Shadbala | new `utils/astrology/shadbala.ts` (see §10b note) |
| New prediction *kind* (marriage timing, Saturn return) | new file in `data/interpretations/` |
| **Change an age band** (when marriage/career/wealth/foreign windows are scanned) | `utils/astrology/ageBands.ts` (`AGE_BANDS`) — see §21.5 |
| New computed panel/feature in the UI | add util → wire in `ChartContext.tsx` → consume in a new/existing panel |
| True (not mean) Rahu/Ketu node | `utils/astrology/ephemeris.ts` (`meanLunarNode` sibling) |
| Ashtakavarga refinements (Kaksha, Shodhya Pinda, Prastarashtakavarga) | `utils/astrology/ashtakavarga.ts`, layered on existing `bav`/`sav` |


---

## 21. Interpretation Engine v2 (2026-08) — vargas, Shadbala, Jaimini, timing, scored sections, theme

A second calculation tier and six new scored Interpretation-tab sections were added on top of the pipeline above. Numeric verification for everything in this section lives in the dev-only harness **`utils/astrology/__checks__/verify.ts`** (run `npx tsx utils/astrology/__checks__/verify.ts` — this is the regression ritual after any calc change). Classical citations and the disagreement log live in **`data/interpretations/SOURCES.md`**.

### 21.1 New calculation modules (`utils/astrology/`)

- **`varga.ts`** — all sixteen Shodasavarga charts (D-1…D-60) as pure longitude→sign remaps of the stored sidereal longitudes. Exposes `vargaSign(vargaId, lon)` (the primitive), `computeVargaChart`, `computeVargaSet` → `VargaSet { charts, vargottama, vimshopaka }`, plus `houseInVarga`/`vargaPositionOf` helpers and the exported `VIMSHOPAKA_WEIGHTS` tables (each scheme totals 20, harness-checked). Varga dignity is judged at sign level via `dignityInSign` with the tatkalika component fixed from the rashi chart.
- **`shadbala.ts`** — full six-fold Shadbala (`computeShadbala(chart) → ShadbalaSet | null`): Sthana (Uchcha, Saptavargaja over 7 vargas, Ojha-Yugma, Kendradi, Drekkana), Dig (cusp-based), Kala (Nathonnatha, Paksha, Tribhaga, Abda/Masa/Vara/Hora, Ayana, Yuddha), Cheshta (seeghrocca), Naisargika, Drik (sputa-drishti curve, exported as `sputaDrishti`) — in virupas/rupas with Ishta/Kashta and the classical minimum table. **Returns `null` for charts without a real birth anchor**; every consumer falls back to the `strength.ts` composite *and says so*. Also `computeBhavaBala`. Deliberate approximations (temporal hours for Nathonnatha/Tribhaga, mean-element seeghrocca, Ayana clamp) are flagged inline and in SOURCES.md.
- **`jaimini.ts`** — chara karakas (7-scheme, `AK…DK`), Karakamsa, `arudhaSign`/`arudhaOfHouse` (with the 1st/7th→10th exception), Upapada, per-house Argala, and `doubleTransitOnSign` (the Saturn+Jupiter gate — a modern synthesis, labelled).
- **`numerology.ts`** — Moolank/Bhagyank digit roots, Chaldean (default; no letter maps to 9) and Pythagorean name numbers, Kua number with the male/female formulas and 5→2/8 rule.
- **`states.ts` refactor** — `naturalRelation`, `temporalRelation` and the longitude-free **`dignityInSign`** are now exported; `computeDignity` is a thin wrapper (behavior-identical, harness-checked). These unblock varga dignity and Saptavargaja bala.
- **`ephemeris.ts` additions** — `sunsetFor`, `nextSunrise`, `declination` (kranti via ecliptic-of-date + obliquity), and **`trueLunarNode`** (osculating node from GeoMoonState r×v, verified against `SearchMoonNode` to 0.0000°). `tropicalLongitude`/`dailySpeed` take an optional `nodeMode` (default `"mean"`), threaded through `chart.ts`, `scan.ts`, `transits.ts` and surfaced as a header toggle + `ChartMeta.nodeMode`.
- **`scan.ts` additions** — generic `refineCrossing` bisector (the two previously-inlined bisections now share it; the 2024-05-01 Jupiter→Taurus regression guards it), `occupancyIntervals` (piecewise sign occupancy), and **`findActivationWindows(chart, tree, ayanamsha, av, criteria, from, to)`** — the timing backbone: every Antardasha whose Maha/Antar lord connects to the criteria (lordship/occupancy/karaka/aspect) is scored, refined by double-transit coverage over the target signs (piecewise on ingress intervals — no daily sampling; ~25 bisections per 20 years) and weighted by Jupiter's BAV bindus. Returns windows with 5–95 confidence and per-window reasons. `ActivationCriteria { houses, karakas?, extraSigns?, requireDoubleTransit?, minBindus?, maxWindows?, agePriorAt?, relativeTo? }` — the last two are the age-band hooks added in §21.5, which also made the output quota-balanced between elapsed and upcoming windows and **chronologically ordered** rather than score-ordered.
- **`yogas.ts` additions** — Raja (kendra–trikona link), Dhana family, Lakshmi, Kemadruma (cancellations *reported inside the finding*, never silently suppressed), Shakata, Daridra, Kala Sarpa, Amala. Keys are namespaced (`raja-*`, `dhana-*`, …) so earlier consumers are unaffected.

### 21.2 The scored-section layer (`data/interpretations/`)

Shared vocabulary in **`report.ts`**: `SectionReport { key, title, headline, score?, verdict?, confidence, blocks, caveats, hasDasha }`, `Evidence { text, weight, source? }` (source = `{ work, ref? }`, ref only when verified), `RankedItem`, `TimingWindow` (with `ageRange`, `phase`, optional `group`, and optional month-level `subWindows`), `verdictOf` (the Life-Areas thresholds, now shared), `themeConnection`, `toTimingWindow`, and the `plain()` glossary. Every section renders **the reading + the "why" + a confidence badge**, and every builder is deterministic (`now` injected, no randomness — harness-checked) and degrades with explicit `caveats` when shadbala/gender/name/birth-time are missing.

| File | Section | Notes |
|---|---|---|
| `career.ts` | 5–8 ranked career fields with fit scores; job-vs-business verdict; environment; `careerTimingWindows` | Votes from the 10th lord (from Lagna/Moon/Sun), 10th occupants, D-10, Amatyakaraka, strongest planet, yogas — each vote is an `Evidence` row |
| `wealth.ts` | Ranked income streams + a percentage split that sums to exactly 100 (harness-checked); the "planets that pay"; per-stream `wealthTimingWindows` | D-2 Hora tally feeds the self-earned vs accumulation lean |
| `marriage.ts` | Harmony/delay factor lists; **`checkMangalDosha`** (1/4/7/8/12 from Lagna+Moon, with implemented cancellations); spouse indications; remedies-as-tradition; `marriageTimingWindows` → up to 4 age-banded windows (§21.5) with Jupiter-transit month sub-windows | All timing language is probabilistic by construction (harness phrasing gate, §21.6) |
| `foreign.ts` | Travel / long-stay / settlement scored separately; purpose; digpati direction (confidence capped ≤ 75 by design); `foreignTimingWindows` | |
| `cautions.ts` | `Caution { caution: Evidence, counterMeasure: string }` — **the type makes a caution without a counter-measure unrepresentable**; adverse dasha windows (both lords functional malefics) | Marakas framed as health-attention periods; no fatalist wording |
| `lucky.ts` | Numerology and Jyotisha verdicts **shown separately, then combined; disagreements rendered, never averaged** (Jyotisha ranked first, rationale stated); gemstones informational-only | Planet→number/direction/colour/day maps live in `constants.ts` |
| `personality.ts` (extended) | New sections: Atmakaraka/Karakamsa, Navamsa lagna + vargottama, Shadbala strongest/weakest, drishti on the Lagna, Arudha-vs-Lagna | Signature gained an optional `extras` bag — old call sites still compile |

UI: `components/panels/interpretation/` — `InterpretationPanel` (moved from `components/panels/`) + `SectionCard` (collapsible; **children mount on first expand**, which is the lazy boundary), `ConfidenceBadge`, `WhyList`, `RankedList`, `TimingWindows`, and one thin card per section. Timing scans additionally hide behind an explicit "Compute timing windows" button inside each card. `vargas`/`jaimini`/`shadbala`/`bhavaBala` are cheap and live as always-on `ChartContext` memos (the context `value` itself is now memoised); numerology is computed inside `LuckyCard`.

Inputs: optional **gender** (`AutoInput` + `ManualInput`, "Prefer not to say" default) and a name field in manual mode — carried on `ChartMeta` (`gender`, `nodeMode`), which is the only channel panels read. A dismissible global disclaimer (`components/ui/Disclaimer.tsx`, localStorage-persisted) renders under the header.

### 21.3 Theme system

`app/globals.css` now defines the whole palette as **semantic tokens** (`--color-surface/-line/-fg*/-heading/-primary*/-good/-bad/-accent/…`) via `@theme inline` over CSS variables, with two value sets: **light (default) — AstroSage-inspired** (white surfaces, saffron primary, maroon headings, blue links, grey table borders; saffron never used for small text — darkened variants keep WCAG AA) and **dark (`.dark`) — the original indigo/amber look, value-for-value**. `@custom-variant dark` + class strategy; a no-flash script in `layout.tsx` applies the stored theme (`jyotisha.theme`) pre-paint with a `prefers-color-scheme` fallback; `components/ui/ThemeToggle.tsx` flips it. **No raw Tailwind palette classes remain in components** — the gate is `grep -rE "(bg|text|border|ring|from|to|via)-(indigo|amber|slate|fuchsia|emerald|rose|sky|orange)-[0-9]" app components` returning nothing. A handful of near-duplicate alpha steps were merged into single tokens (e.g. indigo-900/30·40·50 → one `--inset`), so dark mode is value-identical for the dominant styles and imperceptibly consolidated for the long tail.

### 21.4 New "I want to add X" rows

| Feature request | Primary file(s) |
|---|---|
| New varga or a varga-rule variant | `utils/astrology/varga.ts` (`vargaSign` switch + `VIMSHOPAKA_WEIGHTS`) |
| Tune/verify a Shadbala sub-bala | `utils/astrology/shadbala.ts` (one function per sub-bala) + harness |
| New Jaimini technique (karakamsa yogas, more arudhas) | `utils/astrology/jaimini.ts` |
| New scored section ("children", "health"…) | `data/interpretations/report.ts` types + new builder file + thin card in `components/panels/interpretation/` |
| Change a section's timing criteria | its `*TimingWindows` wrapper (career/wealth/marriage/foreign) → `ActivationCriteria` |
| Change activation-window scoring/weights | `utils/astrology/scan.ts` (`findActivationWindows`) |
| Mangal Dosha rules/cancellations | `data/interpretations/marriage.ts` (`checkMangalDosha`) |
| Numerology systems/maps | `utils/astrology/numerology.ts` + letter maps in `constants.ts` |
| Lucky colour/direction/gemstone tables | `utils/astrology/constants.ts` (`PLANET_COLOURS`, `PLANET_DIRECTION`, `PLANET_GEMSTONES`, `PLANET_NUMBER`) |
| Theme colours (either mode) | `app/globals.css` (`:root` = light, `.dark` = dark) — components never hard-code colours |
| Add a caution rule | `data/interpretations/cautions.ts` (must ship with a counter-measure — the type enforces it) |
| Cite or change a classical source | inline comment + `data/interpretations/SOURCES.md` (module→rule→citation + disagreement log) |
| **Change an age band, or add one** | `utils/astrology/ageBands.ts` (`AGE_BANDS`) — then the builder that scans it, and the band copy in its card |
| Change the past/upcoming selection quota | `utils/astrology/scan.ts` (tail of `findActivationWindows`) |
| Change phase chips / age display / window grouping | `components/panels/interpretation/TimingWindows.tsx` (+ `BandNote.tsx` for the standing caveat) |

### 21.5 Age-banded probable windows (2026-08)

`findActivationWindows` was always a pure function of `[from, to]`, but every caller passed `now → now + 15 years`. That is wrong for anyone who is not standing at the start of the relevant life stage: a 52-year-old was shown "marriage windows" at ages 52–67, a 12-year-old career windows starting at 12, and a 36-year-old never saw the 22–30 window that may have been the strongest marriage yoga in the chart. The fix supplies the missing input — the native's **age**.

- **`utils/astrology/ageBands.ts`** (new, pure — no astronomy, no `Date.now()`): `AGE_BANDS` (marriage 22–45 peaking 24–32; careerEntry 22–30 peaking 24–28; careerChange 28–50 peaking 32–42; wealth 25–65 peaking 32–50; foreign 18–55 peaking 22–38), `ageAt`/`dateAtAge` (365.2425-day years), `agePrior(band, age)` → 1.0 across the peak, linear ramps down to `EDGE_PRIOR = 0.15` at each edge, 0 strictly outside, plus `agePriorFor` (the closure shape `ActivationCriteria` wants), `ageYearsAt` and `bandStance`. **These bands are a modern demographic convention, not a shastric rule** — stated in the module docstring, logged in `SOURCES.md`, and surfaced as a caveat on every banded card. Do not present them as Parashari.
- **`scan.ts`** — `ActivationCriteria` gains `agePriorAt?: (t) => number` (injected, so `scan.ts` holds no domain age tables) and `relativeTo?: Date` (phase labelling only — it never bounds the scan). `ActivationWindow` gains `phase: "past" | "current" | "future"` and `agePrior?`. The prior contributes `round(30 × (prior − 0.5))`, i.e. **−15…+15**, and a `prior <= 0` window is dropped outright. The tail is now a **quota, not a top-N**: sort by score, take `ceil(maxWindows/2)` from the non-past pool and the rest from past (either pool tops up the other when short), then **re-sort chronologically** — elapsed windows often outscore upcoming ones, and a pure score sort let them crowd out everything the reader could still act on. Chronological output reads as a life story; the score survives per window.
- **`report.ts`** — `TimingWindow` gains `ageRange: {from, to}`, `phase`, and optional `group`. `toTimingWindow(w, label, birthUtc, group?)` now requires the birth instant.
- **Callers** — marriage scans 22→45 (`maxWindows: 4`, Jupiter sub-windows unchanged); **career splits into two scans**, *Entry & establishment* (`careerEntry`, houses 10/6/2, 3 windows) and *Change, elevation & independence* (`careerChange`, houses 10/7/11/3, 4 windows), concatenated entry-first with `group` headings; wealth scans 25→65; foreign 18→55. All five keep their signatures — `now` survives as the phase reference. **`cautions.ts` is deliberately unbanded**: health and adversity are age-independent and an elapsed health window is not actionable, so it keeps `now → now + 15y` and drops anything already closed.
- **UI** — `TimingWindows.tsx` renders `age N–M`, a phase chip (`already passed` / `running now` / `upcoming`, past rows muted) and grouped lists when `group` is present; `BandNote.tsx` is the standing note above each banded list, carrying the band range, the "you are younger/older than this band" cases, and the required convention caveat. The "Compute probable windows" gating is unchanged — the scan is still on demand.

`vimshottariTree` builds a full 120-year cycle from a balance-adjusted start, so every band is always covered by the tree; no exhaustion guard is needed.

### 21.6 Interpretation voice (2026-08)

The six scored-section builders (`marriage`, `career`, `wealth`, `foreign`, `cautions`, `lucky`) were rewritten for a warmer register. The rules, if you are editing these files: **second person, present tense** ("your 7th house is ruled by Venus", not "the 7th lord is Venus"); **factor → meaning → daily life** — every analytical sentence earns a companion sentence saying what it looks like in someone's week; **plain English for technique** ("main period / sub-period", "the aspect Saturn casts on your 7th"), with `plain()` still glossing first mentions of glossary terms and **no new Sanskrit beyond `report.ts`'s `GLOSSARY`**; **no new determinism** — windows, not dates, and never "you will"; **difficult readings close constructively** (the `Caution` type already makes a caution without a counter-measure unrepresentable — extend that habit: no paragraph ends on a bare negative); **≤ 4 sentences per paragraph**; no fatalism, fear-selling, or medical/legal instruction.

This was a **language pass only** — the 108 curated `planetInHouse.ts` entries, `aspectTexts.ts` and all numeric scoring were untouched, and every score, confidence, evidence weight and wealth split percentage was verified byte-identical against the previous commit. The harness enforces the voice with a **phrasing gate** over all six reports plus their timing windows (§21.4 checks list).
