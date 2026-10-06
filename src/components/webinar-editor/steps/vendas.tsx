import { ShoppingBag, TriangleAlert } from "lucide-react";
import { CountPill, Field, Note, Section, Seg, SwitchRow, Tag, TimeChip } from "../ui";
import type { EditorClock } from "./video";

export type SalesQty = "poucas" | "moderadas" | "muitas";
export const SALES_QTY: Record<SalesQty, number> = { poucas: 3, moderadas: 6, muitas: 10 };

/** Vendas: as compras de demonstração que aparecem na sala depois do pitch. */
export function StepVendas({
  offerVisible,
  pitch,
  enabled,
  onEnabled,
  qty,
  onQty,
  sales,
  clock: c,
  onGoOffer,
  busy,
}: {
  offerVisible: boolean;
  pitch: number | null;
  enabled: boolean;
  onEnabled: (on: boolean) => void;
  qty: SalesQty;
  onQty: (qty: SalesQty) => void;
  sales: readonly { id: string; at: number; buyer: string; product: string }[];
  clock: EditorClock;
  onGoOffer: () => void;
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
          <Field label="Quantidade">
            <Seg
              full
              small
              value={qty}
              onChange={onQty}
              options={[
                { value: "poucas", label: "Poucas" },
                { value: "moderadas", label: "Moderadas", tag: "Recomendado" },
                { value: "muitas", label: "Muitas" },
              ]}
            />
          </Field>
        ) : null}
        <p className="text-[12.5px] text-muted-foreground">Aparecem no vídeo e ficam no chat, com o nome do produto da Oferta.</p>
      </Section>
      {sales.length > 0 ? (
        <Section title="Na linha do vídeo" aside={<CountPill>{sales.length}</CountPill>}>
          <div className="divide-y overflow-hidden rounded-xl border bg-white">
            {sales.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => c.seek(s.at)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] hover:bg-gray-50"
              >
                <TimeChip seconds={s.at} active={c.t >= s.at && c.t - s.at < 8} />
                <span className="min-w-0 flex-1 truncate">
                  {s.buyer} comprou {s.product}
                </span>
                <Tag tone="gray">Demonstração</Tag>
              </button>
            ))}
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
