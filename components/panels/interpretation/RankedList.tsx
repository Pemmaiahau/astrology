"use client";

import { useState } from "react";
import type { RankedItem } from "@/data/interpretations/report";
import WhyList from "./WhyList";

/** Ranked options with fit-score bars; each row expands to show its evidence. */
export default function RankedList({ items }: { items: RankedItem[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (!items.length) return null;

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
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-inset-2">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-cta-from to-cta-to-hover"
                  style={{ width: `${item.score}%` }}
                />
              </span>
              <span className="w-7 text-right font-mono text-xs text-fg-muted">{item.score}</span>
            </span>
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
