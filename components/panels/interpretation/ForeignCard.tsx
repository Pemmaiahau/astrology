"use client";

import BriefView, { FullReasoning } from "./BriefView";
import { briefOfSection } from "@/data/interpretations/brief";
import { Plane } from "lucide-react";
import { useMemo, useState } from "react";
import { useChart } from "@/components/context/ChartContext";
import { buildForeignReport, foreignTimingWindows } from "@/data/interpretations/foreign";
import { ageAt } from "@/utils/astrology/ageBands";
import BandNote from "./BandNote";
import RankedList from "./RankedList";
import SectionCard, { Section } from "./SectionCard";
import { foreignPart } from "@/data/interpretations/reading/foreign";
import { useReadingContext } from "./useReadingContext";
import TimingWindows from "./TimingWindows";

/** Foreign travel & settlement: scenario scores, purpose, direction, timing. */
export default function ForeignCard() {
  const { chart, vargas, strengths, dashaTree, ayanamsha, ashtakavarga, now } = useChart();
  const [showTiming, setShowTiming] = useState(false);

  const report = useMemo(
    () => (chart ? buildForeignReport(chart, vargas, strengths) : null),
    [chart, vargas, strengths]
  );

  const timing = useMemo(
    () =>
      chart && showTiming
        ? foreignTimingWindows(chart, dashaTree, ayanamsha, ashtakavarga, now)
        : null,
    [chart, showTiming, dashaTree, ayanamsha, ashtakavarga, now]
  );

  // The verdict comes from the chart reading's weighing (judge.ts), so the
  // card and 5 of the reading always agree.
  const rc = useReadingContext();
  const judged = useMemo(() => (rc ? foreignPart(rc, false) : null), [rc]);

  const age = chart?.birthUtc ? ageAt(chart.birthUtc, now) : null;

  if (!chart || !report) return null;
  const brief = briefOfSection(report, timing);

  return (
    <SectionCard
      icon={Plane}
      title={report.title}
      headline={judged?.summary[0] ?? report.headline}
      verdict={judged?.verdict?.word}
      confidence={judged?.verdict?.confidence ?? report.confidence}
    >
      <BriefView absolute brief={brief} topTitle="Most likely form of foreign connection" />
      <FullReasoning>
      {report.blocks.map((b) => (
        <Section key={b.heading} title={b.heading}>
          {b.paragraphs.map((p, i) => (
            <p key={i} className="mb-2 text-sm leading-relaxed text-fg last:mb-0">
              {p}
            </p>
          ))}
          {b.items && <RankedList words absolute items={b.items} />}
        </Section>
      ))}
      </FullReasoning>

      <Section title="When foreign doors open">
        <BandNote
          bands={["foreign"]}
          age={age}
          lead="Windows across the years when people most often move abroad — study migration early, work migration later (ages 18–55). Ones that have already passed are marked — if a move happened, it most likely happened there."
        />
        {showTiming ? (
          timing && timing.length ? (
            <TimingWindows words windows={timing} title="Windows across ages 18–55" />
          ) : (
            <p className="text-xs text-fg-muted">
              {report.hasDasha
                ? "No strongly connected period surfaces anywhere in the 18–55 band — foreign themes in this chart are likely to come through opportunity and transit rather than a main period."
                : "Timing needs a birth time and place."}
            </p>
          )
        ) : (
          <button
            type="button"
            onClick={() => setShowTiming(true)}
            className="rounded-lg border border-primary-border-soft bg-primary-wash px-3 py-1.5 text-xs font-semibold text-heading transition hover:bg-primary-wash-2"
          >
            Compute timing windows
          </button>
        )}
      </Section>

      {report.caveats.length > 0 && (
        <div className="text-[11px] leading-relaxed text-fg-subtle">
          {report.caveats.map((c, i) => (
            <p key={i}>{c}</p>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
