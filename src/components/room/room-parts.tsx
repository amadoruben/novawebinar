import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUp,
  BadgeCheck,
  Captions,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Monitor,
  Moon,
  Settings,
  ShoppingCart,
  Smile,
  Sparkles,
  Sun,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Peças da sala que a sala pública e a pré-visualização do editor desenham iguais. As cores
 * vêm dos tokens da sala (room-*), por isso o tema escuro e o claro servem as duas.
 */

const ROOM_PARTS_CSS = `@keyframes cwRxUp{0%{opacity:0;transform:translate(0,0) scale(.5)}12%{opacity:1;transform:translate(0,-18px) scale(1.1)}75%{opacity:.9}100%{opacity:0;transform:translate(var(--dx),calc(-1 * var(--h,250px))) scale(.9)}}.cw-rx{animation:cwRxUp 2.6s cubic-bezier(.2,.6,.3,1) forwards}@keyframes cwDot{50%{opacity:.35}}.cw-dot{animation:cwDot 1.4s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.cw-rx{display:none}.cw-dot{animation:none}}`;

export function RoomPartsStyle() {
  return <style>{ROOM_PARTS_CSS}</style>;
}

export type Reaction = { id: string | number; offset: number; size?: number };
export type Appearance = "system" | "dark" | "light";

/* ---------- Título e quem apresenta ---------- */

export function RoomTitle({
  kicker,
  title,
  host,
  compact,
  highlight,
}: {
  kicker: string;
  title: string;
  host: { name: string; role: string; avatarUrl: string; verified: boolean };
  compact?: boolean | undefined;
  highlight?: string | null | undefined;
}) {
  const hl = (key: string) =>
    highlight === key ? "outline outline-2 outline-offset-4 outline-[#E8440C] shadow-[0_0_0_10px_rgba(232,68,12,.25)]" : "";
  const initials = host.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div className={compact ? "px-4 py-3" : "pt-5"}>
      {!compact ? (
        <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-primary">{kicker}</p>
      ) : null}
      <h1
        className={cn(
          "font-extrabold tracking-tight text-room-text",
          compact ? "mb-2.5 line-clamp-2 text-[18px] leading-snug" : "mt-1.5 text-[32px] leading-tight",
          hl("title"),
        )}
      >
        {title}
      </h1>
      {host.name ? (
        <div className={cn("flex items-center", compact ? "gap-2.5" : "mt-4 gap-3.5", hl("host"))}>
          {host.avatarUrl ? (
            <img
              src={host.avatarUrl}
              alt=""
              className={cn("shrink-0 rounded-full object-cover ring-1 ring-room-line", compact ? "size-10" : "size-12")}
            />
          ) : (
            <span
              className={cn(
                "grid shrink-0 place-items-center rounded-full bg-room-raised font-bold text-room-text ring-1 ring-room-line",
                compact ? "size-10 text-sm" : "size-12 text-base",
              )}
            >
              {initials || "?"}
            </span>
          )}
          <span className="min-w-0">
            <b className={cn("flex items-center gap-1.5 font-semibold text-room-text", compact ? "text-[15px]" : "text-[17px]")}>
              <span className="truncate">{host.name}</span>
              {host.verified ? (
                <BadgeCheck className="size-[18px] shrink-0 fill-[#0095f6] text-white" aria-label="Verificado" />
              ) : null}
            </b>
            {host.role ? (
              <span className={cn("block truncate text-room-subtle", compact ? "text-[13px]" : "text-sm")}>{host.role}</span>
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Definições do vídeo, como no YouTube ---------- */

/**
 * O botão ⚙ do vídeo: volume, legendas, qualidade (automática, sempre a melhor) e aparência.
 * Sem velocidade nem avançar: a sessão parece sempre ao vivo.
 */
export function VideoSettings({
  volume,
  onVolume,
  captions,
  onCaptions,
  hasCaptions,
  appearance,
  onAppearance,
  compact,
}: {
  volume: number;
  onVolume: (volume: number) => void;
  captions: boolean;
  onCaptions: (on: boolean) => void;
  hasCaptions: boolean;
  appearance: Appearance;
  onAppearance: (appearance: Appearance) => void;
  compact?: boolean | undefined;
}) {
  const [page, setPage] = useState<"main" | "appearance">("main");
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const appearanceLabel = { system: "Do dispositivo", dark: "Escuro", light: "Claro" }[appearance];
  const row = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] hover:bg-white/10";
  return (
    <Popover onOpenChange={(open) => open && setPage("main")}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Definições do vídeo"
          title="Definições"
          className={cn(
            "grid place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75",
            compact ? "size-8" : "size-10",
          )}
        >
          <Settings className={compact ? "size-4" : "size-5"} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-[272px] rounded-xl border-0 bg-[rgba(28,28,28,.94)] p-1.5 text-white shadow-2xl backdrop-blur-md"
      >
        {page === "main" ? (
          <div className="grid gap-0.5">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <button
                type="button"
                onClick={() => onVolume(volume === 0 ? 1 : 0)}
                aria-label={volume === 0 ? "Ligar o som" : "Tirar o som"}
                className="grid size-7 shrink-0 place-items-center rounded-md hover:bg-white/10"
              >
                <VolumeIcon className="size-[18px]" />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => onVolume(Number(e.target.value))}
                aria-label="Volume"
                className="h-1 flex-1 cursor-pointer accent-white"
              />
            </div>
            {hasCaptions ? (
              <button type="button" onClick={() => onCaptions(!captions)} className={row}>
                <Captions className="size-[18px] shrink-0" />
                <span className="flex-1">Legendas</span>
                <span className="text-[13px] text-white/60">{captions ? "Ligadas" : "Desligadas"}</span>
              </button>
            ) : null}
            <div className={cn(row, "cursor-default hover:bg-transparent")}>
              <Sparkles className="size-[18px] shrink-0" />
              <span className="flex-1">Qualidade</span>
              <span className="text-[13px] text-white/60">Automática</span>
            </div>
            <button type="button" onClick={() => setPage("appearance")} className={row}>
              <Moon className="size-[18px] shrink-0" />
              <span className="flex-1">Aparência</span>
              <span className="text-[13px] text-white/60">{appearanceLabel}</span>
              <ChevronRight className="size-4 text-white/60" />
            </button>
          </div>
        ) : (
          <div className="grid gap-0.5">
            <button type="button" onClick={() => setPage("main")} className={cn(row, "border-b border-white/10 pb-3")}>
              <ChevronLeft className="size-4" />
              <span className="flex-1 font-medium">Aparência</span>
            </button>
            {(
              [
                ["system", "Do dispositivo", Monitor],
                ["dark", "Escuro", Moon],
                ["light", "Claro", Sun],
              ] as const
            ).map(([value, label, Icon]) => (
              <button key={value} type="button" onClick={() => onAppearance(value)} className={row}>
                <Icon className="size-[18px] shrink-0" />
                <span className="flex-1">{label}</span>
                {appearance === value ? <Check className="size-4" /> : null}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** A legenda da fala, por cima do vídeo, como no YouTube. */
export function CaptionLine({ text, compact }: { text: string | null; compact?: boolean | undefined }) {
  if (!text) return null;
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 flex justify-center px-6", compact ? "bottom-3" : "bottom-6")}>
      <span
        className={cn(
          "max-w-[80%] rounded-md bg-black/75 px-2.5 py-1 text-center font-medium leading-snug text-white",
          compact ? "text-[11px]" : "text-[17px]",
        )}
      >
        {text}
      </span>
    </div>
  );
}

/* ---------- Escrever no chat ---------- */

const EMOJIS = ["😀", "😂", "😍", "🥰", "😮", "🤔", "👏", "🙌", "👍", "💪", "🔥", "💯", "❤️", "🎉", "🙏", "✅", "😅", "🤩", "😢", "👀", "💡", "🚀", "⭐", "🇦🇴", "🇧🇷", "🇵🇹"];

/**
 * A caixa de escrever, como o chat ao vivo do YouTube: o campo, os emojis e o coração; a seta de
 * enviar aparece quando há texto. As reações sobem por cima do coração, só no separador Chat.
 */
export function ChatComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  withReactions,
  onHeart,
  reactions,
  compact,
  inputProps,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  withReactions: boolean;
  onHeart?: (() => void) | undefined;
  reactions?: readonly Reaction[] | undefined;
  compact?: boolean | undefined;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement> | undefined;
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const icon = cn(
    "grid shrink-0 place-items-center rounded-full text-room-subtle transition hover:bg-room-raised hover:text-room-text",
    compact ? "size-9" : "size-10",
  );
  return (
    <form
      className="flex items-center gap-1 border-t border-room-line px-3 py-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) onSubmit();
      }}
    >
      <input
        {...inputProps}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="send"
        className={cn(
          "min-w-0 flex-1 rounded-full bg-room-raised px-4 text-room-text outline-none ring-1 ring-room-line placeholder:text-room-subtle focus:ring-primary/60",
          compact ? "h-9 text-[13px]" : "h-10 text-sm",
        )}
      />
      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Emojis" title="Emojis" className={icon}>
            <Smile className="size-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-[248px] p-2">
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onChange(`${value}${emoji}`)}
                className="grid size-7 place-items-center rounded-md text-lg hover:bg-accent"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {withReactions && onHeart ? <HeartButton onHeart={onHeart} reactions={reactions ?? []} className={icon} /> : null}
      {value.trim() ? (
        <button
          type="submit"
          aria-label="Enviar"
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:brightness-110",
            compact ? "size-9" : "size-10",
          )}
        >
          <ArrowUp className="size-4" />
        </button>
      ) : null}
    </form>
  );
}

/** O coração: as reações sobem por cima dele, dentro do painel do chat. */
export function HeartButton({
  onHeart,
  reactions,
  className,
}: {
  onHeart: () => void;
  reactions: readonly Reaction[];
  className: string;
}) {
  return (
    <span className="relative shrink-0">
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 -ml-9 h-[240px] w-[72px] overflow-hidden [--h:220px] [mask-image:linear-gradient(to_top,#000_70%,transparent)]"
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
      <button type="button" onClick={onHeart} aria-label="Reagir com um coração" title="Reagir" className={className}>
        <Heart className="size-5" />
      </button>
    </span>
  );
}

/* ---------- Oferta ---------- */

/** «A oferta termina em» com os minutos e os segundos em blocos. */
export function CountdownBlocks({ seconds, compact }: { seconds: number; compact?: boolean | undefined }) {
  const s = Math.max(0, Math.round(seconds));
  const mm = String(Math.min(99, Math.floor(s / 60))).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const tile = cn(
    "grid place-items-center rounded-lg bg-room-raised font-extrabold tabular-nums text-room-text ring-1 ring-room-line",
    compact ? "h-11 w-[34px] text-[26px]" : "h-[52px] w-10 text-[32px]",
  );
  const group = (digits: string, label: string) => (
    <span className="relative flex gap-1 pb-[18px]">
      {digits.split("").map((d, i) => (
        <b key={i} className={tile}>
          {d}
        </b>
      ))}
      <em className="absolute inset-x-0 bottom-0 text-center text-[10.5px] font-semibold not-italic uppercase tracking-[0.12em] text-room-subtle">
        {label}
      </em>
    </span>
  );
  return (
    <div className="grid justify-items-center gap-2 rounded-[14px] bg-primary/10 px-3 pb-3 pt-3.5 ring-1 ring-primary/25">
      <small className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
        {s > 0 ? "A oferta termina em" : "Tempo esgotado"}
      </small>
      <div className="flex items-start gap-1.5">
        {group(mm, "min")}
        <i className={cn("font-extrabold not-italic text-room-subtle", compact ? "text-2xl leading-[44px]" : "text-[30px] leading-[52px]")}>
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
  /** O cronómetro chegou a zero (e o botão fecha) ou o prazo passou. */
  closed?: boolean | undefined;
  /** Na pré-visualização, antes de a oferta abrir. */
  note?: ReactNode;
  compact?: boolean | undefined;
  highlight?: string | null | undefined;
}) {
  const hl = (key: string) =>
    highlight === key ? "outline outline-2 outline-offset-4 outline-[#E8440C] shadow-[0_0_0_10px_rgba(232,68,12,.25)]" : "";
  return (
    <div className="grid content-start gap-4 p-4">
      {note ? <p className="rounded-[10px] bg-amber-500/15 px-3 py-2.5 text-[13px] font-medium text-amber-500">{note}</p> : null}
      {imageUrl || productName !== undefined ? (
        <div
          className={cn(
            "relative grid content-end overflow-hidden rounded-xl p-4 text-white ring-1 ring-room-line",
            compact ? "h-[110px]" : "h-[150px]",
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
        <div className={cn("border-t border-room-line pt-4", hl("price"))}>
          {priceFrom ? <p className="text-[15px] font-bold text-room-subtle line-through">De {priceFrom}</p> : null}
          {priceNow ? (
            <p className={cn("font-black tracking-tight text-room-text", compact ? "text-[28px]" : "text-[34px]")}>
              Por {priceNow}
            </p>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={onBuy}
        disabled={closed}
        className={cn(
          "flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#E8440C] font-black uppercase tracking-[0.03em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-room-raised disabled:text-room-subtle",
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
    <div className="inline-flex items-center gap-2 self-start rounded-[10px] bg-emerald-500/15 px-3 py-2 text-[13.5px] font-semibold text-emerald-500">
      <ShoppingCart className="size-4 shrink-0" />
      <span className="min-w-0">{text}</span>
    </div>
  );
}

/** O ponto que pulsa no separador Oferta enquanto não está aberto. */
export function PulseDot() {
  return <span aria-hidden className="cw-dot size-[7px] rounded-full bg-[#E8440C]" />;
}
