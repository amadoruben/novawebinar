import { useMemo } from "react";
import { MessageSquare, ShoppingBag, ShoppingCart, Wand2, Users } from "lucide-react";

import { cn } from "@/lib/utils";

export type TimelineMarker = {
  id: string;
  at: number;
  kind: "ai" | "manual" | "offer" | "sales" | "audience";
  label: string;
};

const KIND_STYLE: Record<
  TimelineMarker["kind"],
  { color: string; icon: typeof MessageSquare; name: string }
> = {
  ai: { color: "bg-primary", icon: Wand2, name: "Chat gerado com IA" },
  manual: { color: "bg-foreground", icon: MessageSquare, name: "Comentário manual" },
  offer: { color: "bg-emerald-500", icon: ShoppingCart, name: "Oferta" },
  sales: { color: "bg-amber-500", icon: ShoppingBag, name: "Notificações de compra" },
  audience: { color: "bg-sky-500", icon: Users, name: "Audiência" },
};

function clock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Régua única do minuto zero ao fim do vídeo. Mostra tudo o que acontece
 * durante a sessão e permite saltar para qualquer momento.
 */
export function WebinarTimeline({
  durationSeconds,
  markers,
  cursor,
  onSeek,
}: {
  durationSeconds: number;
  markers: TimelineMarker[];
  cursor?: number;
  onSeek?: (seconds: number) => void;
}) {
  const duration = Math.max(60, durationSeconds || 0);

  const ticks = useMemo(() => {
    const step = duration > 3600 ? 600 : duration > 1200 ? 300 : 60;
    const values: number[] = [];
    for (let t = 0; t <= duration; t += step) values.push(t);
    return values;
  }, [duration]);

  const grouped = useMemo(() => {
    const kinds: TimelineMarker["kind"][] = ["ai", "manual", "offer", "sales", "audience"];
    return kinds
      .map((kind) => ({
        kind,
        items: markers.filter((m) => m.kind === kind).sort((a, b) => a.at - b.at),
      }))
      .filter((row) => row.items.length > 0);
  }, [markers]);

  const percent = (value: number) => `${Math.min(100, Math.max(0, (value / duration) * 100))}%`;

  return (
    <div className="space-y-4 rounded-2xl border bg-background p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {grouped.map(({ kind, items }) => {
          const style = KIND_STYLE[kind];
          const Icon = style.icon;
          return (
            <span key={kind} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-2.5 rounded-full", style.color)} />
              <Icon className="size-3.5" />
              {style.name} ({items.length})
            </span>
          );
        })}
        {grouped.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Ainda não há nada marcado nesta sessão.
          </span>
        )}
      </div>

      <div
        className="relative cursor-pointer select-none rounded-xl bg-muted/50 py-3"
        onClick={(event) => {
          if (!onSeek) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          onSeek(Math.round(Math.min(1, Math.max(0, ratio)) * duration));
        }}
      >
        {grouped.map(({ kind, items }) => (
          <div key={kind} className="relative mx-3 h-7">
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
            {items.map((marker) => (
              <span
                key={marker.id}
                title={`${clock(marker.at)} — ${marker.label}`}
                style={{ left: percent(marker.at) }}
                className={cn(
                  "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background",
                  KIND_STYLE[kind].color,
                )}
              />
            ))}
          </div>
        ))}

        {cursor !== undefined && (
          <span
            style={{
              left: `calc(0.75rem + (100% - 1.5rem) * ${Math.min(1, Math.max(0, cursor / duration))})`,
            }}
            className="pointer-events-none absolute inset-y-1 w-0.5 -translate-x-1/2 rounded bg-primary"
          />
        )}
      </div>

      <div className="mx-3 flex justify-between text-[10px] font-semibold tabular-nums text-muted-foreground">
        {ticks.map((tick) => (
          <span key={tick}>{clock(tick)}</span>
        ))}
      </div>
    </div>
  );
}
