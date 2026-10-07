import { useMemo, useRef } from "react";
import { CheckCircle2, Palette, Radio, ShoppingBag, ShoppingCart, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/room-logic";
import { SALE_COLORS, saleColor } from "@/components/room/room-parts";
import { Field, Note, Section, Seg, Stepper, SwitchRow } from "../ui";
import type { EditorClock } from "./video";

/** Vendas: as compras que aparecem na sala, de demonstração e reais. */
export function StepVendas({
  offerVisible,
  pitch,
  enabled,
  onEnabled,
  count,
  onCount,
  color,
  onColor,
  real,
  onReal,
  where,
  onWhere,
  sales,
  product,
  clock: c,
  onGoOffer,
  onWatch,
  busy,
}: {
  offerVisible: boolean;
  pitch: number | null;
  enabled: boolean;
  onEnabled: (on: boolean) => void;
  /** Quantas compras de demonstração. */
  count: number;
  onCount: (count: number) => void;
  /** A cor do aviso de compra (no vídeo e no chat). */
  color: string;
  onColor: (color: string) => void;
  real: boolean;
  onReal: (on: boolean) => void;
  where: "chat" | "video" | "both";
  onWhere: (where: "chat" | "video" | "both") => void;
  sales: readonly { id: string; at: number; buyer: string; product: string }[];
  product: string;
  clock: EditorClock;
  onGoOffer: () => void;
  /** Toca o vídeo um pouco antes deste segundo, para ver a compra a aparecer. */
  onWatch: (seconds: number) => void;
  busy: boolean;
}) {
  const tone = saleColor(color);
  return (
    <>
      {offerVisible && pitch === null ? (
        <div className="pb-3.5">
          <Note icon={TriangleAlert} tone="warn">
            Sem minuto do pitch, as compras contam do início.{" "}
            <button type="button" onClick={onGoOffer} className="font-medium underline underline-offset-2">
              Marcar na Oferta
            </button>
          </Note>
        </div>
      ) : null}

      <Section icon={ShoppingBag} title="Compras de demonstração" help="vendas">
        <SwitchRow
          title="Mostrar compras de demonstração"
          description="Só depois do pitch. Nunca entram nas métricas."
          checked={enabled}
          onChange={onEnabled}
          disabled={busy}
        />
        {enabled ? (
          <Field label="Quantas compras" hint="Espalham-se do pitch até ao fim do vídeo.">
            <div className="flex flex-wrap items-center gap-2">
              <Stepper value={count} min={1} max={50} onChange={onCount} unit="compras" />
              <Seg
                small
                label="Quantidades rápidas"
                value={String(count)}
                onChange={(v) => {
                  if (!busy) onCount(Number(v));
                }}
                options={[3, 6, 10, 20].map((n) => ({ value: String(n), label: String(n) }))}
              />
            </div>
          </Field>
        ) : null}
      </Section>

      <Section icon={CheckCircle2} title="Compras reais" help="comprasReais">
        <SwitchRow
          title="Mostrar as compras da Kambafy"
          description="Aparecem na sala no momento em que acontecem, só com o primeiro nome."
          checked={real}
          onChange={onReal}
        />
      </Section>

      <Section icon={Radio} title="Onde aparecem" help="vendasOnde">
        <Seg
          full
          small
          value={where}
          onChange={onWhere}
          options={[
            { value: "video", label: "No vídeo" },
            { value: "chat", label: "No chat" },
            { value: "both", label: "Nos dois" },
          ]}
        />
      </Section>

      <Section icon={Palette} title="Cor do aviso" help="vendasCor">
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Cor do aviso de compra">
          {Object.entries(SALE_COLORS).map(([key, value]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={color === key}
              aria-label={value.label}
              title={value.label}
              onClick={() => onColor(key)}
              className={cn("size-8 rounded-full ring-1 ring-black/10 transition", color === key && "ring-2 ring-foreground ring-offset-2")}
              style={{ background: value.solid }}
            />
          ))}
        </div>
        {/* Como fica: o aviso no vídeo e a linha no chat, na cor escolhida. */}
        <div className="grid gap-2.5 rounded-xl bg-[#141414] p-3">
          <span
            className="flex items-center gap-2.5 justify-self-start rounded-[12px] py-2 pl-2 pr-3.5 text-white shadow-[0_8px_20px_rgba(0,0,0,.35)]"
            style={{ background: tone.solid }}
          >
            <span className="grid size-7 place-items-center rounded-full bg-white/25">
              <ShoppingCart className="size-3.5" />
            </span>
            <span className="leading-tight">
              <b className="block text-[13px] font-bold">Helena comprou {product.trim() || "a vaga"}</b>
              <small className="text-[11px] text-white/80">agora mesmo · no vídeo</small>
            </span>
          </span>
          <span
            className="inline-flex items-center gap-2 justify-self-start rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold"
            style={{ background: tone.soft, color: tone.ink }}
          >
            <ShoppingCart className="size-3.5" />
            Bruno comprou {product.trim() || "a vaga"} · no chat
          </span>
        </div>
      </Section>

      {sales.length > 0 ? (
        <Section icon={ShoppingBag} title="Na linha do vídeo" help="vendasLinha">
          <SalesChart sales={sales} pitch={pitch} clock={c} color={tone.solid} onWatch={onWatch} />
        </Section>
      ) : null}
    </>
  );
}

/**
 * As compras ao longo do vídeo, como o gráfico da Audiência: a linha sobe a cada compra e cada
 * ponto é uma compra. Arrastar o cursor leva a sala a esse minuto; clicar num ponto toca a sala
 * uns segundos antes, para ver o aviso a aparecer.
 */
function SalesChart({
  sales,
  pitch,
  clock: c,
  color,
  onWatch,
}: {
  sales: readonly { id: string; at: number; buyer: string; product: string }[];
  pitch: number | null;
  clock: EditorClock;
  color: string;
  onWatch: (seconds: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const d = Math.max(1, c.duration);
  const sorted = useMemo(() => [...sales].sort((a, b) => a.at - b.at), [sales]);
  const n = sorted.length;
  const x = (s: number) => (Math.min(d, Math.max(0, s)) / d) * 100;
  const y = (k: number) => 100 - (k / Math.max(1, n)) * 86;
  const path = useMemo(() => {
    let line = `M0,${y(0)}`;
    sorted.forEach((s, i) => {
      line += ` L${x(s.at).toFixed(2)},${y(i).toFixed(2)} L${x(s.at).toFixed(2)},${y(i + 1).toFixed(2)}`;
    });
    line += ` L100,${y(n).toFixed(2)}`;
    return { line, area: `${line} L100,100 L0,100 Z` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, d, n]);
  const done = sorted.filter((s) => s.at <= c.t).length;
  const fx = Math.min(1, Math.max(0, c.t / d));
  const seekAt = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    c.seek(Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * d));
  };
  return (
    <div className="grid gap-2 rounded-xl border bg-white p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm">
          <b className="font-mono text-xl font-semibold tabular-nums">{done}</b> de {n} compras
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
          if ((e.target as HTMLElement).dataset["sale"]) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          seekAt(e.clientX);
        }}
        onPointerMove={(e) => e.buttons && !(e.target as HTMLElement).dataset["sale"] && seekAt(e.clientX)}
        className="relative h-[120px] cursor-grab touch-none select-none active:cursor-grabbing"
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
          <path d={path.area} fill={color} opacity={0.1} />
          <path d={path.line} fill="none" stroke={color} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        </svg>
        {pitch !== null && pitch <= d ? (
          <div className="absolute inset-y-0 border-l border-dashed border-foreground/70" style={{ left: `${x(pitch)}%` }}>
            <span className="absolute -left-px top-0 -translate-x-full whitespace-nowrap rounded bg-foreground px-1.5 py-px text-[10.5px] font-semibold text-background">
              Oferta {clock(pitch)}
            </span>
          </div>
        ) : null}
        {sorted.map((s, i) => (
          <button
            key={s.id}
            type="button"
            data-sale="1"
            onClick={() => onWatch(s.at)}
            title={`${clock(s.at)} · ${s.buyer} comprou ${s.product}`}
            aria-label={`Ver a compra de ${s.buyer} aos ${clock(s.at)}`}
            className={cn(
              "absolute z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.12)] transition hover:scale-150",
              s.at > c.t && "opacity-60",
            )}
            style={{ left: `${x(s.at)}%`, top: `${y(i + 1)}%`, background: color }}
          />
        ))}
        <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground" style={{ left: `${fx * 100}%` }}>
          <span className="absolute -top-1 left-1/2 size-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-foreground" />
        </div>
      </div>
      <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>00:00</span>
        <span>{clock(d / 2)}</span>
        <span>{clock(d)}</span>
      </div>
      <p className="text-[12.5px] text-muted-foreground">Clique num ponto: a sala toca uns segundos antes e vê a compra a aparecer.</p>
    </div>
  );
}

const BUYERS = ["Helena", "Bruno", "Inês", "Carla", "Tomás", "Sofia", "Rui", "Marta", "Diogo", "Paula", "Edson", "Kátia", "Nelson", "Yola", "Célia", "Hélio"];

/** As compras de demonstração: depois do pitch, espalhadas até ao fim do vídeo. */
export function demoSales(count: number, pitch: number | null, duration: number) {
  const p = pitch ?? 0;
  const d = Math.max(duration, p + 20);
  const span = Math.max(12, d - p - 6);
  return Array.from({ length: count }, (_, i) => ({
    buyer: BUYERS[i % BUYERS.length]!,
    at: Math.min(d - 1, Math.round(p + 4 + ((i + 0.5) * span) / count)),
  }));
}
