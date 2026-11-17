"use client";

import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { useChart } from "@/components/context/ChartContext";
import { PART_BUILDERS, type ReadingContext, type ReadingPart, type ReadingSubsection } from "@/data/interpretations/reading";
import { FullReasoning } from "./BriefView";
import ConfidenceBadge from "./ConfidenceBadge";
import { VerdictChip } from "./SectionCard";
import { useReadingContext } from "./useReadingContext";

const PART_TITLES: Record<string, string> = {
  personality: "Personality",
  career: "Career, profession, status and authority",
  wealth: "Wealth, income, savings, property and vehicles",
  marriage: "Marriage, spouse and relationships",
  foreign: "Foreign travel and settlement",
  health: "Health and things to watch",
  timing: "Timing outlook",
};

/** Headings that carry a direction get a coloured accent. */
function accent(heading: string): string {
  if (heading === "Supporting") return "text-good";
  if (heading === "Opposing") return "text-bad";
  if (heading.startsWith("Verdict")) return "text-heading";
  return "text-heading-2";
}

function Subsection({ s }: { s: ReadingSubsection }) {
  return (
    <div className={s.heading.startsWith("Verdict") ? "rounded-lg border border-heading-border bg-primary-wash p-3" : ""}>
      <h4 className={`mb-1.5 font-serif text-[15px] font-bold ${accent(s.heading)}`}>{s.heading}</h4>
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
  );
}

function PartBody({ part }: { part: ReadingPart }) {
  const hasVerdict = part.subsections.some((s) => s.heading.startsWith("Verdict"));
  return (
    <div className="space-y-5 border-t border-line-soft px-4 pb-4 pt-3">
      {part.subsections.map((s) => (
        <Subsection key={s.heading} s={s} />
      ))}
      {!hasVerdict && part.summary.length > 0 && (
        <div className="rounded-lg border border-heading-border bg-primary-wash p-3">
          <h4 className="mb-1 font-serif text-[15px] font-bold text-heading">{part.title} summary</h4>
          {part.summary.map((p, i) => (
            <p key={i} className="mb-1 text-sm leading-relaxed text-fg last:mb-0">
              {p}
            </p>
          ))}
        </div>
      )}
      {part.detail && part.detail.length > 0 && (
        <FullReasoning label="Full reasoning — houses, lords, vargas and yogas">
          {part.detail.map((s) => (
            <Subsection key={s.heading} s={s} />
          ))}
        </FullReasoning>
      )}
    </div>
  );
}

/**
 * One part, built only once it is opened: the build includes the timing
 * scans (dashas, Chara/Yogini cross-checks, transits), which are too heavy to
 * run for all seven parts on every chart change.
 */
function LazyPart({ rc, index, defaultOpen }: { rc: ReadingContext; index: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const builder = PART_BUILDERS[index];
  const part = useMemo(() => (open ? builder.build(rc, true) : null), [open, builder, rc]);
  return (
    <section className="rounded-xl border border-line bg-surface">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 p-4 text-left">
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" /> : <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />}
        <span className="flex-1 font-serif text-base font-bold text-heading">
          Part {index + 1}: {PART_TITLES[builder.key]}
        </span>
        {part?.verdict && (
          <>
            <VerdictChip verdict={part.verdict.word} />
            <ConfidenceBadge value={part.verdict.confidence} />
          </>
        )}
      </button>
      {part && <PartBody part={part} />}
    </section>
  );
}

/** The astrologer's report: seven parts, each weighed evidence, verdict and timing. */
export default function ReadingView() {
  const { chart } = useChart();
  const rc = useReadingContext();
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
