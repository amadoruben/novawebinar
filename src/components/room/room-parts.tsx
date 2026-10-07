import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  Captions,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Headset,
  Heart,
  Monitor,
  Moon,
  SendHorizontal,
  Settings,
  ShoppingCart,
  Smile,
  Sparkles,
  Sun,
  Users,
  Volume1,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Peças da sala que a sala pública e a pré-visualização do editor desenham iguais. As cores
 * vêm dos tokens da sala (room-*), por isso o tema escuro e o claro servem as duas.
 */

const ROOM_PARTS_CSS = `@keyframes cwRxUp{0%{opacity:0;transform:translate(0,0) scale(.6)}8%{opacity:1;transform:translate(0,-14px) scale(1)}28%{transform:translate(var(--sway),-62px)}50%{transform:translate(calc(var(--sway) * -1),-112px)}72%{opacity:.85;transform:translate(var(--sway),-160px)}100%{opacity:0;transform:translate(0,calc(-1 * var(--h,210px))) scale(.92)}}.cw-rx{animation:cwRxUp 2.4s linear forwards}@keyframes cwDot{50%{opacity:.35}}.cw-dot{animation:cwDot 1.4s ease-in-out infinite}@keyframes cwPop{0%{transform:scale(1)}40%{transform:scale(1.25)}100%{transform:scale(1)}}.cw-pop{animation:cwPop .3s ease}@media (prefers-reduced-motion:reduce){.cw-rx{display:none}.cw-dot,.cw-pop{animation:none}}`;

export function RoomPartsStyle() {
  return <style>{ROOM_PARTS_CSS}</style>;
}

export type Reaction = { id: string | number; offset: number; size?: number };
export type Appearance = "system" | "dark" | "light";

/**
 * O selo de verificado, como o do YouTube: um círculo cinzento com o visto da cor do fundo.
 * Na sala escura o círculo é claro; na clara, escuro.
 */
export function VerifiedBadge({ className, check }: { className?: string | undefined; check?: string | undefined }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Verificado"
      className={cn("shrink-0 text-[#AAAAAA] [.room-light_&]:text-[#606060]", className)}
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M7.4 12.3l3.1 3.1 6.1-6.4"
        fill="none"
        stroke={check ?? "var(--room-bg, #fff)"}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------- Título e quem apresenta ---------- */

export function RoomTitle({
  kicker,
  title,
  host,
  compact,
  highlight,
  follow,
  onHost,
}: {
  kicker: string;
  title: string;
  host: { name: string; role: string; avatarUrl: string; verified: boolean };
  compact?: boolean | undefined;
  highlight?: string | null | undefined;
  /** O + Seguir, à direita de quem apresenta (só nos momentos escolhidos). */
  follow?: ReactNode;
  /** Tocar na foto ou no nome abre as redes de quem apresenta. */
  onHost?: (() => void) | undefined;
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
      {title ? (
        <h1
          className={cn(
            "font-extrabold tracking-tight text-room-text",
            compact ? "mb-2.5 line-clamp-2 text-[18px] leading-snug" : "mt-1.5 text-[32px] leading-tight",
            hl("title"),
          )}
        >
          {title}
        </h1>
      ) : (
        // Ainda sem título: um traço no lugar dele, para a sala se ir construindo com o que se preenche.
        <span aria-hidden className={cn("block w-3/5 rounded-md bg-room-raised", compact ? "mb-2.5 h-5" : "mt-2.5 h-8", hl("title"))} />
      )}
      {host.name ? (
        <div className={cn("flex items-center", compact ? "gap-2.5" : "mt-4 gap-3.5", hl("host"))}>
          <button type="button" onClick={onHost} disabled={!onHost} className="flex min-w-0 flex-1 items-center gap-[inherit] text-left">
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
              {host.verified ? <VerifiedBadge className={compact ? "size-[15px]" : "size-[17px]"} /> : null}
            </b>
            {host.role ? (
              <span className={cn("block truncate text-room-subtle", compact ? "text-[13px]" : "text-sm")}>{host.role}</span>
            ) : null}
          </span>
          </button>
          {follow}
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
  const appearanceLabel = { system: "Do sistema", dark: "Escuro", light: "Claro" }[appearance];
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
                ["system", "Do sistema", Monitor],
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

export const EMOJIS = ["😀", "😂", "😍", "🥰", "😮", "🤔", "👏", "🙌", "👍", "💪", "🔥", "💯", "❤️", "🎉", "🙏", "✅", "😅", "🤩", "😢", "👀", "💡", "🚀", "⭐", "🇦🇴", "🇧🇷", "🇵🇹"];

/**
 * A caixa de escrever do formato Webinar, com o mesmo desenho do Live (como no Instagram e no
 * YouTube): o campo com os emojis e, ao lado, o enviar e o coração só em ícone, sem círculos.
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
  const ready = Boolean(value.trim());
  return (
    <form
      className="flex items-center gap-1 border-t border-room-line px-3 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onSubmit();
      }}
    >
      <div className={cn("flex min-w-0 flex-1 items-center gap-0.5 rounded-full bg-room-raised pl-4 pr-[5px]", compact ? "h-10" : "h-11")}>
        <input
          {...inputProps}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          enterKeyHint="send"
          maxLength={200}
          className={cn("min-w-0 flex-1 bg-transparent text-room-text outline-none placeholder:text-room-subtle", compact ? "text-[14px]" : "text-[15px]")}
        />
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Emojis"
              title="Emojis"
              className={cn("grid size-8 shrink-0 place-items-center rounded-full text-room-text transition", emojiOpen && "bg-room-line")}
            >
              <Smile className="size-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-[264px] p-2">
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
      </div>
      <button
        type="submit"
        aria-label="Comentar"
        title="Comentar"
        disabled={!ready}
        className={cn("grid size-[38px] shrink-0 place-items-center rounded-full transition", ready ? "text-primary" : "text-room-text")}
      >
        <SendHorizontal className="size-[22px]" strokeWidth={1.8} />
      </button>
      {withReactions && onHeart ? (
        <HeartButton
          onHeart={onHeart}
          reactions={reactions ?? []}
          className="grid size-[38px] shrink-0 place-items-center rounded-full text-room-text transition active:scale-90"
          iconClassName="size-6 [stroke-width:1.8]"
        />
      ) : null}
    </form>
  );
}

/** O coração: as reações sobem a direito por cima dele, com um leve balanço, como no YouTube. */
const HEART_REDS = ["#FF2E43", "#FF4A5C", "#E8172F"];
const HEART_PATH =
  "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z";

/**
 * O coração das reações: um contorno; enquanto a pessoa toca enche-se de vermelho (sabe que reagiu)
 * e sobem corações vermelhos, a direito e com um leve balanço. Um vermelho só das reações.
 */
export function HeartButton({
  onHeart,
  reactions,
  className,
  iconClassName,
}: {
  onHeart: () => void;
  reactions: readonly Reaction[];
  className: string;
  iconClassName?: string | undefined;
}) {
  const [pressed, setPressed] = useState(0);
  useEffect(() => {
    if (!pressed) return;
    const timer = window.setTimeout(() => setPressed(0), 650);
    return () => window.clearTimeout(timer);
  }, [pressed]);
  return (
    <span className="relative shrink-0">
      {/* Sem máscara nem caixa: no Safari uma máscara vazia desenhava um rectângulo preto. */}
      {reactions.length > 0 ? (
        <span aria-hidden className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 h-[230px] w-12 -translate-x-1/2 [--h:210px]">
          {reactions.map((r, i) => {
            const size = Math.max(26, Math.min(34, r.size ?? 30));
            const sway = Math.max(-7, Math.min(7, Math.round(r.offset / 5))) || 4;
            return (
              <svg
                key={r.id}
                viewBox="0 0 24 24"
                className="cw-rx absolute bottom-0 opacity-0 drop-shadow-[0_2px_4px_rgba(0,0,0,.35)]"
                style={{ left: `calc(50% - ${size / 2}px)`, width: size, height: size, "--sway": `${sway}px` } as CSSProperties}
              >
                <path d={HEART_PATH} fill={HEART_REDS[i % HEART_REDS.length]} />
              </svg>
            );
          })}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setPressed((n) => n + 1);
          onHeart();
        }}
        aria-label="Enviar um coração"
        title="Reagir"
        className={className}
      >
        <Heart
          key={pressed ? "on" : "off"}
          className={cn("size-5", iconClassName, pressed ? "cw-pop fill-[#FF2E43] text-[#FF2E43]" : "")}
        />
      </button>
    </span>
  );
}

/** Uma mensagem do chat, como no YouTube: avatar, nome e texto na mesma linha. */
export function ChatLine({
  author,
  text,
  avatarUrl,
  tone = "people",
  badge,
  big,
  onVideo,
}: {
  author: string;
  text: string;
  avatarUrl?: string | null | undefined;
  tone?: "people" | "mine" | "agent" | undefined;
  badge?: string | undefined;
  /** Letra maior (sala no computador). */
  big?: boolean | undefined;
  /** Por cima do vídeo (formato Live): letra branca com sombra, como no Instagram. */
  onVideo?: boolean | undefined;
}) {
  const initials =
    author
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";
  return (
    <div className="flex items-start gap-2.5">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className={cn("shrink-0 rounded-full object-cover", big ? "size-8" : "size-7")} />
      ) : (
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full font-bold",
            big ? "size-8 text-[11.5px]" : "size-7 text-[10.5px]",
            tone === "agent"
              ? "bg-primary text-white"
              : onVideo
                ? "bg-white/20 text-white ring-1 ring-white/30 backdrop-blur"
                : "bg-room-raised text-room-text ring-1 ring-room-line",
          )}
        >
          {tone === "mine" ? "EU" : initials}
        </span>
      )}
      <p
        className={cn(
          "min-w-0 break-words leading-[1.45]",
          onVideo ? "text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]" : "text-room-text",
          big ? "pt-0.5 text-[16px]" : onVideo ? "pt-0.5 text-[15px]" : "pt-0.5 text-[14.5px]",
        )}
      >
        <span
          className={cn(
            "mr-2 font-semibold",
            tone === "agent" ? "text-primary" : onVideo ? "text-white/80" : "text-room-subtle",
          )}
        >
          {author}
          {tone === "agent" ? <Zap className="ml-1 inline size-3 align-[-1px]" /> : null}
        </span>
        {badge ? (
          <span
            className={cn(
              "mr-2 rounded px-1.5 py-px align-[1px] text-[11px] font-medium [text-shadow:none]",
              onVideo ? "bg-white/20 text-white" : "bg-room-raised text-room-subtle",
            )}
          >
            {badge}
          </span>
        ) : null}
        {text}
      </p>
    </div>
  );
}

/**
 * No chat do formato Webinar: o Suporte já respondeu e a pessoa ainda não viu. Só ela vê; tocar
 * abre o Suporte. É o mesmo aviso do Live, com o desenho das linhas do chat.
 */
export function SupportNotice({ onOpen, big }: { onOpen: () => void; big?: boolean | undefined }) {
  return (
    <button type="button" onClick={onOpen} className="flex items-start gap-2.5 text-left">
      <span className={cn("grid shrink-0 place-items-center rounded-full bg-[#E8440C] text-white", big ? "size-8" : "size-7")}>
        <Headset className="size-4" />
      </span>
      <p className={cn("min-w-0 pt-0.5 leading-[1.45] text-room-text", big ? "text-[16px]" : "text-[14.5px]")}>
        <span className="mr-2 font-semibold text-room-subtle">Suporte</span>
        <span className="mr-2 rounded bg-room-raised px-1.5 py-px align-[1px] text-[11px] font-medium text-room-subtle">Só você vê</span>
        @Você, já respondemos à sua dúvida. <u className="font-semibold underline-offset-[3px]">Ver resposta</u>
      </p>
    </button>
  );
}

/** As cores das compras na sala (aviso no vídeo e linha no chat). */
export const SALE_COLORS: Record<string, { label: string; solid: string; soft: string; ink: string }> = {
  emerald: { label: "Verde", solid: "#16A34A", soft: "rgba(22,163,74,.14)", ink: "#16A34A" },
  blue: { label: "Azul", solid: "#2563EB", soft: "rgba(37,99,235,.14)", ink: "#3B82F6" },
  violet: { label: "Roxo", solid: "#7C3AED", soft: "rgba(124,58,237,.14)", ink: "#8B5CF6" },
  orange: { label: "Laranja", solid: "#E8440C", soft: "rgba(232,68,12,.14)", ink: "#F0642E" },
  amber: { label: "Âmbar", solid: "#D97706", soft: "rgba(217,119,6,.15)", ink: "#F59E0B" },
  rose: { label: "Rosa", solid: "#E11D48", soft: "rgba(225,29,72,.14)", ink: "#F43F5E" },
  slate: { label: "Grafite", solid: "#334155", soft: "rgba(100,116,139,.18)", ink: "#64748B" },
};
export const saleColor = (name: string | null | undefined) => SALE_COLORS[name ?? ""] ?? SALE_COLORS["emerald"]!;

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
  banner,
  group,
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
  /** Depois do vídeo: a sala continua aberta para compras. */
  banner?: ReactNode;
  /** O botão leva a um grupo (WhatsApp ou Telegram): pede os dados e abre o grupo. */
  group?: boolean | undefined;
  compact?: boolean | undefined;
  highlight?: string | null | undefined;
}) {
  const hl = (key: string) =>
    highlight === key ? "outline outline-2 outline-offset-4 outline-[#E8440C] shadow-[0_0_0_10px_rgba(232,68,12,.25)]" : "";
  return (
    <div className="grid content-start gap-4 p-4">
      {note ? <p className="rounded-[10px] bg-amber-500/15 px-3 py-2.5 text-[13px] font-medium text-amber-500">{note}</p> : null}
      {banner ? (
        <div className="rounded-[12px] bg-primary/10 px-3.5 py-3 text-[13.5px] leading-snug text-room-text ring-1 ring-primary/25">
          {banner}
        </div>
      ) : null}
      {imageUrl || productName !== undefined ? (
        <div
          className={cn(
            "relative grid content-end overflow-hidden rounded-xl p-4 text-white ring-1 ring-room-line",
            compact ? "h-[110px]" : "h-[150px]",
            !imageUrl &&
              "bg-[radial-gradient(100%_120%_at_100%_0%,color-mix(in_srgb,var(--of,#E8440C)_45%,transparent),transparent_60%),linear-gradient(160deg,#2a2f38,#15171b)]",
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
          "flex w-full items-center justify-center gap-2.5 rounded-xl bg-[var(--of,#E8440C)] font-black uppercase tracking-[0.03em] text-[var(--of-on,#FFFFFF)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-room-raised disabled:text-room-subtle",
          compact ? "h-[54px] text-[15px]" : "h-[60px] text-[17px]",
          hl("cta"),
        )}
      >
        {group ? <Users className="size-5" /> : <ShoppingCart className="size-5" />}
        {closed ? "Oferta encerrada" : buttonText}
      </button>
      {showCountdown ? <CountdownBlocks seconds={countdownSeconds} compact={compact} /> : null}
    </div>
  );
}

/** A linha de uma compra no chat, na cor escolhida nas Vendas. */
export function SaleLine({
  text,
  color,
  onVideo,
}: {
  text: string;
  color?: string | null | undefined;
  /** Por cima do vídeo: a cor cheia e a letra branca. */
  onVideo?: boolean | undefined;
}) {
  const c = saleColor(color);
  return (
    <div
      className="inline-flex items-center gap-2 self-start justify-self-start rounded-[10px] px-3 py-2 text-[14px] font-semibold"
      style={onVideo ? { background: c.solid, color: "#fff" } : { background: c.soft, color: c.ink }}
    >
      <ShoppingCart className="size-4 shrink-0" />
      <span className="min-w-0">{text}</span>
    </div>
  );
}

/** O ponto que pulsa no separador Oferta enquanto não está aberto. */
export function PulseDot() {
  return <span aria-hidden className="cw-dot size-[7px] rounded-full bg-[#E8440C]" />;
}

/* ---------- Formato Live (vídeo ao alto, chat por cima) ---------- */

/** O vídeo ao alto a cobrir o palco do Live (as unidades cq medem o palco), sem faixas pretas. */
export const LIVE_COVER =
  "absolute left-1/2 top-1/2 h-[max(100cqh,177.78cqw)] w-[max(100cqw,56.25cqh)] -translate-x-1/2 -translate-y-1/2";
/**
 * O vídeo deitado no computador (Live): 16:9 inteiro, ao centro, com uma margem preta à volta e os
 * cantos arredondados, como no cinema. As unidades cq medem o palco.
 */
export const LIVE_WIDE =
  "absolute left-1/2 top-1/2 aspect-video w-[min(calc(100cqw-64px),calc((100cqh-112px)*16/9))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl";
/** Num ecrã deitado o vídeo ao alto fica inteiro, ao centro, em fundo preto. */
export const LIVE_CONTAIN = "absolute left-1/2 top-1/2 h-full w-[56.25cqh] -translate-x-1/2 -translate-y-1/2";
