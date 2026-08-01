"use client";

import { HeartHandshake } from "lucide-react";
import { useMemo, useState } from "react";
import { useChart } from "@/components/context/ChartContext";
import { buildMarriageReport, marriageTimingWindows } from "@/data/interpretations/marriage";
import SectionCard, { Section } from "./SectionCard";
import TimingWindows from "./TimingWindows";
import WhyList from "./WhyList";

/** Marriage: houses/karakas, Mangal Dosha, spouse indications, probable windows. */
export default function MarriageCard() {
  const { chart, vargas, jaimini, strengths, yogas, dashaTree, ayanamsha, ashtakavarga, now } =
    useChart();
  const [showTiming, setShowTiming] = useState(false);

  const report = useMemo(
    () => (chart ? buildMarriageReport(chart, vargas, jaimini, strengths, yogas) : null),
    [chart, vargas, jaimini, strengths, yogas]
  );

  const timing = useMemo(
    () =>
      chart && showTiming
        ? marriageTimingWindows(chart, dashaTree, ayanamsha, ashtakavarga, jaimini, now)
        : null,
    [chart, showTiming, dashaTree, ayanamsha, ashtakavarga, jaimini, now]
  );

  if (!chart || !report) return null;

  return (
    <SectionCard
      icon={HeartHandshake}
      title={report.title}
      headline={report.headline}
      score={report.score}
      confidence={report.confidence}
    >
      {report.blocks.map((b) => (
        <Section key={b.heading} title={b.heading}>
          {b.paragraphs.map((p, i) => (
            <p key={i} className="mb-2 text-sm leading-relaxed text-fg last:mb-0">
              {p}
            </p>
          ))}
          {b.reasons && b.reasons.length > 0 && (
            <WhyList reasons={b.reasons} title="Supportive (▲) and delaying (▼) factors" />
          )}
        </Section>
      ))}

      <Section title="Most probable marriage windows">
        <p className="mb-2 text-[11px] leading-relaxed text-fg-subtle">
          These are windows of raised probability, never fixed dates: dasha periods whose lords rule
          your marriage houses, sharpened by Jupiter's transits and the Saturn+Jupiter double
          transit.
        </p>
        {showTiming ? (
          timing && timing.length ? (
            <TimingWindows windows={timing} title="Top windows (next 15 years)" />
          ) : (
            <p className="text-xs text-fg-muted">
              {report.hasDasha
                ? "No marriage-connected dasha window rises above threshold in the next 15 years — Jupiter transits over your 7th house become the primary trigger to watch."
                : "Timing needs a birth time and place."}
            </p>
          )
        ) : (
          <button
            type="button"
            onClick={() => setShowTiming(true)}
            className="rounded-lg border border-primary-border-soft bg-primary-wash px-3 py-1.5 text-xs font-semibold text-heading transition hover:bg-primary-wash-2"
          >
            Compute probable windows
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
