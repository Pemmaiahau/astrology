"use client";

import { useState } from "react";
import { Compass } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { PLANETS, PLANET_NAMES, SIGNS, SIGNS_SANSKRIT } from "@/utils/astrology/constants";
import type { GeoPlace, ManualPlanetInput } from "@/utils/astrology/types";
import CitySearch from "./CitySearch";

const DEFAULT_PLANETS: ManualPlanetInput[] = PLANETS.map((id) => ({
  id,
  house: 1,
  deg: 15,
  retro: false,
}));

/** Mode 1: direct astrological configuration. */
export default function ManualInput() {
  const { commitManual } = useChart();
  const [lagnaSign, setLagnaSign] = useState(0);
  const [ascDeg, setAscDeg] = useState(15);
  const [planets, setPlanets] = useState<ManualPlanetInput[]>(DEFAULT_PLANETS);
  const [dateISO, setDateISO] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState<GeoPlace | null>(null);

  function update(idx: number, patch: Partial<ManualPlanetInput>) {
    setPlanets((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commitManual({
          lagnaSign,
          ascDeg,
          planets,
          anchor: { dateISO, time, place },
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-amber-500/80">
            Ascendant (Lagna)
          </label>
          <select
            value={lagnaSign}
            onChange={(e) => setLagnaSign(Number(e.target.value))}
            className="w-full rounded-lg border border-indigo-800/60 bg-indigo-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500/60"
          >
            {SIGNS.map((s, i) => (
              <option key={s} value={i}>
                {s} ({SIGNS_SANSKRIT[i]})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-amber-500/80">
            Asc Degree (0–30)
          </label>
          <input
            type="number"
            min={0}
            max={29.99}
            step={0.01}
            value={ascDeg}
            onChange={(e) => setAscDeg(Number(e.target.value))}
            className="w-full rounded-lg border border-indigo-800/60 bg-indigo-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500/60"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-indigo-800/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-indigo-900/50 text-left text-xs uppercase tracking-wider text-amber-500/80">
              <th className="px-2 py-2">Graha</th>
              <th className="px-2 py-2">House</th>
              <th className="px-2 py-2">Degree</th>
              <th className="px-2 py-2 text-center">R</th>
            </tr>
          </thead>
          <tbody>
            {planets.map((p, i) => (
              <tr key={p.id} className="border-t border-indigo-900/50 bg-indigo-950/40">
                <td className="px-2 py-1.5 font-medium text-slate-200">{PLANET_NAMES[p.id]}</td>
                <td className="px-2 py-1.5">
                  <select
                    value={p.house}
                    onChange={(e) => update(i, { house: Number(e.target.value) })}
                    className="w-full rounded border border-indigo-800/60 bg-indigo-950 px-1.5 py-1 text-xs text-slate-100 outline-none focus:border-amber-500/60"
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
                    className="w-20 rounded border border-indigo-800/60 bg-indigo-950 px-1.5 py-1 text-xs text-slate-100 outline-none focus:border-amber-500/60"
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
                    <span className="text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <fieldset className="rounded-lg border border-indigo-800/60 p-3">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-amber-500/80">
          Dasha Anchor — Birth Date, Time &amp; Place
        </legend>
        <p className="mb-2 text-xs text-slate-400">
          Used only to anchor Vimshottari timelines and Bhava Chalit cusps to your manually mapped degrees.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value)}
            className="w-full rounded-lg border border-indigo-800/60 bg-indigo-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500/60 [color-scheme:dark]"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-lg border border-indigo-800/60 bg-indigo-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500/60 [color-scheme:dark]"
          />
        </div>
        <div className="mt-3">
          <CitySearch value={place} onSelect={setPlace} placeholder="Place of birth (for timezone)…" />
        </div>
      </fieldset>

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2.5 text-sm font-semibold text-indigo-950 shadow-lg shadow-amber-900/30 transition hover:from-amber-500 hover:to-amber-400"
      >
        <Compass className="h-4 w-4" />
        Cast Chart
      </button>
    </form>
  );
}
