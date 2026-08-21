"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { HOUSE_SIGNIFICATIONS, PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";
import { ordinal } from "@/utils/astrology/format";
import {
  computeSudarshana,
  FRAME_LABELS,
  unanimouslyStrained,
  unanimouslySupported,
  type SudarshanaHouse,
} from "@/utils/astrology/sudarshana";
import { munthaAt } from "@/utils/astrology/varshaphala";

/**
 * Two techniques that were computed but unreachable, surfaced together
 * because both answer "which part of life is live right now?".
 *
 * - Sudarshana Chakra: the twelve houses judged from the rising sign, the Moon
 *   and the Sun at once, so a reading rests on three views instead of one.
 * - Muntha: the Tajika annual point, which advances one house a year.
 *
 * Both are pure arithmetic over the natal chart, so unlike the Sade Sati card
 * there is nothing expensive to defer; the collapse is for reading order, not
 * for cost.
 */

const houseTheme = (house: number): string =>
  HOUSE_SIGNIFICATIONS[house - 1].split(",").slice(0, 2).join(", ");

function AgreementRow({ h }: { h: SudarshanaHouse }) {
  return (
    <tr className="border-t border-line-faint">
      <td className="px-2 py-1.5 font-semibold text-fg-strong">{ordinal(h.house)}</td>
      <td className="px-2 py-1.5 text-fg-muted">{houseTheme(h.house)}</td>
      {h.frames.map((f) => (
        <td key={f.frame} className="px-2 py-1.5 text-center">
          <span
            className={
              f.net > 0 ? "text-good-strong" : f.net < 0 ? "text-bad-strong" : "text-fg-subtle"
            }
            title={`${SIGNS[f.sign]} — ${
              f.occupants.length ? `${f.occupants.map((p) => PLANET_NAMES[p]).join(", ")} present` : "empty"
            }${f.aspecting.length ? `; aspected by ${f.aspecting.map((p) => PLANET_NAMES[p]).join(", ")}` : ""}`}
          >
            {f.net > 0 ? "▲" : f.net < 0 ? "▼" : "–"}
          </span>
        </td>
      ))}
      <td className="px-2 py-1.5 text-center">
        {h.unanimous ? (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
              h.supported > 0
                ? "bg-good-soft text-good ring-good-ring"
                : "bg-bad-soft text-bad ring-bad-ring"
            }`}
          >
            all three
          </span>
        ) : (
          <span className="text-[10px] text-fg-subtle">mixed</span>
        )}
      </td>
    </tr>
  );
}

export default function ThreeViewCard() {
  const { chart, now } = useChart();
  const [open, setOpen] = useState(false);

  const chakra = useMemo(() => (chart ? computeSudarshana(chart) : null), [chart]);
  const muntha = useMemo(() => (chart ? munthaAt(chart, now) : null), [chart, now]);

  if (!chart || !chakra) return null;

  const strong = unanimouslySupported(chakra);
  const weak = unanimouslyStrained(chakra);

  return (
    <section className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-fg-subtle" />
        )}
        <Layers className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 font-serif text-base font-bold text-heading">
          Three views of your chart — and this year&rsquo;s focus
        </span>
        {muntha && (
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-bold text-heading ring-1 ring-inset ring-primary-ring">
            year {muntha.age + 1} · {ordinal(muntha.house)} house
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-4">
          {muntha ? (
            <div className="rounded-lg border border-heading-border bg-primary-wash p-3">
              <p className="text-sm font-medium leading-relaxed text-heading-2">
                This year of your life is about {houseTheme(muntha.house)}.
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-fg">
                There is a point called the Muntha that starts on your rising sign at birth and moves
                forward one house every birthday. In your {ordinal(muntha.age + 1)}{" "}
                year it sits in your {ordinal(muntha.house)} house, in {SIGNS[muntha.sign]}. That house
                governs {houseTheme(muntha.house)} — so those themes tend to be where this year&rsquo;s
                attention and events concentrate. {PLANET_NAMES[muntha.lord]} rules that sign, which makes
                its condition in your chart the thing to read for how the year tends to go.
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-fg-subtle">
                This is the annual point on its own, not a full annual chart. The complete Tajika
                procedure — the year lord, the sahams and its own dasha — is not implemented here.
              </p>
            </div>
          ) : (
            <p className="rounded-lg border border-line-soft bg-surface-3 p-3 text-xs leading-relaxed text-fg-muted">
              The annual point needs a birth date to count from.
            </p>
          )}

          <div>
            <p className="text-sm leading-relaxed text-fg">
              Most readings judge a house only from the rising sign. The Sudarshana Chakra reads it three
              times — from your rising sign, your Moon and your Sun — and treats agreement between them as
              the real signal. A house that looks well-supported from all three is something your chart is
              committed to; one that looks good from only one is a possibility, not a promise.
            </p>
            {strong.length > 0 && (
              <p className="mt-2 text-sm leading-relaxed text-fg">
                <span className="font-semibold text-good-strong">All three views agree these are well
                supported:</span>{" "}
                {strong.map((h) => `${ordinal(h.house)} (${houseTheme(h.house)})`).join(", ")}.
              </p>
            )}
            {weak.length > 0 && (
              <p className="mt-1.5 text-sm leading-relaxed text-fg">
                <span className="font-semibold text-bad-strong">All three agree these need conscious
                effort:</span>{" "}
                {weak.map((h) => `${ordinal(h.house)} (${houseTheme(h.house)})`).join(", ")}. That is a
                flag to plan around, not a verdict.
              </p>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-line-soft">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="bg-inset text-left uppercase tracking-wider text-eyebrow">
                  <th className="px-2 py-2">House</th>
                  <th className="px-2 py-2">Governs</th>
                  {chakra[0].frames.map((f) => (
                    <th key={f.frame} className="px-2 py-2 text-center">
                      {FRAME_LABELS[f.frame].replace("from your ", "").replace("from your ", "")}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center">Agreement</th>
                </tr>
              </thead>
              <tbody>
                {chakra.map((h) => (
                  <AgreementRow key={h.house} h={h} />
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs leading-relaxed text-fg-subtle">
            ▲ means benefic influence outweighs malefic on that house in that view, ▼ the reverse, – an
            even balance. Hover a mark to see which planets produced it. Counting occupancy and glances
            equally is this app&rsquo;s simplification — the classical texts describe the chakra in
            words rather than numbers — which is why the table reports agreement instead of a score.
          </p>
        </div>
      )}
    </section>
  );
}
