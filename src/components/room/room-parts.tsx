import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Captions,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Headset,
  Heart,
  Monitor,
  MonitorPlay,
  Moon,
  Play,
  SendHorizontal,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Smile,
  Sun,
  Users,
  Volume1,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { clock, discountPercent, liveVideoPlace, type EntryLook, type LiveVideoPlace, type OfferLook } from "@/lib/room-logic";

/**
 * Peças da sala que a sala pública e a pré-visualização do editor desenham iguais. As cores
 * vêm dos tokens da sala (room-*), por isso o tema escuro e o claro servem as duas.
 */

const ROOM_PARTS_CSS = `@keyframes cwRxUp{0%{opacity:0;transform:translate(0,0) scale(.6)}8%{opacity:1;transform:translate(0,-14px) scale(1)}28%{transform:translate(var(--sway),-62px)}50%{transform:translate(calc(var(--sway) * -1),-112px)}72%{opacity:.85;transform:translate(var(--sway),-160px)}100%{opacity:0;transform:translate(0,calc(-1 * var(--h,210px))) scale(.92)}}.cw-rx{animation:cwRxUp 2.4s linear forwards}@keyframes cwDot{50%{opacity:.35}}.cw-dot{animation:cwDot 1.4s ease-in-out infinite}@keyframes cwPop{0%{transform:scale(1)}40%{transform:scale(1.25)}100%{transform:scale(1)}}.cw-pop{animation:cwPop .3s ease}@media (prefers-reduced-motion:reduce){.cw-rx{display:none}.cw-dot,.cw-pop{animation:none}}.room-light .room-panel{--tw-ring-color:#CACACA}`;

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
        <p className="text-[14.5px] font-bold uppercase tracking-[0.2em] text-primary">{kicker}</p>
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
          {/* O + Seguir fica logo a seguir ao nome, como no Instagram e no YouTube, e não no outro lado do ecrã. */}
          <button type="button" onClick={onHost} disabled={!onHost} className="flex min-w-0 items-center gap-[inherit] text-left">
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

/** O menu do ⚙ em vidro, como no YouTube: transparente, mas legível por cima de qualquer vídeo. */
const GLASS = "rounded-xl bg-[rgba(20,20,20,.74)] p-1.5 text-white shadow-[0_12px_40px_rgba(0,0,0,.45)] ring-1 ring-white/10 backdrop-blur-xl backdrop-saturate-150";

/**
 * O botão ⚙ do vídeo: volume, legendas, qualidade (automática, sempre a melhor) e aparência.
 * Sem velocidade nem avançar: a sessão parece sempre ao vivo. `inline` (Live): o menu abre para baixo
 * dentro da própria sala, para nunca sair do ecrã (nem da moldura do aparelho na pré-visualização).
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
  inline,
}: {
  volume: number;
  onVolume: (volume: number) => void;
  captions: boolean;
  onCaptions: (on: boolean) => void;
  hasCaptions: boolean;
  appearance: Appearance;
  onAppearance: (appearance: Appearance) => void;
  compact?: boolean | undefined;
  inline?: boolean | undefined;
}) {
  const [page, setPage] = useState<"main" | "appearance">("main");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Fora do menu, um toque ou o Esc fecham-no (o Popover faz isto sozinho; o menu na sala não).
  useEffect(() => {
    if (!inline || !open) return;
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const esc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [inline, open]);
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const appearanceLabel = { system: "Do sistema", dark: "Escuro", light: "Claro" }[appearance];
  const row = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] hover:bg-white/10";
  const trigger = (
    <button
      type="button"
      aria-label="Definições do vídeo"
      aria-expanded={inline ? open : undefined}
      title="Definições"
      onClick={
        inline
          ? () => {
              setPage("main");
              setOpen((o) => !o);
            }
          : undefined
      }
      className={cn(
        "grid place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75",
        compact ? "size-9" : "size-10",
        inline && open && "bg-black/75",
      )}
    >
      <Settings className={compact ? "size-[18px]" : "size-5"} />
    </button>
  );
  const menu =
    page === "main" ? (
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
            <span className="text-[13px] text-white/65">{captions ? "Ligadas" : "Desligadas"}</span>
          </button>
        ) : null}
        <div className={cn(row, "cursor-default hover:bg-transparent")}>
          <MonitorPlay className="size-[18px] shrink-0" />
          <span className="flex-1">Qualidade</span>
          <span className="text-[13px] text-white/65">Automática</span>
        </div>
        <button type="button" onClick={() => setPage("appearance")} className={row}>
          <Moon className="size-[18px] shrink-0" />
          <span className="flex-1">Aparência</span>
          <span className="text-[13px] text-white/65">{appearanceLabel}</span>
          <ChevronRight className="size-4 text-white/65" />
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
    );
  if (inline) {
    return (
      <div ref={box} className="relative">
        {trigger}
        {open ? (
          // As unidades cq medem o palco da sala: o menu nunca fica mais largo do que o ecrã.
          <div role="dialog" aria-label="Definições do vídeo" className={cn(GLASS, "absolute right-0 top-[calc(100%+8px)] z-50 w-[272px] max-w-[calc(100cqw-24px)]")}>
            {menu}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <Popover onOpenChange={(next) => next && setPage("main")}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side="top" align="end" className={cn(GLASS, "w-[272px] border-0")}>
        {menu}
      </PopoverContent>
    </Popover>
  );
}

/** A legenda da fala, um pouco acima do fundo do vídeo, como no cinema: curta, no máximo duas linhas. */
export function CaptionLine({ text, compact }: { text: string | null; compact?: boolean | undefined }) {
  if (!text) return null;
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 z-[1] flex justify-center px-6", compact ? "bottom-[6%]" : "bottom-[7%]")}>
      <span
        className={cn(
          "line-clamp-2 max-w-[78%] rounded bg-black/60 px-2 py-0.5 text-center font-medium leading-snug text-white [box-decoration-break:clone]",
          compact ? "text-[12px]" : "text-[16px]",
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

/** O vermelho das reações (só delas). */
const HEART = "#FF3B5C";

/**
 * O coração das reações: um contorno; enquanto a pessoa toca enche-se de vermelho (sabe que reagiu)
 * e sobem corações planos, como no YouTube, a direito e com um leve balanço, por cima do botão
 * (no canto de baixo à direita).
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
          {reactions.map((r) => {
            const size = Math.max(24, Math.min(30, (r.size ?? 28) * 0.9));
            const sway = Math.max(-7, Math.min(7, Math.round(r.offset / 5))) || 4;
            return (
              <Heart
                key={r.id}
                fill="currentColor"
                strokeWidth={0}
                className="cw-rx absolute bottom-0 opacity-0"
                style={{ left: `calc(50% - ${size / 2}px)`, width: size, height: size, color: HEART, "--sway": `${sway}px` } as CSSProperties}
              />
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
        {pressed ? (
          <Heart key="on" fill="currentColor" strokeWidth={0} className={cn("cw-pop size-5", iconClassName)} style={{ color: HEART }} />
        ) : (
          <Heart key="off" className={cn("size-5", iconClassName)} />
        )}
      </button>
    </span>
  );
}

/** A reacção do chat simulado a uma mensagem real («❤️ 3»), no fim da linha. */
export function ReactionPill({ text, onVideo }: { text: string; onVideo?: boolean | undefined }) {
  return (
    <span
      className={cn(
        "lv-in ml-1.5 inline-flex h-[22px] items-center rounded-full px-2 align-[1px] text-[12.5px] font-semibold tabular-nums [text-shadow:none]",
        onVideo ? "bg-white/20 text-white" : "bg-room-raised text-room-text ring-1 ring-room-line",
      )}
    >
      {text}
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
  reaction,
  big,
  onVideo,
}: {
  author: string;
  text: string;
  avatarUrl?: string | null | undefined;
  /** «team»: alguém da equipa, com o nome e o selo na cor do botão. */
  tone?: "people" | "mine" | "agent" | "team" | undefined;
  badge?: string | undefined;
  /** A reacção do chat simulado, quando já chegou. */
  reaction?: string | undefined;
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
              : tone === "team"
                ? "bg-[var(--of,#E8440C)] text-[var(--of-on,#fff)]"
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
            tone === "agent" || tone === "team" ? "text-[var(--of-ink,#E8440C)]" : onVideo ? "text-white/80" : "text-room-subtle",
          )}
        >
          {author}
          {tone === "agent" ? <Zap className="ml-1 inline size-3 align-[-1px]" /> : null}
        </span>
        {badge ? (
          <span
            className={cn(
              "mr-2 rounded px-1.5 py-px align-[1px] text-[11px] [text-shadow:none]",
              tone === "team"
                ? "bg-[var(--of,#E8440C)] font-bold text-[var(--of-on,#fff)]"
                : onVideo
                  ? "bg-white/20 font-medium text-white"
                  : "bg-room-raised font-medium text-room-subtle",
            )}
          >
            {badge}
          </span>
        ) : null}
        {text}
        {reaction ? <ReactionPill text={reaction} onVideo={onVideo} /> : null}
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

/** «A oferta termina em» com os minutos e os segundos em blocos, na cor da oferta. */
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
    <div className="grid justify-items-center gap-2 rounded-[14px] bg-[color-mix(in_srgb,var(--of,#E8440C)_10%,transparent)] px-3 pb-3 pt-3.5 ring-1 ring-[color-mix(in_srgb,var(--of,#E8440C)_25%,transparent)]">
      <small className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--of-ink,#E8440C)]">A oferta termina em</small>
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

/** A imagem do produto em pequeno; sem imagem, o saco na cor da oferta. */
export function OfferThumb({ imageUrl, className }: { imageUrl?: string | null | undefined; className?: string | undefined }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(140deg,var(--of,#E8440C),color-mix(in_srgb,var(--of,#E8440C)_35%,#000))] text-white",
        className,
      )}
    >
      {imageUrl ? <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" /> : <ShoppingBag className="size-[42%]" />}
    </span>
  );
}

/** «-86%» na cor da oferta ou, com a oferta fechada, «Encerrada» a cinzento. */
function OfferBadge({ discount, closed, className }: { discount: number | null; closed?: boolean | undefined; className?: string | undefined }) {
  if (closed)
    return <span className={cn("rounded-full bg-room-raised px-2.5 py-1 text-[12px] font-bold text-room-subtle ring-1 ring-room-line", className)}>Encerrada</span>;
  if (discount === null) return null;
  return <span className={cn("rounded-full bg-[var(--of,#E8440C)] px-2.5 py-1 text-[12.5px] font-extrabold text-[var(--of-on,#fff)]", className)}>-{discount}%</span>;
}

/**
 * O separador Oferta (e a folha da oferta no Live): produto, preços, botão e cronómetro. Duas formas,
 * escolhidas no editor: «Quadrada», com o produto num quadrado grande, e «Compacta», numa linha.
 */
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
  look = "square",
  highlight,
  stickyBuy,
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
  look?: OfferLook | undefined;
  highlight?: string | null | undefined;
  /** Numa folha que rola: o botão fica preso ao fundo, sempre à vista. */
  stickyBuy?: boolean | undefined;
}) {
  const hl = (key: string) =>
    highlight === key ? "outline outline-2 outline-offset-4 outline-[#E8440C] shadow-[0_0_0_10px_rgba(232,68,12,.25)]" : "";
  const discount = discountPercent(priceFrom ?? "", priceNow ?? "");
  const name = productName ? (
    <span className={cn("font-extrabold leading-tight", look === "compact" ? "line-clamp-2 text-[17px]" : "relative text-[22px] drop-shadow")}>{productName}</span>
  ) : productName === "" ? (
    <em className="relative justify-self-start rounded-lg border-[1.5px] border-dashed border-[#F2C77B] px-2.5 py-1 text-[15px] font-bold not-italic text-[#F2C77B]">
      Nome do produto
    </em>
  ) : null;
  const buy = (
    // A folha rola por baixo do botão: um esbatido por cima dele, para nada ficar cortado a meio.
    <div
      className={
        stickyBuy
          ? "sticky bottom-0 z-[1] -mx-4 -mb-4 bg-room-surface px-4 pb-4 pt-1 before:pointer-events-none before:absolute before:inset-x-0 before:-top-5 before:h-5 before:bg-gradient-to-t before:from-room-surface before:to-transparent"
          : "contents"
      }
    >
      <button
        type="button"
        onClick={onBuy}
        disabled={closed}
        className={cn(
          "flex w-full items-center justify-center gap-2.5 rounded-xl bg-[var(--of,#E8440C)] font-black uppercase tracking-[0.03em] text-[var(--of-on,#FFFFFF)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-room-raised disabled:text-room-subtle",
          compact || look === "compact" ? "h-[54px] text-[15px]" : "h-[60px] text-[17px]",
          hl("cta"),
        )}
      >
        {group ? <Users className="size-5" /> : <ShoppingCart className="size-5" />}
        {closed ? "Oferta encerrada" : buttonText}
      </button>
    </div>
  );
  const top = (
    <>
      {note ? <p className="rounded-[10px] bg-amber-500/15 px-3 py-2.5 text-[13px] font-medium text-amber-500">{note}</p> : null}
      {banner ? (
        <div className="rounded-[12px] bg-primary/10 px-3.5 py-3 text-[13.5px] leading-snug text-room-text ring-1 ring-primary/25">{banner}</div>
      ) : null}
    </>
  );

  if (look === "compact") {
    return (
      <div className="grid content-start gap-3.5 p-4">
        {top}
        <div className={cn("flex items-center gap-3", hl("product"))}>
          <OfferThumb imageUrl={imageUrl} className="size-[68px]" />
          <div className="grid min-w-0 flex-1 gap-1">
            {name}
            {priceFrom || priceNow ? (
              <p className={cn("flex flex-wrap items-baseline gap-x-2 leading-tight", hl("price"))}>
                {priceFrom ? <s className="text-[13.5px] font-semibold text-room-subtle">{priceFrom}</s> : null}
                {priceNow ? <b className="text-[22px] font-black tracking-tight">{priceNow}</b> : null}
              </p>
            ) : null}
          </div>
          <OfferBadge discount={discount} closed={closed} className="shrink-0 self-start" />
        </div>
        {buy}
        {showCountdown ? (
          <p className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[color-mix(in_srgb,var(--of,#E8440C)_10%,transparent)] text-[14px] font-bold text-[var(--of-ink,#E8440C)]">
            <Clock className="size-4" strokeWidth={2.4} />
            A oferta termina em <span className="tabular-nums">{clock(Math.max(0, countdownSeconds))}</span>
          </p>
        ) : null}
      </div>
    );
  }

  // «Quadrada»: o produto num quadrado grande (a imagem, ou o saco na cor da oferta), com o nome e os
  // preços ao lado; o botão e o cronómetro cabem por baixo, à vista, mesmo no telemóvel.
  return (
    <div className="grid content-start gap-4 p-4">
      {top}
      <div className={cn("flex items-start gap-3.5", hl("product"))}>
        <span className={cn("relative aspect-square shrink-0", compact ? "w-[38%] max-w-[132px]" : "w-[42%] max-w-[168px]")}>
          <OfferThumb imageUrl={imageUrl} className="size-full rounded-2xl ring-1 ring-room-line" />
          <OfferBadge discount={discount} closed={closed} className="absolute left-2 top-2" />
        </span>
        <div className="grid min-w-0 flex-1 content-start gap-2 pt-0.5">
          {productName ? (
            <span className={cn("line-clamp-3 break-words font-extrabold leading-tight", compact ? "text-[17px]" : "text-[19px]")}>{productName}</span>
          ) : (
            name
          )}
          {priceFrom || priceNow ? (
            <div className={cn("grid", hl("price"))}>
              {priceFrom ? <s className="text-[14px] font-bold text-room-subtle">De {priceFrom}</s> : null}
              {priceNow ? (
                <b className={cn("font-black leading-tight tracking-tight text-room-text", compact ? "text-[22px]" : "text-[26px]")}>Por {priceNow}</b>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {buy}
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
/**
 * O vídeo deitado no telemóvel ao alto (Live): à largura do ecrã, centrado na parte de cima do palco
 * (o centro a 37% da altura), logo abaixo da barra de cima e longe do chat, como no Instagram. Por cima
 * e por baixo fica o preto do palco, com uma passagem curta de 10 px nas bordas; o vídeo nunca fica
 * desfocado nem escurecido. As unidades cq medem o palco; `--live-top` é a zona da câmara.
 */
export const LIVE_TOP =
  "absolute inset-x-0 top-[max(calc(var(--live-top,0px)_+_58px),calc(37cqh_-_28.125cqw))] aspect-video w-full [mask-image:linear-gradient(180deg,transparent,#000_10px,#000_calc(100%_-_10px),transparent)]";
/** O vídeo ao alto no computador (Live): uma coluna 9:16 ao centro, quase da altura do palco. */
export const LIVE_COLUMN =
  "absolute left-1/2 top-1/2 aspect-[9/16] h-[calc(100cqh-48px)] max-w-[calc(100cqw-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-[0_0_0_1px_rgba(255,255,255,.06),0_30px_80px_rgba(0,0,0,.6)]";
/** O fundo discreto atrás da coluna ao alto: um cinzento muito escuro que se apaga para as bordas. */
export const LIVE_COLUMN_BG = "absolute inset-0 bg-[radial-gradient(50%_75%_at_50%_50%,#1f1f1f,#0a0a0a_70%,#000)]";

const LIVE_BOXES: Record<LiveVideoPlace, string> = { fill: LIVE_COVER, top: LIVE_TOP, wide: LIVE_WIDE, column: LIVE_COLUMN };

/**
 * A moldura do vídeo no Live: depende só da forma do vídeo (lida do ficheiro) e do aparelho, com
 * regras fixas (`liveVideoPlace`). Só enche o ecrã um vídeo ao alto no telemóvel; nunca estica.
 */
export function liveFrame(shape: "horizontal" | "vertical" | null | undefined, where: "desk" | "phone") {
  const place = liveVideoPlace(shape, where);
  return { place, box: LIVE_BOXES[place], fit: place === "fill" ? ("cover" as const) : ("contain" as const) };
}

/** Num ecrã deitado o vídeo ao alto fica inteiro, ao centro, em fundo preto. */
export const LIVE_CONTAIN = "absolute left-1/2 top-1/2 h-full w-[56.25cqh] -translate-x-1/2 -translate-y-1/2";

/**
 * O botão para começar a ver (o navegador só deixa tocar com som depois de um toque), ao centro do
 * vídeo, na cor do botão escolhida no editor (`--of`): só o botão a pulsar, ou o botão com uma linha de
 * informação. O escurecido do vídeo por trás é `ENTRY_DIM`, posto por quem o desenha.
 */
export function EntryPlay({ look, kicker, compact }: { look: EntryLook; kicker: string; compact?: boolean | undefined }) {
  const big = look === "pulse";
  return (
    <span
      className={cn(
        "pointer-events-none flex items-center text-white",
        !big && "gap-3.5 rounded-full bg-black/60 py-2 pl-2 pr-6 text-left shadow-[0_12px_32px_rgba(0,0,0,.35)] ring-1 ring-white/15 backdrop-blur-md",
        !big && compact && "gap-2.5 py-1.5 pl-1.5 pr-4",
      )}
    >
      <span
        className={cn(
          "relative grid shrink-0 place-items-center rounded-full bg-[var(--of,#E8440C)] text-[var(--of-on,#fff)] shadow-[0_8px_28px_color-mix(in_srgb,var(--of,#E8440C)_45%,transparent)]",
          big ? (compact ? "size-16" : "size-[86px]") : compact ? "size-10" : "size-[52px]",
        )}
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-[var(--of,#E8440C)] opacity-50 motion-reduce:animate-none" />
        <Play className={cn("relative translate-x-px", big ? (compact ? "size-7" : "size-9") : compact ? "size-[18px]" : "size-[22px]")} fill="currentColor" />
      </span>
      {big ? null : (
        <span className="leading-tight">
          <small className={cn("block font-bold uppercase tracking-[0.16em] text-white/75", compact ? "text-[10px]" : "text-[11.5px]")}>{kicker}</small>
          <b className={cn("block font-semibold", compact ? "text-[14.5px]" : "text-[17px]")}>Assistir agora</b>
        </span>
      )}
    </span>
  );
}

/** O escurecido do vídeo por trás do botão de entrar: o vídeo continua à vista, como num Live em pausa. */
export const ENTRY_DIM = "bg-black/45";
