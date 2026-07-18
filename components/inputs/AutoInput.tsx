"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import type { GeoPlace } from "@/utils/astrology/types";
import CitySearch from "./CitySearch";

/** Mode 2: automatic ephemeris calculation from birth data. */
export default function AutoInput() {
  const { commitAuto } = useChart();
  const [name, setName] = useState("");
  const [dateISO, setDateISO] = useState("1990-01-01");
  const [time, setTime] = useState("12:00");
  const [place, setPlace] = useState<GeoPlace | null>(null);

  const ready = Boolean(dateISO && time && place);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) commitAuto({ name, dateISO, time, place });
      }}
      className="space-y-3"
    >
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-amber-500/80">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Native's name (optional)"
          className="w-full rounded-lg border border-indigo-800/60 bg-indigo-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-amber-500/80">
            Date of Birth
          </label>
          <input
            type="date"
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value)}
            required
            className="w-full rounded-lg border border-indigo-800/60 bg-indigo-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500/60 [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-amber-500/80">
            Time of Birth
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="w-full rounded-lg border border-indigo-800/60 bg-indigo-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500/60 [color-scheme:dark]"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-amber-500/80">
          Place of Birth
        </label>
        <CitySearch value={place} onSelect={setPlace} />
      </div>
      <button
        type="submit"
        disabled={!ready}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2.5 text-sm font-semibold text-indigo-950 shadow-lg shadow-amber-900/30 transition hover:from-amber-500 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Sparkles className="h-4 w-4" />
        Calculate Chart
      </button>
    </form>
  );
}
