"use client";

import { Briefcase } from "lucide-react";
import { useMemo, useState } from "react";
import { useChart } from "@/components/context/ChartContext";
import { buildCareerReport, careerTimingWindows } from "@/data/interpretations/career";
import RankedList from "./RankedList";
import SectionCard, { Section } from "./SectionCard";
import TimingWindows from "./TimingWindows";
import WhyList from "./WhyList";

/** Career & profession: ranked options, job-vs-business, timing windows. */
export default function CareerCard() {
  const { chart, vargas, jaimini, shadbala, strengths, yogas, dashaTree, ayanamsha, ashtakavarga, now } =
    useChart();
  const [showTiming, setShowTiming] = useState(false);

  const report = useMemo(
    () => (chart ? buildCareerReport(chart, vargas, jaimini, shadbala, strengths, yogas) : null),
    [chart, vargas, jaimini, shadbala, strengths, yogas]
  );

  // Transit scanning is the expensive part — computed only when requested.
  const timing = useMemo(
    () =>
      chart && showTiming
        ? careerTimingWindows(chart, dashaTree, ayanamsha, ashtakavarga, jaimini, now)
        : null,
    [chart, showTiming, dashaTree, ayanamsha, ashtakavarga, jaimini, now]
  );

  if (!chart || !report) return null;

  return (
    <SectionCard
      icon={Briefcase}
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
          {b.reasons && b.reasons.length > 0 && <WhyList reasons={b.reasons} />}
        </Section>
      ))}

      <Section title="Best periods for career moves">
        {showTiming ? (
          timing && timing.length ? (
            <TimingWindows windows={timing} title="Probable activation windows (next 15 years)" />
          ) : (
            <p className="text-xs text-fg-muted">
              {report.hasDasha
                ? "No strongly connected dasha windows in the next 15 years — career moves will ride on transits rather than dasha support."
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
