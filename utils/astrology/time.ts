/**
 * Timezone handling via the browser's ICU database: converts a civil local
 * time in an IANA zone to a UTC instant, respecting historical DST rules.
 */

function tzOffsetMs(timeZone: string, utcDate: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(utcDate)) parts[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - utcDate.getTime();
}

export function localToUtc(timeZone: string, dateISO: string, time: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0);
  let guess = new Date(naive);
  // Two iterations converge for all real-world zones
  for (let i = 0; i < 3; i++) {
    const off = tzOffsetMs(timeZone, guess);
    guess = new Date(naive - off);
  }
  return guess;
}

/**
 * Signed UTC offset of a zone at an instant, in minutes. Exposed because
 * rectification has to *judge* the offset it was given — a pre-1955 Indian LMT
 * offset or a DST transition inside the search window destroys a rectification
 * more thoroughly than any astrological error.
 */
export function tzOffsetMinutes(timeZone: string, utcDate: Date): number {
  // `tzOffsetMs` rebuilds the zoned time from formatted parts at SECOND
  // resolution, so any milliseconds on `utcDate` survive as noise in the
  // difference. Rounding to the whole minute removes it — and every real zone
  // offset, including the pre-1906 LMT ones (Asia/Calcutta +05:53), is a whole
  // number of minutes anyway.
  return Math.round(tzOffsetMs(timeZone, utcDate) / 60000);
}

export function utcOffsetLabel(timeZone: string, utcDate: Date): string {
  const off = tzOffsetMinutes(timeZone, utcDate);
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
