"use client";

import { useMemo, useState } from "react";
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  Flower2,
  Gem,
  GraduationCap,
  Heart,
  HeartPulse,
  Home,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import {
  buildLifeAreaReports,
  type AreaVerdict,
  type LifeAreaKey,
  type LifeAreaReport,
} from "@/data/interpretations/lifeAreas";

const AREA_ICONS: Record<LifeAreaKey, LucideIcon> = {
  finance: Wallet,
  health: HeartPulse,
  love: Heart,
  marriage: Gem,
  career: Briefcase,
  children: GraduationCap,
  property: Home,
  spirituality: Flower2,
};

const VERDICT_STYLE: Record<AreaVerdict, string> = {
  "Strong promise": "bg-good-soft text-good ring-good-ring",
  Supportive: "bg-info-soft text-info ring-info-ring",
  Mixed: "bg-primary-soft text-heading ring-primary-ring",
  "Needs effort": "bg-warn-soft text-warn ring-warn-ring",
  Challenged: "bg-bad-soft text-bad ring-bad-ring",
};

function fmt(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{title}</p>
      {children}
    </div>
  );
}

function AreaCard({ report }: { report: LifeAreaReport }) {
  const [open, setOpen] = useState(false);
  const Icon = AREA_ICONS[report.key];

  return (
    <div className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-3.5 text-left transition hover:bg-inset"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-eyebrow" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
        )}
        <Icon className="h-5 w-5 shrink-0 text-primary" />
        <span className="font-serif text-base font-bold text-fg-2">{report.name}</span>
        <span
          className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${VERDICT_STYLE[report.verdict]}`}
        >
          {report.verdict}
        </span>
        <div className="hidden w-24 items-center gap-2 sm:flex">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-inset-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cta-from-hover to-cta-to-hover"
              style={{ width: `${report.score}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-fg-muted">{report.score}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-line-soft p-4">
          <p className="text-xs italic leading-relaxed text-fg-subtle">Scope: {report.blurb}.</p>

          {report.houses.map((h) => (
            <Section key={h.house} title={`House Analysis — ${h.house}`}>
              <div className="space-y-1.5">
                {h.lines.map((l, i) => (
                  <p key={i} className="text-sm leading-relaxed text-fg">
                    {l}
                  </p>
                ))}
              </div>
            </Section>
          ))}

          {report.karakas.length > 0 && (
            <Section title="Karakas (Natural Significators)">
              <div className="space-y-1.5">
                {report.karakas.map((l, i) => (
                  <p key={i} className="text-sm leading-relaxed text-fg">
                    {l}
                  </p>
                ))}
              </div>
            </Section>
          )}

          {report.nakshatra.length > 0 && (
            <Section title="Nakshatra Threads">
              <div className="space-y-1.5">
                {report.nakshatra.map((l, i) => (
                  <p key={i} className="text-xs leading-relaxed text-fg-muted">
                    {l}
                  </p>
                ))}
              </div>
            </Section>
          )}

          {report.yogas.length > 0 && (
            <Section title="Yogas Touching This Area">
              <div className="space-y-1.5">
                {report.yogas.map((l, i) => (
                  <p key={i} className="text-xs leading-relaxed text-fg-muted">
                    {l}
                  </p>
                ))}
              </div>
            </Section>
          )}

          {report.cautions.length > 0 && (
            <div className="rounded-lg border border-bad-border bg-bad-wash p-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-bad-strong">Cautions</p>
              <div className="space-y-1">
                {report.cautions.map((l, i) => (
                  <p key={i} className="text-xs leading-relaxed text-bad-2">
                    {l}
                  </p>
                ))}
              </div>
            </div>
          )}

          {report.hasDasha && (
            <Section title="Dasha Activation">
              {report.activationNow.length > 0 ? (
                <div className="mb-2 space-y-1">
                  {report.activationNow.map((l, i) => (
                    <p key={i} className="text-sm leading-relaxed text-good">
                      ● Active now — {l}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mb-2 text-xs text-fg-subtle">
                  None of the currently running dasha lords connect to this area — it idles until a connected
                  period opens.
                </p>
              )}
              {report.windows.length > 0 && (
                <div className="space-y-1 rounded-lg border border-line-soft bg-surface-3 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
                    Key windows (next 20 years)
                  </p>
                  {report.windows.map((w, i) => (
                    <p key={i} className="text-xs leading-relaxed text-fg-muted">
                      <span
                        className={`font-semibold ${w.grade === "strong" ? "text-heading" : "text-fg"}`}
                      >
                        {w.label}
                      </span>{" "}
                      <span className="font-mono text-fg-subtle">
                        {fmt(w.start)} → {fmt(w.end)}
                      </span>
                      {w.grade === "strong" && (
                        <span className="ml-1.5 rounded-full bg-primary-soft px-1.5 text-[10px] font-bold text-heading">
                          strong
                        </span>
                      )}{" "}
                      — {w.reason}
                    </p>
                  ))}
                </div>
              )}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

export default function LifeAreasPanel() {
  const { chart, dashaTree, ashtakavarga, yogas, now } = useChart();

  const reports = useMemo(() => {
    if (!chart) return null;
    return buildLifeAreaReports(chart, dashaTree, ashtakavarga, yogas, now);
  }, [chart, dashaTree, ashtakavarga, yogas, now]);

  if (!chart || !reports) return null;

  return (
    <div className="space-y-3">
      {!chart.birthUtc && (
        <p className="rounded-xl border border-heading-border bg-primary-wash p-3 text-xs text-heading-soft">
          No birth anchor supplied — natal analysis below is complete, but dasha activation timing is omitted.
        </p>
      )}
      {reports.map((r) => (
        <AreaCard key={r.key} report={r} />
      ))}
      <p className="px-1 text-[11px] leading-relaxed text-fg-faint">
        Scores are composite planetary-strength aggregates (dignity, combustion, drishti, dig bala, nakshatra
        dispositor, Ashtakavarga) — a transparent heuristic, not classical Shadbala. For guidance, not
        determinism.
      </p>
    </div>
  );
}
