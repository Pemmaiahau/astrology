# Jyotisha Studio — Professional Vedic Astrology

A production-ready Vedic astrology web application: Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + Lucide icons, fully client-side calculation, optimized for Vercel.

For how the calculation and prediction engine actually works (file-by-file, formulas, and where to make changes), see [ENGINE.md](ENGINE.md).

## Features

- **Two input modes**
  - *Birth Data (Ephemeris)*: name, DOB, exact time, place with Open-Meteo city autocomplete (lat/lon/IANA timezone; historical DST handled via the browser ICU database).
  - *Manual Configuration*: pick the Lagna, assign each of the 9 grahas to a house with exact degrees and retro flags; optional birth anchor (date/time/place) powers the Vimshottari timelines and Sripati cusps.
- **High-precision engine** — [astronomy-engine](https://github.com/cosinekitty/astronomy) (of-date true ecliptic, ~arcminute accuracy); Meeus mean lunar node for Rahu/Ketu; apparent-sidereal-time ascendant/MC.
- **Ayanamsha toggle** — Lahiri (Chitra Paksha) and Pushya Paksha; everything recalculates live.
- **Planetary states** — retrograde, combustion (classical orbs), full compound dignity (exalted → great enemy), Graha Yuddha.
- **Vimshottari Dasha** — exact Moon-degree balance; explorable Mahadasha → Antardasha → Pratyantardasha tree with day-precise dates.
- **Bhava Chalit (Sripati)** — Porphyry-trisected quadrants with madhya/sandhi convention; chart toggle marks structurally shifted planets.
- **Ashtakavarga** — classical Parashari bindu tables, 12×8 BAV grid + SAV row with <25 / >30 highlighting (total 337).
- **Panchang** — Tithi, Vara (sunrise-anchored), Nakshatra, Yoga, Karana with practical implications.
- **Interpretation engine** — 108 curated planet-in-house cores × lagna-specific functional lordship synthesis, 35 conjunction dynamics, dignity/state overlays, yoga detection (Neechabhanga, Vipareeta, Gajakesari, Budhaditya, Chandra-Mangala, Yogakaraka).
- **Predictive timeline** — current-year and current-month write-ups from active dasha lords + gochara of Jupiter/Saturn/Rahu/Ketu from the Moon, Sade Sati phases, and fast Sun/Mars currents.
- **Functional role sidebar** — benefics, malefics, neutrals, yogakaraka and marakas per Lagna.
- **Shodasavarga divisional charts** — all sixteen vargas (D-1…D-60) per BPHS, with Vargottama flags and the four Vimshopaka dignity schemes.
- **Full classical Shadbala** — the six-fold strength (Sthana/Dig/Kala/Cheshta/Naisargika/Drik) in rupas with Ishta/Kashta and the minimum-requirement table, plus Bhava Bala; falls back transparently to the composite score for charts without an exact birth anchor.
- **Jaimini layer** — chara karakas (AK…DK), Karakamsa, Arudha Lagna and Upapada, Argala.
- **Scored life-question sections** (Interpretation tab, each with the reading, the "why", and a confidence badge):
  - *Career & Profession* — 5–8 ranked career directions with fit scores, job-vs-business verdict, best periods for career moves.
  - *Sources of Income* — ranked income streams with a percentage split, the "planets that pay", per-stream activation windows.
  - *Marriage* — timing as ranked probable windows (dasha ∩ Jupiter transits ∩ Saturn+Jupiter double transit ∩ Ashtakavarga) with month-level sub-windows; spouse indications; Mangal Dosha **with** its cancellation rules.
  - *Foreign Travel & Settlement* — travel / long-stay / settlement scored separately, purpose and direction indications.
  - *Things to Watch and Avoid* — every caution paired with a practical counter-measure, no fatalism.
  - *Lucky Number, Colour & Direction* — numerology (Moolank/Bhagyank/Chaldean-or-Pythagorean name number/Kua) and Jyotisha verdicts shown separately, then combined, with disagreements surfaced.
- **Deepened personality profile** — Atmakaraka & Karakamsa, Navamsa lagna, Shadbala strong/weak axis, glances on the Lagna, and perceived-vs-actual (Arudha vs Lagna).
- **True node toggle** — mean (default, classical) or osculating Rahu/Ketu.
- **Light & dark themes** — AstroSage-inspired light theme (default) with the original indigo/amber look preserved behind a toggle; fully tokenized palette, WCAG-AA checked.
- **Classical sourcing** — every interpretive rule cited (work-level or verified chapter) in [data/interpretations/SOURCES.md](data/interpretations/SOURCES.md), with a disagreement log of chosen defaults; numeric verification harness at `utils/astrology/__checks__/verify.ts` (`npx tsx utils/astrology/__checks__/verify.ts`).

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
components/panels/        # Interpretation, Dasha, Panchang, Predictions, roles
components/context/       # ChartContext — global state + derived computation
utils/astrology/          # Ephemeris, ayanamsha, houses, dasha, panchang, yogas…
data/interpretations/     # Curated matrices + synthesis and prediction engines
```
