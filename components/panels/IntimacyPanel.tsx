"use client";

import { useMemo } from "react";
import { Eye, Flame, Info, Sparkle } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import ConfidenceBadge from "@/components/panels/interpretation/ConfidenceBadge";
import WhyList from "@/components/panels/interpretation/WhyList";
import { buildIntimacyReport } from "@/data/interpretations/intimacy";
import type { Verdict } from "@/data/interpretations/report";
import { PLANET_NAMES } from "@/utils/astrology/constants";

const VERDICT_STYLE: Record<Verdict, string> = {
  "Strong promise": "bg-good-soft text-good ring-good-ring",
  Supportive: "bg-info-soft text-info ring-info-ring",
  Mixed: "bg-primary-soft text-heading ring-primary-ring",
  "Needs effort": "bg-warn-soft text-warn ring-warn-ring",
  Challenged: "bg-bad-soft text-bad ring-bad-ring",
};

function Gauge({ label, value, reading }: { label: string; value: number; reading: string }) {
  return (
    <div className="rounded-lg border border-line-soft bg-surface-3 p-3">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="flex-1 text-xs font-semibold text-fg-2">{label}</span>
        <span className="font-mono text-xs text-fg-muted">{value}</span>
      </div>
      <span className="mb-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-inset-2">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-cta-from to-cta-to-hover"
          style={{ width: `${value}%` }}
        />
      </span>
      <p className="text-[11px] leading-relaxed text-fg-muted">{reading}</p>
    </div>
  );
}

export default function IntimacyPanel() {
  const { chart, vargas, jaimini, shadbala, strengths, yogas } = useChart();

  const report = useMemo(
    () => (chart ? buildIntimacyReport(chart, vargas, jaimini, shadbala, strengths, yogas) : null),
    [chart, vargas, jaimini, shadbala, strengths, yogas]
  );

  if (!chart || !report) return null;

  return (
    <div className="space-y-5">
      {/* Standing boundaries — visible UI copy, not a code comment. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-heading-border bg-primary-wash p-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-heading" />
        <div className="space-y-1.5 text-xs leading-relaxed text-fg">
          <p>
            <span className="font-bold text-heading">Adults only.</span> This section discusses
            sexuality frankly and clinically, as an adult wellbeing reading.
          </p>
          <p>
            A chart cannot show sexual orientation or gender identity, and no attempt is made here to
            infer either. Everything below describes you — not who you are drawn to — and no partner&apos;s
            gender is assumed anywhere in it.
          </p>
          <p>
            Nothing here is a moral judgement, and nothing here is medical. Where the chart points at
            something physical — pain, arousal, fertility, anything that has changed — that belongs with
            a clinician, not with an interpretation.
          </p>
        </div>
      </div>

      {/* Verdict header */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Flame className="h-5 w-5 shrink-0 text-primary" />
          <h3 className="flex-1 font-serif text-lg font-bold text-heading">{report.title}</h3>
          {report.verdict && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${VERDICT_STYLE[report.verdict]}`}
            >
              {report.verdict}
            </span>
          )}
          <ConfidenceBadge value={report.confidence} />
          {report.score !== undefined && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-inset-2">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-cta-from to-cta-to-hover"
                  style={{ width: `${report.score}%` }}
                />
              </span>
              <span className="font-mono text-xs text-fg-muted">{report.score}</span>
            </span>
          )}
        </div>
        <p className="text-sm font-medium italic leading-relaxed text-heading-2">{report.headline}</p>
      </section>

      {/* Four facets */}
      <section>
        <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-eyebrow">
          Four things, judged separately
        </h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {report.facets.map((f) => (
            <Gauge key={f.key} label={f.label} value={f.score} reading={f.reading} />
          ))}
        </div>
      </section>

      {/* Strengths / frictions */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-eyebrow">
            What makes this chart good for a sexual life
          </h4>
          {report.strengths.length ? (
            <WhyList reasons={report.strengths.slice(0, 12)} title="Supporting factors" />
          ) : (
            <p className="rounded-lg border border-line-soft bg-surface-3 p-3 text-xs text-fg-muted">
              No single placement stands out as a strength here, which usually means this area is
              described by ordinary conditions rather than by a headline signature.
            </p>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-eyebrow">
            What makes it difficult
          </h4>
          {report.frictions.length ? (
            <WhyList reasons={report.frictions.slice(0, 12)} title="Friction points" />
          ) : (
            <p className="rounded-lg border border-line-soft bg-surface-3 p-3 text-xs text-fg-muted">
              No structural friction surfaces in this area of your chart — an unusually clean reading,
              and one worth taking at face value.
            </p>
          )}
        </div>
      </section>

      {/* Yoni summary chips */}
      <section className="rounded-xl border border-accent-border bg-accent-wash p-4">
        <h4 className="mb-2 flex items-center gap-2 font-serif text-base font-bold text-accent">
          <Sparkle className="h-4 w-4" /> Your Yoni and nakshatra temperament
        </h4>
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-[11px] font-semibold text-fg-2 ring-1 ring-inset ring-line-ring">
            {report.yoni.yoni} yoni
          </span>
          <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-[11px] font-semibold text-fg-2 ring-1 ring-inset ring-line-ring">
            {report.yoni.appetite} appetite band
          </span>
          <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-[11px] font-semibold text-fg-2 ring-1 ring-inset ring-line-ring">
            {report.yoni.gana} gana
          </span>
          {report.yoni.clashesWith.length > 0 && (
            <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-[11px] font-semibold text-fg-muted ring-1 ring-inset ring-line-ring">
              clashes with {report.yoni.clashesWith.join(", ")}
            </span>
          )}
        </div>
        {report.yoni.paragraphs.map((p, i) => (
          <p key={i} className="mb-2 text-sm leading-relaxed text-fg last:mb-0">
            {p}
          </p>
        ))}
      </section>

      {/* Every prose block from the builder except the yoni one, already shown above */}
      {report.blocks
        .filter((b) => b.heading !== "The Yoni and nakshatra layer")
        .map((b) => (
          <section key={b.heading} className="rounded-xl border border-line bg-surface p-4">
            <h4 className="mb-2 font-serif text-base font-bold text-heading">{b.heading}</h4>
            {b.paragraphs.map((p, i) => (
              <p key={i} className="mb-2 text-sm leading-relaxed text-fg last:mb-0">
                {p}
              </p>
            ))}
          </section>
        ))}

      {/* Drishti */}
      {report.drishti.length > 0 && (
        <section>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-eyebrow">
            <Eye className="h-4 w-4" /> What aspects the houses of desire
          </h4>
          <p className="mb-2 px-1 text-[11px] leading-relaxed text-fg-subtle">
            Each glance is weighted by how much of it actually arrives — the classical sputa-drishti
            value in virupas, out of 60 — rather than treated as simply present or absent. A house is
            measured at its midpoint, which is the finest resolution a whole-sign house allows.
          </p>
          <ul className="space-y-1.5">
            {report.drishti.slice(0, 14).map((d, i) => (
              <li
                key={i}
                className="rounded-lg border border-line-soft bg-surface-3 p-2.5 text-xs leading-relaxed text-fg"
              >
                <span className="mr-2 font-mono text-[10px] text-fg-subtle">
                  {PLANET_NAMES[d.from]} → {d.target} · {d.strength}/60
                </span>
                {d.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.caveats.length > 0 && (
        <section className="rounded-xl border border-line-soft bg-surface-soft p-3.5">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
            What was missing, and how the reading adapted
          </div>
          {report.caveats.map((c, i) => (
            <p key={i} className="mb-1.5 text-[11px] leading-relaxed text-fg-muted last:mb-0">
              {c}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
