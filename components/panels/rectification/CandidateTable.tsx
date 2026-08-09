"use client";

import { SIGNS } from "@/utils/astrology/constants";
import { fmtDeg } from "@/utils/astrology/math";
import type { CandidateScore, RectificationResult } from "@/utils/astrology/rectification/types";

/**
 * Ranked candidate minutes with the score curve across the whole window.
 *
 * The sparkline is not decoration: the shape of the curve is the evidence for
 * or against the winner. A single sharp spike is a real signal; a flat ridge
 * with a one-pixel bump on it is the picture of an indeterminate result, and a
 * reader should be able to see that without reading the z-score.
 */

function Sparkline({ result }: { result: RectificationResult }) {
  const cs = result.candidates;
  const scores = cs.map((c) => c.score);
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  const span = hi - lo || 1;
  const W = 320;
  const H = 56;
  const x = (i: number) => (i / Math.max(1, cs.length - 1)) * W;
  const y = (s: number) => H - ((s - lo) / span) * (H - 6) - 3;

  const path = cs.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c.score).toFixed(1)}`).join(" ");
  const medianY = y(result.stats.median);
  const bestIdx = cs.findIndex((c) => c.offsetMin === result.best.offsetMin);
  const inInterval = cs
    .map((c, i) => ({ c, i }))
    .filter(
      ({ c }) =>
        c.offsetMin >= result.interval.startOffsetMin && c.offsetMin <= result.interval.endOffsetMin
    );

  return (
    <div className="rounded-lg border border-line-soft bg-surface-3 p-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
          Score across the window
        </span>
        <span className="font-mono text-[10px] text-fg-subtle">
          {lo.toFixed(3)} – {hi.toFixed(3)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" role="img" aria-label="Score curve across candidate minutes">
        {inInterval.length > 0 && (
          <rect
            x={x(inInterval[0].i)}
            y={0}
            width={Math.max(2, x(inInterval[inInterval.length - 1].i) - x(inInterval[0].i))}
            height={H}
            className="fill-good-soft"
          />
        )}
        <line
          x1={0}
          x2={W}
          y1={medianY}
          y2={medianY}
          className="stroke-line-strong"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <path d={path} fill="none" className="stroke-primary" strokeWidth={1.6} />
        {bestIdx >= 0 && (
          <circle cx={x(bestIdx)} cy={y(cs[bestIdx].score)} r={3} className="fill-good-strong" />
        )}
      </svg>
      <div className="flex justify-between font-mono text-[10px] text-fg-subtle">
        <span>{cs[0]?.localTime}</span>
        <span className="text-fg-muted">dashed = median candidate</span>
        <span>{cs[cs.length - 1]?.localTime}</span>
      </div>
    </div>
  );
}

function Row({ c, result, rank }: { c: CandidateScore; result: RectificationResult; rank: number }) {
  const isBest = c.offsetMin === result.best.offsetMin;
  const inInterval =
    c.offsetMin >= result.interval.startOffsetMin && c.offsetMin <= result.interval.endOffsetMin;
  const delta = c.score - result.stats.median;
  return (
    <tr className={isBest ? "bg-good-soft" : inInterval ? "bg-primary-wash" : undefined}>
      <td className="px-2 py-1 font-mono text-fg-subtle">{rank}</td>
      <td className="px-2 py-1 font-mono font-semibold text-fg-2">{c.localTime}</td>
      <td className="px-2 py-1 font-mono text-fg-muted">
        {c.offsetMin > 0 ? "+" : ""}
        {c.offsetMin}m
      </td>
      <td className="px-2 py-1 font-mono text-fg">{c.score.toFixed(4)}</td>
      <td className={`px-2 py-1 font-mono ${delta >= 0 ? "text-good" : "text-fg-subtle"}`}>
        {delta >= 0 ? "+" : ""}
        {delta.toFixed(4)}
      </td>
      <td className="px-2 py-1 font-mono text-fg-muted">
        {SIGNS[c.ascSign].slice(0, 3)} {fmtDeg(c.ascendant % 30)}
      </td>
      <td className="px-2 py-1 font-mono text-fg-muted">{SIGNS[c.d9LagnaSign].slice(0, 3)}</td>
      <td className="px-2 py-1 font-mono text-fg-muted">{SIGNS[c.d60LagnaSign].slice(0, 3)}</td>
    </tr>
  );
}

export default function CandidateTable({ result }: { result: RectificationResult }) {
  const ranked = [...result.candidates].sort(
    (a, b) => b.score - a.score || Math.abs(a.offsetMin) - Math.abs(b.offsetMin)
  );

  return (
    <div className="space-y-3">
      <Sparkline result={result} />
      <div className="overflow-x-auto rounded-lg border border-line-soft">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="bg-inset text-[10px] uppercase tracking-wider text-fg-subtle">
            <tr>
              <th className="px-2 py-1.5 font-bold">#</th>
              <th className="px-2 py-1.5 font-bold">Time</th>
              <th className="px-2 py-1.5 font-bold">Offset</th>
              <th className="px-2 py-1.5 font-bold">Score</th>
              <th className="px-2 py-1.5 font-bold" title="Score minus the median candidate">
                vs median
              </th>
              <th className="px-2 py-1.5 font-bold">Lagna</th>
              <th className="px-2 py-1.5 font-bold" title="Navamsa Lagna sign — changes about every 11 minutes">
                D-9
              </th>
              <th
                className="px-2 py-1.5 font-bold"
                title="Shashtiamsa Lagna sign — changes about every 2 minutes, the sharpest signal in this window"
              >
                D-60
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-faint">
            {ranked.map((c, i) => (
              <Row key={c.offsetMin} c={c} result={result} rank={i + 1} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-relaxed text-fg-subtle">
        Green row is the best minute; the shaded band is the interval statistically tied with it —
        that interval, not the single row, is the result. The D-60 column is the only one that
        changes fast enough to separate adjacent minutes, which is why it carries the most weight
        in the varga score.
      </p>
    </div>
  );
}
