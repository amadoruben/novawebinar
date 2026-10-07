import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ChevronDown, EyeOff, Radio, Users } from "lucide-react";
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
}: {
  format: AudienceFormat;
  onFormat: (format: AudienceFormat) => void;
  min: number;
  max: number;
  onRange: (min: number, max: number) => void;
  curve: readonly number[];
  pitch: number | null;
  clock: EditorClock;
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
              <div className="grid grid-cols-2 gap-2.5">
                <CountInput label="Começa com" value={min} onCommit={(v) => onRange(v, Math.max(max, v + 1))} />
                <CountInput label="Chega até" value={max} onCommit={(v) => onRange(Math.min(min, Math.max(0, v - 1)), Math.max(1, v))} />
              </div>
            ) : (
              <div>
                <WheelBox>
                  <WheelColumn label="Mínimo" items={mins.map(fmt)} index={mins.indexOf(min)} onSettle={(i) => pickMin(mins[i]!)} wide />
                  <WheelColumn label="Máximo" items={maxs.map(fmt)} index={maxs.indexOf(max)} onSettle={(i) => pickMax(maxs[i]!)} wide />
                </WheelBox>
                <div className="mt-1.5 grid grid-cols-2 text-center text-[11.5px] font-medium text-muted-foreground">
                  <span>Começa com</span>
                  <span>Chega até</span>
                </div>
              </div>
            )}
            <p className="text-[12.5px] text-muted-foreground">
              A sala começa com {fmt(min)} e chega até {fmt(max)} pessoas, seguindo o formato abaixo.
            </p>
          </>
        )}
      </Section>

      <Section icon={Activity} title="Formato">
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
        <Section icon={Radio} title="Como fica ao vivo">
          <Chart curve={curve} pitch={pitch} clock={c} />
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
    <Field label={label}>
      <label className="flex h-11 items-baseline gap-1.5 rounded-lg bg-white px-3.5 shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)] focus-within:shadow-[inset_0_0_0_1.5px_var(--foreground)]">
        <input
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^\d\s.]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          aria-label={label}
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-semibold tabular-nums outline-none"
        />
        <span className="text-[12.5px] text-muted-foreground">pessoas</span>
      </label>
    </Field>
  );
}

/** A curva com o cursor: arrastar (rato ou dedo) leva o vídeo a esse minuto e o número muda na sala. */
function Chart({ curve, pitch, clock: c }: { curve: readonly number[]; pitch: number | null; clock: EditorClock }) {
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
  const seekAt = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    c.seek(Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * d));
  };
  return (
    <div className="grid gap-2 rounded-xl border bg-white p-3">
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
        className="relative h-[120px] cursor-grab touch-none select-none active:cursor-grabbing"
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
          <path d={path.area} fill="#12A594" opacity={0.12} />
          <path d={path.line} fill="none" stroke="#12A594" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        </svg>
        {pitch !== null && pitch <= d ? (
          <div className="absolute inset-y-0 border-l border-dashed border-foreground/70" style={{ left: `${(pitch / d) * 100}%` }}>
            <span className="absolute -left-px top-0 -translate-x-full whitespace-nowrap rounded bg-foreground px-1.5 py-px text-[10.5px] font-semibold text-background">
              Oferta {clock(pitch)}
            </span>
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground" style={{ left: `${fx * 100}%` }}>
          <span className="absolute -top-1 left-1/2 size-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-foreground" />
          <span
            className="absolute left-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-foreground bg-white"
            style={{ top: `${fy * 100}%` }}
          />
        </div>
      </div>
      <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>00:00</span>
        <span>{clock(d / 2)}</span>
        <span>{clock(d)}</span>
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        Arraste o cursor para a esquerda ou para a direita: o número muda e a sala mostra-o.
      </p>
    </div>
  );
}
