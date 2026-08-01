"use client";

import { Plane } from "lucide-react";
import { useMemo, useState } from "react";
import { useChart } from "@/components/context/ChartContext";
import { buildForeignReport, foreignTimingWindows } from "@/data/interpretations/foreign";
import RankedList from "./RankedList";
import SectionCard, { Section } from "./SectionCard";
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

  if (!chart || !report) return null;

  return (
    <SectionCard
      icon={Plane}
      title={report.title}
      headline={report.headline}
      score={report.score}
      verdict={report.verdict}
      confidence={report.confidence}
    >
      {report.blocks.map((b) => (
        <Section key={b.heading} title={b.heading}>
          {b.paragraphs.map((p, i) => (
            <p key={i} className="mb-2 text-sm leading-relaxed text-fg last:mb-0">
              {p}
            </p>
          ))}
          {b.items && <RankedList items={b.items} />}
        </Section>
      ))}

      <Section title="When foreign doors open">
        {showTiming ? (
          timing && timing.length ? (
            <TimingWindows windows={timing} title="Probable activation windows (next 15 years)" />
          ) : (
            <p className="text-xs text-fg-muted">
              {report.hasDasha
                ? "No strongly connected dasha windows in the next 15 years."
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
