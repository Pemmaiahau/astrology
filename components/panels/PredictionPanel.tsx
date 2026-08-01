"use client";

import { useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Sun, TrendingUp } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { buildYearForecast } from "@/data/interpretations/yearForecast";
import { solarReturn } from "@/utils/astrology/scan";
import { PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";

const MIN_YEAR = 1850;
const MAX_YEAR = 2150;

function fmt(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PredictionPanel() {
  const {
    chart,
    dashaTree,
    ayanamsha,
    predictionYear,
    setPredictionYear,
    predictionWindow,
    setPredictionWindow,
    now,
  } = useChart();

  const hasBirth = Boolean(chart?.birthUtc);
  const windowType = hasBirth ? predictionWindow : "calendar";

  const window = useMemo(() => {
    if (!chart) return null;
    if (windowType === "solar" && hasBirth) {
      const start = solarReturn(chart, ayanamsha, predictionYear);
      const end = solarReturn(chart, ayanamsha, predictionYear + 1);
      if (start && end) return { start, end };
    }
    return {
      start: new Date(Date.UTC(predictionYear, 0, 1, 0, 0, 0)),
      end: new Date(Date.UTC(predictionYear + 1, 0, 1, 0, 0, 0)),
    };
  }, [chart, ayanamsha, predictionYear, windowType, hasBirth]);

  const forecast = useMemo(() => {
    if (!chart || !window) return null;
    return buildYearForecast(chart, dashaTree, ayanamsha, window.start, window.end);
  }, [chart, dashaTree, ayanamsha, window]);

  if (!chart || !window || !forecast) return null;

  const stepYear = (delta: number) =>
    setPredictionYear(Math.min(MAX_YEAR, Math.max(MIN_YEAR, predictionYear + delta)));

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
        <h3 className="flex items-center gap-2 font-serif text-lg font-bold text-heading">
          <TrendingUp className="h-5 w-5" /> Year Forecast
        </h3>

        <div className="ml-auto flex items-center gap-1 rounded-lg border border-line-2 bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => stepYear(-1)}
            className="rounded-md px-2 py-1 text-fg-muted transition hover:text-heading"
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="number"
            value={predictionYear}
            min={MIN_YEAR}
            max={MAX_YEAR}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v)) setPredictionYear(Math.min(MAX_YEAR, Math.max(MIN_YEAR, v)));
            }}
            className="w-16 bg-transparent text-center font-mono text-sm font-bold text-heading outline-none"
          />
          <button
            type="button"
            onClick={() => stepYear(1)}
            className="rounded-md px-2 py-1 text-fg-muted transition hover:text-heading"
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {predictionYear !== now.getFullYear() && (
            <button
              type="button"
              onClick={() => setPredictionYear(now.getFullYear())}
              className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted transition hover:text-heading"
            >
              Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-line-2 bg-surface-2 p-1">
          {(["calendar", "solar"] as const).map((w) => (
            <button
              key={w}
              type="button"
              disabled={w === "solar" && !hasBirth}
              onClick={() => setPredictionWindow(w)}
              title={w === "solar" && !hasBirth ? "Requires birth date/time/place" : undefined}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                windowType === w
                  ? "bg-primary-soft text-heading ring-1 ring-inset ring-primary-ring"
                  : "text-fg-muted hover:text-fg-2"
              }`}
            >
              {w === "calendar" ? <CalendarDays className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              {w === "calendar" ? "Calendar" : "Solar return"}
            </button>
          ))}
        </div>
      </div>

      <p className="px-1 text-xs text-fg-muted">
        {windowType === "solar" ? "Solar-return year" : "Calendar year"}:{" "}
        <span className="font-semibold text-fg">
          {fmt(window.start)} → {fmt(window.end)}
        </span>
      </p>

      {!forecast.hasDasha && (
        <p className="rounded-xl border border-heading-border bg-primary-wash p-3 text-xs text-heading-soft">
          No birth anchor supplied — dasha-based sections are omitted; transit readings below remain valid
          against your mapped Moon and Lagna.
        </p>
      )}
      {forecast.beforeBirth && (
        <p className="rounded-xl border border-accent-border bg-accent-wash p-3 text-xs text-accent">
          This window predates the birth date, so dasha periods have not begun — the transit readings show the
          sky for that year, but personal predictions apply only from birth onward.
        </p>
      )}

      {/* Year overview */}
      {(forecast.mahaSegments.length > 0 || forecast.sadeSatiText) && (
        <section>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-eyebrow">Year Overview</h4>
          <div className="space-y-4">
            {forecast.mahaSegments.map((m, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-4">
                <p className="mb-2 text-sm font-bold text-heading">
                  {PLANET_NAMES[m.lord]} Mahadasha
                  <span className="ml-2 font-mono text-xs font-normal text-fg-subtle">
                    {fmt(m.start)} → {fmt(m.end)}
                  </span>
                </p>
                <p className="text-sm leading-relaxed text-fg">{m.text}</p>
              </div>
            ))}
            {forecast.sadeSatiText && (
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="text-sm leading-relaxed text-fg">{forecast.sadeSatiText}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Segmented timeline */}
      <section>
        <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-eyebrow">
          Timeline — Dasha &amp; Transit Segments
        </h4>
        <div className="space-y-4">
          {forecast.timeline.map((seg, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-sm font-bold text-heading">
                  {fmt(seg.start)} → {fmt(seg.end)}
                </span>
                {seg.maha && seg.antar && (
                  <span className="text-xs text-fg-muted">
                    {PLANET_NAMES[seg.maha]} – {PLANET_NAMES[seg.antar]}
                  </span>
                )}
                <span className="rounded-full bg-neutral-soft px-2 py-0.5 text-[10px] font-medium text-planet">
                  {seg.boundaryReason}
                </span>
              </div>

              {seg.antarText && (
                <p className="mb-3 text-sm leading-relaxed text-fg">{seg.antarText}</p>
              )}

              {seg.transits.length > 0 && (
                <div className="mb-3 space-y-2">
                  {seg.transits.map((t) => (
                    <p key={t.id} className="text-xs leading-relaxed text-fg-muted">
                      <span className="font-semibold text-fg">
                        {PLANET_NAMES[t.id]} in {SIGNS[t.sign]}
                        {t.retrograde ? " (R)" : ""} — {t.houseFromMoon}th from Moon, {t.houseFromLagna}th
                        from Lagna:
                      </span>{" "}
                      {t.text}
                    </p>
                  ))}
                </div>
              )}

              {seg.pratyantars.length > 0 && (
                <div className="rounded-lg border border-line-soft bg-surface-3 p-2.5">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
                    Pratyantardashas in this segment
                  </p>
                  <div className="space-y-1">
                    {seg.pratyantars.map((p, j) => (
                      <p key={j} className="text-xs leading-relaxed text-fg-muted">
                        <span className="font-mono text-fg-subtle">
                          {fmt(p.start)}–{fmt(p.end)}
                        </span>{" "}
                        <span className="font-semibold text-heading-soft">{PLANET_NAMES[p.lord]}</span>:{" "}
                        {p.theme}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Month-by-month */}
      <section>
        <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-eyebrow">
          Month by Month
        </h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {forecast.months.map((m, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-3">
              <p className="mb-1 text-sm font-bold text-heading">{m.label}</p>
              {m.dashaLine && <p className="mb-2 text-[11px] font-medium text-fg-subtle">{m.dashaLine}</p>}
              {m.paragraphs.map((p, j) => (
                <p key={j} className="mb-1.5 text-xs leading-relaxed text-fg-muted last:mb-0">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
