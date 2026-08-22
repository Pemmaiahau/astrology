"use client";

import { useMemo, useState } from "react";
import {
  Briefcase,
  CalendarRange,
  Flower2,
  GraduationCap,
  Heart,
  Hourglass,
  MapPin,
  ShieldAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import {
  buildLifeEventTimeline,
  type LifeEventOccurrence,
} from "@/data/interpretations/lifeEvents";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type LifeEventCategory,
} from "@/data/interpretations/lifeEventRules";
import { PLANET_NAMES } from "@/utils/astrology/constants";
import { dashaLabelAt } from "@/utils/astrology/eventTiming";
import EventCard from "./EventCard";
import PromiseTable from "./PromiseTable";

/**
 * The Life Events tab.
 *
 * Two views over one dataset: grouped by Mahadasha (the frame Jyotisha
 * actually times in — a life is a sequence of periods, not of years) and a
 * flat chronology for readers who think in dates. Category and phase filters
 * narrow both.
 *
 * The whole timeline is one `useMemo` behind the tab, which is the lazy
 * boundary: ~300 ms of ephemeris work that must not run for a reader who never
 * opens this tab, and must not re-run when they toggle a filter.
 */

const CATEGORY_ICONS: Record<LifeEventCategory, LucideIcon> = {
  education: GraduationCap,
  relationships: Heart,
  career: Briefcase,
  milestones: MapPin,
  finance: Wallet,
  adversity: ShieldAlert,
  spiritual: Flower2,
};

type View = "dasha" | "chrono";
type Phase = "all" | "ahead";

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

const PHASE_DOT: Record<LifeEventOccurrence["window"]["phase"], string> = {
  past: "bg-line-strong",
  current: "bg-accent",
  future: "bg-primary",
};

export default function LifeEventsPanel() {
  const { chart, dashaTree, ayanamsha, ashtakavarga, shadbala, bhavaBala, strengths, jaimini, now } =
    useChart();

  const timeline = useMemo(() => {
    if (!chart) return null;
    return buildLifeEventTimeline({
      chart,
      dashaTree,
      ayanamsha,
      ashtakavarga,
      shadbala,
      bhavaBala,
      strengths,
      jaimini,
      now,
    });
  }, [chart, dashaTree, ayanamsha, ashtakavarga, shadbala, bhavaBala, strengths, jaimini, now]);

  const [view, setView] = useState<View>("dasha");
  const [phase, setPhase] = useState<Phase>("all");
  const [active, setActive] = useState<Set<LifeEventCategory>>(new Set());

  const visible = useMemo(() => {
    if (!timeline) return [];
    return timeline.entries.filter(
      (e) =>
        (active.size === 0 || active.has(e.category)) &&
        (phase === "all" || e.window.phase !== "past")
    );
  }, [timeline, active, phase]);

  if (!chart || !timeline) return null;

  if (!timeline.hasDasha) {
    return (
      <div className="space-y-3">
        {timeline.caveats.map((c, i) => (
          <p key={i} className="rounded-xl border border-heading-border bg-primary-wash p-4 text-sm leading-relaxed text-heading-soft">
            {c}
          </p>
        ))}
      </div>
    );
  }

  const toggle = (c: LifeEventCategory) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const byId = new Map(visible.map((e) => [e.id, e]));
  const nowLabel = dashaTree ? dashaLabelAt(dashaTree, now) : null;
  const age = timeline.currentAge;

  return (
    <div className="space-y-5">
      {/* --- Controls --- */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
        <h3 className="flex items-center gap-2 font-serif text-lg font-bold text-heading">
          <CalendarRange className="h-5 w-5" /> Life Events
        </h3>

        <div className="ml-auto flex items-center gap-1 rounded-lg border border-line-2 bg-surface-2 p-1">
          {(
            [
              ["dasha", "By Dasha"],
              ["chrono", "Chronological"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                view === k
                  ? "bg-primary-soft text-heading ring-1 ring-inset ring-primary-ring"
                  : "text-fg-muted hover:text-fg-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-line-2 bg-surface-2 p-1">
          {(
            [
              ["all", "Whole life"],
              ["ahead", "From today"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setPhase(k)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                phase === k
                  ? "bg-accent-soft text-accent ring-1 ring-inset ring-accent-ring"
                  : "text-fg-muted hover:text-fg-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* --- Where the reader stands --- */}
      <p className="px-1 text-xs text-fg-muted">
        {age !== null && (
          <>
            You are <span className="font-semibold text-fg">{Math.floor(age)}</span>
            {nowLabel && (
              <>
                , currently running <span className="font-semibold text-fg">{nowLabel}</span>
              </>
            )}
            .{" "}
          </>
        )}
        <span className="font-semibold text-fg">{visible.length}</span> of {timeline.entries.length} windows
        shown
        {timeline.span && (
          <>
            {" "}
            across a scan from birth to age{" "}
            {Math.round(
              (timeline.span.to.getTime() - timeline.span.from.getTime()) / (365.2425 * 86400000)
            )}
          </>
        )}
        .
      </p>

      {/* --- Category filter --- */}
      <div className="flex flex-wrap gap-1.5 px-1">
        <button
          type="button"
          onClick={() => setActive(new Set())}
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition ${
            active.size === 0
              ? "bg-primary-soft text-heading ring-primary-ring"
              : "text-fg-muted ring-line-ring hover:text-fg-2"
          }`}
        >
          All categories
        </button>
        {CATEGORY_ORDER.filter((c) => timeline.categories.includes(c)).map((c) => {
          const Icon = CATEGORY_ICONS[c];
          const on = active.has(c);
          const count = timeline.entries.filter((e) => e.category === c).length;
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition ${
                on
                  ? "bg-primary-soft text-heading ring-primary-ring"
                  : "text-fg-muted ring-line-ring hover:text-fg-2"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {CATEGORY_LABELS[c]}
              <span className="font-mono text-[10px] text-fg-subtle">{count}</span>
            </button>
          );
        })}
      </div>

      <PromiseTable promises={timeline.promises} />

      {/* --- Timeline --- */}
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface-soft p-6 text-center text-sm text-fg-muted">
          No windows match the current filters. Widen the category selection, or switch back to the whole
          life — this chart&apos;s strongest windows for some themes have already passed.
        </p>
      ) : view === "chrono" ? (
        <div className="space-y-2">
          {visible.map((e) => (
            <div key={e.id} className="flex gap-3">
              <div className="flex flex-col items-center pt-4">
                <span className={`h-2 w-2 shrink-0 rounded-full ${PHASE_DOT[e.window.phase]}`} />
                <span className="w-px flex-1 bg-line" />
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <EventCard entry={e} icon={CATEGORY_ICONS[e.category]} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {timeline.groups
            .map((g) => ({ group: g, items: g.eventIds.map((id) => byId.get(id)).filter(Boolean) }))
            .filter((g) => g.items.length > 0)
            .map(({ group, items }) => (
              <section key={`${group.lord}-${group.start.getTime()}`}>
                <div
                  className={`mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border px-3 py-2 ${
                    group.phase === "current"
                      ? "border-accent-border bg-accent-wash"
                      : "border-line-soft bg-surface-3"
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-serif text-base font-bold text-heading">
                    <Hourglass className="h-4 w-4" />
                    {PLANET_NAMES[group.lord]} Mahadasha
                  </span>
                  <span className="font-mono text-xs text-fg-muted">
                    {fmt(group.start)} → {fmt(group.end)}
                  </span>
                  <span className="font-mono text-[11px] text-fg-subtle">
                    age {group.ageFrom}–{group.ageTo}
                  </span>
                  {group.phase === "current" && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent ring-1 ring-inset ring-accent-ring">
                      running now
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-fg-subtle">
                    {items.length} window{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-2 border-l border-line pl-3">
                  {items.map((e) => (
                    <EventCard key={e!.id} entry={e!} icon={CATEGORY_ICONS[e!.category]} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      {/* --- Standing caveats --- */}
      <div className="space-y-1.5 px-1">
        <p className="text-[11px] leading-relaxed text-fg-faint">
          Every row is a <em>window</em>, never a date. The method is the applied-Parashari synthesis:
          Vimshottari periods of the lords that signify each event, intersected with the Guru–Shani double
          transit and the Moon-frame Gochara Phala with its vedha cancellations, weighted by the birth
          chart&apos;s own promise for that event. The limbs are classical; the arithmetic that blends them
          is a modern synthesis, and every window shows its own weighted reasons so you can discount any
          limb you disagree with.
        </p>
        <p className="text-[11px] leading-relaxed text-fg-faint">
          Age ranges are a common-experience convention, not a classical rule — no Parashari text fixes
          these years. Your chart supplies the timing; the band only supplies the plausibility. If your own
          life ran on a different clock, trust your life.
        </p>
        {timeline.caveats.map((c, i) => (
          <p key={i} className="text-[11px] leading-relaxed text-fg-faint">
            {c}
          </p>
        ))}
      </div>
    </div>
  );
}
