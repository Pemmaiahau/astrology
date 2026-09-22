import type { AutoInputState, BirthAnchor, ManualInputState } from "@/utils/astrology/types";

/**
 * Client side of the chart log: turns whichever input produced the chart into
 * the flat payload /api/chart-log accepts, and posts it.
 *
 * Both input modes are covered because both describe a real birth. Manual
 * entry carries its date, time and place on `anchor` rather than at the top
 * level — the panchang and dasha layers need them even when the positions
 * themselves were typed in — so the two shapes flatten to the same row.
 */
type Committed =
  | { kind: "auto"; data: AutoInputState }
  | { kind: "manual"; data: ManualInputState }
  | null;

export function logChartExport(committed: Committed): void {
  if (!committed) return;

  // Discriminate on the tag rather than on `data`: an `AutoInputState` is
  // already anchor-shaped, so a ternary over the union narrows to neither.
  const anchor: BirthAnchor =
    committed.kind === "auto"
      ? { dateISO: committed.data.dateISO, time: committed.data.time, place: committed.data.place }
      : committed.data.anchor;
  const d = committed.data;
  const place = anchor.place;

  const payload = {
    mode: committed.kind,
    name: d.name ?? null,
    gender: d.gender ?? null,
    dateISO: anchor.dateISO ?? null,
    time: anchor.time ?? null,
    placeName: place?.name ?? null,
    placeAdmin: place?.admin ?? null,
    placeCountry: place?.country ?? null,
    lat: place?.lat ?? null,
    lon: place?.lon ?? null,
    timezone: place?.timezone ?? null,
  };

  /**
   * Fire and forget, and deliberately so.
   *
   * The visitor asked for a file, not for a database write. A logging failure
   * — offline, blocked by an extension, env vars unset on a fork — must never
   * reach the button's error line or delay the download by a single frame, so
   * nothing here is awaited and every rejection is swallowed. `keepalive`
   * lets the request outlive the page if the tab is closed the moment the
   * save dialog appears.
   */
  void fetch("/api/chart-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    /* recording is best-effort; the report is the product */
  });
}
