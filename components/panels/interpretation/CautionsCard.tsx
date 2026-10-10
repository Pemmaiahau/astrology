"use client";

import { FullReasoning } from "./BriefView";
import { briefOfCautions } from "@/data/interpretations/brief";
import { ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import { useChart } from "@/components/context/ChartContext";
import { buildCautionsReport } from "@/data/interpretations/cautions";
import SectionCard, { Section } from "./SectionCard";
import TimingWindows from "./TimingWindows";

/** "Things to watch and avoid" — every caution paired with its counter-measure. */
export default function CautionsCard() {
  const { chart, strengths, shadbala, yogas, extendedYogas, specialPoints, dashaTree, now } = useChart();

  const report = useMemo(
    () => (chart ? buildCautionsReport(chart, strengths, shadbala, yogas, dashaTree, now, { extended: extendedYogas, special: specialPoints }) : null),
    [chart, strengths, shadbala, yogas, dashaTree, now, extendedYogas, specialPoints]
  );

  if (!chart || !report) return null;
  const top = briefOfCautions(report.cautions);

  return (
    <SectionCard
      icon={ShieldAlert}
      title={report.title}
      headline={report.headline}
      confidence={report.confidence}
    >
      {top.length > 0 && (
        <div className="rounded-lg border border-bad-border bg-bad-wash p-3">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
            Main cautions — and what helps
          </div>
          <ul className="space-y-1.5">
            {top.map((c, i) => (
              <li key={i} className="text-sm leading-snug text-fg">
                <span className="text-bad-strong" aria-hidden>▼ </span>
                {c.text}
                <span className="block text-xs text-good">What helps: {c.remedy}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <FullReasoning label={`All ${report.cautions.length} cautions with full counter-measures`}>
      {report.blocks.map((b) => (
        <div key={b.heading}>
          {b.paragraphs.map((p, i) => (
            <p key={i} className="text-xs leading-relaxed text-fg-muted">
              {p}
            </p>
          ))}
        </div>
      ))}

      <Section title="Cautions — each with its counter-measure">
        <ul className="space-y-3">
          {report.cautions.map((c, i) => (
            <li key={i} className="rounded-lg border border-bad-border bg-bad-wash p-3">
              <p className="text-sm leading-relaxed text-fg">{c.caution.text}</p>
              {c.caution.source && (
                <p className="mt-0.5 text-[10px] text-fg-subtle">
                  {c.caution.source.work}
                  {c.caution.source.ref ? ` — ${c.caution.source.ref}` : ""}
                </p>
              )}
              <p className="mt-1.5 text-xs leading-relaxed text-good">
                <span className="font-semibold">What helps:</span> {c.counterMeasure}
              </p>
            </li>
          ))}
        </ul>
      </Section>
      </FullReasoning>

      {report.adverseWindows.length > 0 && (
        <TimingWindows
          windows={report.adverseWindows}
          title="Periods to favour consolidation over expansion"
        />
      )}

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
