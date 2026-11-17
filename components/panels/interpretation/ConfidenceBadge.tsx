"use client";

export type ConfidenceValue = number | "High" | "Medium" | "Low";

/** A numeric confidence (0–100) or a word, as a word band. */
export function confidenceWord(value: ConfidenceValue): "high" | "medium" | "low" {
  if (typeof value === "string") return value.toLowerCase() as "high" | "medium" | "low";
  return value >= 70 ? "high" : value >= 45 ? "medium" : "low";
}

/**
 * Small confidence chip: how firmly the section's combinations point one way.
 * Numeric bands: ≥70 high · 45–69 moderate · <45 low. The Interpretation tab
 * passes a word (High / Medium / Low) from its own weighing instead.
 */
export default function ConfidenceBadge({ value }: { value: ConfidenceValue }) {
  const band = confidenceWord(value);
  const label = typeof value === "number" && band === "medium" ? "moderate" : band;
  const style =
    band === "high"
      ? "bg-good-soft text-good ring-good-ring"
      : band === "medium"
        ? "bg-primary-faint text-heading-soft ring-primary-ring-soft"
        : "bg-neutral-soft text-fg-muted ring-neutral-ring";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${style}`}
      title={typeof value === "number" ? `Confidence ${value}/100 — how consistently the chart's combinations point the same way` : "How consistently the chart's evidence points the same way"}
    >
      {label} confidence
    </span>
  );
}
