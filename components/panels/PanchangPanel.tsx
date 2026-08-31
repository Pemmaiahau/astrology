"use client";

import { useMemo, useState } from "react";
import { AlarmClock, CalendarDays, Clock, Moon, Sun, Sunrise, TriangleAlert } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { NAKSHATRA_QUALITIES, PLANET_NAMES } from "@/utils/astrology/constants";
import {
  CHOGHADIYA_MEANING,
  HORA_USE,
  computeDayParts,
  computeLimbTimings,
  nightKaalas,
  type DayParts,
  type LimbSpan,
  type NamedSpan,
  type TimeSpan,
} from "@/utils/astrology/dayParts";
import {
  KARANA_TEXT,
  TITHI_GROUP_TEXT,
  VARA_TEXT,
  YOGA_TEXT,
  tithiGroup,
} from "@/data/interpretations/panchangTexts";

/**
 * The panchang in two halves.
 *
 * The five limbs answer "what kind of moment was this?" — a natal reading, and
 * the reason this panel existed at all. The day-parts answer "which stretches
 * of this day are usable?" — the question a panchang is actually opened for.
 * The scope switch decides which day the second half describes: the day of
 * birth (what the chart was born into) or today (what to do with the afternoon).
 * The limbs re-read on the same switch, so the two halves always describe the
 * same day rather than silently drifting apart.
 */

type Scope = "birth" | "today";

function tz(chart: { meta: { timezone?: string } }): string | undefined {
  return chart.meta.timezone;
}

function hm(d: Date, timeZone?: string): string {
  return d.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
}

function dayLabel(d: Date, timeZone?: string): string {
  return d.toLocaleDateString("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" });
}

function spanLabel(s: TimeSpan, timeZone?: string): string {
  return `${hm(s.start, timeZone)} – ${hm(s.end, timeZone)}`;
}

/** Minutes between two instants, for the "ends in" countdown. */
function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function humanDuration(mins: number): string {
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

const QUALITY_CHIP: Record<NamedSpan["quality"], string> = {
  auspicious: "bg-good-soft text-good ring-good-ring",
  neutral: "bg-info-soft text-info ring-info-ring",
  inauspicious: "bg-bad-soft text-bad ring-bad-ring",
};

// ---------------------------------------------------------------------------

function LimbCard({
  label,
  value,
  span,
  text,
  at,
  timeZone,
}: {
  label: string;
  value: string;
  span: LimbSpan;
  text: string;
  at: Date;
  timeZone?: string;
}) {
  const running = at >= span.start && at < span.end;
  const left = minutesBetween(at, span.end);
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-eyebrow">{label}</span>
        <span className="font-serif text-sm font-bold text-fg-strong">{value}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-fg-muted">
        <span className="font-mono">
          {dayLabel(span.start, timeZone)} {hm(span.start, timeZone)}
        </span>
        <span aria-hidden>→</span>
        <span className="font-mono">
          {dayLabel(span.end, timeZone)} {hm(span.end, timeZone)}
        </span>
        {span.approximate && (
          <span className="rounded bg-warn-soft px-1.5 text-[10px] font-semibold text-warn">
            boundary beyond search horizon
          </span>
        )}
        {running && !span.approximate && (
          <span className="rounded-full bg-primary-soft px-1.5 text-[10px] font-semibold text-heading">
            ends in {humanDuration(left)}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-fg">{text}</p>
    </div>
  );
}

function KaalaRow({
  name,
  span,
  tone,
  note,
  timeZone,
}: {
  name: string;
  span: TimeSpan;
  tone: "bad" | "good";
  note: string;
  timeZone?: string;
}) {
  const good = tone === "good";
  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border p-2.5 ${
        good ? "border-good-ring bg-good-soft" : "border-bad-border bg-bad-wash"
      }`}
    >
      <span className={`text-xs font-bold ${good ? "text-good" : "text-bad-strong"}`}>{name}</span>
      <span className="font-mono text-xs text-fg">{spanLabel(span, timeZone)}</span>
      <span className="w-full text-[11px] leading-relaxed text-fg-muted">{note}</span>
    </div>
  );
}

function SpanStrip({
  title,
  spans,
  describe,
  timeZone,
}: {
  title: string;
  spans: NamedSpan[];
  describe: (s: NamedSpan) => string;
  timeZone?: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-subtle">{title}</p>
      <div className="space-y-1">
        {spans.map((s) => (
          <div
            key={`${s.name}-${s.start.getTime()}`}
            className={`flex flex-wrap items-baseline gap-x-2 rounded-lg px-2.5 py-1.5 ${
              s.current ? "bg-primary-wash ring-1 ring-inset ring-primary-ring" : "bg-surface-3"
            }`}
          >
            <span className="font-mono text-[11px] text-fg-muted">{spanLabel(s, timeZone)}</span>
            <span className="text-xs font-bold text-fg-2">{s.name}</span>
            <span
              className={`rounded-full px-1.5 text-[10px] font-semibold ring-1 ring-inset ${QUALITY_CHIP[s.quality]}`}
            >
              {s.quality}
            </span>
            {s.current && (
              <span className="rounded-full bg-primary-soft px-1.5 text-[10px] font-bold text-heading">
                now
              </span>
            )}
            <span className="w-full text-[11px] leading-relaxed text-fg-faint">{describe(s)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayPartsBlock({ parts, timeZone }: { parts: DayParts; timeZone?: string }) {
  const night = useMemo(() => nightKaalas(parts), [parts]);
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="space-y-3">
      {/* Rise and set */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <h4 className="mb-2.5 flex items-center gap-2 font-serif text-sm font-bold text-heading">
          <Sunrise className="h-4 w-4" /> The day&apos;s frame
        </h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { icon: Sun, label: "Sunrise", value: hm(parts.sunrise, timeZone) },
            { icon: Sun, label: "Sunset", value: hm(parts.sunset, timeZone) },
            {
              icon: Moon,
              label: "Moonrise",
              value: parts.moonrise ? hm(parts.moonrise, timeZone) : "—",
            },
            {
              icon: Moon,
              label: "Moonset",
              value: parts.moonset ? hm(parts.moonset, timeZone) : "—",
            },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-lg bg-surface-3 p-2 text-center">
              <Icon className="mx-auto h-3.5 w-3.5 text-eyebrow" />
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-fg-subtle">{label}</p>
              <p className="font-mono text-sm font-bold text-fg-strong">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-fg-faint">
          {parts.varaName}, ruled by {PLANET_NAMES[parts.varaLord]}. Every division below is an equal share
          of the sunrise-to-sunset arc ({humanDuration(minutesBetween(parts.sunrise, parts.sunset))}) or of
          the night that follows it — not of the civil clock, which is why these times move through the year.
          {parts.moonrise === null || parts.moonset === null
            ? " A missing moonrise or moonset is real: the Moon drifts ~50 minutes later each day, so on roughly one day a month one of the two does not occur."
            : ""}
        </p>
      </div>

      {/* Kaalas */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <h4 className="mb-2.5 flex items-center gap-2 font-serif text-sm font-bold text-heading">
          <TriangleAlert className="h-4 w-4" /> Inauspicious and auspicious windows
        </h4>
        <div className="space-y-2">
          <KaalaRow
            name="Rahu Kaal"
            span={parts.rahuKaal}
            tone="bad"
            note="The eighth of the day assigned to Rahu. The most widely observed of the three: avoid starting anything you want to last — journeys, signings, new work."
            timeZone={timeZone}
          />
          <KaalaRow
            name="Gulika Kaal"
            span={parts.gulikaKaal}
            tone="bad"
            note="Saturn's eighth. Traditionally the heaviest of the three, because what begins in it is held to repeat itself. Also the seat of the upagraha Gulika/Mandi."
            timeZone={timeZone}
          />
          <KaalaRow
            name="Yamaganda"
            span={parts.yamaganda}
            tone="bad"
            note="Jupiter's eighth, read as the knot of the day. Avoid travel and auspicious beginnings; ordinary continuing work is unaffected."
            timeZone={timeZone}
          />
          {parts.abhijitApplies ? (
            <KaalaRow
              name="Abhijit Muhurta"
              span={parts.abhijit}
              tone="good"
              note="The 8th of the day's fifteen muhurtas, centred on true solar noon. The default fallback muhurta: it is held to overcome most ordinary blemishes in the day, and is the one window worth using when nothing better is available."
              timeZone={timeZone}
            />
          ) : (
            <div className="rounded-lg border border-line-soft bg-surface-3 p-2.5">
              <span className="text-xs font-bold text-fg-2">Abhijit Muhurta</span>{" "}
              <span className="text-[11px] text-fg-muted">
                not observed on Wednesday in the common convention — it would otherwise have run{" "}
                {spanLabel(parts.abhijit, timeZone)}.
              </span>
            </div>
          )}
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-fg-faint">
          Night Gulika {spanLabel(night.gulika, timeZone)} · night Yamaganda{" "}
          {spanLabel(night.yamaganda, timeZone)} — the night arc&apos;s eighths are lorded from the 5th
          weekday onward, which is why they do not mirror the daytime ones.
        </p>
      </div>

      {/* Current choghadiya + hora, then the full tables on demand */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <h4 className="mb-2.5 flex items-center gap-2 font-serif text-sm font-bold text-heading">
          <Clock className="h-4 w-4" /> Choghadiya &amp; Hora
        </h4>
        {(parts.currentChoghadiya || parts.currentHora) && (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {parts.currentChoghadiya && (
              <div className="rounded-lg border border-primary-border-soft bg-primary-wash p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-eyebrow">Choghadiya now</p>
                <p className="font-serif text-sm font-bold text-heading">
                  {parts.currentChoghadiya.name}{" "}
                  <span className="font-mono text-[11px] font-normal text-fg-muted">
                    {spanLabel(parts.currentChoghadiya, timeZone)}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-fg">
                  {CHOGHADIYA_MEANING[parts.currentChoghadiya.name]}
                </p>
              </div>
            )}
            {parts.currentHora && (
              <div className="rounded-lg border border-primary-border-soft bg-primary-wash p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-eyebrow">Hora now</p>
                <p className="font-serif text-sm font-bold text-heading">
                  {PLANET_NAMES[parts.currentHora.lord]}{" "}
                  <span className="font-mono text-[11px] font-normal text-fg-muted">
                    {spanLabel(parts.currentHora, timeZone)}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-fg">
                  {HORA_USE[parts.currentHora.lord]}
                </p>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="rounded-lg border border-line-2 bg-surface-2 px-3 py-1.5 text-xs font-semibold text-fg-2 transition hover:bg-inset"
        >
          {showAll ? "Hide" : "Show"} the full sixteen choghadiya and twenty-four horas
        </button>
        {showAll && (
          <div className="mt-3 space-y-3">
            <SpanStrip
              title="Choghadiya — day"
              spans={parts.choghadiyaDay}
              describe={(s) => CHOGHADIYA_MEANING[s.name] ?? ""}
              timeZone={timeZone}
            />
            <SpanStrip
              title="Choghadiya — night"
              spans={parts.choghadiyaNight}
              describe={(s) => CHOGHADIYA_MEANING[s.name] ?? ""}
              timeZone={timeZone}
            />
            <SpanStrip
              title="Hora — day"
              spans={parts.horaDay}
              describe={(s) => HORA_USE[s.lord] ?? ""}
              timeZone={timeZone}
            />
            <SpanStrip
              title="Hora — night"
              spans={parts.horaNight}
              describe={(s) => HORA_USE[s.lord] ?? ""}
              timeZone={timeZone}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function PanchangPanel() {
  const { panchang, chart, ayanamsha, nodeMode, now } = useChart();
  const [scope, setScope] = useState<Scope>("birth");

  const timeZone = chart ? tz(chart) : undefined;
  const hasBirthFrame = Boolean(chart?.birthUtc && chart.lat !== undefined && chart.lon !== undefined);

  // The instant the day-parts and limb timings describe.
  const at = useMemo(
    () => (scope === "birth" && chart?.birthUtc ? chart.birthUtc : now),
    [scope, chart, now]
  );

  const dayParts = useMemo(() => {
    if (!chart || chart.lat === undefined || chart.lon === undefined) return null;
    return computeDayParts(at, chart.lat, chart.lon, timeZone);
  }, [chart, at, timeZone]);

  const limbs = useMemo(() => computeLimbTimings(at, ayanamsha, nodeMode), [at, ayanamsha, nodeMode]);

  if (!chart) return null;
  if (!panchang) {
    return (
      <p className="rounded-xl border border-line bg-surface p-4 text-sm text-fg-muted">
        Panchang requires the birth instant — add date, time and place to compute the five limbs of time.
      </p>
    );
  }

  const group = tithiGroup(limbs.tithi.index);
  const showingBirth = scope === "birth" && hasBirthFrame;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-heading-border bg-primary-wash p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex items-center gap-2 font-serif text-base font-bold text-heading">
            <CalendarDays className="h-4 w-4" /> Panchang
          </h3>
          {hasBirthFrame && (
            <div className="ml-auto flex items-center gap-1 rounded-lg border border-line-2 bg-surface-2 p-1">
              {(["birth", "today"] as Scope[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    scope === s
                      ? "bg-primary-soft text-heading ring-1 ring-inset ring-primary-ring"
                      : "text-fg-muted hover:text-fg-2"
                  }`}
                >
                  {s === "birth" ? "At birth" : "Today"}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-fg-muted">
          {showingBirth
            ? "The five limbs of the birth moment — the energetic signature beneath the chart — followed by how that day was divided."
            : `Today, ${dayLabel(at, timeZone)}, computed for the birth coordinates and timezone. The limbs are the sky right now; the divisions below are today's usable and unusable windows.`}
        </p>
      </div>

      {/* The five limbs, each with its boundaries */}
      <LimbCard
        label="Tithi (Lunar Day)"
        value={`${limbs.tithi.index < 15 ? "Shukla" : "Krishna"} ${limbs.tithi.name}`}
        span={limbs.tithi}
        text={`${showingBirth ? "This native was " : "A moment "}${TITHI_GROUP_TEXT[group]}`}
        at={at}
        timeZone={timeZone}
      />
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-eyebrow">Vara (Solar Day)</span>
          <span className="font-serif text-sm font-bold text-fg-strong">
            {dayParts ? dayParts.varaName : panchang.varaName}
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-fg">
          {VARA_TEXT[dayParts ? dayParts.varaIndex : panchang.varaIndex]}
        </p>
        <p className="mt-1 text-[11px] text-fg-faint">
          The vara runs sunrise to sunrise, not midnight to midnight — a 2 a.m. moment still belongs to the
          previous weekday.
        </p>
      </div>
      <LimbCard
        label="Nakshatra (Moon's Star)"
        value={limbs.nakshatra.name}
        span={limbs.nakshatra}
        text={`Moon in ${limbs.nakshatra.name}: ${NAKSHATRA_QUALITIES[limbs.nakshatra.index]}.`}
        at={at}
        timeZone={timeZone}
      />
      <LimbCard
        label="Yoga (Soli-lunar)"
        value={limbs.yoga.name}
        span={limbs.yoga}
        text={YOGA_TEXT[limbs.yoga.index]}
        at={at}
        timeZone={timeZone}
      />
      <LimbCard
        label="Karana (Half-Tithi)"
        value={limbs.karana.name}
        span={limbs.karana}
        text={KARANA_TEXT[limbs.karana.name] ?? ""}
        at={at}
        timeZone={timeZone}
      />

      {/* Day parts */}
      {dayParts ? (
        <>
          <div className="flex items-center gap-2 pt-1">
            <AlarmClock className="h-4 w-4 text-primary" />
            <h3 className="font-serif text-base font-bold text-heading">
              Day parts — {dayLabel(dayParts.sunrise, timeZone)}
            </h3>
          </div>
          <DayPartsBlock parts={dayParts} timeZone={timeZone} />
        </>
      ) : (
        <p className="rounded-xl border border-line bg-surface p-4 text-xs leading-relaxed text-fg-muted">
          Day parts need a sunrise and a sunset to divide. This chart has no coordinates, or sits at a
          latitude where the Sun did not both rise and set on this date — there is no classical construction
          for an eighth of a day that never ends, so the divisions are omitted rather than approximated.
        </p>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-fg-faint">
        Rahu Kaal is tabulated; Gulika and Yamaganda are derived as Saturn&apos;s and Jupiter&apos;s eighths
        of the day arc under the classical lordship rule, which reproduces the published tables for all seven
        weekdays. Varjyam and Amrit Kaal are deliberately omitted — their per-nakshatra fractions disagree
        across published sources, and guessing them would put invented numbers beside derived ones.
      </p>
    </div>
  );
}
