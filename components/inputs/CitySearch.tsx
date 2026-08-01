"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import type { GeoPlace } from "@/utils/astrology/types";

interface Props {
  value: GeoPlace | null;
  onSelect: (p: GeoPlace | null) => void;
  placeholder?: string;
}

interface OpenMeteoResult {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

/** City autocomplete via the Open-Meteo geocoding API (no key required). */
export default function CitySearch({ value, onSelect, placeholder }: Props) {
  const [query, setQuery] = useState(value ? value.name : "");
  const [results, setResults] = useState<OpenMeteoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function search(q: string) {
    setQuery(q);
    onSelect(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`
        );
        const json = await res.json();
        setResults(json.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function pick(r: OpenMeteoResult) {
    const place: GeoPlace = {
      name: r.name,
      admin: r.admin1,
      country: r.country,
      lat: r.latitude,
      lon: r.longitude,
      timezone: r.timezone,
    };
    setQuery([r.name, r.admin1, r.country].filter(Boolean).join(", "));
    setResults([]);
    setOpen(false);
    onSelect(place);
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-eyebrow" />
        <input
          type="text"
          value={query}
          onChange={(e) => search(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Search city of birth…"}
          className="w-full rounded-lg border border-line-2 bg-surface-2 py-2 pl-9 pr-9 text-sm text-fg-strong placeholder-fg-subtle outline-none transition focus:border-primary-border focus:ring-1 focus:ring-primary-ring-soft"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-eyebrow" />
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line-2 bg-surface-solid shadow-xl shadow-chart-shadow">
          {results.map((r, i) => (
            <li key={`${r.name}-${r.latitude}-${i}`}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-inset-2"
              >
                <span className="text-fg-strong">
                  {r.name}
                  {r.admin1 ? `, ${r.admin1}` : ""}
                </span>
                <span className="text-xs text-fg-muted">
                  {r.country} · {r.latitude.toFixed(2)}°, {r.longitude.toFixed(2)}° · {r.timezone}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {value && (
        <p className="mt-1 text-xs text-good-strong">
          ✓ {value.lat.toFixed(4)}°, {value.lon.toFixed(4)}° — {value.timezone} (historical DST handled)
        </p>
      )}
    </div>
  );
}
