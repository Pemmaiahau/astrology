"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { openingBalanceYears } from "@/utils/astrology/dasha";
import { PLANET_NAMES, PLANET_SANSKRIT } from "@/utils/astrology/constants";
import type { DashaPeriod } from "@/utils/astrology/types";

function fmt(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function PeriodRow({
  period,
  now,
  depth,
}: {
  period: DashaPeriod;
  now: Date;
  depth: number;
}) {
  const isActive = now >= period.start && now < period.end;
  const [open, setOpen] = useState(isActive && depth < 2);
  const hasChildren = Boolean(period.children && period.children.length > 0);
  const labels = ["Mahadasha", "Antardasha", "Pratyantardasha"];

  return (
    <div className={depth > 0 ? "ml-4 border-l border-line-soft pl-2" : ""}>
      <button
        type="button"
        onClick={() => hasChildren && setOpen(!open)}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-inset ${
          isActive ? "bg-primary-wash-2 ring-1 ring-inset ring-primary-ring" : ""
        }`}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-eyebrow" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        <span className={`font-semibold ${isActive ? "text-heading" : "text-fg-2"}`}>
          {PLANET_NAMES[period.lord]}
          <span className="ml-1 hidden text-xs font-normal text-fg-subtle sm:inline">
            ({PLANET_SANSKRIT[period.lord]})
          </span>
        </span>
        <span className="ml-auto font-mono text-xs text-fg-muted">
          {fmt(period.start)} → {fmt(period.end)}
        </span>
        {isActive && (
          <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-heading">
            {labels[depth]} now
          </span>
        )}
      </button>
      {open && hasChildren && (
        <div className="mt-0.5 space-y-0.5">
          {period.children!.map((c, i) => (
            <PeriodRow key={`${c.lord}-${i}`} period={c} now={now} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashaPanel() {
  const { dashaTree, chart, now, activeDasha } = useChart();

  if (!chart) return null;
  if (!dashaTree || !chart.birthUtc) {
    return (
      <p className="rounded-xl border border-line bg-surface p-4 text-sm text-fg-muted">
        Provide the birth date, time and place (the Dasha Anchor in manual mode) to compute Vimshottari
        timelines.
      </p>
    );
  }

  const balance = openingBalanceYears(dashaTree, chart.birthUtc);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-heading-border bg-primary-wash p-3 text-sm text-fg">
        <p className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Opening balance at birth:{" "}
          <span className="font-semibold text-heading">
            {PLANET_NAMES[balance.lord]} Mahadasha, {balance.years.toFixed(2)} years remaining
          </span>
        </p>
        {activeDasha && (
          <p className="mt-1 text-xs text-fg-muted">
            Running now: {PLANET_NAMES[activeDasha.maha.lord]} — {PLANET_NAMES[activeDasha.antar.lord]} —{" "}
            {PLANET_NAMES[activeDasha.pratyantar.lord]}
          </p>
        )}
      </div>
      <div className="space-y-1 rounded-xl border border-line bg-surface p-3">
        {dashaTree.map((md, i) => (
          <PeriodRow key={`${md.lord}-${i}`} period={md} now={now} depth={0} />
        ))}
      </div>
    </div>
  );
}
