"use client";

import { AlertTriangle, OctagonAlert } from "lucide-react";
import type { ValidationIssue } from "@/utils/astrology/validate";

/**
 * Renders input warnings and errors.
 *
 * The distinction matters and is carried through visually: an **error** means
 * the chart would be wrong in a way the engine can name (a date outside the
 * ayanamsha's validity, a degree outside its sign), and a **warning** means the
 * input is unusual but might be correct — a hand-copied chart, a genuinely
 * polar birth, a clock change near the recorded time. Warnings never block
 * submission, because refusing a plausible-but-odd chart would break a real
 * workflow; errors do.
 */
export default function ValidationNotes({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) return null;
  const errors = issues.filter((i) => i.severity === "error");
  const warns = issues.filter((i) => i.severity === "warn");

  return (
    <div className="space-y-1.5">
      {errors.map((i, n) => (
        <p
          key={`e${n}`}
          className="flex items-start gap-1.5 rounded-lg border border-bad-border bg-bad-wash p-2 text-[11px] leading-relaxed text-bad-2"
        >
          <OctagonAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bad-strong" />
          <span>{i.message}</span>
        </p>
      ))}
      {warns.map((i, n) => (
        <p
          key={`w${n}`}
          className="flex items-start gap-1.5 rounded-lg border border-warn-ring bg-warn-soft p-2 text-[11px] leading-relaxed text-fg"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
          <span>{i.message}</span>
        </p>
      ))}
    </div>
  );
}
