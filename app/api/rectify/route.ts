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

/**
 * No runtime declaration — deliberately.
 *
 * This route was briefly declared `runtime = "edge"`, for a deployment through
 * Cloudflare Pages and `@cloudflare/next-on-pages`, an adapter that can only
 * serve edge functions. The deployment now goes through Workers and
 * `@opennextjs/cloudflare` instead, which is the exact inverse: it refuses to
 * bundle an edge route at all ("OpenNext requires edge runtime function to be
 * defined in a separate function") and fails the build outright. So the two
 * Cloudflare paths cannot both be satisfied, and the declaration follows
 * whichever one deploys the site.
 *
 * Leaving it off rather than writing `runtime = "nodejs"` is the point: the
 * default already is nodejs, and an explicit declaration here is what created
 * the coupling to a deployment target in the first place. Nothing in the
 * rectification chain constrains the choice — it is `astronomy-engine` (pure
 * JS), the ayanamsha polynomials, and `Intl.DateTimeFormat` for zone handling,
 * with no `fs`, `Buffer`, `process` or `require` anywhere in the graph — so it
 * runs unchanged under workerd with nodejs_compat.
 *
 * `force-dynamic` stays: a sweep is a pure function of its POST body, but the
 * route must not be prerendered or cached as a static asset.
 */
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
