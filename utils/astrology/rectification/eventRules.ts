/**
 * The event→bhava table lives in `data/rectification/eventRules.ts` alongside
 * the other declarative content tables (`AREA_CONFIGS`, `FUNCTIONAL_ROLES`).
 * This re-export is the seam the calculation modules import from, so a future
 * move of the table does not ripple through the fitness modules.
 */
export {
  EVENT_LABELS,
  EVENT_RULES,
  EVENT_TYPES,
  NAISARGIKA_ROLE,
  describeHouse,
  resolveHouse,
  resolveHouses,
  type EventRule,
  type HouseRef,
  type TransitExpectation,
} from "@/data/rectification/eventRules";
