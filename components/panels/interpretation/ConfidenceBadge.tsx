"use client";

/**
 * Small confidence chip: how firmly the section's combinations point one way.
 * Bands: ≥70 high · 45–69 moderate · <45 low.
 */
export default function ConfidenceBadge({ value }: { value: number }) {
  const band = value >= 70 ? "high" : value >= 45 ? "moderate" : "low";
  const style =
    band === "high"
      ? "bg-good-soft text-good ring-good-ring"
      : band === "moderate"
        ? "bg-primary-faint text-heading-soft ring-primary-ring-soft"
        : "bg-neutral-soft text-fg-muted ring-neutral-ring";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${style}`}
      title={`Confidence ${value}/100 — how consistently the chart's combinations point the same way`}
    >
      {band} confidence
    </span>
  );
}
