"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";

/**
 * Downloads the whole cast chart as one Markdown document.
 *
 * The builder and the two gated report modules are imported at click time
 * rather than at module scope. Between them they pull in the divisional,
 * Shadbala and interpretation layers — none of which the entry form needs to
 * render — and the two gated modules alone are ~150 KB of source that a
 * session which never opens the gate must not pay for. Splitting here keeps
 * the input card's cost unchanged for every visitor and moves the whole export
 * into a chunk fetched only when someone actually asks for the file.
 */
export default function DownloadReport() {
  const ctx = useChart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { chart } = ctx;
  if (!chart) return null;

  async function download() {
    if (!chart) return;
    setBusy(true);
    setError(null);
    try {
      const { buildMarkdownReport, markdownReportFilename } = await import(
        "@/utils/export/markdownReport"
      );

      const {
        ayanamsha, nodeMode, dashaTree, activeDasha, transits, sadeSati,
        ashtakavarga, yogas, strengths, vargas, jaimini, shadbala, bhavaBala,
        advancedUnlocked, now,
      } = ctx;

      // Built here, not inside the builder, so the gated modules stay out of
      // the export chunk for sessions that cannot open those sections.
      let speculation = null;
      let intimacy = null;
      if (advancedUnlocked) {
        const [{ buildSpeculationReport }, { buildIntimacyReport }] = await Promise.all([
          import("@/data/interpretations/speculation"),
          import("@/data/interpretations/intimacy"),
        ]);
        speculation = buildSpeculationReport(
          chart, vargas, jaimini, shadbala, strengths, ashtakavarga, yogas, bhavaBala
        );
        intimacy = buildIntimacyReport(
          chart, vargas, jaimini, shadbala, strengths, yogas, ashtakavarga, bhavaBala
        );
      }

      const markdown = buildMarkdownReport({
        chart, ayanamsha, nodeMode, dashaTree, activeDasha, transits, sadeSati,
        ashtakavarga, yogas, vargas, jaimini, shadbala, bhavaBala,
        speculation, intimacy, generatedAt: now,
      });

      const url = URL.createObjectURL(
        new Blob([markdown], { type: "text/markdown;charset=utf-8" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = markdownReportFilename(chart);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        `The report could not be built: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-1.5">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary-border-soft bg-primary-wash px-4 py-2.5 text-sm font-semibold text-heading transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? "Building report…" : "Download Chart as Markdown (.md)"}
      </button>
      <p className="text-[11px] leading-relaxed text-fg-faint">
        Every computed layer — positions, panchang, vargas, yogas, doshas, Shadbala, Ashtakavarga,
        Jaimini and the full Vimshottari tree — as one Markdown file you can hand to an AI assistant.
      </p>
      {error && <p className="text-[11px] leading-relaxed text-bad-strong">{error}</p>}
    </div>
  );
}
