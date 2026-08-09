"use client";

import { Plus, Trash2 } from "lucide-react";
import { EVENT_RULES, EVENT_TYPES } from "@/utils/astrology/rectification/eventRules";
import { COMFORTABLE_EVENTS, MIN_EVENTS } from "@/utils/astrology/rectification/score";
import type {
  EventType,
  LifeEvent,
  Precision,
  Reliability,
} from "@/utils/astrology/rectification/types";

/**
 * Add, edit and remove the dated life events the sweep is fitted against.
 * Five is the floor; below seven the fit is easy to achieve by chance and the
 * form says so rather than letting the user find out from the result.
 */

const PRECISION_LABEL: Record<Precision, string> = {
  exact: "Exact date",
  month: "Month only",
  year: "Year only",
};

const PRECISION_HINT: Record<Precision, string> = {
  exact: "Scored on the day itself.",
  month: "Scored across four days spread through the month, at 0.8 weight.",
  year: "Scored across all twelve months, at 0.5 weight.",
};

const RELIABILITY_LABEL: Record<Reliability, string> = {
  certain: "Certain",
  probable: "Probable",
  hearsay: "Hearsay",
};

const RELIABILITY_HINT: Record<Reliability, string> = {
  certain: "Full weight — you have a document or a clear memory.",
  probable: "0.75 weight — you are fairly sure.",
  hearsay: "0.4 weight — someone told you.",
};

const field =
  "w-full rounded-lg border border-line-2 bg-surface-2 px-2 py-1.5 text-xs text-fg outline-none transition focus:border-primary-border focus:ring-1 focus:ring-primary-ring";

let seq = 0;
function newId(): string {
  seq += 1;
  return `ev-${Date.now().toString(36)}-${seq}`;
}

export function blankEvent(): LifeEvent {
  return {
    id: newId(),
    type: "marriage",
    dateISO: "",
    precision: "exact",
    reliability: "certain",
  };
}

export default function EventForm({
  events,
  onChange,
}: {
  events: LifeEvent[];
  onChange: (next: LifeEvent[]) => void;
}) {
  const update = (id: string, patch: Partial<LifeEvent>) =>
    onChange(events.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const undated = events.filter((e) => !e.dateISO).length;
  const tooFew = events.length < MIN_EVENTS;
  const uncomfortable = !tooFew && events.length < COMFORTABLE_EVENTS;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {events.map((e, i) => (
          <div key={e.id} className="rounded-lg border border-line-soft bg-surface-3 p-2.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-[10px] text-fg-subtle">{String(i + 1).padStart(2, "0")}</span>
              <select
                value={e.type}
                onChange={(ev) => update(e.id, { type: ev.target.value as EventType })}
                className={`${field} flex-1`}
                aria-label={`Event ${i + 1} type`}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_RULES[t].label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(events.filter((x) => x.id !== e.id))}
                aria-label={`Remove event ${i + 1}`}
                className="shrink-0 rounded p-1 text-fg-subtle transition hover:bg-bad-soft hover:text-bad"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                  Date
                </span>
                <input
                  type="date"
                  value={e.dateISO}
                  onChange={(ev) => update(e.id, { dateISO: ev.target.value })}
                  className={field}
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                  Precision
                </span>
                <select
                  value={e.precision}
                  onChange={(ev) => update(e.id, { precision: ev.target.value as Precision })}
                  className={field}
                  title={PRECISION_HINT[e.precision]}
                >
                  {(Object.keys(PRECISION_LABEL) as Precision[]).map((p) => (
                    <option key={p} value={p}>
                      {PRECISION_LABEL[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                  Reliability
                </span>
                <select
                  value={e.reliability}
                  onChange={(ev) => update(e.id, { reliability: ev.target.value as Reliability })}
                  className={field}
                  title={RELIABILITY_HINT[e.reliability]}
                >
                  {(Object.keys(RELIABILITY_LABEL) as Reliability[]).map((r) => (
                    <option key={r} value={r}>
                      {RELIABILITY_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <input
              type="text"
              value={e.note ?? ""}
              onChange={(ev) => update(e.id, { note: ev.target.value })}
              placeholder="Note (optional) — what happened, for your own reference"
              className={`${field} mt-2`}
            />
            <p className="mt-1 text-[10px] leading-relaxed text-fg-subtle">
              {PRECISION_HINT[e.precision]} {RELIABILITY_HINT[e.reliability]} Reads the{" "}
              {EVENT_RULES[e.type].primaryHouses
                .map((h) => (h.from ? `${h.house}th from the ${h.from}th` : `${h.house}th`))
                .join(" and ")}
              , karaka {EVENT_RULES[e.type].karakas.join("/")}.
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...events, blankEvent()])}
        disabled={events.length >= 10}
        className="flex items-center gap-1.5 rounded-lg border border-primary-border-soft bg-primary-wash px-3 py-1.5 text-xs font-semibold text-heading transition hover:bg-primary-wash-2 disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" /> Add event
      </button>

      {tooFew && (
        <p className="rounded-lg border border-bad-border bg-bad-wash px-3 py-2 text-xs text-bad-2">
          At least {MIN_EVENTS} dated events are needed before a sweep means anything — {events.length}{" "}
          entered.
        </p>
      )}
      {uncomfortable && (
        <p className="rounded-lg border border-warn-ring bg-warn-soft px-3 py-2 text-xs text-warn">
          {events.length} events against 31 candidate minutes. Below {COMFORTABLE_EVENTS} a
          convincing-looking peak can be pure noise — add more if you can.
        </p>
      )}
      {undated > 0 && (
        <p className="text-xs text-fg-muted">
          {undated} event{undated === 1 ? "" : "s"} still need a date.
        </p>
      )}
    </div>
  );
}
