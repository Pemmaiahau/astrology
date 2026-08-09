"use client";

import { ScaleIcon } from "lucide-react";

/**
 * Standing notice for the Rectification tab, styled after
 * `components/ui/Disclaimer.tsx` but deliberately NOT dismissible: the global
 * disclaimer is about interpretation, this one is about what the number on the
 * screen actually is. A rectified time is one plausible reconciliation of the
 * events you supplied, under the rules stated here and under one chosen
 * ayanamsha. It is not a recovered fact, and no amount of decimal places in
 * the score makes it one.
 */
export default function RectifyDisclaimer() {
  return (
    <div className="rounded-xl border border-heading-border bg-primary-wash p-4">
      <h3 className="mb-1.5 flex items-center gap-2 font-serif text-sm font-bold text-heading">
        <ScaleIcon className="h-4 w-4" /> What this tool does, and what it cannot do
      </h3>
      <div className="space-y-2 text-xs leading-relaxed text-heading-2">
        <p>
          Birth time rectification is <strong>interpretive, not deterministic</strong>. This sweep
          finds the minute inside your search window that best reconciles the life events you
          entered with classical Parashari rules. A different rule set, a different ayanamsha, or
          one more event can move the answer. Treat the result as a reasoned proposal to test
          against your own life, never as a discovered fact.
        </p>
        <p>
          Every result is reported with its confidence tier, its margin over the rest of the
          window, and a stability flag. If those say the answer is indeterminate, the honest
          reading is that your events do not resolve the minute — not that you should take the
          top row anyway.
        </p>
        <p>
          The two ayanamsha columns are computed independently and are never averaged or blended.
          Nothing here is medical, legal or financial advice.
        </p>
      </div>
    </div>
  );
}
