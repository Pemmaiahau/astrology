"use client";

import { useState } from "react";
import type { RankedItem } from "@/data/interpretations/report";
import WhyList from "./WhyList";

/**
 * Where an option stands among the chart's options, in words. The scores
 * behind the ranking are relative (the top option always sits near the top of
 * the scale), so a bare number would overstate them.
 */
export function fitWord(score: number, top: number, index: number): string {
  if (index === 0) return "best fit";
  const r = top > 0 ? score / top : 0;
  return r >= 0.75 ? "strong fit" : r >= 0.5 ? "good fit" : "secondary";
}

/**
 * Ranked options; each row expands to show its evidence. By default a fit-score
 * bar; with `words` (the Interpretation tab) a word instead — the option's own
 * verdict when `absolute`, otherwise where it stands against the others.
 */
export default function RankedList({ items, words = false, absolute = false }: { items: RankedItem[]; words?: boolean; absolute?: boolean }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (!items.length) return null;
  const top = Math.max(...items.map((i) => i.score));

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={item.key} className="rounded-lg border border-line-soft bg-surface-3 p-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left"
            onClick={() => setOpenKey(openKey === item.key ? null : item.key)}
          >
            <span className="w-5 shrink-0 font-mono text-xs text-fg-subtle">{i + 1}.</span>
            <span className="flex-1 text-sm text-fg-2">{item.label}</span>
            {words ? (
              <span className="shrink-0 rounded-full bg-inset-2 px-2 py-0.5 text-[11px] font-semibold text-fg-muted">
                {absolute ? item.verdict.toLowerCase() : fitWord(item.score, top, i)}
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-inset-2">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-cta-from to-cta-to-hover"
                    style={{ width: `${item.score}%` }}
                  />
                </span>
                <span className="w-7 text-right font-mono text-xs text-fg-muted">{item.score}</span>
              </span>
            )}
          </button>
          {openKey === item.key && (
            <div className="mt-2">
              <WhyList reasons={item.reasons} title="Why this ranks here" />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
