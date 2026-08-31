# Jyotisha Studio — Professional Vedic Astrology

A production-ready Vedic astrology web application: Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + Lucide icons, fully client-side calculation, optimized for Vercel.

For how the calculation and prediction engine actually works (file-by-file, formulas, and where to make changes), see [ENGINE.md](ENGINE.md).

## Features

- **Two input modes**
  - *Birth Data (Ephemeris)*: name, DOB, exact time, place with Open-Meteo city autocomplete (lat/lon/IANA timezone; historical DST handled via the browser ICU database).
  - *Manual Configuration*: pick the Lagna, assign each of the 9 grahas to a house with exact degrees and retro flags; optional birth anchor (date/time/place) powers the Vimshottari timelines and Sripati cusps.
- **High-precision engine** — [astronomy-engine](https://github.com/cosinekitty/astronomy) (of-date true ecliptic, ~arcminute accuracy); Meeus mean lunar node for Rahu/Ketu; apparent-sidereal-time ascendant/MC.
- **Ayanamsha toggle** — Lahiri (Chitra Paksha), Pushya Paksha and Raman; everything recalculates live. The three run Raman < Pushya < Lahiri, so switching can change a Lagna, a Moon nakshatra and therefore the Vimshottari starting lord.
- **Planetary states** — retrograde, combustion (classical orbs), full compound dignity (exalted → great enemy), Graha Yuddha.
- **Vimshottari Dasha** — exact Moon-degree balance; explorable Mahadasha → Antardasha → Pratyantardasha tree with day-precise dates.
- **Bhava Chalit (Sripati)** — Porphyry-trisected quadrants with madhya/sandhi convention; chart toggle marks structurally shifted planets.
- **Ashtakavarga** — classical Parashari bindu tables, 12×8 BAV grid + SAV row with <25 / >30 highlighting (total 337).
- **Panchang** — the five limbs (Tithi, Vara sunrise-anchored, Nakshatra, Yoga, Karana) each with its **start and end instants**, plus the full day-parts: Rahu Kaal, Gulika Kaal and Yamaganda (day and night), Abhijit Muhurta, all sixteen Choghadiya, all twenty-four Horas, and sunrise/sunset/moonrise/moonset. Every division is of the real sunrise→sunset arc, not the civil clock. Switchable between the birth day and today.
- **Interpretation engine** — 108 curated planet-in-house cores × lagna-specific functional lordship synthesis, 35 conjunction dynamics, dignity/state overlays, yoga detection (Neechabhanga, Vipareeta, Gajakesari, Budhaditya, Chandra-Mangala, Yogakaraka).
- **Predictive timeline** — current-year and current-month write-ups from active dasha lords + gochara of Jupiter/Saturn/Rahu/Ketu from the Moon, Sade Sati phases, and fast Sun/Mars currents.
- **Functional role sidebar** — benefics, malefics, neutrals, yogakaraka and marakas per Lagna.
- **Shodasavarga divisional charts** — a dedicated **Vargas** tab renders any of the sixteen (D-1…D-60) as a chart grid *beside the D-1*, with a per-graha movement table, Vargottama flags and all four Vimshopaka dignity schemes.
- **Full classical Shadbala** — the six-fold strength (Sthana/Dig/Kala/Cheshta/Naisargika/Drik) in rupas on the **Strength** tab, expandable per graha to every sub-bala, with Ishta/Kashta and the ratio against each graha's own classical minimum; shown alongside Ashtakavarga and Bhava Bala. Falls back transparently to the composite score without an exact birth anchor.
- **Jaimini layer** — a dedicated tab for the chara karakas (AK…DK) with degrees, Karakamsa, Arudha Lagna, Upapada, and the twelve-house Argala/virodha table.
- **Scored life-question sections** (Interpretation tab, each with the reading, the "why", and a confidence badge):
  - *Career & Profession* — 5–8 ranked career directions with fit scores, job-vs-business verdict, best periods for career moves.
  - *Sources of Income* — ranked income streams with a percentage split, the "planets that pay", per-stream activation windows.
  - *Marriage* — timing as ranked probable windows (dasha ∩ Jupiter transits ∩ Saturn+Jupiter double transit ∩ Ashtakavarga) with month-level sub-windows; spouse indications; Mangal Dosha **with** its cancellation rules.
  - *Foreign Travel & Settlement* — travel / long-stay / settlement scored separately, purpose and direction indications.
  - *Things to Watch and Avoid* — every caution paired with a practical counter-measure, no fatalism.
  - *Lucky Number, Colour & Direction* — numerology (Moolank/Bhagyank/Chaldean-or-Pythagorean name number/Kua) and Jyotisha verdicts shown separately, then combined, with disagreements surfaced.
- **Life Events timeline** — twenty-five events (graduation, higher studies, study abroad, love, marriage, breakup, divorce, first job, promotion, job change, starting a business, job loss, retirement, children, property, vehicle, relocation, foreign settlement, windfall, peak earning years, illness, accident, litigation, spiritual turn) scanned across the whole life as probable **windows**, grouped by Mahadasha or chronologically, filterable by category. Each window opens into a reasoning panel showing the four limbs behind it — the birth chart's **natal promise** for that event (Bhava Bala, Shadbala of lords and karakas, drishti, cusp star-lords, Sarvashtakavarga), the Vimshottari period and what its lords signify, the **Gochara Phala** from the natal Moon with the classical vedha cancellations plus the Guru–Shani double transit, and the age band — ending in the classical rule the whole reading came from. The event→bhava table is *shared by identity* with the rectification engine, so the "when will it happen?" and "which birth minute explains it?" directions cannot drift apart on doctrine.

- **Deepened personality profile** — Atmakaraka & Karakamsa, Navamsa lagna, Shadbala strong/weak axis, glances on the Lagna, and perceived-vs-actual (Arudha vs Lagna).
- **True node toggle** — mean (default, classical) or osculating Rahu/Ketu.
- **Input validation** — birth dates bounded to the ayanamsha's validity window (1850–2150) with a soft warning band outside ±100 years of J2000; daylight-saving gaps and clock changes near the birth time flagged; polar latitudes warned; hand-entered charts checked for impossible Mercury/Venus elongations and a broken Rahu–Ketu axis, with one-click Ketu derivation.
- **Works without the network** — the city geocoder is the only external call; failures are reported rather than swallowed, recent lookups are cached, and latitude/longitude/timezone can be entered by hand.
- **Survives a refresh** — the birth input and the ayanamsha/node/chart-style settings persist locally; the chart is re-derived rather than stored.
- **Light & dark themes** — AstroSage-inspired light theme (default) with the original indigo/amber look preserved behind a toggle; fully tokenized palette, WCAG-AA checked.
- **Classical sourcing** — every interpretive rule cited (work-level or verified chapter) in [data/interpretations/SOURCES.md](data/interpretations/SOURCES.md), with a disagreement log of chosen defaults; numeric verification harness at `utils/astrology/__checks__/verify.ts`, run with `node utils/astrology/__checks__/run.mjs verify` (496 checks) and `node utils/astrology/__checks__/run.mjs golden` for the output-regression snapshot.

## Develop

```bash
npm install
npm run dev
```

## Deploy to Vercel

Import the repository, set the project **Root Directory** to `astrology/`, framework auto-detects Next.js. No environment variables or API keys required.

## Structure

```
app/                      # App Router shell (single-page client workspace)
components/charts/        # South Indian chart, planet table, Ashtakavarga grid
components/inputs/        # Manual + automatic workflows, city search
components/panels/        # Interpretation, Life Areas, Dasha, Life Events, Panchang, Vargas, Jaimini,
                          #   Predictions, Ashtakavarga, Rectify Time, roles
components/context/       # ChartContext — global state + derived computation
utils/astrology/          # Ephemeris, ayanamsha, houses, dasha, panchang, yogas…
data/interpretations/     # Curated matrices + synthesis and prediction engines
```
