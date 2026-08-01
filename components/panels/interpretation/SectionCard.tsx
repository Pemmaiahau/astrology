"use client";

import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Verdict } from "@/data/interpretations/report";
import ConfidenceBadge from "./ConfidenceBadge";

/**
 * Collapsible card shell for the scored Interpretation sections — the visual
 * sibling of the Life Areas AreaCard (chevron header, verdict chip, score
 * bar). Children render only after first expand, which doubles as the lazy
 * boundary for expensive timing computations inside the section.
 */

const VERDICT_STYLE: Record<Verdict, string> = {
  "Strong promise": "bg-good-soft text-good ring-good-ring",
  Supportive: "bg-info-soft text-info ring-info-ring",
  Mixed: "bg-primary-soft text-heading ring-primary-ring",
  "Needs effort": "bg-warn-soft text-warn ring-warn-ring",
  Challenged: "bg-bad-soft text-bad ring-bad-ring",
};

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
  score,
  verdict,
  confidence,
  defaultOpen = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  headline?: string;
  score?: number;
  verdict?: Verdict;
  confidence?: number;
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
        <span className="flex-1 font-serif text-base font-bold text-heading">{title}</span>
        {verdict && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${VERDICT_STYLE[verdict]}`}
          >
            {verdict}
          </span>
        )}
        {confidence !== undefined && <ConfidenceBadge value={confidence} />}
        {score !== undefined && (
          <span className="hidden items-center gap-1.5 sm:flex">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-inset-2">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-cta-from to-cta-to-hover"
                style={{ width: `${score}%` }}
              />
            </span>
            <span className="font-mono text-xs text-fg-muted">{score}</span>
          </span>
        )}
      </button>
      {open && (
        <div className="space-y-4 px-4 pb-4">
          {headline && <p className="text-sm font-medium italic text-heading-2">{headline}</p>}
          {everOpened ? children : null}
        </div>
      )}
    </section>
  );
}
