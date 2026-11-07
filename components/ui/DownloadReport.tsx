"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { logChartExport } from "@/utils/log/chartLog";

/**
 * Downloads the whole cast chart as one Markdown document, or as a PDF of that
 * same document with the charts drawn in.
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
  const [busy, setBusy] = useState<"md" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { chart } = ctx;
  if (!chart) return null;

  async function download(format: "md" | "pdf") {
    if (!chart) return;
    setBusy(format);
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

      // Export-only expert layers (Sookshma, Yogini/Chara dasha, special
      // points, extended yogas, full gochara). They scan ephemerides over
      // years, so they run here, on demand, never on the context cascade.
      const { buildExpertLayers } = await import("@/utils/export/expertLayers");
      const expert = buildExpertLayers({
        chart, ayanamsha, nodeMode, now, dashaTree, activeDasha, ashtakavarga, jaimini,
      });

      const markdown = buildMarkdownReport({
        chart, ayanamsha, nodeMode, dashaTree, activeDasha, transits, sadeSati,
        ashtakavarga, yogas, vargas, jaimini, shadbala, bhavaBala,
        speculation, intimacy, expert, generatedAt: now,
      });

      let file: Blob;
      let filename = markdownReportFilename(chart);
      if (format === "pdf") {
        const { buildPdfReport } = await import("@/utils/export/pdfReport");
        file = await buildPdfReport({ markdown, chart, vargas, layout: ctx.chartLayout });
        filename = filename.replace(/\.md$/, ".pdf");
      } else {
        file = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      // After the file is handed over, never before: a download that succeeded
      // is the event being recorded, and the call itself is non-blocking.
      logChartExport(ctx.committed);
    } catch (err) {
      setError(
        `The report could not be built: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 space-y-1.5">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => download("pdf")}
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary-border-soft bg-primary-wash px-3 py-2.5 text-sm font-semibold text-heading transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {busy === "pdf" ? "Building PDF…" : "Download PDF"}
        </button>
        <button
          type="button"
          onClick={() => download("md")}
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary-border-soft bg-primary-wash px-3 py-2.5 text-sm font-semibold text-heading transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "md" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy === "md" ? "Building report…" : "Download Markdown"}
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-fg-faint">
        Every computed layer — positions, panchang, vargas, yogas, doshas, Shadbala, Ashtakavarga,
        Jaimini and the full Vimshottari tree. The PDF adds the charts, in the chart style selected
        above; the Markdown file is the one to hand to an AI assistant.
      </p>
      {error && <p className="text-[11px] leading-relaxed text-bad-strong">{error}</p>}
    </div>
  );
}
