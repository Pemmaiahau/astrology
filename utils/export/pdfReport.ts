import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  NORTH_HOUSES,
  NORTH_SIGN_ANCHOR,
  SOUTH_SIGN_CELL,
  houseOfSign,
  isWideHouse,
  northSlots,
  rashiModel,
  signOfHouse,
  vargaModel,
  type ChartEntry,
  type ChartLayout,
  type ChartModel,
  type LabelAlign,
} from "@/utils/astrology/chartLayout";
import { AYANAMSHA_SHORT } from "@/utils/astrology/ayanamsha";
import { NAKSHATRAS, SIGNS } from "@/utils/astrology/constants";
import { fmtDeg } from "@/utils/astrology/math";
import type { ChartData } from "@/utils/astrology/types";
import { VARGA_IDS, VARGA_NAMES, type VargaChart, type VargaSet } from "@/utils/astrology/varga";

/**
 * The Markdown report as a real PDF file, with the charts drawn in.
 *
 * The Markdown is the single source of the report's content: this module adds
 * the charts and page layout and computes no astrology of its own, so the two
 * downloads cannot disagree. Charts are drawn as vector lines and text from
 * `chartLayout.ts`, in whichever layout the reader has selected.
 *
 * DejaVu Sans is embedded because the built-in PDF fonts have no glyph for the
 * arrows, minus signs and stars the report uses. The files live in
 * `public/fonts` and are fetched at click time, like the module itself, so a
 * session that never exports pays for neither.
 */

export type MdBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "table"; head: string[]; body: string[][] };

const splitRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => plainText(c.replace(/\\\|/g, "|").trim()));

/** Inline Markdown removed; table cells have no room for mixed weights. */
export function plainText(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|[\s(])[_*]([^_*]+)[_*](?=[\s).,;:]|$)/g, "$1$2").replace(/`/g, "");
}

/** The subset of Markdown `buildMarkdownReport` writes. */
export function parseMarkdown(md: string): MdBlock[] {
  const lines = md.split(/\r?\n/);
  const out: MdBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^-{3,}$/.test(line.trim())) continue;
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      out.push({ kind: "heading", level: heading[1].length, text: plainText(heading[2]) });
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      for (; i < lines.length && lines[i].startsWith("|"); i++) {
        if (!/^\|[\s:|-]+\|?\s*$/.test(lines[i])) rows.push(splitRow(lines[i]));
      }
      i--;
      if (rows.length) out.push({ kind: "table", head: rows[0], body: rows.slice(1) });
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      out.push({ kind: "bullet", text: bullet[1] });
      continue;
    }
    out.push({ kind: "paragraph", text: line.trim() });
  }
  return out;
}

/** "a **b** c" as runs of plain and bold text. */
function boldRuns(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/\*\*/)
    .map((part, i) => ({ text: plainText(part), bold: i % 2 === 1 }))
    .filter((r) => r.text);
}

const FONT = "DejaVu";
const MARGIN = 40;
const TOP = 44;
const BOTTOM = 46;
/** Height of one row of the three-across varga grid on an A4 portrait page. */
const VARGA_GRID_ROW = (595.28 - MARGIN * 2 - 24) / 3 + 24;
/** A table this wide cannot be read on a portrait page. */
const LANDSCAPE_COLUMNS = 11;

type Rgb = [number, number, number];
const HEADING: Rgb = [154, 32, 7];
const INK: Rgb = [38, 38, 38];
const MUTED: Rgb = [100, 106, 115];
const LINE: Rgb = [176, 176, 186];
const LAGNA_FILL: Rgb = [253, 236, 222];
const HEAD_FILL: Rgb = [253, 243, 234];
const ROW_FILL: Rgb = [249, 249, 250];
const TONE: Record<ChartEntry["tone"], Rgb> = {
  strong: [21, 128, 61],
  weak: [185, 28, 28],
  plain: INK,
  lagna: [194, 65, 12],
};

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function fetchFont(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} could not be loaded (${res.status})`);
  return toBase64(await res.arrayBuffer());
}

export interface PdfFonts {
  regular: string;
  bold: string;
}

interface DrawOptions {
  /** Small grid charts: planet ids only. */
  compact?: boolean;
  /** Text for the middle of a South Indian chart. */
  centre?: string[];
}

function setColor(doc: jsPDF, rgb: Rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

/** One label, coloured piece by piece, positioned as a whole. */
function drawEntry(doc: jsPDF, e: ChartEntry, x: number, y: number, align: LabelAlign, size: number, compact: boolean) {
  const pieces: { text: string; rgb: Rgb; bold: boolean; size: number }[] = [
    { text: e.id, rgb: TONE[e.tone], bold: true, size },
  ];
  const small = size * 0.84;
  if (!compact && e.detail) pieces.push({ text: ` ${e.detail}`, rgb: MUTED, bold: false, size: small });
  if (e.flags) pieces.push({ text: ` ${e.flags}`, rgb: TONE.lagna, bold: true, size: small });
  if (e.shift) pieces.push({ text: ` ${e.shift}`, rgb: TONE.lagna, bold: true, size: small });

  const width = pieces.reduce((sum, p) => {
    doc.setFont(FONT, p.bold ? "bold" : "normal").setFontSize(p.size);
    return sum + doc.getTextWidth(p.text);
  }, 0);
  let cursor = align === "start" ? x : align === "end" ? x - width : x - width / 2;
  for (const p of pieces) {
    doc.setFont(FONT, p.bold ? "bold" : "normal").setFontSize(p.size);
    setColor(doc, p.rgb);
    doc.text(p.text, cursor, y, { baseline: "middle" });
    cursor += doc.getTextWidth(p.text);
  }
}

function polygon(doc: jsPDF, points: [number, number][], style: "F" | "S") {
  const [first, ...rest] = points;
  const deltas = rest.map((p, i) => {
    const from = points[i];
    return [p[0] - from[0], p[1] - from[1]];
  });
  doc.lines(deltas, first[0], first[1], [1, 1], style, true);
}

function drawNorth(doc: jsPDF, model: ChartModel, x: number, y: number, size: number, compact: boolean) {
  const k = size / 100;
  const at = ([px, py]: [number, number]): [number, number] => [x + px * k, y + py * k];
  doc.setFillColor(...LAGNA_FILL);
  polygon(doc, NORTH_HOUSES[0].map(at), "F");
  doc.setDrawColor(...LINE).setLineWidth(0.6);
  for (const points of NORTH_HOUSES) polygon(doc, points.map(at), "S");

  NORTH_HOUSES.forEach((_, i) => {
    const house = i + 1;
    const sign = signOfHouse(house, model.lagnaSign);
    const entries = model.bySign[sign];
    const [nx, ny] = at(NORTH_SIGN_ANCHOR[i]);
    doc.setFont(FONT, "bold").setFontSize(3 * k);
    setColor(doc, house === 1 ? TONE.lagna : MUTED);
    doc.text(String(sign + 1), nx, ny, { align: "center", baseline: "middle" });

    const { slots, scale } = northSlots(house, entries.length, !compact && isWideHouse(entries));
    entries.forEach((e, j) => {
      const [sx, sy] = at([slots[j].x, slots[j].y]);
      drawEntry(doc, e, sx, sy, slots[j].align, (compact ? 3.1 : 2.6) * k * scale, compact);
    });
  });
}

function drawSouth(doc: jsPDF, model: ChartModel, x: number, y: number, size: number, opts: DrawOptions) {
  const cell = size / 4;
  const pad = cell * 0.06;
  const label = Math.max(4, cell * 0.095);
  doc.setLineWidth(0.6).setDrawColor(...LINE);
  for (let sign = 0; sign < 12; sign++) {
    const [r, c] = SOUTH_SIGN_CELL[sign];
    const cx = x + c * cell;
    const cy = y + r * cell;
    const isLagna = sign === model.lagnaSign;
    if (isLagna) doc.setFillColor(...LAGNA_FILL).rect(cx, cy, cell, cell, "F");
    doc.rect(cx, cy, cell, cell, "S");

    doc.setFont(FONT, "normal").setFontSize(label * 0.8);
    setColor(doc, MUTED);
    doc.text(SIGNS[sign].slice(0, 3), cx + pad, cy + pad + label * 0.45, { baseline: "middle" });
    doc.setFont(FONT, "bold");
    setColor(doc, isLagna ? TONE.lagna : MUTED);
    doc.text(String(houseOfSign(sign, model.lagnaSign)), cx + cell - pad, cy + pad + label * 0.45, {
      align: "right",
      baseline: "middle",
    });

    const entries = model.bySign[sign];
    const top = cy + pad + label * 1.5;
    const span = cell - pad * 2 - label * 1.2;
    if (opts.compact) {
      const cols = 2;
      entries.forEach((e, j) => {
        const ex = cx + pad + (j % cols) * ((cell - pad * 2) / cols);
        drawEntry(doc, e, ex, top + Math.floor(j / cols) * label * 1.25, "start", label, true);
      });
    } else {
      const step = Math.min(label * 1.3, span / Math.max(1, entries.length));
      const size2 = Math.min(label, step / 1.15);
      entries.forEach((e, j) => drawEntry(doc, e, cx + pad, top + j * step, "start", size2, false));
    }
  }
  doc.rect(x + cell, y + cell, cell * 2, cell * 2, "S");
  (opts.centre ?? []).forEach((text, i, all) => {
    doc.setFont(FONT, i === 0 ? "bold" : "normal").setFontSize(i === 0 ? label * 1.15 : label * 0.95);
    setColor(doc, i === 0 ? HEADING : INK);
    doc.text(text, x + size / 2, y + size / 2 + (i - (all.length - 1) / 2) * label * 1.6, {
      align: "center",
      baseline: "middle",
      maxWidth: cell * 1.9,
    });
  });
}

function drawChart(doc: jsPDF, model: ChartModel, layout: ChartLayout, x: number, y: number, size: number, opts: DrawOptions) {
  if (layout === "north") drawNorth(doc, model, x, y, size, Boolean(opts.compact));
  else drawSouth(doc, model, x, y, size, opts);
}

export interface PdfReportInput {
  markdown: string;
  chart: ChartData;
  vargas: VargaSet | null;
  layout: ChartLayout;
  /** Base64 font files; fetched from `public/fonts` when omitted. */
  fonts?: PdfFonts;
}

export async function buildPdfDocument(input: PdfReportInput): Promise<jsPDF> {
  const { chart, vargas, layout } = input;
  const fonts = input.fonts ?? {
    regular: await fetchFont("/fonts/DejaVuSans.ttf"),
    bold: await fetchFont("/fonts/DejaVuSans-Bold.ttf"),
  };

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait", compress: true });
  doc.addFileToVFS("DejaVuSans.ttf", fonts.regular);
  doc.addFileToVFS("DejaVuSans-Bold.ttf", fonts.bold);
  doc.addFont("DejaVuSans.ttf", FONT, "normal");
  doc.addFont("DejaVuSans-Bold.ttf", FONT, "bold");

  const blocks = parseMarkdown(input.markdown);
  const pageW = () => doc.internal.pageSize.getWidth();
  const pageH = () => doc.internal.pageSize.getHeight();
  const textW = () => pageW() - MARGIN * 2;
  let y = TOP;

  const newPage = (orientation: "portrait" | "landscape" = "portrait") => {
    doc.addPage("a4", orientation);
    y = TOP;
  };
  const ensure = (needed: number) => {
    if (y + needed > pageH() - BOTTOM) newPage(pageW() > pageH() ? "landscape" : "portrait");
  };

  const wrapped = (text: string, size: number, indent = 0) => {
    const lineH = size * 1.42;
    const maxW = textW() - indent;
    let x = 0;
    const flush = () => {
      y += lineH;
      x = 0;
    };
    ensure(lineH);
    for (const run of boldRuns(text)) {
      doc.setFont(FONT, run.bold ? "bold" : "normal").setFontSize(size);
      for (const word of run.text.split(/(?<=\s)/)) {
        const w = doc.getTextWidth(word);
        if (x + w > maxW && x > 0) {
          flush();
          ensure(lineH);
        }
        doc.text(word, MARGIN + indent + x, y, { baseline: "top" });
        x += w;
      }
    }
    flush();
  };

  const title = blocks.find((b) => b.kind === "heading" && b.level === 1);
  const titleText = title?.kind === "heading" ? title.text : "Vedic Birth Chart";
  const name = chart.meta.name?.trim() || "Unnamed chart";
  doc.setProperties({ title: titleText, creator: "Jyotisha Studio" });

  // --- Opening page: the two charts everything else is read against.
  doc.setFont(FONT, "bold").setFontSize(17);
  setColor(doc, HEADING);
  doc.text(titleText, MARGIN, y, { baseline: "top" });
  y += 26;
  doc.setFont(FONT, "normal").setFontSize(8.5);
  setColor(doc, MUTED);
  const moon = chart.planets.find((p) => p.id === "Mo");
  doc.text(
    [
      chart.meta.localDateTime,
      chart.meta.place,
      `Lagna ${SIGNS[chart.ascendant.sign]} ${fmtDeg(chart.ascendant.degInSign)}`,
      moon ? `Moon ${SIGNS[moon.sign]}, ${NAKSHATRAS[moon.nakshatra]} p${moon.pada}` : null,
    ]
      .filter(Boolean)
      .join("  ·  "),
    MARGIN,
    y,
    { baseline: "top", maxWidth: textW() }
  );
  y += 22;

  const gap = 15;
  const size = (textW() - gap) / 2;
  const captioned = (text: string, x: number, at: number) => {
    doc.setFont(FONT, "bold").setFontSize(9);
    setColor(doc, HEADING);
    doc.text(text, x, at, { baseline: "top" });
  };
  captioned("Rashi (D-1)", MARGIN, y);
  const d9 = vargas?.charts.D9;
  if (d9) captioned("Navamsa (D-9)", MARGIN + size + gap, y);
  y += 15;
  drawChart(doc, rashiModel(chart), layout, MARGIN, y, size, {
    centre: [name, `${SIGNS[chart.ascendant.sign]} Lagna`, AYANAMSHA_SHORT[chart.meta.ayanamsha]],
  });
  if (d9) {
    drawChart(doc, vargaModel(d9), layout, MARGIN + size + gap, y, size, {
      centre: ["Navamsa", `${SIGNS[d9.ascendant]} Lagna`],
    });
  }
  y += size + 8;
  doc.setFont(FONT, "normal").setFontSize(7);
  setColor(doc, MUTED);
  doc.text(
    `${layout === "north" ? "Houses fixed, Lagna at the top; numbers are signs (1 = Aries). " : ""}Green: exalted, moolatrikona or own sign. Red: debilitated. R retrograde, C combust, W+/W− graha yuddha won/lost, ★ vargottama.`,
    MARGIN,
    y,
    { baseline: "top", maxWidth: textW() }
  );
  y += 26;

  const drawVargaGrid = (set: VargaSet) => {
    const list: VargaChart[] = VARGA_IDS.filter((v) => v !== "D1" && v !== "D9").map((v) => set.charts[v]);
    const cols = 3;
    const cellGap = 12;
    const chartSize = (textW() - cellGap * (cols - 1)) / cols;
    const rowH = VARGA_GRID_ROW;
    list.forEach((vc, i) => {
      if (i % cols === 0) {
        if (i > 0) y += rowH;
        ensure(rowH);
      }
      const x = MARGIN + (i % cols) * (chartSize + cellGap);
      doc.setFont(FONT, "bold").setFontSize(8);
      setColor(doc, HEADING);
      doc.text(`${VARGA_NAMES[vc.varga]} (${vc.varga})`, x, y, { baseline: "top" });
      drawChart(doc, vargaModel(vc), layout, x, y + 12, chartSize, {
        compact: true,
        centre: [vc.varga, `${SIGNS[vc.ascendant]} Lagna`],
      });
    });
    y += rowH + 4;
  };

  for (const block of blocks) {
    if (block === title) continue;
    if (block.kind === "heading") {
      const size = block.level === 2 ? 12.5 : block.level === 3 ? 10 : 9;
      // The chart grid has to open under its own heading, not on the next page.
      const opensGrid = vargas !== null && block.level === 2 && /Divisional Charts/.test(block.text);
      ensure(size * 5 + (opensGrid ? VARGA_GRID_ROW : 0));
      y += block.level === 2 ? 10 : 6;
      doc.setFont(FONT, "bold").setFontSize(size);
      setColor(doc, block.level === 2 ? HEADING : INK);
      const lines: string[] = doc.splitTextToSize(block.text, textW());
      doc.text(lines, MARGIN, y, { baseline: "top" });
      y += lines.length * size * 1.3 + 3;
      if (block.level === 2) {
        doc.setDrawColor(...LINE).setLineWidth(0.5).line(MARGIN, y, pageW() - MARGIN, y);
        y += 7;
        if (opensGrid) drawVargaGrid(vargas);
      }
    } else if (block.kind === "paragraph" || block.kind === "bullet") {
      setColor(doc, INK);
      if (block.kind === "bullet") {
        ensure(13);
        doc.setFont(FONT, "normal").setFontSize(8.5).text("•", MARGIN + 2, y, { baseline: "top" });
        wrapped(block.text, 8.5, 11);
      } else {
        wrapped(block.text, 8.5);
      }
      y += 4;
    } else {
      const wide = block.head.length >= LANDSCAPE_COLUMNS;
      if (wide) newPage("landscape");
      else if (pageW() > pageH()) newPage("portrait");
      else ensure(50);
      autoTable(doc, {
        head: [block.head],
        body: block.body,
        startY: y,
        margin: { left: MARGIN, right: MARGIN, top: TOP, bottom: BOTTOM },
        styles: {
          font: FONT,
          fontSize: wide ? 6.3 : 7.2,
          cellPadding: 2.6,
          overflow: "linebreak",
          textColor: INK,
          lineColor: LINE,
          lineWidth: 0.25,
        },
        headStyles: { font: FONT, fontStyle: "bold", fillColor: HEAD_FILL, textColor: HEADING },
        alternateRowStyles: { fillColor: ROW_FILL },
        showHead: "everyPage",
        rowPageBreak: "avoid",
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont(FONT, "normal").setFontSize(7);
    setColor(doc, MUTED);
    const footerY = doc.internal.pageSize.getHeight() - 24;
    doc.text(`${name} · Jyotisha Studio`, MARGIN, footerY);
    doc.text(`Page ${i} of ${pages}`, doc.internal.pageSize.getWidth() - MARGIN, footerY, { align: "right" });
  }
  return doc;
}

export async function buildPdfReport(input: PdfReportInput): Promise<Blob> {
  return (await buildPdfDocument(input)).output("blob");
}
