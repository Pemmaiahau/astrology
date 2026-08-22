import type { ChartData } from "@/utils/astrology/types";

/**
 * The reveal rule for the two adult-scope sections (Speculation, Intimacy):
 * the native's name starts with a **case-sensitive** `AU-` prefix AND the
 * gender selection is `"other"`. Both, or neither section appears.
 *
 * The prefix is the deliberate half — `AU-` is not something a name arrives
 * with by accident, and matching it case-sensitively means `au-` and `Au-` do
 * not open anything. `startsWith` rather than `includes` is also deliberate,
 * so `Beau-Something` does not qualify. The name is trimmed first: that
 * forgives a stray leading space, which is a typo rather than a different
 * intent, and does not loosen the case rule.
 *
 * NOTE FOR ANYONE CHANGING THE CLASSICAL RULES: `"other"` here is doing double
 * duty. It is a real answer that a real reader may give, and it is also half of
 * this switch — so a chart cast as `"other"` cannot be assumed to have been
 * answered on its own terms, and the gender-differentiated classical rules
 * (Jupiter as an additional marriage karaka in `marriage.ts`, the Kua number in
 * `lucky.ts`) already treat `"other"` as the ungendered default rather than
 * branching on it. Keep it that way; branching on `"other"` would read this
 * switch as a fact about the native.
 *
 * The gate stays silent either way: nothing in the input forms advertises it,
 * and neither panel's copy refers to what revealed it.
 *
 * Plain `.ts` rather than living inside `ChartContext.tsx` so the checks
 * harness — which reads TypeScript but not JSX — can test it directly.
 * `ChartContext` re-exports it, so callers have one import site.
 */
export function isAdvancedUnlocked(chart: ChartData | null): boolean {
  if (!chart) return false;
  const name = chart.meta.name?.trim() ?? "";
  return name.startsWith("AU-") && chart.meta.gender === "other";
}
