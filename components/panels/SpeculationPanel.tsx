"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dices,
  ShieldAlert,
  Sun,
} from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import ConfidenceBadge from "@/components/panels/interpretation/ConfidenceBadge";
import RankedList from "@/components/panels/interpretation/RankedList";
import WhyList from "@/components/panels/interpretation/WhyList";
import SpeculationWindows from "@/components/panels/SpeculationWindows";
import {
  buildSpeculationReport,
  speculationYearWindows,
} from "@/data/interpretations/speculation";
import type { Verdict } from "@/data/interpretations/report";
import { solarReturn } from "@/utils/astrology/scan";
import { NAKSHATRAS, PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";
import { DIGNITY_SHORT } from "@/utils/astrology/states";

const MIN_YEAR = 1850;
const MAX_YEAR = 2150;

const VERDICT_STYLE: Record<Verdict, string> = {
  "Strong promise": "bg-good-soft text-good ring-good-ring",
  Supportive: "bg-info-soft text-info ring-info-ring",
  Mixed: "bg-primary-soft text-heading ring-primary-ring",
  "Needs effort": "bg-warn-soft text-warn ring-warn-ring",
  Challenged: "bg-bad-soft text-bad ring-bad-ring",
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Labelled 0–100 bar, reused for the five axis gauges. */
function Gauge({ label, value, reading }: { label: string; value: number; reading: string }) {
  return (
    <div className="rounded-lg border border-line-soft bg-surface-3 p-3">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="flex-1 text-xs font-semibold text-fg-2">{label}</span>
        <span className="font-mono text-xs text-fg-muted">{value}</span>
      </div>
      <span className="mb-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-inset-2">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-cta-from to-cta-to-hover"
          style={{ width: `${value}%` }}
        />
      </span>
      <p className="text-[11px] leading-relaxed text-fg-muted">{reading}</p>
    </div>
  );
}

/** A single month cell in the twelve-month strip. */
function MonthCell({
  label,
  score,
  notes,
}: {
  label: string;
  score: number;
  notes: string[];
}) {
  const tone =
    score >= 25
      ? "border-good-border bg-good-wash"
      : score >= 12
        ? "border-good-border bg-surface-3"
        : score <= -25
          ? "border-bad-border bg-bad-wash"
          : score <= -12
            ? "border-warn-ring bg-surface-3"
            : "border-line-soft bg-surface-3";
  const scoreTone = score >= 12 ? "text-good" : score <= -12 ? "text-bad" : "text-fg-muted";
  return (
    <div className={`rounded-lg border p-2.5 ${tone}`}>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="flex-1 text-[11px] font-bold text-heading-soft">{label}</span>
        <span className={`font-mono text-[11px] font-bold ${scoreTone}`}>
          {score > 0 ? "+" : ""}
          {score}
        </span>
      </div>
      <ul className="space-y-0.5">
        {notes.map((n, i) => (
          <li key={i} className="text-[10px] leading-relaxed text-fg-muted">
            {n}
          </li>
        ))}
        {notes.length === 0 && (
          <li className="text-[10px] leading-relaxed text-fg-subtle">
            Nothing in the periods or transits leans either way this month.
          </li>
        )}
      </ul>
    </div>
  );
}

export default function SpeculationPanel() {
  const {
    chart,
    vargas,
    jaimini,
    shadbala,
    strengths,
    ashtakavarga,
    yogas,
    dashaTree,
    ayanamsha,
    speculationYear,
    setSpeculationYear,
    speculationWindow,
    setSpeculationWindow,
    now,
  } = useChart();

  // The year scan is the expensive part, so it stays behind an explicit
  // affordance — same habit as the timing scans inside the Interpretation
  // cards. Nothing below runs until the reader asks for it.
  const [yearOpen, setYearOpen] = useState(false);

  const report = useMemo(
    () =>
      chart
        ? buildSpeculationReport(chart, vargas, jaimini, shadbala, strengths, ashtakavarga, yogas)
        : null,
    [chart, vargas, jaimini, shadbala, strengths, ashtakavarga, yogas]
  );

  const hasBirth = Boolean(chart?.birthUtc);
  const windowType = hasBirth ? speculationWindow : "calendar";

  const window = useMemo(() => {
    if (!chart) return null;
    if (windowType === "solar" && hasBirth) {
      const start = solarReturn(chart, ayanamsha, speculationYear);
      const end = solarReturn(chart, ayanamsha, speculationYear + 1);
      if (start && end) return { start, end };
    }
    return {
      start: new Date(Date.UTC(speculationYear, 0, 1, 0, 0, 0)),
      end: new Date(Date.UTC(speculationYear + 1, 0, 1, 0, 0, 0)),
    };
  }, [chart, ayanamsha, speculationYear, windowType, hasBirth]);

  const year = useMemo(() => {
    if (!yearOpen || !chart || !window) return null;
    return speculationYearWindows(
      chart,
      dashaTree,
      ayanamsha,
      ashtakavarga,
      window.start,
      window.end,
      now
    );
  }, [yearOpen, chart, dashaTree, ayanamsha, ashtakavarga, window, now]);

  if (!chart || !report) return null;

  const stepYear = (delta: number) =>
    setSpeculationYear(Math.min(MAX_YEAR, Math.max(MIN_YEAR, speculationYear + delta)));

  return (
    <div className="space-y-5">
      {/* Permanent, non-dismissible disclaimer. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-bad-border bg-bad-wash p-3.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
        <p className="text-xs leading-relaxed text-fg">
          <span className="font-bold text-bad">This is not financial advice.</span> Everything below
          describes tendencies in your chart — temperament, timing and the kinds of risk this chart
          handles well or badly. It does not describe markets. No security, exchange, token, position
          size or amount is named or recommended anywhere in this reading, and nothing here implies an
          expected return, a win rate or a probability of profit. Money you cannot afford to lose does
          not belong in speculation regardless of what any chart says.
        </p>
      </div>

      {/* Verdict header */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Dices className="h-5 w-5 shrink-0 text-primary" />
          <h3 className="flex-1 font-serif text-lg font-bold text-heading">{report.title}</h3>
          {report.verdict && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${VERDICT_STYLE[report.verdict]}`}
            >
              {report.verdict}
            </span>
          )}
          <ConfidenceBadge value={report.confidence} />
          {report.score !== undefined && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-inset-2">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-cta-from to-cta-to-hover"
                  style={{ width: `${report.score}%` }}
                />
              </span>
              <span className="font-mono text-xs text-fg-muted">{report.score}</span>
            </span>
          )}
        </div>
        <p className="text-sm font-medium italic leading-relaxed text-heading-2">{report.headline}</p>
      </section>

      {/* The five axes */}
      <section>
        <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-eyebrow">
          The five axes, judged separately
        </h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {report.axes.map((a) => (
            <Gauge key={a.key} label={a.label} value={a.score} reading={a.reading} />
          ))}
        </div>
      </section>

      {/* Why it works / why it does not */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-eyebrow">
            Why speculation works in your chart
          </h4>
          {report.worksBecause.length ? (
            <WhyList reasons={report.worksBecause.slice(0, 10)} title="Supporting factors" />
          ) : (
            <p className="rounded-lg border border-line-soft bg-surface-3 p-3 text-xs text-fg-muted">
              Nothing in this chart argues positively for speculation, which is a real finding rather
              than a gap in the reading — the instrument ranking below shows where the same money meets
              less resistance.
            </p>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-eyebrow">
            Why it does not
          </h4>
          {report.failsBecause.length ? (
            <WhyList reasons={report.failsBecause.slice(0, 10)} title="Working against you" />
          ) : (
            <p className="rounded-lg border border-line-soft bg-surface-3 p-3 text-xs text-fg-muted">
              No structural argument against speculation surfaces in this chart. That is unusual and
              worth reading carefully: it removes the chart's objections, not the market's.
            </p>
          )}
        </div>
      </section>

      {/* Planetary + nakshatra evidence */}
      <section>
        <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-eyebrow">
          Your speculation significators, star by star
        </h4>
        <div className="space-y-2">
          {report.significators.map((s) => (
            <div key={s.id} className="rounded-lg border border-line-soft bg-surface-3 p-3">
              <div className="mb-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-xs">
                <span className="font-bold text-planet">{PLANET_NAMES[s.id]}</span>
                <span className="text-fg-muted">
                  {SIGNS[s.sign]} · {s.house}th house · {DIGNITY_SHORT[s.dignity]}
                </span>
                <span className="text-fg-subtle">
                  {NAKSHATRAS[s.nakshatra]} → {PLANET_NAMES[s.nakshatraLord]} ({s.relation})
                </span>
                {s.gandanta && (
                  <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-bold text-warn ring-1 ring-inset ring-warn-ring">
                    gandanta
                  </span>
                )}
              </div>
              <p className="mb-1 text-[11px] text-fg-subtle">{s.roles.join(" · ")}</p>
              <p className="text-xs leading-relaxed text-fg">{s.chain}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Instrument fit */}
      <section>
        <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-eyebrow">
          Which routes this chart supports
        </h4>
        <div className="mb-3 space-y-1.5 rounded-lg border border-line-soft bg-surface-3 p-3">
          {report.split.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              <span className="w-52 shrink-0 text-fg">{s.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-inset-2">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-cta-from to-cta-to-hover"
                  style={{ width: `${s.percent}%` }}
                />
              </span>
              <span className="w-9 shrink-0 text-right font-mono text-fg-muted">{s.percent}%</span>
            </div>
          ))}
        </div>
        <RankedList items={report.instruments} />
      </section>

      {/* Blocks (how this is built, sizing, leverage) */}
      {report.blocks
        .filter((b) => !b.items)
        .map((b) => (
          <section key={b.heading} className="rounded-xl border border-line bg-surface p-4">
            <h4 className="mb-2 font-serif text-base font-bold text-heading">{b.heading}</h4>
            {b.paragraphs.map((p, i) => (
              <p key={i} className="mb-2 text-sm leading-relaxed text-fg last:mb-0">
                {p}
              </p>
            ))}
          </section>
        ))}

      {/* ---------------- Year engine ---------------- */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h4 className="flex items-center gap-2 font-serif text-base font-bold text-heading">
            <CalendarDays className="h-4 w-4" /> Best and worst stretches, by year
          </h4>

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
              value={speculationYear}
              min={MIN_YEAR}
              max={MAX_YEAR}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) setSpeculationYear(Math.min(MAX_YEAR, Math.max(MIN_YEAR, v)));
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
            {speculationYear !== now.getFullYear() && (
              <button
                type="button"
                onClick={() => setSpeculationYear(now.getFullYear())}
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
                onClick={() => setSpeculationWindow(w)}
                title={w === "solar" && !hasBirth ? "Requires birth date/time/place" : undefined}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  windowType === w
                    ? "bg-primary-soft text-heading ring-1 ring-inset ring-primary-ring"
                    : "text-fg-muted hover:text-fg-2"
                }`}
              >
                {w === "calendar" ? (
                  <CalendarDays className="h-3.5 w-3.5" />
                ) : (
                  <Sun className="h-3.5 w-3.5" />
                )}
                {w === "calendar" ? "Calendar" : "Solar return"}
              </button>
            ))}
          </div>
        </div>

        {window && (
          <p className="mb-3 text-xs text-fg-muted">
            {windowType === "solar" ? "Solar-return year" : "Calendar year"}:{" "}
            <span className="font-semibold text-fg">
              {fmtDate(window.start)} → {fmtDate(window.end)}
            </span>
          </p>
        )}

        {!yearOpen ? (
          <div>
            <p className="mb-2 text-xs leading-relaxed text-fg-muted">
              Scoring every month of this window means running the dasha tree, the transits from your
              Moon and Lagna, the Ashtakavarga, the retrograde stretches and the eclipse search — so it
              runs only when you ask for it.
            </p>
            <button
              type="button"
              onClick={() => setYearOpen(true)}
              className="rounded-lg bg-gradient-to-r from-cta-from to-cta-to px-3.5 py-2 text-xs font-semibold text-cta-fg transition hover:from-cta-from-hover hover:to-cta-to-hover"
            >
              Score this window month by month
            </button>
          </div>
        ) : year ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-fg">{year.summary}</p>

            {!year.hasDasha && (
              <p className="rounded-lg border border-heading-border bg-primary-wash p-3 text-xs text-heading-soft">
                No birth anchor supplied, so the period layer is missing entirely — the scores below
                rest on transits alone.
              </p>
            )}
            {year.beforeBirth && (
              <p className="rounded-lg border border-accent-border bg-accent-wash p-3 text-xs text-accent">
                This window predates the birth date. The sky shown is real; the personal reading has not
                started yet.
              </p>
            )}

            <SpeculationWindows
              windows={year.favourable}
              title="Most supported stretches"
              emptyNote="No stretch in this window clears the bar for a genuinely favourable period. That is useful in itself: it points at a year for building the process rather than pressing it."
            />
            <SpeculationWindows
              windows={year.adverse}
              title="Stretches to be smallest in"
              emptyNote="No stretch in this window scores as a genuine headwind — the year has no obviously defensive months, which argues for consistency rather than for timing."
            />

            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
                Month by month
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {year.months.map((m, i) => (
                  <MonthCell key={i} label={m.label} score={m.score} notes={m.notes} />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {report.caveats.length > 0 && (
        <section className="rounded-xl border border-line-soft bg-surface-soft p-3.5">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
            What was missing, and how the reading adapted
          </div>
          {report.caveats.map((c, i) => (
            <p key={i} className="mb-1.5 text-[11px] leading-relaxed text-fg-muted last:mb-0">
              {c}
            </p>
          ))}
        </section>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-fg-subtle">
        Windows, never dates: a period is a stretch in which a tendency is active, not a schedule of
        outcomes. Scores are a balance of chart factors and carry no claim about any market.
      </p>
    </div>
  );
}
