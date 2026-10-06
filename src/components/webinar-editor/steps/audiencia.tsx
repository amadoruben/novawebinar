import { useMemo, useRef } from "react";
import { Activity, ChevronDown, Eye, Users } from "lucide-react";
import { AUDIENCE_FORMATS, clock, curveValueAt, type AudienceFormat } from "@/lib/room-logic";
import { Field, Note, Section } from "../ui";
import type { EditorClock } from "./video";

const RANGE = 2000;
const STEP = 10;

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
  onFocusViewers,
}: {
  format: AudienceFormat;
  onFormat: (format: AudienceFormat) => void;
  min: number;
  max: number;
  onRange: (min: number, max: number) => void;
  curve: readonly number[];
  pitch: number | null;
  clock: EditorClock;
  onFocusViewers: (on: boolean) => void;
}) {
  const simulated = format !== "real";
  const chosen = AUDIENCE_FORMATS.find((f) => f.value === format)!;
  const top = Math.max(RANGE, max);
  const setMin = (v: number) => onRange(Math.max(0, Math.min(v, max - STEP)), max);
  const setMax = (v: number) => onRange(min, Math.max(v, min + STEP));

  return (
    <>
      <Section icon={Users} title="Quantidade" help="audiencia">
        {simulated ? (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              De
              <NumberBox value={min} onChange={setMin} label="Mínimo" onFocus={onFocusViewers} />a
              <NumberBox value={max} onChange={setMax} label="Máximo" onFocus={onFocusViewers} />
              pessoas
            </div>
            <div className="relative h-8">
              <div className="absolute inset-x-2.5 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gray-200" />
              <div
                className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-foreground"
                style={{ left: `calc(10px + (100% - 20px) * ${min / top})`, right: `calc(10px + (100% - 20px) * ${1 - max / top})` }}
              />
              <input
                type="range"
                min={0}
                max={top}
                step={STEP}
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
                aria-label="Mínimo de pessoas"
                className="cw-range absolute inset-0 w-full"
              />
              <input
                type="range"
                min={0}
                max={top}
                step={STEP}
                value={max}
                onChange={(e) => setMax(Number(e.target.value))}
                aria-label="Máximo de pessoas"
                className="cw-range absolute inset-0 w-full"
              />
            </div>
            <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>0</span>
              <span>{(top / 2).toLocaleString("pt-PT")}</span>
              <span>{top.toLocaleString("pt-PT")}</span>
            </div>
            <style>{RANGE_CSS}</style>
          </>
        ) : (
          <Note icon={Eye}>A sala mostra só quem está mesmo a ver.</Note>
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
        <Section icon={Eye} title="Como fica">
          <Chart curve={curve} pitch={pitch} clock={c} />
        </Section>
      ) : null}
    </>
  );
}

const RANGE_CSS = `.cw-range{appearance:none;-webkit-appearance:none;background:transparent;pointer-events:none;height:32px;margin:0}.cw-range::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:20px;height:20px;border-radius:50%;background:#fff;border:2px solid #171717;cursor:grab}.cw-range::-moz-range-thumb{pointer-events:auto;width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid #171717;cursor:grab}.cw-range:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px rgba(0,114,245,.35)}`;

function NumberBox({
  value,
  onChange,
  label,
  onFocus,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  onFocus: (on: boolean) => void;
}) {
  return (
    <input
      inputMode="numeric"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
      onFocus={() => onFocus(true)}
      onBlur={() => onFocus(false)}
      className="h-[38px] w-[86px] rounded-sm bg-white text-center font-mono text-[15px] font-semibold text-foreground tabular-nums shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)] outline-none focus:shadow-[inset_0_0_0_1px_var(--foreground)]"
    />
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
        {pitch !== null ? (
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
