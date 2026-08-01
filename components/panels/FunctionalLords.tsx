"use client";

import { Shield, Swords, Scale } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { FUNCTIONAL_ROLES, marakasFor } from "@/data/interpretations/lordships";
import { PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";

/** Sidebar: functional benefics / malefics / neutrals for the running Lagna. */
export default function FunctionalLords() {
  const { chart } = useChart();
  if (!chart) return null;
  const lagna = chart.ascendant.sign;
  const roles = FUNCTIONAL_ROLES[lagna];
  const marakas = marakasFor(lagna);

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h3 className="mb-3 font-serif text-sm font-bold text-heading">
        Functional Roles — {SIGNS[lagna]} Lagna
      </h3>
      <div className="space-y-2.5 text-xs">
        <div className="flex items-start gap-2">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good-strong" />
          <div>
            <span className="font-semibold text-good">Functional Benefics: </span>
            <span className="text-fg">
              {roles.benefics.map((p) => PLANET_NAMES[p]).join(", ")}
              {roles.yogakaraka && (
                <span className="text-heading"> · Yogakaraka: {PLANET_NAMES[roles.yogakaraka]}</span>
              )}
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Swords className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bad-strong" />
          <div>
            <span className="font-semibold text-bad">Functional Malefics: </span>
            <span className="text-fg">{roles.malefics.map((p) => PLANET_NAMES[p]).join(", ")}</span>
            <span className="text-fg-muted"> · Marakas: {marakas.map((p) => PLANET_NAMES[p]).join(", ")}</span>
          </div>
        </div>
        {roles.neutrals.length > 0 && (
          <div className="flex items-start gap-2">
            <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted" />
            <div>
              <span className="font-semibold text-fg">Neutral: </span>
              <span className="text-fg">{roles.neutrals.map((p) => PLANET_NAMES[p]).join(", ")}</span>
            </div>
          </div>
        )}
        <p className="border-t border-line-faint pt-2 leading-relaxed text-fg-muted">{roles.note}</p>
      </div>
    </div>
  );
}
