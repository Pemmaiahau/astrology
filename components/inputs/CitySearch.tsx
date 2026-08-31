"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, PencilLine, WifiOff } from "lucide-react";
import type { GeoPlace } from "@/utils/astrology/types";
import { checkCoordinates } from "@/utils/astrology/validate";
import ValidationNotes from "./ValidationNotes";

interface Props {
  value: GeoPlace | null;
  onSelect: (p: GeoPlace | null) => void;
  placeholder?: string;
}

const CACHE_KEY = "jyotisha.geocache.v1";

/**
 * Remember successful lookups so a place used before still resolves when the
 * geocoder is unreachable. Keyed by the lowercased query prefix; capped so the
 * store cannot grow without bound. Every access is wrapped because
 * `localStorage` throws outright in some privacy modes rather than returning
 * null.
 */
function cacheResults(q: string, results: OpenMeteoResult[]): void {
  if (results.length === 0) return;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const store: Record<string, OpenMeteoResult[]> = raw ? JSON.parse(raw) : {};
    store[q.trim().toLowerCase()] = results.slice(0, 8);
    const keys = Object.keys(store);
    if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete store[k];
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable — the cache is a convenience, never a requirement */
  }
}

function readCache(q: string): OpenMeteoResult[] {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const store: Record<string, OpenMeteoResult[]> = JSON.parse(raw);
    const needle = q.trim().toLowerCase();
    const exact = store[needle];
    if (exact) return exact;
    // Any cached query that starts with, or is a prefix of, this one.
    for (const [k, v] of Object.entries(store)) {
      if (k.startsWith(needle) || needle.startsWith(k)) return v;
    }
    return [];
  } catch {
    return [];
  }
}

/** Does the runtime recognise this IANA zone? */
function isKnownTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

interface OpenMeteoResult {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

/**
 * City autocomplete via the Open-Meteo geocoding API (no key required),
 * with a manual coordinate fallback.
 *
 * The geocoder is this app's only external runtime dependency, and it used to
 * fail silently: the catch reset the results to an empty array, which renders
 * identically to "no city matched". Because `place` is required before a chart
 * can be cast, an outage, a proxy or a blocked host made the entire ephemeris
 * mode unusable with no diagnosis and no workaround.
 *
 * Two changes: the error state is now distinct from the empty state and says
 * what failed, and there is a manual latitude/longitude/timezone panel that
 * bypasses the network entirely. Successful lookups are cached in
 * `localStorage`, so a place used before keeps working offline.
 */
export default function CitySearch({ value, onSelect, placeholder }: Props) {
  const [query, setQuery] = useState(value ? value.name : "");
  const [results, setResults] = useState<OpenMeteoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [manual, setManual] = useState(false);
  const [mLat, setMLat] = useState("");
  const [mLon, setMLon] = useState("");
  const [mTz, setMTz] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  });
  const [mName, setMName] = useState("");
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
      setFailed(false);
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`
        );
        if (!res.ok) throw new Error(`geocoder returned ${res.status}`);
        const json = await res.json();
        const found: OpenMeteoResult[] = json.results ?? [];
        setResults(found);
        setOpen(true);
        cacheResults(q, found);
      } catch {
        // Fall back to anything this browser has seen before for the same
        // prefix, so a previously-used place still resolves offline.
        const cached = readCache(q);
        setResults(cached);
        setOpen(cached.length > 0);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  const manualIssues = manual
    ? [
        ...checkCoordinates(Number(mLat), Number(mLon)),
        ...(mTz.trim() && !isKnownTimeZone(mTz.trim())
          ? [
              {
                severity: "error" as const,
                field: "tz",
                message:
                  `"${mTz}" is not an IANA timezone this browser recognises. Use a zone name such as ` +
                  `Asia/Kolkata, Europe/London or America/New_York — an abbreviation like IST or a raw ` +
                  `offset will not carry the historical rules that a birth chart depends on.`,
              },
            ]
          : []),
      ]
    : [];

  function commitManual() {
    const lat = Number(mLat);
    const lon = Number(mLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (manualIssues.some((i) => i.severity === "error")) return;
    const place: GeoPlace = {
      name: mName.trim() || `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
      lat,
      lon,
      timezone: mTz.trim() || "UTC",
    };
    setQuery(place.name);
    setManual(false);
    onSelect(place);
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
      {failed && (
        <p className="mt-1 flex items-start gap-1.5 rounded-lg border border-warn-ring bg-warn-soft p-2 text-[11px] leading-relaxed text-fg">
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
          <span>
            The place lookup could not be reached
            {results.length > 0 ? " — showing previously cached matches for this search" : ""}. This is the
            app&apos;s only network dependency; everything else computes locally. Enter the coordinates by
            hand below to carry on.
          </span>
        </p>
      )}

      {!manual ? (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="mt-1 flex items-center gap-1 text-[11px] font-medium text-eyebrow underline-offset-2 hover:underline"
        >
          <PencilLine className="h-3 w-3" />
          Enter coordinates manually
        </button>
      ) : (
        <div className="mt-2 space-y-2 rounded-lg border border-line-2 bg-surface-2 p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-eyebrow">Manual coordinates</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-fg-subtle">Latitude (+N)</span>
              <input
                type="number"
                step="any"
                value={mLat}
                onChange={(e) => setMLat(e.target.value)}
                placeholder="28.6139"
                className="w-full rounded-md border border-line-2 bg-surface px-2 py-1.5 text-xs text-fg-strong outline-none focus:border-primary-border"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-fg-subtle">Longitude (+E)</span>
              <input
                type="number"
                step="any"
                value={mLon}
                onChange={(e) => setMLon(e.target.value)}
                placeholder="77.2090"
                className="w-full rounded-md border border-line-2 bg-surface px-2 py-1.5 text-xs text-fg-strong outline-none focus:border-primary-border"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-0.5 block text-[10px] text-fg-subtle">IANA timezone</span>
            <input
              type="text"
              value={mTz}
              onChange={(e) => setMTz(e.target.value)}
              placeholder="Asia/Kolkata"
              className="w-full rounded-md border border-line-2 bg-surface px-2 py-1.5 text-xs text-fg-strong outline-none focus:border-primary-border"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] text-fg-subtle">Place label (optional)</span>
            <input
              type="text"
              value={mName}
              onChange={(e) => setMName(e.target.value)}
              placeholder="New Delhi"
              className="w-full rounded-md border border-line-2 bg-surface px-2 py-1.5 text-xs text-fg-strong outline-none focus:border-primary-border"
            />
          </label>
          <ValidationNotes issues={manualIssues} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={commitManual}
              disabled={!mLat || !mLon || manualIssues.some((i) => i.severity === "error")}
              className="rounded-md bg-primary-soft px-3 py-1.5 text-xs font-semibold text-heading ring-1 ring-inset ring-primary-ring transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Use these coordinates
            </button>
            <button
              type="button"
              onClick={() => setManual(false)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-fg-muted hover:text-fg-2"
            >
              Cancel
            </button>
          </div>
          <p className="text-[10px] leading-relaxed text-fg-faint">
            The timezone must be an IANA name, not an offset: historical rules matter. Asia/Kolkata carries
            the +05:53 Calcutta local mean time used before 1906 and the 1942–45 wartime changes, and a raw
            &ldquo;+5:30&rdquo; would silently discard both.
          </p>
        </div>
      )}

      {value && (
        <p className="mt-1 text-xs text-good-strong">
          ✓ {value.lat.toFixed(4)}°, {value.lon.toFixed(4)}° — {value.timezone} (historical DST handled)
        </p>
      )}
    </div>
  );
}
