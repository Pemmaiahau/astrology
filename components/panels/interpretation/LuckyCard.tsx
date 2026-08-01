"use client";

import { Clover } from "lucide-react";
import { useMemo, useState } from "react";
import { useChart } from "@/components/context/ChartContext";
import { buildLuckyReport } from "@/data/interpretations/lucky";
import { computeNumerology, type NamankSystem } from "@/utils/astrology/numerology";
import { PLANET_NAMES } from "@/utils/astrology/constants";
import type { LuckyVerdict } from "@/data/interpretations/lucky";
import SectionCard, { Section } from "./SectionCard";

function VerdictGrid({ v }: { v: LuckyVerdict }) {
  const rows: [string, string][] = [
    ["Numbers", v.numbers.join(", ") || "—"],
    ["Avoid numbers", v.avoidNumbers.join(", ") || "—"],
    ["Colours", v.colours.join("; ") || "—"],
    ["Avoid colours", v.avoidColours.join("; ") || "—"],
    ["Directions", v.directions.join(", ") || "—"],
    ["Days", v.days.join(", ") || "—"],
  ];
  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(([k, val]) => (
          <tr key={k} className="border-b border-line-soft last:border-0">
            <td className="py-1 pr-3 font-medium text-fg-muted">{k}</td>
            <td className="py-1 text-fg-2">{val}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Lucky numbers/colours/directions: numerology and Jyotisha shown separately, then combined. */
export default function LuckyCard() {
  const { chart, strengths, shadbala } = useChart();
  const [system, setSystem] = useState<NamankSystem>("chaldean");

  const numerology = useMemo(() => {
    if (!chart) return null;
    const dateISO = chart.meta.localDateTime?.slice(0, 10);
    return computeNumerology(dateISO, chart.meta.name, chart.meta.gender, system);
  }, [chart, system]);

  const report = useMemo(
    () => (chart ? buildLuckyReport(chart, strengths, shadbala, numerology) : null),
    [chart, strengths, shadbala, numerology]
  );

  if (!chart || !report) return null;

  return (
    <SectionCard icon={Clover} title={report.title} headline={report.headline} confidence={report.confidence}>
      {report.blocks.map((b) => (
        <Section key={b.heading} title={b.heading}>
          {b.paragraphs.map((p, i) => (
            <p key={i} className="mb-2 text-xs leading-relaxed text-fg-muted last:mb-0">
              {p}
            </p>
          ))}
        </Section>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Jyotisha verdict (from your chart)">
          <VerdictGrid v={report.jyotishaVerdict} />
          <p className="mt-1.5 text-[10px] text-fg-subtle">
            Auspicious planets: {report.jyotishaVerdict.planets.map((p) => PLANET_NAMES[p]).join(", ")}
          </p>
        </Section>
        <Section title="Numerology verdict (from date & name)">
          {report.numerologyVerdict ? (
            <>
              <VerdictGrid v={report.numerologyVerdict} />
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-fg-subtle">
                Name system:
                {(["chaldean", "pythagorean"] as NamankSystem[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSystem(s)}
                    className={`rounded px-1.5 py-0.5 ring-1 ring-inset transition ${
                      system === s
                        ? "bg-primary-soft text-heading ring-primary-ring"
                        : "text-fg-subtle ring-line-ring hover:text-fg"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-fg-muted">Needs a birth date.</p>
          )}
        </Section>
      </div>

      <Section title="Combined verdict">
        <table className="w-full text-xs">
          <tbody>
            {(
              [
                ["Lucky numbers", report.combined.numbers.join(", ")],
                ["Lucky colours", report.combined.colours.join("; ")],
                ["Favourable directions", report.combined.directions.join(", ")],
                ["Favourable days", report.combined.days.join(", ")],
              ] as [string, string][]
            ).map(([k, v]) => (
              <tr key={k} className="border-b border-line-soft last:border-0">
                <td className="py-1 pr-3 font-medium text-fg-muted">{k}</td>
                <td className="py-1 font-medium text-heading-2">{v || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {report.combined.disagreements.length > 0 && (
          <div className="mt-2 rounded-lg border border-heading-border bg-primary-wash p-2.5">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-eyebrow">
              Where the two systems disagree
            </div>
            {report.combined.disagreements.map((d, i) => (
              <p key={i} className="text-[11px] leading-relaxed text-fg">
                {d}
              </p>
            ))}
          </div>
        )}
      </Section>

      <p className="text-[11px] leading-relaxed text-fg-subtle">{report.gemstoneNote}</p>

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
