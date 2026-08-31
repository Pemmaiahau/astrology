"use client";

import { useMemo, useState } from "react";
import { Compass, Link2 } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { PLANETS, PLANET_NAMES, SIGNS, SIGNS_SANSKRIT } from "@/utils/astrology/constants";
import type { Gender, GeoPlace, ManualPlanetInput } from "@/utils/astrology/types";
import CitySearch from "./CitySearch";
import ValidationNotes from "./ValidationNotes";
import {
  checkBirthDate,
  DATE_MAX,
  DATE_MIN,
  ketuFromRahu,
  validateManualChart,
} from "@/utils/astrology/validate";

const DEFAULT_PLANETS: ManualPlanetInput[] = PLANETS.map((id) => ({
  id,
  house: 1,
  deg: 15,
  retro: false,
}));

/** Mode 1: direct astrological configuration. */
export default function ManualInput() {
  const { commitManual, committed } = useChart();
  // Seed from a restored session — see the note in AutoInput.
  const saved = committed?.kind === "manual" ? committed.data : null;
  const [lagnaSign, setLagnaSign] = useState(saved?.lagnaSign ?? 0);
  const [ascDeg, setAscDeg] = useState(saved?.ascDeg ?? 15);
  const [planets, setPlanets] = useState<ManualPlanetInput[]>(saved?.planets ?? DEFAULT_PLANETS);
  const [dateISO, setDateISO] = useState(saved?.anchor.dateISO ?? "");
  const [time, setTime] = useState(saved?.anchor.time ?? "");
  const [place, setPlace] = useState<GeoPlace | null>(saved?.anchor.place ?? null);
  const [name, setName] = useState(saved?.name ?? "");
  const [gender, setGender] = useState<Gender | "">(saved?.gender ?? "");

  function update(idx: number, patch: Partial<ManualPlanetInput>) {
    setPlanets((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  /** Snap Ketu onto the opposite end of Rahu's axis. */
  function deriveKetu() {
    setPlanets((prev) => {
      const ra = prev.find((p) => p.id === "Ra");
      if (!ra) return prev;
      const ke = ketuFromRahu(ra.house, ra.deg);
      return prev.map((p) => (p.id === "Ke" ? { ...p, ...ke } : p));
    });
  }

  /**
   * Plausibility of the hand-entered chart, recomputed as it is edited.
   *
   * These are warnings rather than blocks: a chart copied from a printed
   * almanac can legitimately disagree with the ephemeris by a degree or two,
   * and refusing to compute it would break a real workflow. Only structurally
   * impossible input (a duplicate graha, a degree outside its sign, a date
   * outside the ayanamsha's validity) is treated as an error.
   */
  const issues = useMemo(() => {
    const out = validateManualChart({
      lagnaSign,
      ascDeg,
      planets,
      anchor: { dateISO, time, place },
      name: name || undefined,
      gender: gender || undefined,
    });
    if (dateISO) out.push(...checkBirthDate(dateISO));
    return out;
  }, [lagnaSign, ascDeg, planets, dateISO, time, place, name, gender]);

  const nodalBroken = issues.some((i) => i.field === "Ke" && i.message.includes("apart"));
  const blocked = issues.some((i) => i.severity === "error");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commitManual({
          lagnaSign,
          ascDeg,
          planets,
          anchor: { dateISO, time, place },
          name: name || undefined,
          gender: gender || undefined,
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-eyebrow">
            Ascendant (Lagna)
          </label>
          <select
            value={lagnaSign}
            onChange={(e) => setLagnaSign(Number(e.target.value))}
            className="w-full rounded-lg border border-line-2 bg-surface-2 px-3 py-2 text-sm text-fg-strong outline-none focus:border-primary-border"
          >
            {SIGNS.map((s, i) => (
              <option key={s} value={i}>
                {s} ({SIGNS_SANSKRIT[i]})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-eyebrow">
            Asc Degree (0–30)
          </label>
          <input
            type="number"
            min={0}
            max={29.99}
            step={0.01}
            value={ascDeg}
            onChange={(e) => setAscDeg(Number(e.target.value))}
            className="w-full rounded-lg border border-line-2 bg-surface-2 px-3 py-2 text-sm text-fg-strong outline-none focus:border-primary-border"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-inset text-left text-xs uppercase tracking-wider text-eyebrow">
              <th className="px-2 py-2">Graha</th>
              <th className="px-2 py-2">House</th>
              <th className="px-2 py-2">Degree</th>
              <th className="px-2 py-2 text-center">R</th>
            </tr>
          </thead>
          <tbody>
            {planets.map((p, i) => (
              <tr key={p.id} className="border-t border-line-faint bg-surface">
                <td className="px-2 py-1.5 font-medium text-fg-2">{PLANET_NAMES[p.id]}</td>
                <td className="px-2 py-1.5">
                  <select
                    value={p.house}
                    onChange={(e) => update(i, { house: Number(e.target.value) })}
                    className="w-full rounded border border-line-2 bg-surface-solid px-1.5 py-1 text-xs text-fg-strong outline-none focus:border-primary-border"
                  >
                    {Array.from({ length: 12 }, (_, h) => (
                      <option key={h + 1} value={h + 1}>
                        H{h + 1} — {SIGNS[(lagnaSign + h) % 12]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={0}
                    max={29.99}
                    step={0.01}
                    value={p.deg}
                    onChange={(e) => update(i, { deg: Number(e.target.value) })}
                    className="w-20 rounded border border-line-2 bg-surface-solid px-1.5 py-1 text-xs text-fg-strong outline-none focus:border-primary-border"
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  {p.id !== "Ra" && p.id !== "Ke" && p.id !== "Su" && p.id !== "Mo" ? (
                    <input
                      type="checkbox"
                      checked={p.retro}
                      onChange={(e) => update(i, { retro: e.target.checked })}
                      className="h-3.5 w-3.5 accent-amber-500"
                    />
                  ) : (
                    <span className="text-fg-faint">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <fieldset className="rounded-lg border border-line-2 p-3">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-eyebrow">
          Dasha Anchor — Birth Date, Time &amp; Place
        </legend>
        <p className="mb-2 text-xs text-fg-muted">
          Used only to anchor Vimshottari timelines and Bhava Chalit cusps to your manually mapped degrees.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value)}
            min={DATE_MIN}
            max={DATE_MAX}
            className="w-full rounded-lg border border-line-2 bg-surface-2 px-3 py-2 text-sm text-fg-strong outline-none focus:border-primary-border"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-lg border border-line-2 bg-surface-2 px-3 py-2 text-sm text-fg-strong outline-none focus:border-primary-border"
          />
        </div>
        <div className="mt-3">
          <CitySearch value={place} onSelect={setPlace} placeholder="Place of birth (for timezone)…" />
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Native's name (optional)"
            className="w-full rounded-lg border border-line-2 bg-surface-2 px-3 py-2 text-sm text-fg-strong placeholder-fg-subtle outline-none focus:border-primary-border"
          />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender | "")}
            className="w-full rounded-lg border border-line-2 bg-surface-2 px-3 py-2 text-sm text-fg-strong outline-none focus:border-primary-border"
            title="Optional — used only where classical rules differ by gender"
          >
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
      </fieldset>

      <ValidationNotes issues={issues} />

      {nodalBroken && (
        <button
          type="button"
          onClick={deriveKetu}
          className="flex items-center gap-1.5 rounded-lg border border-primary-border-soft bg-primary-wash px-3 py-1.5 text-xs font-semibold text-heading transition hover:bg-primary-soft"
        >
          <Link2 className="h-3.5 w-3.5" />
          Derive Ketu from Rahu (opposite house, same degree)
        </button>
      )}

      <button
        type="submit"
        disabled={blocked}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cta-from to-cta-to px-4 py-2.5 text-sm font-semibold text-cta-fg shadow-lg shadow-cta-shadow transition hover:from-cta-from-hover hover:to-cta-to-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Compass className="h-4 w-4" />
        Cast Chart
      </button>
    </form>
  );
}
