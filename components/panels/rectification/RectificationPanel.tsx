"use client";

import { AlertTriangle, Clock4, Play, Sigma, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useChart } from "@/components/context/ChartContext";
import { AYANAMSHA_LABELS } from "@/utils/astrology/ayanamsha";
import {
  RECTIFY_STEP_MIN,
  RECTIFY_WINDOW_MIN,
  rectify,
  timezoneWarnings,
} from "@/utils/astrology/rectification/rectify";
import { MIN_EVENTS } from "@/utils/astrology/rectification/score";
import type {
  AyanamshaSensitivity,
  DualAyanamshaResult,
  LifeEvent,
  RectificationResult,
  RectifyBirth,
} from "@/utils/astrology/rectification/types";
import { TECHNIQUE_SENSITIVITY } from "@/utils/astrology/rectification/types";
import type { AyanamshaId } from "@/utils/astrology/types";
import AyanamshaCompare from "./AyanamshaCompare";
import CandidateTable from "./CandidateTable";
import EventBreakdown from "./EventBreakdown";
import EventForm, { blankEvent } from "./EventForm";
import RectifyDisclaimer from "./RectifyDisclaimer";

/**
 * The Rectification tab.
 *
 * Computed in-process like every other panel (a full dual-ayanamsha sweep of
 * 62 charts costs well under a second), behind an explicit button so it never
 * runs on tab open. `app/api/rectify` exposes the same orchestrator for
 * programmatic use.
 */

const STORAGE_KEY = "jyotisha.rectify.events";

/** Recover the recorded birth record from the committed chart. */
function birthFromChart(
  meta: { localDateTime?: string; timezone?: string; place?: string; gender?: string; nodeMode?: string },
  lat?: number,
  lon?: number,
  name?: string
): RectifyBirth | null {
  if (!meta.localDateTime || !meta.timezone || lat === undefined || lon === undefined) return null;
  const [dateISO, time] = meta.localDateTime.split(" ");
  if (!dateISO || !time) return null;
  return {
    name,
    dateISO,
    time: time.slice(0, 5),
    timezone: meta.timezone,
    lat,
    lon,
    placeName: meta.place,
    gender: meta.gender as RectifyBirth["gender"],
    nodeMode: meta.nodeMode === "true" ? "true" : "mean",
  };
}

function seedEvents(): LifeEvent[] {
  return Array.from({ length: MIN_EVENTS }, () => blankEvent());
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line-soft bg-surface-3 px-3 py-2" title={hint}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{label}</div>
      <div className="font-mono text-sm text-fg">{value}</div>
    </div>
  );
}

function ResultDetail({
  result,
  events,
}: {
  result: RectificationResult;
  events: LifeEvent[];
}) {
  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border p-3 ${
          result.verdict === "determinate"
            ? "border-good-border bg-good-wash"
            : "border-warn-ring bg-warn-soft"
        }`}
      >
        <div className="mb-1 flex flex-wrap items-baseline gap-2">
          <span className="font-serif text-lg font-bold text-heading">
            {result.interval.startLocal}
            {result.interval.startOffsetMin !== result.interval.endOffsetMin &&
              `–${result.interval.endLocal}`}
          </span>
          <span className="text-xs text-fg-muted">
            best estimate {result.best.localTime}
            {result.best.offsetMin !== 0 &&
              ` (${result.best.offsetMin > 0 ? "+" : ""}${result.best.offsetMin} min from the record)`}
          </span>
          <span
            className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
              result.verdict === "determinate"
                ? "bg-good-soft text-good ring-good-ring"
                : "bg-warn-soft text-warn ring-warn-ring"
            }`}
          >
            {result.verdict === "determinate" ? "Determinate" : "Indeterminate at this resolution"}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-fg">{result.verdictReason}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Median candidate" value={result.stats.median.toFixed(4)} />
        <Stat label="Std dev" value={result.stats.stdDev.toFixed(4)} />
        <Stat
          label="z over median"
          value={`${result.stats.zScore.toFixed(2)}σ`}
          hint="How far the winner stands above the middle of the whole window"
        />
        <Stat
          label="Degrees of freedom"
          value={`${result.dof.events} ev / ${result.dof.candidates} cand`}
          hint={`Effective sample size after precision and reliability weighting: ${result.dof.effectiveEvents.toFixed(2)} events, fitting ${result.dof.freeParameters} free parameter (the birth minute).`}
        />
      </div>

      {result.warnings.length > 0 && (
        <div className="rounded-lg border border-warn-ring bg-warn-soft p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold text-warn">
            <TriangleAlert className="h-3.5 w-3.5" /> Read before trusting this
          </div>
          <ul className="space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-warn">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!result.stability.stable && (
        <div className="rounded-lg border border-bad-border bg-bad-wash p-3 text-[11px] leading-relaxed text-bad-2">
          <span className="font-bold text-bad">Leave-one-out: unstable. </span>
          {result.stability.hinges.map((h) => (
            <span key={h.eventId}>
              Dropping this event moves the winner to {h.movesToOffsetMin > 0 ? "+" : ""}
              {h.movesToOffsetMin} min.{" "}
            </span>
          ))}
          A result that rests on one recollection is worth exactly as much as that recollection.
        </div>
      )}

      <CandidateTable result={result} />

      <div>
        <h4 className="mb-2 font-serif text-sm font-bold text-heading">
          Event by event at {result.best.localTime}
        </h4>
        <EventBreakdown candidate={result.best} events={events} />
      </div>

      <div className="rounded-lg border border-line-soft bg-surface-soft p-3">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
          Cross-checks (reported, not scored)
        </div>
        <ul className="space-y-1.5">
          {result.crossChecks.map((c) => (
            <li key={c.key} className="text-[11px] leading-relaxed text-fg-muted">
              <span className="font-semibold text-fg-2">{c.label}: </span>
              {c.detail}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function RectificationPanel() {
  const { chart } = useChart();
  const [events, setEvents] = useState<LifeEvent[]>(seedEvents);
  const [result, setResult] = useState<DualAyanamshaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AyanamshaId>("lahiri");

  // Events are laborious to type; keep them across tab switches and reloads.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LifeEvent[];
        if (Array.isArray(parsed) && parsed.length) setEvents(parsed);
      }
    } catch {
      /* storage unavailable — session-only events */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      /* storage unavailable */
    }
  }, [events]);

  const birth = useMemo(
    () => (chart ? birthFromChart(chart.meta, chart.lat, chart.lon, chart.meta.name) : null),
    [chart]
  );

  const timeWarnings = useMemo(
    () => (birth ? timezoneWarnings(birth, RECTIFY_WINDOW_MIN, RECTIFY_STEP_MIN) : []),
    [birth]
  );

  const dated = events.filter((e) => e.dateISO);
  const canRun = Boolean(birth) && dated.length >= MIN_EVENTS;

  const run = () => {
    if (!birth) return;
    setError(null);
    try {
      setResult(rectify({ birth, events: dated }));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "The sweep could not be computed.");
    }
  };

  if (!chart) return null;

  if (!birth) {
    return (
      <div className="space-y-4">
        <RectifyDisclaimer />
        <div className="rounded-xl border border-dashed border-line bg-surface-soft p-6 text-center">
          <Clock4 className="mx-auto mb-2 h-8 w-8 text-eyebrow-faint" />
          <p className="text-sm text-fg-muted">
            Rectification needs a recorded birth date, time and place to sweep around. Cast the
            chart from birth data (or supply a birth anchor in Manual Configuration) and come back.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RectifyDisclaimer />

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-2 flex items-center gap-2 font-serif text-base font-bold text-heading">
          <Clock4 className="h-4 w-4 text-primary" /> Recorded birth record
        </h3>
        <p className="text-xs leading-relaxed text-fg-muted">
          <span className="font-mono text-fg">
            {birth.dateISO} {birth.time}
          </span>{" "}
          · {birth.placeName ?? "birth place"} · {birth.timezone} · sweeping ±{RECTIFY_WINDOW_MIN}{" "}
          minutes in {RECTIFY_STEP_MIN}-minute steps ({2 * RECTIFY_WINDOW_MIN + 1} candidates per
          ayanamsha, {2 * (2 * RECTIFY_WINDOW_MIN + 1)} charts in total).
        </p>
        {timeWarnings.length > 0 && (
          <div className="mt-3 rounded-lg border border-bad-border bg-bad-wash p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold text-bad">
              <AlertTriangle className="h-3.5 w-3.5" /> Check the timezone before anything else
            </div>
            <ul className="space-y-1">
              {timeWarnings.map((w, i) => (
                <li key={i} className="text-[11px] leading-relaxed text-bad-2">
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-1 font-serif text-base font-bold text-heading">Life events</h3>
        <p className="mb-3 text-xs leading-relaxed text-fg-muted">
          Five to ten dated events. Be honest about precision and reliability — a year-precision
          hearsay event is scored across the whole year at 20% of the weight of a documented one,
          which is exactly what it deserves.
        </p>
        <EventForm events={events} onChange={setEvents} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={!canRun}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cta-from to-cta-to px-4 py-2 text-xs font-bold text-cta-fg transition hover:from-cta-from-hover hover:to-cta-to-hover disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" /> Run rectification sweep
          </button>
          {!canRun && (
            <span className="text-xs text-fg-muted">
              {dated.length} of {MIN_EVENTS} required events have dates.
            </span>
          )}
          {result && (
            <span className="text-[11px] text-fg-subtle">
              Swept {2 * (result.windowMin / result.stepMin) + 2} charts in {result.elapsedMs} ms.
            </span>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      </section>

      {result && (
        <>
          <AyanamshaCompare result={result} />

          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Sigma className="h-4 w-4 text-primary" />
              <h3 className="font-serif text-base font-bold text-heading">Full working</h3>
              <div className="ml-auto flex items-center gap-1 rounded-lg border border-line-2 bg-surface-2 p-1">
                {(["lahiri", "pushya"] as AyanamshaId[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setDetail(a)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      detail === a
                        ? "bg-primary-soft text-heading ring-1 ring-inset ring-primary-ring"
                        : "text-fg-muted hover:text-fg-2"
                    }`}
                  >
                    {AYANAMSHA_LABELS[a].split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-fg-faint">
              The sweep is a deliberate two-way Lahiri-vs-Pushya comparison, unchanged by the Raman option in
              the header. The three run in the order Raman &lt; Pushya &lt; Lahiri: Raman sits ~1.45° behind
              Lahiri, which is a further ~0.32° beyond Pushya rather than between the two. A candidate minute
              that survives this pair is therefore well tested, but Raman lies just outside the tested span —
              treat a Raman reading of the surviving minute as one step less confirmed.
            </p>
            <ResultDetail result={detail === "lahiri" ? result.lahiri : result.pushya} events={dated} />
          </section>

          <section className="rounded-xl border border-line-soft bg-surface-soft p-4">
            <h4 className="mb-1.5 font-serif text-sm font-bold text-heading">
              Which evidence survives an ayanamsha change
            </h4>
            <p className="mb-2 text-[11px] leading-relaxed text-fg-muted">
              Robust techniques read angles and house counts that shift equally in both systems.
              Sensitive ones read a discrete sign or nakshatra label that 1.122° can flip. When the
              two columns disagree, this table says whether the disagreement is real or an artefact
              of the zodiac offset.
            </p>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {Object.entries(TECHNIQUE_SENSITIVITY).map(([k, v]) => (
                <li key={k} className="flex items-center gap-2 text-[11px]">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                      (v as AyanamshaSensitivity) === "robust"
                        ? "bg-good-soft text-good"
                        : "bg-warn-soft text-warn"
                    }`}
                  >
                    {v}
                  </span>
                  <span className="font-mono text-fg-muted">{k}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
