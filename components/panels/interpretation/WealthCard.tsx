"use client";

import { Coins } from "lucide-react";
import { useMemo, useState } from "react";
import { useChart } from "@/components/context/ChartContext";
import { buildWealthReport, wealthTimingWindows } from "@/data/interpretations/wealth";
import { ageAt } from "@/utils/astrology/ageBands";
import BandNote from "./BandNote";
import RankedList from "./RankedList";
import SectionCard, { Section } from "./SectionCard";
import TimingWindows from "./TimingWindows";

/** Sources of income: ranked streams, percentage split, per-stream timing. */
export default function WealthCard() {
  const { chart, vargas, strengths, yogas, dashaTree, ayanamsha, ashtakavarga, now } = useChart();
  const [timingKey, setTimingKey] = useState<string | null>(null);

  const report = useMemo(
    () => (chart ? buildWealthReport(chart, vargas, strengths, yogas) : null),
    [chart, vargas, strengths, yogas]
  );

  const timing = useMemo(
    () =>
      chart && timingKey
        ? wealthTimingWindows(chart, dashaTree, ayanamsha, ashtakavarga, timingKey, now)
        : null,
    [chart, timingKey, dashaTree, ayanamsha, ashtakavarga, now]
  );

  const age = chart?.birthUtc ? ageAt(chart.birthUtc, now) : null;

  if (!chart || !report) return null;

  return (
    <SectionCard
      icon={Coins}
      title={report.title}
      headline={report.headline}
      score={report.score}
      verdict={report.verdict}
      confidence={report.confidence}
    >
      <Section title="Balance of earning channels">
        <div className="space-y-1.5">
          {report.split.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              <span className="w-44 shrink-0 text-fg">{s.label}</span>
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
      </Section>

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

      <Section title="When each stream activates">
        <BandNote
          bands={["wealth"]}
          age={age}
          lead="Windows across the years when earning and accumulation usually build (ages 25–65). Ones that have already passed are marked — if the stream opened up, it most likely opened there."
        />
        <div className="mb-2 flex flex-wrap gap-1.5">
          {report.split.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setTimingKey(s.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition ${
                timingKey === s.key
                  ? "bg-primary-soft text-heading ring-primary-ring"
                  : "text-fg-muted ring-line-ring hover:text-fg-2"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {timingKey &&
          (timing && timing.length ? (
            <TimingWindows windows={timing} title="Windows across ages 25–65" />
          ) : (
            <p className="text-xs text-fg-muted">
              {report.hasDasha
                ? "No strongly connected period surfaces for this stream anywhere in the 25–65 band — this channel is likely to run steadily rather than in bursts."
                : "Timing needs a birth time and place."}
            </p>
          ))}
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
