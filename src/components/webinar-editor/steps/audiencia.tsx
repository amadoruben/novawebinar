import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, ChevronDown, EyeOff, Radio, Users } from "lucide-react";
import { AUDIENCE_FORMATS, clock, curveValueAt, type AudienceFormat } from "@/lib/room-logic";
import { Field, Note, Section, Seg, WheelBox, WheelColumn } from "../ui";
import type { EditorClock } from "./video";

/** Os números das rodas: passos que se lêem bem, do pequeno ao grande. */
const STEPS = [
  0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 180, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800,
  900, 1000, 1200, 1500, 1800, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 7500, 10000, 12500, 15000, 20000, 30000, 50000,
];

/** As rodas de um número: os passos, mais o valor actual se não for um deles. */
function wheelItems(value: number) {
  return [...new Set([...STEPS, value])].sort((a, b) => a - b);
}

/** Audiência: quantas pessoas a sala mostra e como o número muda ao longo do vídeo. */
export function StepAudiencia({
  format,
  onFormat,
  min,
  max,
  onRange,
  curve,
  pitch,
  clock: c,
  marks,
}: {
  format: AudienceFormat;
  onFormat: (format: AudienceFormat) => void;
  min: number;
  max: number;
  onRange: (min: number, max: number) => void;
  curve: readonly number[];
  pitch: number | null;
  clock: EditorClock;
  marks: ChartMarks;
}) {
  const simulated = format !== "real" && format !== "off";
  const chosen = AUDIENCE_FORMATS.find((f) => f.value === format)!;
  const mins = wheelItems(min).filter((v) => v < 50000);
  const maxs = wheelItems(max).filter((v) => v > 0);
  // O máximo fica sempre acima do mínimo: se o mínimo passar, o máximo sobe com ele.
  const pickMin = (v: number) => onRange(v, max > v ? max : (maxs.find((m) => m > v) ?? v + 1));
  const pickMax = (v: number) => onRange(min < v ? min : (mins.filter((m) => m < v).at(-1) ?? 0), v);
  const fmt = (n: number) => n.toLocaleString("pt-PT");
  // Duas maneiras de escolher, à vista: escrever os números ou rodar as rodas.
  const [way, setWay] = useState<"write" | "wheel">("write");

  return (
    <>
      <Section icon={Users} title="Quantas pessoas a sala mostra" help="audiencia">
        {format === "off" ? (
          <Note icon={EyeOff}>A sala não mostra quantas pessoas estão a ver.</Note>
        ) : format === "real" ? (
          <Note icon={Radio}>A sala mostra só quem está mesmo a ver, sem número simulado.</Note>
        ) : (
          <>
            <Seg
              full
              small
              label="Como escolher"
              value={way}
              onChange={setWay}
              options={[
                { value: "write", label: "Escrever" },
                { value: "wheel", label: "Definir nas rodas" },
              ]}
            />
            {way === "write" ? (
              // Uma só caixa, do número com que começa ao número a que chega.
              <div className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-stretch overflow-hidden rounded-xl bg-white shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)]">
                <CountInput label="Começa com" value={min} onCommit={(v) => onRange(v, Math.max(max, v + 1))} />
                <span className="grid place-items-center border-x border-[var(--ds-gray-alpha-200)] text-muted-foreground">
                  <ArrowRight className="size-3.5" />
                </span>
                <CountInput label="Chega até" value={max} onCommit={(v) => onRange(Math.min(min, Math.max(0, v - 1)), Math.max(1, v))} />
              </div>
            ) : (
              <div className="grid gap-1.5">
                {/* Os nomes por cima de cada roda, alinhados com ela. */}
                <div className="flex justify-center gap-5 text-center text-[12px] font-medium text-muted-foreground">
                  <span className="w-[92px]">Começa com</span>
                  <span className="w-[92px]">Chega até</span>
                </div>
                <WheelBox>
                  <WheelColumn label="Começa com" items={mins.map(fmt)} index={mins.indexOf(min)} onSettle={(i) => pickMin(mins[i]!)} wide />
                  <WheelColumn label="Chega até" items={maxs.map(fmt)} index={maxs.indexOf(max)} onSettle={(i) => pickMax(maxs[i]!)} wide />
                </WheelBox>
              </div>
            )}
            <p className="text-[12.5px] text-muted-foreground">
              A sala começa com {fmt(min)} e chega até {fmt(max)} pessoas, seguindo o formato abaixo.
            </p>
          </>
        )}
      </Section>

      <Section icon={Activity} title="Formato" help="audienciaFormato">
        <Field hint={chosen.description}>
          <div className="relative">
            <select
              value={format}
              onChange={(e) => onFormat(e.target.value as AudienceFormat)}
              aria-label="Formato da audiência"
              className="h-9 w-full appearance-none rounded-sm bg-white pl-3 pr-9 text-sm shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)] outline-none focus:shadow-[inset_0_0_0_1px_var(--foreground)]"
            >
              {AUDIENCE_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                  {f.recommended ? " (recomendado)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </Field>
      </Section>

      {simulated && curve.length > 1 ? (
        <Section icon={Radio} title="Como fica ao vivo" help="audienciaCurva">
          <Chart curve={curve} pitch={pitch} clock={c} marks={marks} />
        </Section>
      ) : null}
    </>
  );
}

/**
 * Um número de pessoas escrito à mão: aceita «1 200» ou «1200» e grava ao sair do campo ou com Enter,
 * para não saltar a cada tecla. Fica entre 0 e 50 000.
 */
function CountInput({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState(value.toLocaleString("pt-PT"));
  useEffect(() => setText(value.toLocaleString("pt-PT")), [value]);
  const commit = () => {
    const n = Math.min(50000, Math.max(0, Number(text.replace(/\D/g, "")) || 0));
    if (n !== value) onCommit(n);
    else setText(value.toLocaleString("pt-PT"));
  };
  return (
    <label className="grid min-w-0 gap-0.5 px-3.5 py-2.5 focus-within:bg-[#FAFAFA]">
      <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <input
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^\d\s.]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          aria-label={label}
          // A caixa tem a largura do número, e «pessoas» fica logo a seguir.
          size={Math.max(2, text.length)}
          className="min-w-0 max-w-full bg-transparent text-[18px] font-semibold tabular-nums outline-none"
        />
        <span className="text-[12px] text-muted-foreground">pessoas</span>
      </span>
    </label>
  );
}

/** O que se marca no gráfico: as ofertas (a principal e as relâmpago), os momentos do + Seguir e as compras. */
export type ChartMarks = {
  offers: readonly { start: number; end: number; main: boolean; name?: string | undefined }[];
  follows: readonly { start: number; end: number }[];
  sales: readonly number[];
};

const TEAL = "#12A594";
const OFFER = "#E8440C";
const EXTRA = "#F5A524";
const FOLLOW = "#0072F5";
const SALE = "#1D8A5E";

/**
 * A audiência ao longo do vídeo, com o que acontece em cada minuto. Cada oferta tem um número: a
 * linha no gráfico, a faixa por baixo e a linha da lista têm o mesmo número e a mesma cor, para se
 * ver logo que minuto é de que oferta. Arrastar (rato ou dedo) leva o vídeo a esse minuto.
 */
function Chart({ curve, pitch, clock: c, marks }: { curve: readonly number[]; pitch: number | null; clock: EditorClock; marks: ChartMarks }) {
  const box = useRef<HTMLDivElement>(null);
  const d = Math.max(1, c.duration);
  const top = Math.max(12, ...curve) * 1.12;
  const path = useMemo(() => {
    const pts = Array.from({ length: 120 }, (_, i) => {
      const x = (i / 119) * 100;
      const y = 100 - (curveValueAt(curve, (i / 119) * d, d) / top) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return { line: `M${pts.join(" L")}`, area: `M0,100 L${pts.join(" L")} L100,100 Z` };
  }, [curve, d, top]);
  const now = curveValueAt(curve, c.t, d);
  const fx = Math.min(1, Math.max(0, c.t / d));
  const fy = 1 - now / top;
  const pct = (t: number) => `${(Math.min(Math.max(t, 0), d) / d) * 100}%`;
  // Um número ou uma etiqueta perto da borda não sai do gráfico.
  const inside = (t: number, half: number) => `clamp(${half}px, ${pct(t)}, calc(100% - ${half}px))`;
  const span = (a: number, b: number) => ({ left: pct(a), width: `${((Math.min(b, d) - Math.min(a, d)) / d) * 100}%` });
  const seekAt = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    c.seek(Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * d));
  };
  // Sem as ofertas marcadas (ex.: só o minuto do pitch), mostra-se esse minuto como a oferta principal.
  const offers = marks.offers.length ? marks.offers : pitch !== null ? [{ start: pitch, end: d, main: true }] : [];
  let extraIndex = 0;
  const named = offers.map((o, i) => ({
    ...o,
    n: i + 1,
    color: o.main ? OFFER : EXTRA,
    label: o.name?.trim() || (o.main ? "Oferta principal" : `Oferta relâmpago ${++extraIndex}`),
  }));
  const endLabel = (end: number) => (end > d + 1 ? "depois do vídeo" : end >= d - 1 ? "fim" : clock(end));
  const legend: [string, string, string][] = [
    [TEAL, "A ver", ""],
    ...(marks.follows.length ? ([[FOLLOW, "+ Seguir", String(marks.follows.length)]] as [string, string, string][]) : []),
    ...(marks.sales.length ? ([[SALE, "Compras", String(marks.sales.length)]] as [string, string, string][]) : []),
  ];
  const badge = (n: number, color: string) => (
    <span className="grid size-[18px] shrink-0 place-items-center rounded-full font-mono text-[10.5px] font-bold text-white ring-2 ring-white" style={{ background: color }}>
      {n}
    </span>
  );
  return (
    <div className="grid gap-2.5 rounded-xl border bg-white p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm">
          <b className="font-mono text-xl font-semibold tabular-nums">{now.toLocaleString("pt-PT")}</b> a ver
        </span>
        <span className="font-mono text-xs text-muted-foreground">aos {clock(c.t)}</span>
      </div>
      <div
        ref={box}
        role="slider"
        tabIndex={0}
        aria-label="Minuto do vídeo"
        aria-valuemin={0}
        aria-valuemax={d}
        aria-valuenow={Math.round(c.t)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") c.seek(Math.max(0, c.t - 5));
          if (e.key === "ArrowRight") c.seek(Math.min(d, c.t + 5));
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekAt(e.clientX);
        }}
        onPointerMove={(e) => e.buttons && seekAt(e.clientX)}
        className="relative grid cursor-grab touch-none select-none gap-1 active:cursor-grabbing"
      >
        {/* Os números das ofertas, numa faixa por cima do gráfico: nunca tapam a curva nem saem da caixa. */}
        {named.length ? (
          <div className="relative h-[18px]">
            {named.map((o) => (
              <span key={o.n} className="absolute top-0 -translate-x-1/2" style={{ left: inside(o.start, 9) }} title={`${o.label}: abre aos ${clock(o.start)}`}>
                {badge(o.n, o.color)}
              </span>
            ))}
          </div>
        ) : null}
        <div className="relative h-[120px]">
          {[0.25, 0.5, 0.75].map((y) => (
            <span key={y} className="absolute inset-x-0 border-t border-dashed border-black/[0.07]" style={{ top: `${y * 100}%` }} />
          ))}
          {/* As janelas das ofertas, em fundo, para se ver a audiência durante a venda. */}
          {named.map((o) => (
            <span key={o.n} className="absolute inset-y-0" style={{ ...span(o.start, o.end), background: o.main ? "rgba(232,68,12,.06)" : "rgba(245,165,36,.09)" }} />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
            <path d={path.area} fill={TEAL} opacity={0.12} />
            <path d={path.line} fill="none" stroke={TEAL} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
          </svg>
          {/* Onde cada oferta abre: uma linha da cor dela, ligada ao número em cima. */}
          {named.map((o) => (
            <span key={o.n} className="absolute inset-y-0 border-l-[1.5px] border-dashed" style={{ left: pct(o.start), borderColor: o.color }} />
          ))}
          {marks.sales.map((at, i) => (
            <span
              key={i}
              title={`Compra aos ${clock(at)}`}
              className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
              style={{ left: pct(at), top: `${(1 - curveValueAt(curve, at, d) / top) * 100}%`, background: SALE }}
            />
          ))}
          <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground" style={{ left: `${fx * 100}%` }}>
            <span
              className="absolute left-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-foreground bg-white"
              style={{ top: `${fy * 100}%` }}
            />
          </div>
        </div>
        {/* As faixas: uma por oferta (do minuto em que abre ao minuto em que fecha) e, por baixo, o + Seguir. */}
        {named.length || marks.follows.length ? (
          <div className="grid gap-[3px] pt-1">
            {named.map((o) => (
              <div key={o.n} className="relative h-1.5 rounded-full bg-chip">
                <span className="absolute inset-y-0 rounded-full" style={{ ...span(o.start, o.end), background: o.color }} />
              </div>
            ))}
            {marks.follows.length ? (
              <div className="relative h-1.5 rounded-full bg-chip">
                {marks.follows.map((m, i) => (
                  <span key={i} title={`+ Seguir: ${clock(m.start)}–${clock(m.end)}`} className="absolute inset-y-0 min-w-1 rounded-full" style={{ ...span(m.start, m.end), background: FOLLOW }} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>00:00</span>
        <span>{clock(d / 2)}</span>
        <span>{clock(d)}</span>
      </div>
      {named.length ? (
        <ul className="grid gap-1.5 border-t pt-2.5">
          {named.map((o) => (
            <li key={o.n}>
              <button type="button" onClick={() => c.seek(o.start)} className="flex w-full items-center gap-2 rounded-md text-left text-[12.5px] hover:bg-gray-50">
                {badge(o.n, o.color)}
                <span className="min-w-0 flex-1 truncate font-medium">{o.label}</span>
                <span className="shrink-0 font-mono text-[12px] tabular-nums text-muted-foreground">
                  {clock(o.start)} → {endLabel(o.end)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 border-t pt-2.5 text-[12px]">
        {legend.map(([color, label, count]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <i className="block size-2 rounded-full" style={{ background: color }} />
            {label}
            {count ? <b className="font-mono font-semibold tabular-nums">{count}</b> : null}
          </span>
        ))}
      </div>
      <p className="text-[12.5px] text-muted-foreground">Arraste no gráfico: o vídeo vai para esse minuto e a sala mostra o número.</p>
    </div>
  );
}
