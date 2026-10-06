import { ArrowUp, Heart, ShoppingCart } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Peças da sala que a sala pública e a pré-visualização do editor desenham iguais: o coração
 * com as reações (só no separador Chat), o envio, o cartão da oferta e o cronómetro em blocos.
 */

const ROOM_PARTS_CSS = `@keyframes cwRxUp{0%{opacity:0;transform:translate(0,0) scale(.5)}12%{opacity:1;transform:translate(0,-18px) scale(1.1)}75%{opacity:.9}100%{opacity:0;transform:translate(var(--dx),calc(-1 * var(--h,250px))) scale(.9)}}.cw-rx{animation:cwRxUp 2.6s cubic-bezier(.2,.6,.3,1) forwards}@keyframes cwDot{50%{opacity:.35}}.cw-dot{animation:cwDot 1.4s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.cw-rx{display:none}.cw-dot{animation:none}}`;

export function RoomPartsStyle() {
  return <style>{ROOM_PARTS_CSS}</style>;
}

export type Reaction = { id: string | number; offset: number; size?: number };

/** O coração com fundo cheio; as reações sobem por cima dele, dentro do painel do chat. */
export function HeartButton({
  onHeart,
  reactions,
  compact,
  disabled,
}: {
  onHeart: () => void;
  reactions: readonly Reaction[];
  compact?: boolean | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <span className="relative shrink-0">
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 -ml-9 w-[72px] overflow-hidden [mask-image:linear-gradient(to_top,#000_70%,transparent)]",
          compact ? "h-[200px] [--h:185px]" : "h-[270px] [--h:250px]",
        )}
      >
        {reactions.map((r) => {
          const size = r.size ?? 24;
          return (
            <span
              key={r.id}
              className="cw-rx absolute bottom-0 leading-none opacity-0"
              style={
                {
                  left: `calc(50% - ${size / 2}px + ${r.offset * 0.4}px)`,
                  fontSize: size,
                  "--dx": `${Math.round(r.offset * 0.6)}px`,
                } as CSSProperties
              }
            >
              ❤️
            </span>
          );
        })}
      </span>
      <button
        type="button"
        onClick={onHeart}
        disabled={disabled}
        aria-label="Reagir com um coração"
        title="Reagir com um coração"
        className={cn(
          "grid place-items-center rounded-full bg-[linear-gradient(140deg,#FF5C7A,#E5484D)] text-white shadow-[0_6px_16px_-6px_rgba(229,72,77,.7)] transition hover:scale-110 active:scale-90",
          compact ? "size-10" : "size-11",
        )}
      >
        <Heart className="size-5 fill-current" />
      </button>
    </span>
  );
}

/** O botão de enviar, cinzento para não competir com o coração. */
export function SendButton({ compact, disabled }: { compact?: boolean | undefined; disabled?: boolean | undefined }) {
  return (
    <button
      type="submit"
      aria-label="Enviar"
      disabled={disabled}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[#333333] text-white transition hover:bg-[#3d3d3d]",
        compact ? "size-10" : "size-11",
      )}
    >
      <ArrowUp className="size-4" />
    </button>
  );
}

/** «A oferta termina em» com os minutos e os segundos em blocos. */
export function CountdownBlocks({ seconds, compact }: { seconds: number; compact?: boolean | undefined }) {
  const s = Math.max(0, Math.round(seconds));
  const mm = String(Math.min(99, Math.floor(s / 60))).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const tile = cn(
    "grid place-items-center rounded-lg bg-[#0E0E0E] font-extrabold tabular-nums text-white shadow-[0_0_0_1px_#2E2E2E]",
    compact ? "h-11 w-[34px] text-[26px]" : "h-[52px] w-10 text-[32px]",
  );
  const group = (digits: string, label: string) => (
    <span className="relative flex gap-1 pb-[18px]">
      {digits.split("").map((d, i) => (
        <b key={i} className={tile}>
          {d}
        </b>
      ))}
      <em className="absolute inset-x-0 bottom-0 text-center text-[10.5px] font-semibold not-italic uppercase tracking-[0.12em] text-[#A3A3A3]">
        {label}
      </em>
    </span>
  );
  return (
    <div className="grid justify-items-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#2B1A12,#1A1A1A)] px-3 pb-3 pt-3.5 shadow-[0_0_0_1px_#3A2A20]">
      <small className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F2A27E]">
        {s > 0 ? "A oferta termina em" : "Tempo esgotado"}
      </small>
      <div className="flex items-start gap-1.5">
        {group(mm, "min")}
        <i className={cn("font-extrabold not-italic text-[#737373]", compact ? "text-2xl leading-[44px]" : "text-[30px] leading-[52px]")}>
          :
        </i>
        {group(ss, "seg")}
      </div>
    </div>
  );
}

/** O separador Oferta: produto, preços, botão e cronómetro. */
export function OfferCard({
  productName,
  imageUrl,
  priceFrom,
  priceNow,
  buttonText,
  onBuy,
  countdownSeconds,
  showCountdown,
  closed,
  note,
  compact,
  highlight,
}: {
  productName?: string | null | undefined;
  imageUrl?: string | null | undefined;
  priceFrom?: string | null | undefined;
  priceNow?: string | null | undefined;
  buttonText: string;
  onBuy?: (() => void) | undefined;
  countdownSeconds: number;
  showCountdown: boolean;
  /** O cronómetro chegou a zero e o botão fecha. */
  closed?: boolean | undefined;
  /** Na pré-visualização, antes de a oferta abrir. */
  note?: string | null | undefined;
  compact?: boolean | undefined;
  highlight?: string | null | undefined;
}) {
  const hl = (key: string) =>
    highlight === key ? "outline outline-2 outline-offset-4 outline-[#E8440C] shadow-[0_0_0_10px_rgba(232,68,12,.25)]" : "";
  return (
    <div className="grid content-start gap-4 p-4">
      {note ? <p className="rounded-[10px] bg-[#2A2418] px-3 py-2.5 text-[13px] text-[#F2C77B]">{note}</p> : null}
      {imageUrl || productName !== undefined ? (
        <div
          className={cn(
            "relative grid content-end overflow-hidden rounded-xl p-4 shadow-[0_0_0_1px_#2E2E2E]",
            compact ? "h-[110px]" : "h-[168px]",
            !imageUrl &&
              "bg-[radial-gradient(100%_120%_at_100%_0%,rgba(232,68,12,.45),transparent_60%),linear-gradient(160deg,#2a2f38,#15171b)]",
            hl("product"),
          )}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={productName || "Oferta"} className="absolute inset-0 size-full object-cover" />
          ) : null}
          {productName ? (
            <span className="relative text-[22px] font-extrabold leading-tight drop-shadow">{productName}</span>
          ) : productName === "" ? (
            <em className="relative justify-self-start rounded-lg border-[1.5px] border-dashed border-[#F2C77B] px-2.5 py-1 text-lg font-bold not-italic text-[#F2C77B]">
              Nome do produto
            </em>
          ) : null}
        </div>
      ) : null}
      {priceFrom || priceNow ? (
        <div className={cn("border-t border-[#2E2E2E] pt-4", hl("price"))}>
          {priceFrom ? <p className="text-[15px] font-bold text-[#A3A3A3] line-through">De {priceFrom}</p> : null}
          {priceNow ? (
            <p className={cn("font-black tracking-tight", compact ? "text-[28px]" : "text-[34px]")}>Por {priceNow}</p>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={onBuy}
        disabled={closed}
        className={cn(
          "flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#E8440C] font-black uppercase tracking-[0.03em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-[#3A3A3A] disabled:text-[#A3A3A3]",
          compact ? "h-[54px] text-[15px]" : "h-[60px] text-[17px]",
          hl("cta"),
        )}
      >
        <ShoppingCart className="size-5" />
        {closed ? "Oferta encerrada" : buttonText}
      </button>
      {showCountdown ? <CountdownBlocks seconds={countdownSeconds} compact={compact} /> : null}
    </div>
  );
}

/** A linha de uma compra no chat. */
export function SaleLine({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-2 self-start rounded-[10px] bg-[rgba(29,138,94,.18)] px-3 py-2 text-[13.5px] font-semibold text-[#7FD8AE]">
      <ShoppingCart className="size-4 shrink-0" />
      <span className="min-w-0">{text}</span>
    </div>
  );
}

/** O ponto que pulsa no separador Oferta enquanto não está aberto. */
export function PulseDot() {
  return <span aria-hidden className="cw-dot size-[7px] rounded-full bg-[#E8440C]" />;
}
