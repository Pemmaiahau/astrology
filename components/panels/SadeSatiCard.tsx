"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Hourglass } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import {
  currentPhase,
  sadeSatiPeriods,
  SADE_SATI_HOUSE,
  type SadeSatiPeriod,
  type SadeSatiPhaseKey,
} from "@/utils/astrology/sadeSati";
import { SIGNS } from "@/utils/astrology/constants";
import { ordinal } from "@/utils/astrology/format";
import {
  SADE_SATI_CAVEAT,
  SADE_SATI_PHASES,
  SADE_SATI_STATUS,
} from "@/data/interpretations/sadeSatiTexts";

/**
 * Saturn's seven-and-a-half-year passage, dated.
 *
 * The engine has computed `sadeSatiPhase` on every chart since the transit
 * layer landed and no component ever read it, so the single most-asked
 * question in popular Jyotisha was being answered internally and thrown away.
 *
 * The scan costs ~40 ms, which is too much for the always-on cascade in
 * ChartContext and fine behind this card's first expand — the same lazy
 * boundary the scored Interpretation sections use.
 */

const fmtMonth = (d: Date): string =>
  d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

const STATUS_CHIP: Record<SadeSatiPeriod["status"], string> = {
  past: "bg-neutral-soft text-fg-muted ring-neutral-ring",
  current: "bg-warn-soft text-warn ring-warn-ring",
  future: "bg-info-soft text-info ring-info-ring",
};

const PHASE_TINT: Record<SadeSatiPhaseKey, string> = {
  rising: "bg-info-soft",
  peak: "bg-warn-soft",
  setting: "bg-good-soft",
};

/** Proportional strip showing the three phases and where "now" falls. */
function PhaseStrip({ period, now }: { period: SadeSatiPeriod; now: Date }) {
  const total = period.end.getTime() - period.start.getTime();
  if (total <= 0) return null;
  const pct = (ms: number): number => (ms / total) * 100;
  const nowOffset = now.getTime() - period.start.getTime();
  const showNow = nowOffset >= 0 && nowOffset <= total;

  return (
    <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-inset">
      {period.phases.map((ph) => (
        <div
          key={ph.phase}
          className={`absolute inset-y-0 ${PHASE_TINT[ph.phase]}`}
          style={{
            left: `${pct(ph.start.getTime() - period.start.getTime())}%`,
            width: `${pct(ph.end.getTime() - ph.start.getTime())}%`,
          }}
          title={`${SADE_SATI_PHASES[ph.phase].label}: ${fmtMonth(ph.start)} – ${fmtMonth(ph.end)}`}
        />
      ))}
      {showNow && (
        <div
          className="absolute inset-y-0 w-0.5 bg-heading"
          style={{ left: `${pct(nowOffset)}%` }}
          title="Today"
        />
      )}
    </div>
  );
}

function PeriodBlock({ period, now }: { period: SadeSatiPeriod; now: Date }) {
  const active = period.status === "current" ? currentPhase(period, now) : null;

  return (
    <div
      className={`rounded-xl border p-4 ${
        period.status === "current" ? "border-warn-ring bg-warn-soft/40" : "border-line bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-sm font-bold text-heading">
          {period.clippedStart ? "before " : ""}
          {fmtMonth(period.start)} → {fmtMonth(period.end)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${STATUS_CHIP[period.status]}`}
        >
          {period.status === "current" ? "running now" : period.status}
        </span>
      </div>

      <PhaseStrip period={period} now={now} />

      <p className="mt-2.5 text-xs leading-relaxed text-fg-muted">{SADE_SATI_STATUS[period.status]}</p>

      {period.clippedStart && (
        <p className="mt-1.5 text-xs leading-relaxed text-fg-subtle">
          This passage was already under way when you were born, so it opens at your birth date rather
          than at its true start.
        </p>
      )}

      <div className="mt-3 space-y-3">
        {period.phases.map((ph) => {
          const copy = SADE_SATI_PHASES[ph.phase];
          const isActive = active?.phase === ph.phase;
          return (
            <div
              key={ph.phase}
              className={`rounded-lg border p-3 ${
                isActive ? "border-heading-border bg-primary-wash" : "border-line-soft bg-surface-3"
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${PHASE_TINT[ph.phase]}`} aria-hidden />
                <span className="text-xs font-bold text-heading-soft">{copy.label}</span>
                <span className="font-mono text-[11px] text-fg-subtle">
                  {fmtMonth(ph.start)} – {fmtMonth(ph.end)}
                </span>
                {isActive && (
                  <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warn">
                    you are here
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-fg-2">{copy.headline}</p>
              <p className="mt-1 text-sm leading-relaxed text-fg">{copy.meaning}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
                <span className="font-semibold text-fg-2">Why: </span>
                {copy.why} Saturn spends this stretch in {SIGNS[ph.sign]}, the{" "}
                {ordinal(SADE_SATI_HOUSE[ph.phase])} sign counted from your birth Moon.
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-good-strong">
                <span className="font-semibold">What helps: </span>
                {copy.guidance}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SadeSatiCard() {
  const { chart, ayanamsha, now } = useChart();
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  const periods = useMemo(
    () => (chart && everOpened ? sadeSatiPeriods(chart, ayanamsha, now) : null),
    [chart, ayanamsha, now, everOpened]
  );

  if (!chart) return null;

  const running = periods?.find((p) => p.status === "current") ?? null;
  const next = periods?.find((p) => p.status === "future") ?? null;

  return (
    <section className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setEverOpened(true);
        }}
        aria-expanded={open}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
        )}
        <Hourglass className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 font-serif text-base font-bold text-heading">
          Sade Sati — Saturn&rsquo;s seven-and-a-half-year passage
        </span>
        {periods && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
              running ? STATUS_CHIP.current : STATUS_CHIP.past
            }`}
          >
            {running ? "running now" : "not running"}
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-4">
          {!periods ? null : periods.length === 0 ? (
            <p className="text-sm leading-relaxed text-fg-muted">
              No Sade Sati passage falls inside the scanned span of this chart.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium italic text-heading-2">
                {running
                  ? `You are in Sade Sati now — it closes around ${fmtMonth(running.end)}.`
                  : next
                    ? `You are not in Sade Sati. The next one opens around ${fmtMonth(next.start)}.`
                    : "You are not in Sade Sati."}
              </p>

              <p className="rounded-lg border border-line-soft bg-surface-3 p-3 text-xs leading-relaxed text-fg-muted">
                {SADE_SATI_CAVEAT}
              </p>

              <div className="space-y-4">
                {periods.map((p) => (
                  <PeriodBlock key={p.index} period={p} now={now} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
