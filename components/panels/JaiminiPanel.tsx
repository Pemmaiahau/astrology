"use client";

import { Crown, Eye, Layers, Shield } from "lucide-react";
import { useChart } from "@/components/context/ChartContext";
import { PLANET_NAMES, SIGNS, SIGNS_SANSKRIT, SIGN_LORDS } from "@/utils/astrology/constants";
import { ordinal } from "@/utils/astrology/format";
import { fmtDeg } from "@/utils/astrology/math";
import { CHARA_KARAKA_NAMES, type CharaKarakaId } from "@/utils/astrology/jaimini";

/**
 * The Jaimini layer.
 *
 * Chara karakas, Karakamsa, Arudha Lagna, Upapada and Argala have all been
 * computed on every chart since the Jaimini module landed, and reached the
 * reader only as sentences buried inside other panels' prose. This is the
 * surface for the system itself.
 *
 * Jaimini is a *parallel* system, not a supplement to Parashara — its karakas
 * are variable (assigned by degree, not by fixed rulership) and its padas
 * describe how a house is perceived rather than what it is. The copy here
 * leans on that distinction throughout, because the commonest misreading is to
 * treat the Arudha Lagna as a second ascendant.
 */

const KARAKA_ORDER: CharaKarakaId[] = ["AK", "AmK", "BK", "MK", "PiK", "GK", "DK"];

const KARAKA_GLOSS: Record<CharaKarakaId, string> = {
  AK: "The soul's own agenda — the lesson this life is organised around. The highest-degree graha carries it, and its dasha periods are when that agenda becomes unavoidable.",
  AmK: "The minister: where help, advancement and career support come from. Classically read with the Atmakaraka as the pair that decides worldly success.",
  BK: "Siblings, and by extension the guru and what is taught forward.",
  MK: "The mother, and nurture generally.",
  PiK: "The father, and inherited authority.",
  GK: "Kin and rivals — the same word covers both, which is the point: obstruction usually arrives from close quarters.",
  DK: "The spouse. Its sign, dignity and dispositor describe the partner more reliably than the 7th house alone.",
};

export default function JaiminiPanel() {
  const { chart, jaimini } = useChart();
  if (!chart || !jaimini) return null;

  const planetOf = (id: string) => chart.planets.find((p) => p.id === id);
  const houseOfSign = (sign: number) => ((sign - chart.ascendant.sign + 12) % 12) + 1;

  const arudhaHouse = houseOfSign(jaimini.arudhaLagna);
  const upapadaHouse = houseOfSign(jaimini.upapada);
  const karakamsaHouse = houseOfSign(jaimini.karakamsa);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-heading-border bg-primary-wash p-3">
        <h3 className="flex items-center gap-2 font-serif text-base font-bold text-heading">
          <Layers className="h-4 w-4" /> Jaimini
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">
          A parallel system rather than an extension of Parashara. Its significators are{" "}
          <span className="italic">variable</span> — assigned by degree within a sign rather than by fixed
          rulership — so they change from chart to chart, and its padas describe how a house is{" "}
          <span className="italic">perceived</span> rather than what it is. The seven-karaka scheme is used
          here (the eight-karaka scheme including Rahu is the documented alternative).
        </p>
      </section>

      {/* Chara karakas */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <h4 className="mb-2 flex items-center gap-2 font-serif text-sm font-bold text-heading">
          <Crown className="h-4 w-4" /> Chara Karakas
        </h4>
        <p className="mb-2.5 text-[11px] leading-relaxed text-fg-faint">
          The seven grahas ranked by descending degree within their sign. The highest degree becomes the
          Atmakaraka regardless of dignity, house or rulership — a debilitated graha can and often does hold
          the role.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead>
              <tr className="bg-inset uppercase tracking-wider text-eyebrow">
                <th className="px-2.5 py-2">Karaka</th>
                <th className="px-2.5 py-2">Graha</th>
                <th className="px-2.5 py-2">Degree</th>
                <th className="px-2.5 py-2">Sign</th>
                <th className="px-2.5 py-2">House</th>
              </tr>
            </thead>
            <tbody>
              {KARAKA_ORDER.map((k) => {
                const id = jaimini.karakas[k];
                const p = planetOf(id);
                return (
                  <tr key={k} className={`border-t border-line-faint ${k === "AK" ? "bg-primary-wash-2" : ""}`}>
                    <td className="px-2.5 py-1.5">
                      <span className="font-mono font-bold text-heading">{k}</span>
                      <span className="ml-1.5 text-[11px] text-fg-muted">
                        {CHARA_KARAKA_NAMES[k].replace(/^[A-Za-z]+ /, "")}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 font-semibold text-fg-2">{PLANET_NAMES[id]}</td>
                    <td className="px-2.5 py-1.5 font-mono text-fg-muted">
                      {p ? fmtDeg(p.degInSign) : "—"}
                    </td>
                    <td className="px-2.5 py-1.5 text-fg">{p ? SIGNS[p.sign] : "—"}</td>
                    <td className="px-2.5 py-1.5 font-mono text-fg-muted">{p ? p.house : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-1.5">
          {KARAKA_ORDER.map((k) => (
            <p key={k} className="text-[11px] leading-relaxed text-fg-muted">
              <span className="font-mono font-semibold text-fg-2">{k}</span>{" "}
              <span className="font-semibold text-fg-2">{PLANET_NAMES[jaimini.karakas[k]]}</span> —{" "}
              {KARAKA_GLOSS[k]}
            </p>
          ))}
        </div>
      </section>

      {/* Karakamsa + padas */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "Karakamsa",
            sign: jaimini.karakamsa,
            house: karakamsaHouse,
            body: `The Atmakaraka ${PLANET_NAMES[jaimini.karakas.AK]}'s sign in the Navamsa. Read as the lagna of the soul: the houses counted from it describe what the native is here to work out, and Jaimini's classic readings for talent, learning and the form of one's spirituality are all taken from this point rather than from the birth lagna.`,
          },
          {
            title: "Arudha Lagna (AL)",
            sign: jaimini.arudhaLagna,
            house: arudhaHouse,
            body: `The image, not the self. The Arudha is where the world places you — reputation, standing, what people assume about your circumstances. A strong Arudha with a weak Lagna is the classical signature of someone widely thought to be doing better than they are; the reverse is the person quietly doing well behind an unremarkable front.`,
          },
          {
            title: "Upapada (UL)",
            sign: jaimini.upapada,
            house: upapadaHouse,
            body: `The arudha of the 12th, and Jaimini's primary marriage indicator. Its sign, its lord's condition, and the 2nd from it (read for the durability of the bond) carry more weight in this system than the 7th house does.`,
          },
        ].map((c) => (
          <section key={c.title} className="rounded-xl border border-line bg-surface p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-eyebrow">{c.title}</p>
            <p className="font-serif text-sm font-bold text-heading">
              {SIGNS[c.sign]}{" "}
              <span className="text-[11px] font-normal text-fg-muted">({SIGNS_SANSKRIT[c.sign]})</span>
            </p>
            <p className="mb-1.5 text-[11px] text-fg-subtle">
              {ordinal(c.house)} house from Lagna · lord {PLANET_NAMES[SIGN_LORDS[c.sign]]}
            </p>
            <p className="text-[11px] leading-relaxed text-fg">{c.body}</p>
          </section>
        ))}
      </div>

      {/* Argala */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <h4 className="mb-1.5 flex items-center gap-2 font-serif text-sm font-bold text-heading">
          <Shield className="h-4 w-4" /> Argala — intervention and its obstruction
        </h4>
        <p className="mb-2.5 text-[11px] leading-relaxed text-fg-faint">
          Grahas in the 2nd, 4th and 11th from a house <span className="font-semibold">intervene</span> in its
          affairs; grahas in the 12th, 10th and 3rd <span className="font-semibold">obstruct</span> that
          intervention (virodha argala). Where a house has argala with no obstruction, those grahas genuinely
          steer its outcomes and their dashas are when the steering happens. Where both are present, the
          house is contested and the result follows whichever side is running.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="bg-inset uppercase tracking-wider text-eyebrow">
                <th className="px-2.5 py-2">House</th>
                <th className="px-2.5 py-2">Intervening (argala)</th>
                <th className="px-2.5 py-2">Obstructing (virodha)</th>
                <th className="px-2.5 py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {jaimini.argala.map((a, i) => {
                const net =
                  a.intervening.length === 0
                    ? "no argala"
                    : a.obstructing.length === 0
                      ? "unopposed"
                      : "contested";
                return (
                  <tr key={i} className="border-t border-line-faint">
                    <td className="px-2.5 py-1.5 font-semibold text-fg-2">{ordinal(i + 1)}</td>
                    <td className="px-2.5 py-1.5 text-good">
                      {a.intervening.length ? a.intervening.map((id) => PLANET_NAMES[id]).join(", ") : "—"}
                    </td>
                    <td className="px-2.5 py-1.5 text-bad-strong">
                      {a.obstructing.length ? a.obstructing.map((id) => PLANET_NAMES[id]).join(", ") : "—"}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                          net === "unopposed"
                            ? "bg-good-soft text-good ring-good-ring"
                            : net === "contested"
                              ? "bg-warn-soft text-warn ring-warn-ring"
                              : "bg-neutral-soft text-fg-muted ring-neutral-ring"
                        }`}
                      >
                        {net}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-fg-faint">
        <Eye className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Not implemented: Chara dasha, Jaimini rashi drishti (sign-to-sign aspects, which differ from
          Parashari graha drishti), and the secondary malefics-in-3rd argala variant. Those are recorded as
          open items rather than silently approximated.
        </span>
      </p>
    </div>
  );
}
