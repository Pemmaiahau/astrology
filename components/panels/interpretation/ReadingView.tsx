"use client";

import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { useChart } from "@/components/context/ChartContext";
import { buildReadingContext, PART_BUILDERS, type ReadingContext, type ReadingPart } from "@/data/interpretations/reading";

const PART_TITLES: Record<string, string> = {
  personality: "Personality",
  career: "Career",
  wealth: "Wealth",
  marriage: "Marriage and relationships",
  foreign: "Foreign travel and settlement",
  health: "Health and things to watch",
  timing: "Timing outlook",
};

function PartBody({ part }: { part: ReadingPart }) {
  return (
    <div className="space-y-5 border-t border-line-soft px-4 pb-4 pt-3">
      {part.subsections.map((s) => (
        <div key={s.heading}>
          <h4 className="mb-1.5 font-serif text-[15px] font-bold text-heading-2">{s.heading}</h4>
          {s.lead.map((l, i) => (
            <p key={i} className="mb-1.5 text-sm leading-relaxed text-fg">
              {l}
            </p>
          ))}
          {s.bullets.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-fg marker:text-fg-subtle">
              {s.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {part.summary.length > 0 && (
        <div className="rounded-lg border border-heading-border bg-primary-wash p-3">
          <h4 className="mb-1 font-serif text-[15px] font-bold text-heading">
            {part.title} summary
          </h4>
          {part.summary.map((p, i) => (
            <p key={i} className="mb-1 text-sm leading-relaxed text-fg last:mb-0">
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One part, built only once it is opened: the build includes the timing
 * scans (career, wealth, marriage and foreign windows, Sade Sati), which are
 * too heavy to run for all seven parts on every chart change.
 */
function LazyPart({ rc, index, defaultOpen }: { rc: ReadingContext; index: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const builder = PART_BUILDERS[index];
  const part = useMemo(() => (open ? builder.build(rc, true) : null), [open, builder, rc]);
  return (
    <section className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" /> : <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />}
        <span className="font-serif text-base font-bold text-heading">
          Part {index + 1}: {PART_TITLES[builder.key]}
        </span>
      </button>
      {part && <PartBody part={part} />}
    </section>
  );
}

/** The astrologer's report: seven parts, each subsections + summary. */
export default function ReadingView() {
  const ctx = useChart();
  const { chart } = ctx;
  const rc = useMemo(
    () =>
      chart
        ? buildReadingContext({
            chart,
            ayanamsha: ctx.ayanamsha,
            now: ctx.now,
            vargas: ctx.vargas,
            jaimini: ctx.jaimini,
            shadbala: ctx.shadbala,
            bhavaBala: ctx.bhavaBala,
            av: ctx.ashtakavarga,
            strengths: ctx.strengths,
            yogas: ctx.yogas,
            extended: ctx.extendedYogas,
            special: ctx.specialPoints,
            dashaTree: ctx.dashaTree,
            confirm: ctx.confirm,
          })
        : null,
    [chart, ctx.ayanamsha, ctx.now, ctx.vargas, ctx.jaimini, ctx.shadbala, ctx.bhavaBala, ctx.ashtakavarga, ctx.strengths, ctx.yogas, ctx.extendedYogas, ctx.specialPoints, ctx.dashaTree, ctx.confirm]
  );
  if (!rc) return null;
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 px-1 font-serif text-lg font-bold text-heading">
        <ScrollText className="h-5 w-5" /> Chart reading
      </h3>
      {PART_BUILDERS.map((p, i) => (
        <LazyPart key={`${p.key}-${chart?.birthUtc?.getTime() ?? 0}`} rc={rc} index={i} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
