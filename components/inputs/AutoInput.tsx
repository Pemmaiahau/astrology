"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import type { Gender, GeoPlace } from "@/utils/astrology/types";
import CitySearch from "./CitySearch";
import ValidationNotes from "./ValidationNotes";
import { localToUtc } from "@/utils/astrology/time";
import {
  checkBirthDate,
  checkCoordinates,
  checkLocalTime,
  DATE_MAX,
  DATE_MIN,
} from "@/utils/astrology/validate";

/** Mode 2: automatic ephemeris calculation from birth data. */
export default function AutoInput() {
  const { commitAuto, committed } = useChart();
  // Seed from a restored session so a reload shows the form that produced the
  // chart on screen, not a form full of defaults beside it.
  const saved = committed?.kind === "auto" ? committed.data : null;
  const [name, setName] = useState(saved?.name ?? "");
  const [gender, setGender] = useState<Gender | "">(saved?.gender ?? "");
  const [dateISO, setDateISO] = useState(saved?.dateISO ?? "1990-01-01");
  const [time, setTime] = useState(saved?.time ?? "12:00");
  const [place, setPlace] = useState<GeoPlace | null>(saved?.place ?? null);

  /**
   * Input validation runs on every keystroke rather than on submit.
   *
   * A birth date outside the ayanamsha's validity window used to produce a
   * confidently-formatted, silently wrong chart; a clock change beside the
   * recorded time was never mentioned at all. Both are cheap to detect and
   * useless to report after the fact, so they are reported while the field is
   * still being edited.
   */
  const issues = useMemo(() => {
    const out = [...checkBirthDate(dateISO)];
    if (place) {
      out.push(...checkCoordinates(place.lat, place.lon));
      if (dateISO && time && out.every((i) => i.severity !== "error")) {
        try {
          out.push(...checkLocalTime(place.timezone, dateISO, time, localToUtc(place.timezone, dateISO, time)));
        } catch {
          /* an unusable zone is already reported by checkCoordinates/CitySearch */
        }
      }
    }
    return out;
  }, [dateISO, time, place]);

  const blocked = issues.some((i) => i.severity === "error");
  const ready = Boolean(dateISO && time && place) && !blocked;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) commitAuto({ name, dateISO, time, place, gender: gender || undefined });
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-eyebrow">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Native's name (optional)"
            className="w-full rounded-lg border border-line-2 bg-surface-2 px-3 py-2 text-sm text-fg-strong placeholder-fg-subtle outline-none focus:border-primary-border focus:ring-1 focus:ring-primary-ring-soft"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-eyebrow">Gender</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender | "")}
            className="w-full rounded-lg border border-line-2 bg-surface-2 px-3 py-2 text-sm text-fg-strong outline-none focus:border-primary-border"
            title="Optional — used only where classical rules differ by gender (marriage karakas, Kua number)"
          >
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-eyebrow">
            Date of Birth
          </label>
          <input
            type="date"
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value)}
            required
            min={DATE_MIN}
            max={DATE_MAX}
            className="w-full rounded-lg border border-line-2 bg-surface-2 px-3 py-2 text-sm text-fg-strong outline-none focus:border-primary-border"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-eyebrow">
            Time of Birth
          </label>
          <input
            type="time"
            step="60"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="w-full rounded-lg border border-line-2 bg-surface-2 px-3 py-2 text-sm text-fg-strong outline-none focus:border-primary-border"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-eyebrow">
          Place of Birth
        </label>
        <CitySearch value={place} onSelect={setPlace} />
      </div>
      <ValidationNotes issues={issues} />
      <button
        type="submit"
        disabled={!ready}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cta-from to-cta-to px-4 py-2.5 text-sm font-semibold text-cta-fg shadow-lg shadow-cta-shadow transition hover:from-cta-from-hover hover:to-cta-to-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Sparkles className="h-4 w-4" />
        Calculate Chart
      </button>
    </form>
  );
}
