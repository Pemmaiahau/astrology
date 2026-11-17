"use client";

import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import ConfidenceBadge, { type ConfidenceValue } from "./ConfidenceBadge";

/**
 * Collapsible card shell for the Interpretation sections — the visual
 * sibling of the Life Areas AreaCard (chevron header, verdict chip and
 * confidence in words; no numeric scores). Children render only after first
 * expand, which doubles as the lazy boundary for expensive timing
 * computations inside the section.
 */

const VERDICT_STYLE: Record<string, string> = {
  "Strong promise": "bg-good-soft text-good ring-good-ring",
  "Good promise": "bg-info-soft text-info ring-info-ring",
  Supportive: "bg-info-soft text-info ring-info-ring",
  "Mixed promise": "bg-primary-soft text-heading ring-primary-ring",
  Mixed: "bg-primary-soft text-heading ring-primary-ring",
  "Needs effort": "bg-warn-soft text-warn ring-warn-ring",
  "Weak promise": "bg-bad-soft text-bad ring-bad-ring",
  Challenged: "bg-bad-soft text-bad ring-bad-ring",
};

export function VerdictChip({ verdict }: { verdict: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${VERDICT_STYLE[verdict] ?? VERDICT_STYLE.Mixed}`}>
      {verdict}
    </span>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{title}</div>
      {children}
    </div>
  );
}

export default function SectionCard({
  icon: Icon,
  title,
  headline,
  verdict,
  confidence,
  defaultOpen = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  headline?: string;
  verdict?: string;
  confidence?: ConfidenceValue;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [everOpened, setEverOpened] = useState(defaultOpen);

  return (
    <section className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setEverOpened(true);
        }}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
        )}
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1">
          <span className="block font-serif text-base font-bold text-heading">{title}</span>
          {headline && !open && (
            <span className="mt-0.5 block text-xs font-medium leading-snug text-heading-2">{headline}</span>
          )}
        </span>
        {verdict && <VerdictChip verdict={verdict} />}
        {confidence !== undefined && <ConfidenceBadge value={confidence} />}
      </button>
      {open && (
        <div className="space-y-4 px-4 pb-4">
          {headline && <p className="text-sm font-medium text-heading-2">{headline}</p>}
          {everOpened ? children : null}
        </div>
      )}
    </section>
  );
}
