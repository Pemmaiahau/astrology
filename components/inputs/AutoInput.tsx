"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import type { Gender, GeoPlace } from "@/utils/astrology/types";
import CitySearch from "./CitySearch";

/** Mode 2: automatic ephemeris calculation from birth data. */
export default function AutoInput() {
  const { commitAuto } = useChart();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [dateISO, setDateISO] = useState("1990-01-01");
  const [time, setTime] = useState("12:00");
  const [place, setPlace] = useState<GeoPlace | null>(null);

  const ready = Boolean(dateISO && time && place);

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
            className="w-full rounded-lg border border-line-2 bg-surface-2 px-3 py-2 text-sm text-fg-strong outline-none focus:border-primary-border"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-eyebrow">
            Time of Birth
          </label>
          <input
            type="time"
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
