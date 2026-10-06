import { CheckCircle2, Play, ShoppingBag, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountPill, Field, Note, Section, Seg, SwitchRow, Tag, TimeChip } from "../ui";
import type { EditorClock } from "./video";

export type SalesQty = "poucas" | "moderadas" | "muitas";
export const SALES_QTY: Record<SalesQty, number> = { poucas: 3, moderadas: 6, muitas: 10 };

/** Vendas: as compras que aparecem na sala, de demonstração e reais. */
export function StepVendas({
  offerVisible,
  pitch,
  enabled,
  onEnabled,
  qty,
  onQty,
  real,
  onReal,
  where,
  onWhere,
  sales,
  clock: c,
  onGoOffer,
  onWatch,
  busy,
}: {
  offerVisible: boolean;
  pitch: number | null;
  enabled: boolean;
  onEnabled: (on: boolean) => void;
  qty: SalesQty;
  onQty: (qty: SalesQty) => void;
  real: boolean;
  onReal: (on: boolean) => void;
  where: "chat" | "video" | "both";
  onWhere: (where: "chat" | "video" | "both") => void;
  sales: readonly { id: string; at: number; buyer: string; product: string }[];
  clock: EditorClock;
  onGoOffer: () => void;
  /** Toca o vídeo um pouco antes deste segundo, para ver a compra a aparecer. */
  onWatch: (seconds: number) => void;
  busy: boolean;
}) {
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
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Quantidade">
            {(
              [
                ["poucas", "Poucas", ""],
                ["moderadas", "Moderadas", "Recomendado"],
                ["muitas", "Muitas", ""],
              ] as const
            ).map(([value, label, tag]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={qty === value}
                disabled={busy}
                onClick={() => onQty(value)}
                className={cn(
                  "grid justify-items-center gap-1.5 rounded-xl border bg-white px-2 py-3 transition hover:bg-gray-50 disabled:opacity-60",
                  qty === value && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
                )}
              >
                <span className="flex h-4 items-center gap-[3px]" aria-hidden>
                  {Array.from({ length: Math.min(6, Math.ceil(SALES_QTY[value] / 2)) }, (_, i) => (
                    <i key={i} className="size-[7px] rounded-full bg-[#30A46C]" />
                  ))}
                </span>
                <b className="text-[13px] font-semibold">{label}</b>
                <span className="text-[11.5px] text-muted-foreground">{SALES_QTY[value]} compras</span>
                {tag ? <Tag>{tag}</Tag> : <span className="h-[18px]" />}
              </button>
            ))}
          </div>
        ) : null}
      </Section>

      <Section icon={CheckCircle2} title="Compras reais">
        <SwitchRow
          title="Mostrar as compras da Kambafy"
          description="Aparecem na sala no momento em que acontecem, só com o primeiro nome."
          checked={real}
          onChange={onReal}
        />
      </Section>

      <Section title="Onde aparecem">
        <Field>
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
        </Field>
      </Section>

      {sales.length > 0 ? (
        <Section title="Na linha do vídeo" aside={<CountPill>{sales.length}</CountPill>}>
          <p className="text-[12.5px] text-muted-foreground">Clique numa compra para ver a sala nesse momento.</p>
          <div className="divide-y overflow-hidden rounded-xl border bg-white">
            {sales.map((s) => {
              const now = c.t >= s.at && c.t - s.at < 8;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onWatch(s.at)}
                  className={cn("flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] hover:bg-gray-50", now && "bg-[#DDF1E7]/60")}
                >
                  <TimeChip seconds={s.at} active={now} />
                  <span className="min-w-0 flex-1 truncate">
                    {s.buyer} comprou {s.product}
                  </span>
                  <Play className="size-3.5 shrink-0 fill-current text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </Section>
      ) : null}
    </>
  );
}

const BUYERS = ["Helena", "Bruno", "Inês", "Carla", "Tomás", "Sofia", "Rui", "Marta", "Diogo", "Paula"];

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
