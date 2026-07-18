# Jyotisha Studio — Professional Vedic Astrology

A production-ready Vedic astrology web application: Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + Lucide icons, fully client-side calculation, optimized for Vercel.

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
