import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Gráficos da referência (convertewebinar-design/components/charts).
 * Regras: sem grelha nem eixos, só rótulos em cinza secundário; linhas e pontos
 * em azul-noite; o destaque é o relevo diagonal (hatch) com uma etiqueta
 * laranja. Recebem séries já calculadas — não inventam números.
 */

function ValueTag({ children, className, style }: { children: React.ReactNode; className?: string | undefined; style?: React.CSSProperties }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center whitespace-nowrap rounded-xs bg-primary px-2 text-[11px] text-white tabular-nums",
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

export type BarDatum = { label: string; value: number; title?: string };

/** Barras cinza; a barra em destaque leva relevo diagonal e etiqueta laranja. */
export function BarChart({
  data,
  highlight,
  tag,
  height = 160,
  gap = 8,
  showLabels = true,
  labelEvery = 1,
  onSelect,
  className,
}: {
  data: BarDatum[];
  /** Índice da barra em destaque (omissão: a maior). */
  highlight?: number | null | undefined;
  tag?: React.ReactNode | undefined;
  height?: number | undefined;
  gap?: number | undefined;
  showLabels?: boolean | undefined;
  /** Mostrar só 1 em cada N rótulos (séries longas). */
  labelEvery?: number | undefined;
  onSelect?: ((index: number) => void) | undefined;
  className?: string | undefined;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const hi =
    highlight === undefined
      ? data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0)
      : highlight;
  const tagRoom = tag != null ? 30 : 0;
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-end" style={{ gap, height }}>
        {data.map((d, i) => {
          const on = i === hi && d.value > 0;
          const h = d.value > 0 ? Math.max(8, (d.value / max) * (height - tagRoom)) : 4;
          return (
            <div
              key={i}
              className={cn("flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2", onSelect && "cursor-pointer")}
              onClick={onSelect ? () => onSelect(i) : undefined}
              title={d.title ?? `${d.label}: ${d.value.toLocaleString("pt-PT")}`}
            >
              {on && tag != null && <ValueTag>{tag}</ValueTag>}
              <div
                className={cn(
                  "w-full rounded-sm transition-[height] duration-[var(--duration-base)] ease-standard",
                  on ? "bg-hatch ring-1 ring-gray-400" : d.value > 0 ? "bg-[var(--chart-bar)]" : "bg-gray-250",
                )}
                style={{ height: h }}
              />
            </div>
          );
        })}
      </div>
      {showLabels && (
        <div className="flex" style={{ gap }}>
          {data.map((d, i) => (
            <span
              key={i}
              className={cn(
                "min-w-0 flex-1 overflow-hidden text-center text-[11px] whitespace-nowrap text-muted-foreground",
                i === hi && "text-foreground",
              )}
            >
              {i % labelEvery === 0 || i === data.length - 1 ? d.label : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Linha azul-noite com pontos e área laranja 12% → 0. */
export function LineChart({
  labels = [],
  values,
  highlight,
  tag,
  width = 420,
  height = 140,
  showDots = true,
  labelEvery = 1,
  className,
}: {
  labels?: string[] | undefined;
  values: number[];
  highlight?: number | null | undefined;
  tag?: React.ReactNode | undefined;
  width?: number | undefined;
  height?: number | undefined;
  showDots?: boolean | undefined;
  labelEvery?: number | undefined;
  className?: string | undefined;
}) {
  const gid = "lc-" + React.useId().replace(/:/g, "");
  if (values.length === 0) return null;
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const padX = 6;
  const padY = 12;
  const x = (i: number) => padX + (i / Math.max(1, values.length - 1)) * (width - padX * 2);
  const y = (v: number) => padY + (1 - (v - min) / (max - min || 1)) * (height - padY * 2);
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = values.length > 1 ? smoothPath(pts) : `M${pts[0]![0]},${pts[0]![1]} L${width - padX},${pts[0]![1]}`;
  const last = pts[pts.length - 1]!;
  const area = `${line} L${values.length > 1 ? last[0] : width - padX},${height} L${pts[0]![0]},${height} Z`;
  const hp = highlight != null ? pts[highlight] : undefined;
  return (
    <div className={className}>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full overflow-visible" role="img">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: 0.12 }} />
              <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke="var(--navy)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          {showDots &&
            pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={i === highlight ? 4.5 : 3.5} fill={i === highlight ? "var(--accent)" : "var(--navy)"}>
                <title>{`${labels[i] ?? ""} ${values[i]!.toLocaleString("pt-PT")}`.trim()}</title>
              </circle>
            ))}
        </svg>
        {hp && tag != null && (
          <ValueTag
            className="absolute"
            style={{ left: `${(hp[0] / width) * 100}%`, top: `${(hp[1] / height) * 100}%`, transform: "translate(-50%,-150%)" }}
          >
            {tag}
          </ValueTag>
        )}
      </div>
      {labels.length > 0 && (
        <div className="mt-3 flex justify-between gap-1.5 text-[11px] text-muted-foreground">
          {labels.map((l, i) => (
            <span key={i} className={cn(i === highlight && "text-foreground")}>
              {i % labelEvery === 0 || i === labels.length - 1 ? l : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Faixa entre duas séries preenchida com relevo diagonal; marcador laranja. */
export function RangeChart({
  labels = [],
  upper,
  lower,
  upperLabel,
  lowerLabel,
  highlight,
  tag,
  width = 600,
  height = 150,
  className,
}: {
  labels?: string[] | undefined;
  upper: number[];
  lower: number[];
  upperLabel?: string | undefined;
  lowerLabel?: string | undefined;
  highlight?: number | null | undefined;
  tag?: React.ReactNode | undefined;
  width?: number | undefined;
  height?: number | undefined;
  className?: string | undefined;
}) {
  const pid = "hatch-" + React.useId().replace(/:/g, "");
  if (upper.length < 2 || lower.length !== upper.length) return null;
  const all = [...upper, ...lower];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const n = upper.length;
  const padX = 8;
  const padY = 10;
  const x = (i: number) => padX + (i / (n - 1)) * (width - padX * 2);
  const y = (v: number) => padY + (1 - (v - min) / (max - min || 1)) * (height - padY * 2);
  const top = upper.map((v, i) => [x(i), y(v)] as [number, number]);
  const bot = lower.map((v, i) => [x(i), y(v)] as [number, number]);
  const poly = [...top, ...bot.slice().reverse()].map((p) => p.join(",")).join(" ");
  const ht = highlight != null ? top[highlight] : undefined;
  const hb = highlight != null ? bot[highlight] : undefined;
  return (
    <div className={className}>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full overflow-visible" role="img">
          <defs>
            <pattern id={pid} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="var(--chart-hatch)" strokeWidth="2" />
            </pattern>
          </defs>
          <polygon points={poly} fill={`url(#${pid})`} stroke="var(--chart-line)" strokeWidth="1" />
          {ht && hb && <line x1={ht[0]} y1={ht[1]} x2={hb[0]} y2={hb[1]} stroke="var(--accent)" strokeWidth="1" />}
          {[...top, ...bot].map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="var(--gray-400)" />
          ))}
        </svg>
        {upperLabel && (
          <span className="absolute left-0 text-[11px] text-gray-700" style={{ top: `${(top[0]![1] / height) * 100}%`, transform: "translateY(-150%)" }}>
            {upperLabel}
          </span>
        )}
        {lowerLabel && (
          <span className="absolute left-0 text-[11px] text-gray-700" style={{ top: `${(bot[0]![1] / height) * 100}%`, transform: "translateY(40%)" }}>
            {lowerLabel}
          </span>
        )}
        {ht && hb && tag != null && (
          <ValueTag
            className="absolute"
            style={{ left: `${(ht[0] / width) * 100}%`, top: `${((ht[1] + hb[1]) / 2 / height) * 100}%`, transform: "translate(-50%,-50%)" }}
          >
            {tag}
          </ValueTag>
        )}
      </div>
      {labels.length > 0 && (
        <div className="mt-4 flex justify-between text-xs text-muted-foreground">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const heatLevel = ["bg-hatch-light opacity-70", "bg-[var(--accent-100)]", "bg-[var(--accent-200)]", "bg-[var(--accent-300)]", "bg-[var(--accent-400)]"];

/** Grelha de intensidade 0–4 (0 = vazio com relevo claro), linhas com rótulo. */
export function Heatmap({
  rows,
  columns,
  cell = 26,
  gap = 4,
  labelWidth = 72,
  className,
}: {
  rows: { label: string; values: (number | null)[]; titles?: (string | undefined)[] }[];
  /** Rótulos das colunas (opcional, por baixo). */
  columns?: string[] | undefined;
  cell?: number | undefined;
  gap?: number | undefined;
  labelWidth?: number | undefined;
  className?: string | undefined;
}) {
  const cols = Math.max(0, ...rows.map((r) => r.values.length));
  return (
    <div className={cn("flex flex-col overflow-x-auto", className)} style={{ gap }}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center" style={{ gap }}>
          <span className="shrink-0 truncate text-xs" style={{ width: labelWidth }}>
            {r.label}
          </span>
          {Array.from({ length: cols }, (_, ci) => {
            const v = r.values[ci];
            return (
              <span
                key={ci}
                title={r.titles?.[ci]}
                className={cn("shrink-0 rounded-[6px]", v == null ? "bg-transparent" : heatLevel[Math.max(0, Math.min(4, v))])}
                style={{ width: cell, height: cell }}
              />
            );
          })}
        </div>
      ))}
      {columns && (
        <div className="flex" style={{ gap, paddingLeft: labelWidth + gap }}>
          {columns.map((c, i) => (
            <span key={i} className="shrink-0 text-center text-[10px] text-muted-foreground" style={{ width: cell }}>
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Nível 0–4 de um valor em relação ao máximo da série (para o Heatmap). */
export function heatLevelOf(value: number, max: number) {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil((value / max) * 4)));
}
