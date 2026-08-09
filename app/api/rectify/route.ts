import { rectify, validateRectifyRequest } from "@/utils/astrology/rectification/rectify";

/**
 * POST /api/rectify — birth time rectification (Janma Samaya Shodhana).
 *
 * The app itself is client-side (see ENGINE.md §1) and the Rectification panel
 * computes in-process; a full 62-chart dual-ayanamsha sweep costs ~170 ms, so
 * a round trip buys nothing there. This route exists as the programmatic entry
 * point — scripting a sweep, batching charts, or calling the engine from
 * outside the browser.
 *
 * Validation is manual and dependency-free, matching the rest of the repo
 * (no zod, no schema library). The whole response is JSON-safe: every instant
 * in the result shape is carried as epoch milliseconds or a formatted string,
 * never as a `Date`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBodyShape {
  birth: unknown;
  events: unknown;
  windowMin?: unknown;
  stepMin?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let body: RequestBodyShape;
  try {
    body = (await request.json()) as RequestBodyShape;
  } catch {
    return json({ errors: ["Request body is not valid JSON."] }, 400);
  }

  const parsed = validateRectifyRequest(body);
  if (!parsed.ok) return json({ errors: parsed.errors }, 400);

  try {
    const result = rectify(parsed.value);
    return json({ ...result, inputWarnings: parsed.warnings }, 200);
  } catch (err) {
    // A chart that will not compute (impossible coordinates, a civil time that
    // does not exist on the clock) is the caller's problem, not a server fault.
    return json({ errors: [err instanceof Error ? err.message : "Rectification failed."] }, 422);
  }
}

export async function GET(): Promise<Response> {
  return json(
    {
      errors: ["Use POST with { birth, events, windowMin?, stepMin? }."],
      birth: "{ dateISO, time, timezone, lat, lon, placeName?, name?, gender?, nodeMode? }",
      events: "[{ id?, type, dateISO, precision: exact|month|year, reliability: certain|probable|hearsay, note? }] — at least 5",
    },
    405
  );
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
