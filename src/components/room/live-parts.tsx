import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Clock, Eye, Headset, Plus, SendHorizontal, ShoppingBag, ShoppingCart, Smile, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { entryPalette, offerColor, type FollowNetwork } from "@/lib/room-logic";
import { EMOJIS, HeartButton, saleColor, type Reaction } from "./room-parts";

/**
 * Peças da sala em formato Live (vídeo com o chat por cima, como no Instagram). A sala pública e a
 * pré-visualização do editor desenham-nas iguais. O que fica por cima do vídeo é sempre branco; o
 * painel do computador, as folhas e o cartão da oferta seguem o tema da sala (`.room-light`).
 *
 * Cores fixas da identidade: «Ao vivo» vermelho, + Seguir e Suporte no laranja da marca. A oferta
 * usa a cor que o apresentador escolher (variáveis --of*), nos dois formatos.
 */

const BRAND = "#E8440C";

/**
 * As variáveis da cor da oferta, a partir de um código hex: o tom médio e o escuro do degradê, o
 * texto em cima do botão (preto num botão claro) e a cor do tempo, que acompanha o tema.
 * Vão no mesmo elemento que leva `.room-light`, para o tempo ler a cor do texto certa.
 */
export function liveOfferVars(color: string): CSSProperties {
  const of = offerColor(color);
  return {
    "--of": of,
    "--of-mid": `color-mix(in srgb, ${of} 52%, #000)`,
    "--of-dark": `color-mix(in srgb, ${of} 20%, #000)`,
    "--of-on": entryPalette(null, of).buttonText,
    "--of-ink": `color-mix(in srgb, ${of} 78%, var(--room-ink))`,
  } as CSSProperties;
}

/**
 * Arrastar pela pega: segue o dedo (ou o rato); largar mais de 70 px abaixo chama `onDown`, mais
 * de 50 px acima chama `onUp`. Um toque sem arrastar fica para o `onClick` do próprio botão.
 */
function useDrag(onDown: () => void, onUp?: () => void) {
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);
  const moved = useRef(false);
  const end = () => {
    start.current = null;
    setDy(0);
  };
  return {
    dy,
    /** Depois de arrastar, o clique que o navegador manda a seguir não conta como toque. */
    moved,
    handlers: {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        start.current = event.clientY;
        moved.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        if (start.current === null) return;
        const d = event.clientY - start.current;
        if (Math.abs(d) > 6) moved.current = true;
        setDy(d);
      },
      onPointerUp: () => {
        if (start.current === null) return;
        const d = dy;
        end();
        if (d > 70) onDown();
        else if (d < -50) onUp?.();
      },
      onPointerCancel: end,
    },
  };
}

const LIVE_CSS = `
.lv-badge-font{font-family:"Barlow Condensed",ui-sans-serif,system-ui,sans-serif}
@keyframes lvIn{from{opacity:0;translate:0 10px}to{opacity:1;translate:0 0}}
@keyframes lvUp{from{opacity:0;translate:0 24px}to{opacity:1;translate:0 0}}
@keyframes lvFollow{0%{opacity:0;transform:scale(.7)}60%{opacity:1;transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes lvGlow{0%{box-shadow:0 0 0 0 rgba(232,68,12,.7)}100%{box-shadow:0 0 0 10px rgba(232,68,12,0)}}
@keyframes lvPing{0%{transform:scale(1);opacity:.85}100%{transform:scale(1.75);opacity:0}}
@keyframes lvPop{0%{transform:scale(1)}40%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes lvDot{50%{opacity:.3}}
.lv-in{animation:lvIn .35s ease-out both}
.lv-up{animation:lvUp .4s cubic-bezier(.2,.8,.2,1) both}
.lv-follow{animation:lvFollow .45s cubic-bezier(.2,.8,.2,1) both,lvGlow 1.4s ease-out .45s 2}
.lv-ping{animation:lvPing 1.4s ease-out infinite}
.lv-pop{animation:lvPop .3s ease}
.lv-dot{animation:lvDot 1.6s ease-in-out infinite}
/* As folhas e o cartão da oferta: no escuro, um cinza que se destaca do vídeo preto; no claro, branco. */
.lv-sheet{--room-surface:#262626;--room-raised:#353535;--room-line:#3D3D3D}
.room-light .lv-sheet{--room-surface:#FFFFFF;--room-raised:#F2F2F2;--room-line:#E5E5E5}
.lv-feed{-webkit-mask-image:linear-gradient(180deg,transparent 0,rgba(0,0,0,.35) 40px,#000 110px);mask-image:linear-gradient(180deg,transparent 0,rgba(0,0,0,.35) 40px,#000 110px)}
@media (prefers-reduced-motion:reduce){.lv-in,.lv-up,.lv-follow,.lv-ping,.lv-pop,.lv-dot{animation:none}}
`;

export function LiveStyle() {
  return <style>{LIVE_CSS}</style>;
}

/**
 * O escurecido de baixo, medido na referência que o utilizador escolheu: o vídeo fica igual até
 * ~60% da altura e escurece devagar até quase preto por trás da caixa de escrever.
 */
export const LIVE_SCRIM =
  "linear-gradient(0deg, rgba(0,0,0,.9) 0%, rgba(0,0,0,.86) 7%, rgba(0,0,0,.8) 17%, rgba(0,0,0,.7) 26%, rgba(0,0,0,.58) 35%, rgba(0,0,0,.48) 43%, rgba(0,0,0,.38) 52%, rgba(0,0,0,.27) 62%, rgba(0,0,0,.15) 71%, rgba(0,0,0,.06) 81%, rgba(0,0,0,.02) 90%, rgba(0,0,0,0) 100%)";

/* ---------- Topo ---------- */

/** «Ao vivo» em vermelho, com o ponto a piscar devagar; letra estreita para ocupar pouco. */
export function LiveBadge({ label = "Ao vivo", tone = "live" }: { label?: string | undefined; tone?: "live" | "replay" | "muted" | undefined }) {
  return (
    <span
      className={cn(
        "lv-badge-font inline-flex h-[23px] items-center gap-[5px] rounded-[5px] pl-1.5 pr-[7px] pt-px text-[14px] font-bold uppercase leading-none tracking-[0.04em] text-white",
        tone === "live" ? "bg-[linear-gradient(90deg,#E11D48,#E3141F)]" : tone === "replay" ? "bg-[#2563EB]" : "bg-black/45",
      )}
    >
      {tone === "live" ? <i className="lv-dot -mt-px block size-[5px] rounded-full bg-white" /> : null}
      {label}
    </span>
  );
}

export function LiveViewers({ count }: { count: number }) {
  return (
    <span className="lv-badge-font inline-flex h-[23px] items-center gap-[3px] rounded-[5px] bg-black/[0.42] px-1.5 pt-px text-[14px] font-semibold leading-none tabular-nums text-white">
      <Eye className="-mt-px size-3" />
      {count.toLocaleString("pt-PT")}
    </span>
  );
}

const ROSETTE =
  "M20.6 12 23.2 9l-3.75-1.3.75-3.9-3.9.75L15 .8 12 3.4 9 .8 7.7 4.55l-3.9-.75.75 3.9L.8 9 3.4 12 .8 15l3.75 1.3-.75 3.9 3.9-.75L9 23.2l3-2.6 3 2.6 1.3-3.75 3.9.75-.75-3.9L23.2 15Z";

/**
 * O selo de verificado do Live: a roseta na cor do texto com o visto vazado (vê-se o fundo). Branco
 * por cima do vídeo, escuro no painel claro. Liga-se e desliga-se no Início; não tem cor à escolha.
 */
export function HostBadge({ size = 14 }: { size?: number | undefined }) {
  const id = `lvb${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Verificado" className="block shrink-0">
      <mask id={id}>
        <rect width="24" height="24" fill="#fff" />
        <path d="M7.4 12.2l3.3 3.3 6-6.2" fill="none" stroke="#000" strokeWidth="2.8" strokeLinecap="square" />
      </mask>
      <path d={ROSETTE} fill="currentColor" mask={`url(#${id})`} />
    </svg>
  );
}

export type LiveHost = { name: string; avatarUrl: string; verified: boolean };

function Avatar({ host, size }: { host: LiveHost; size: number }) {
  const initials = host.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return host.avatarUrl ? (
    <img src={host.avatarUrl} alt="" className="block shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-room-raised text-[12px] font-bold text-room-text"
      style={{ width: size, height: size }}
    >
      {initials || "?"}
    </span>
  );
}

/** O botão + Seguir, que entra com um pequeno destaque quando o apresentador pede para seguir. */
export function FollowButton({ label, onClick, big }: { label: string; onClick: () => void; big?: boolean | undefined }) {
  const plus = label === "Seguir";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "lv-follow inline-flex shrink-0 items-center gap-0.5 rounded-full font-extrabold leading-none text-white",
        big ? "h-9 pl-3 pr-4 text-[14px]" : "h-[30px] pl-2 pr-[11px] text-[12.5px]",
        !plus && (big ? "pl-4" : "pl-[11px]"),
      )}
      style={{ background: BRAND }}
    >
      {plus ? <Plus className={big ? "size-[13px]" : "size-3"} strokeWidth={3.2} /> : null}
      {label}
    </button>
  );
}

/**
 * O topo do Live no telemóvel, como no Instagram mas com o nosso desenho: a foto e o nome à
 * esquerda (o + Seguir só nos momentos escolhidos), «Ao vivo» e quantos vêem à direita.
 */
export function LiveTopBar({
  host,
  follow,
  onHost,
  status,
  viewers,
  extra,
}: {
  host: LiveHost;
  follow: { label: string; onClick: () => void } | null;
  onHost?: (() => void) | undefined;
  status: { label: string; tone: "live" | "replay" | "muted" } | null;
  viewers: number | null;
  /** Por baixo de «Ao vivo», à direita (o ⚙ do vídeo). */
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-1 text-white">
      <div className="flex min-w-0 items-center gap-[7px]">
        <button type="button" onClick={onHost} disabled={!onHost} aria-label={`Ver as redes de ${host.name}`} className="shrink-0 rounded-full">
          <Avatar host={host} size={34} />
        </button>
        <button
          type="button"
          onClick={onHost}
          disabled={!onHost}
          className="flex min-w-0 items-center gap-[5px] text-[14px] font-[600] leading-tight [text-shadow:0_1px_3px_rgba(0,0,0,.45)]"
        >
          <span className="truncate">{host.name}</span>
          {host.verified && host.name ? <HostBadge /> : null}
        </button>
        {follow ? <FollowButton label={follow.label} onClick={follow.onClick} /> : null}
      </div>
      <div className="relative flex shrink-0 items-center gap-1">
        {status ? <LiveBadge label={status.label} tone={status.tone} /> : null}
        {viewers !== null ? <LiveViewers count={viewers} /> : null}
        {extra ? <div className="absolute right-0 top-[calc(100%+8px)]">{extra}</div> : null}
      </div>
    </div>
  );
}

/** No painel do computador: o título e, por baixo, a foto, o nome e o + Seguir à direita. */
export function LivePanelHead({
  title,
  host,
  follow,
  onHost,
}: {
  title: string;
  host: LiveHost;
  follow: { label: string; onClick: () => void } | null;
  onHost?: (() => void) | undefined;
}) {
  return (
    <div className="shrink-0 border-b border-room-line px-5 pb-4 pt-[18px] text-room-text">
      {title ? (
        <h2 className="text-balance text-[20px] font-extrabold leading-tight tracking-[-0.01em]">{title}</h2>
      ) : (
        // Ainda sem título: um traço no lugar dele, para a sala se ir construindo com o que se preenche.
        <span aria-hidden className="block h-5 w-3/5 rounded-md bg-room-raised" />
      )}
      {host.name ? (
        <div className="mt-3.5 flex items-center gap-3">
          <button type="button" onClick={onHost} disabled={!onHost} aria-label={`Ver as redes de ${host.name}`} className="shrink-0 rounded-full">
            <Avatar host={host} size={44} />
          </button>
          <button type="button" onClick={onHost} disabled={!onHost} className="flex min-w-0 flex-1 items-center gap-[5px] text-[15px] font-[600]">
            <span className="truncate">{host.name}</span>
            {host.verified ? <HostBadge size={15} /> : null}
          </button>
          {follow ? <FollowButton big label={follow.label} onClick={follow.onClick} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Chat ---------- */

export type LiveFeedItem =
  | { key: string; kind: "msg"; author: string; text: string }
  | { key: string; kind: "mine"; text: string; note?: ReactNode }
  | { key: string; kind: "sale"; text: string; color?: string | null | undefined }
  | { key: string; kind: "notice" };

/**
 * O chat por cima do vídeo: nome e mensagem em branco, como no Instagram. As linhas desvanecem
 * ao subir. O aviso do Suporte só a própria pessoa vê, e tocar nele abre a resposta.
 */
export function LiveFeed({
  items,
  onNotice,
  feedRef,
  className,
  panel,
}: {
  items: readonly LiveFeedItem[];
  onNotice?: (() => void) | undefined;
  feedRef?: React.Ref<HTMLDivElement> | undefined;
  className?: string | undefined;
  /** No painel do computador: o texto segue o tema, sem a sombra que o destaca do vídeo. */
  panel?: boolean | undefined;
}) {
  return (
    <div ref={feedRef} className={cn("lv-feed flex flex-col overflow-y-auto overscroll-contain pr-11 [scrollbar-width:none]", className)}>
      <div
        className={cn(
          "mt-auto grid gap-2.5 pt-10 text-[15px] leading-[1.35]",
          panel ? "text-room-text" : "text-white [text-shadow:0_1px_3px_rgba(0,0,0,.6)]",
        )}
      >
        {items.map((item) =>
          item.kind === "sale" ? (
            // A compra com fundo na cor escolhida nas Vendas, para se ver bem por cima do vídeo.
            <p
              key={item.key}
              className="lv-in flex items-start gap-1.5 justify-self-start rounded-[14px] px-2.5 py-1 font-bold text-white [text-shadow:none]"
              style={{ background: saleColor(item.color).solid }}
            >
              <ShoppingCart className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">{item.text}</span>
            </p>
          ) : item.kind === "notice" ? (
            <button key={item.key} type="button" onClick={onNotice} className="lv-in flex items-start gap-2 text-left">
              <span className="mt-[-1px] grid size-[22px] shrink-0 place-items-center rounded-full [text-shadow:none]" style={{ background: BRAND }}>
                <Headset className="size-[13px]" strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <b className="mr-1.5 font-bold">Suporte</b>
                <span className="font-medium">@Você, já respondemos à sua dúvida. </span>
                <u className="font-extrabold underline-offset-[3px]">Ver resposta</u>
                <OnlyYou panel={panel} />
              </span>
            </button>
          ) : item.kind === "mine" ? (
            <div key={item.key} className="lv-in">
              <p className="min-w-0 break-words">
                <b className="mr-1.5 font-bold">Você</b>
                <span className="font-medium">{item.text}</span>
                <OnlyYou panel={panel} />
              </p>
              {item.note}
            </div>
          ) : (
            <p key={item.key} className="lv-in min-w-0 break-words">
              <b className="mr-1.5 font-bold">{item.author}</b>
              <span className="font-medium">{item.text}</span>
            </p>
          ),
        )}
      </div>
    </div>
  );
}

function OnlyYou({ panel }: { panel?: boolean | undefined }) {
  return (
    <em
      className={cn(
        "ml-1.5 rounded px-1.5 py-px align-[1px] text-[11px] font-semibold not-italic [text-shadow:none]",
        panel ? "bg-room-raised text-room-subtle" : "bg-white/20",
      )}
    >
      só você vê
    </em>
  );
}

/* ---------- Oferta ---------- */

/** «-86%» a partir dos dois preços escritos («50 000 Kz» e «6 997 Kz»); sem números, nada. */
export function priceDiscount(from: string | null | undefined, now: string | null | undefined) {
  const num = (s: string | null | undefined) => Number((s ?? "").replace(/[^\d,.]/g, "").replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
  const a = num(from);
  const b = num(now);
  if (!a || !b || b >= a) return null;
  return `-${Math.round((1 - b / a) * 100)}%`;
}

export function clockOf(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.min(99, Math.floor(s / 60))).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export type LiveOffer = {
  product: string;
  priceFrom: string;
  priceNow: string;
  button: string;
  countdown: number | null;
  closed: boolean;
};

/**
 * O cartão da oferta quando abre: nome, preços, o tempo e o botão. Tem uma pega como as folhas:
 * tocar ou puxar para baixo reduz à barra; puxar para cima abre a oferta inteira.
 */
export function LiveOfferCard({
  offer,
  onBuy,
  onMinimize,
  onExpand,
  panel,
}: {
  offer: LiveOffer;
  onBuy: () => void;
  onMinimize: () => void;
  onExpand?: (() => void) | undefined;
  panel?: boolean | undefined;
}) {
  const drag = useDrag(onMinimize, onExpand);
  return (
    <div
      className="lv-up mt-2"
      style={drag.dy ? { transform: `translateY(${drag.dy > 0 ? drag.dy : drag.dy / 3}px)` } : { transition: "transform .2s" }}
    >
      <button
        type="button"
        {...drag.handlers}
        onClick={() => {
          if (!drag.moved.current) onMinimize();
        }}
        aria-label="Reduzir a oferta (puxe para cima para a ver inteira)"
        title="Puxe para baixo para reduzir, para cima para ver tudo"
        className="mx-auto flex h-6 w-24 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      >
        <span className={cn("block h-[5px] w-10 rounded-full", panel ? "bg-room-subtle/50" : "bg-white/80 shadow-[0_1px_4px_rgba(0,0,0,.4)]")} />
      </button>
      <div className="lv-sheet mt-1 overflow-hidden rounded-2xl bg-room-surface text-room-text shadow-[0_18px_40px_rgba(0,0,0,.45)] ring-1 ring-room-line">
        <div className="bg-[linear-gradient(110deg,var(--of-dark)_0%,var(--of-mid)_52%,var(--of)_100%)] px-4 pb-3.5 pt-3 text-white">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.2em] text-white/85">Inscrições abertas</p>
          <p className="mt-1 text-[22px] font-extrabold leading-tight tracking-[-0.01em]">{offer.product || "A oferta"}</p>
        </div>
        <div className="px-3.5 pb-3.5 pt-3">
          <div className="flex items-center gap-2 text-[14.5px]">
            {offer.priceFrom ? <s className="text-room-subtle">De {offer.priceFrom}</s> : null}
            {offer.priceNow ? <b className="font-extrabold">Por {offer.priceNow}</b> : null}
            {offer.countdown !== null ? (
              <span className="ml-auto inline-flex items-center gap-1 font-extrabold tabular-nums text-[var(--of-ink)]">
                <Clock className="size-3.5" strokeWidth={2.4} />
                {clockOf(offer.countdown)}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onBuy}
            disabled={offer.closed}
            className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--of)] text-[15px] font-extrabold text-[var(--of-on)] transition hover:brightness-110 disabled:bg-room-raised disabled:text-room-subtle"
          >
            <ShoppingCart className="size-[17px]" />
            {offer.closed ? "Oferta encerrada" : offer.button}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A oferta minimizada: uma barra com o nome, os preços, o desconto e o tempo. Abre a oferta inteira. */
export function LiveOfferSlim({ offer, onOpen }: { offer: LiveOffer; onOpen: () => void }) {
  const off = priceDiscount(offer.priceFrom, offer.priceNow);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Ver a oferta"
      className="lv-up mt-3 flex h-[52px] w-full items-center gap-2.5 rounded-[14px] bg-[linear-gradient(100deg,var(--of-mid),var(--of))] pl-2 pr-2.5 text-left text-white"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-black/25">
        <ShoppingBag className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <b className="truncate text-[14px] font-extrabold">{offer.product || "A oferta"}</b>
        <span className="truncate text-[12.5px] font-bold">
          {offer.priceFrom ? <s className="mr-1 font-medium opacity-70">{offer.priceFrom}</s> : null}
          {offer.priceNow}
          {off ? <em className="ml-1.5 rounded-full bg-black/30 px-1.5 py-px text-[11px] not-italic">{off}</em> : null}
        </span>
      </span>
      {offer.countdown !== null ? (
        <span className="inline-flex h-[30px] shrink-0 items-center gap-1 rounded-full bg-black/30 px-2.5 text-[13.5px] font-extrabold tabular-nums">
          <Clock className="size-[13px]" strokeWidth={2.4} />
          {clockOf(offer.countdown)}
        </span>
      ) : null}
      <ChevronUp className="size-[18px] shrink-0" strokeWidth={2.4} />
    </button>
  );
}

/* ---------- Caixa de escrever e botões ---------- */

/** O coração do Live: o mesmo da sala, sem fundo, com o contorno branco como os outros botões. */
export function LiveHeartButton({ onHeart, reactions, panel }: { onHeart: () => void; reactions: readonly Reaction[]; panel?: boolean | undefined }) {
  return (
    <HeartButton
      onHeart={onHeart}
      reactions={reactions}
      className={cn("grid size-[38px] place-items-center rounded-full transition active:scale-90", panel ? "text-room-text" : "text-white")}
      iconClassName="size-6 [stroke-width:1.8]"
    />
  );
}

function CountBadge({ children, panel }: { children: ReactNode; panel?: boolean | undefined }) {
  return (
    <span
      className={cn(
        "absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-extrabold leading-none",
        panel ? "bg-[#E8440C] text-white" : "bg-white text-[#C2410C]",
      )}
    >
      {children}
    </span>
  );
}

/**
 * A linha de baixo: a caixa de escrever (com emojis), enviar, o saco da oferta (pisca quando a
 * oferta está minimizada), o Suporte (só um número, sem piscar) e o coração.
 */
export function LiveComposer({
  value,
  onChange,
  onSubmit,
  inputProps,
  bag,
  support,
  onHeart,
  reactions,
  panel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement> | undefined;
  bag: { blink: boolean; onClick: () => void } | null;
  support: { unread: number; open: boolean; onClick: () => void };
  onHeart: () => void;
  reactions: readonly Reaction[];
  /** No painel do computador: as cores seguem o tema em vez do branco por cima do vídeo. */
  panel?: boolean | undefined;
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const ink = panel ? "text-room-text" : "text-white";
  return (
    <form
      className="mt-2.5 flex items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) onSubmit();
      }}
    >
      <div
        className={cn(
          "flex h-11 min-w-0 flex-1 items-center gap-0.5 rounded-full pl-[15px] pr-[5px]",
          panel ? "bg-room-raised" : "border-[1.5px] border-white/60 bg-black/[0.18]",
        )}
      >
        <input
          {...inputProps}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enviar mensagem..."
          enterKeyHint="send"
          maxLength={200}
          aria-label="Mensagem"
          className={cn(
            "min-w-0 flex-1 bg-transparent text-[15px] outline-none",
            panel ? "text-room-text placeholder:text-room-subtle" : "text-white placeholder:text-white/85",
          )}
        />
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Emojis" className={cn("grid size-8 shrink-0 place-items-center rounded-full", ink, emojiOpen && (panel ? "bg-room-line" : "bg-white/20"))}>
              <Smile className="size-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-[264px] p-2">
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJIS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => onChange(`${value}${emoji}`)} className="grid size-7 place-items-center rounded-md text-lg hover:bg-accent">
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <button type="submit" aria-label="Enviar" className={cn("grid size-[38px] shrink-0 place-items-center rounded-full", ink)}>
        <SendHorizontal className="size-[22px]" strokeWidth={1.8} />
      </button>
      {bag ? (
        <button
          type="button"
          onClick={bag.onClick}
          aria-label="Ver a oferta"
          className={cn(
            "relative grid size-[38px] shrink-0 place-items-center rounded-full bg-[var(--of)] text-[var(--of-on)]",
            !bag.blink && (panel ? "ring-2 ring-room-line" : "ring-2 ring-white"),
          )}
        >
          {bag.blink ? <span className="lv-ping pointer-events-none absolute inset-0 rounded-full border-2 border-[var(--of)]" /> : null}
          <ShoppingBag className="size-[19px]" />
          {bag.blink ? <CountBadge panel={panel}>1</CountBadge> : null}
        </button>
      ) : null}
      <button
        type="button"
        onClick={support.onClick}
        aria-label="Suporte"
        className={cn(
          "relative grid size-[38px] shrink-0 place-items-center rounded-full",
          ink,
          support.open && (panel ? "ring-2 ring-inset ring-room-text" : "ring-2 ring-inset ring-white"),
        )}
      >
        <Headset className="size-[22px]" strokeWidth={1.8} />
        {support.unread > 0 ? <CountBadge panel={panel}>{support.unread}</CountBadge> : null}
      </button>
      <LiveHeartButton onHeart={onHeart} reactions={reactions} panel={panel} />
    </form>
  );
}

/* ---------- Folhas (Suporte, redes, oferta inteira) ---------- */

/**
 * Uma folha que sobe por cima da sala, no tema da sala. Puxa-se pela pega: para baixo fecha; tocar
 * fora também fecha. Ocupa o contentor (relative) onde está.
 */
export function LiveSheet({ onClose, children, label, className }: { onClose: () => void; children: ReactNode; label: string; className?: string | undefined }) {
  const drag = useDrag(onClose);
  return (
    <div className="absolute inset-0 z-40">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/45" />
      <div
        role="dialog"
        aria-label={label}
        className={cn("lv-sheet lv-up absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl bg-room-surface text-room-text shadow-[0_-10px_40px_rgba(0,0,0,.5)]", className)}
        style={drag.dy > 0 ? { transform: `translateY(${drag.dy}px)` } : { transition: "transform .2s" }}
      >
        <div {...drag.handlers} aria-hidden className="flex h-5 shrink-0 cursor-grab touch-none items-end justify-center active:cursor-grabbing">
          <span className="block h-1 w-9 rounded-full bg-room-subtle/40" />
        </div>
        {children}
      </div>
    </div>
  );
}

export type LiveSupportMessage = { key: string; text: string; fromTeam: boolean; note?: ReactNode };

/** O Suporte, como uma conversa do Instagram: o título «Suporte» e quem responde por cima de cada resposta. */
export function LiveSupportSheet({
  thread,
  teamName,
  waiting,
  onClose,
}: {
  thread: readonly LiveSupportMessage[];
  teamName: string;
  waiting?: boolean | undefined;
  onClose: () => void;
}) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = body.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [thread.length, waiting]);
  return (
    <LiveSheet onClose={onClose} label="Suporte" className="max-h-[66%]">
      <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center border-b border-room-line px-2 pb-2.5 pt-1">
        <span className="grid size-8 place-items-center justify-self-center rounded-full text-white" style={{ background: BRAND }}>
          <Headset className="size-[17px]" />
        </span>
        <b className="text-center text-[16px] font-extrabold">Suporte</b>
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-9 place-items-center rounded-full text-room-subtle">
          <X className="size-5" />
        </button>
      </div>
      <div ref={body} className="flex min-h-[140px] flex-1 flex-col overflow-y-auto px-3.5 pb-[18px] pt-1.5">
        <SupportMessages
          thread={thread}
          teamName={teamName}
          waiting={waiting}
          empty={`Quando fizer uma pergunta no chat, a ${teamName} responde aqui, só para si.`}
        />
      </div>
    </LiveSheet>
  );
}

/**
 * A conversa do Suporte, como no Instagram: quem responde por cima de cada resposta, o avatar da
 * equipa e as perguntas da pessoa à direita, no laranja da marca. Serve o Live e o Webinar.
 */
export function SupportMessages({
  thread,
  teamName,
  waiting,
  empty,
}: {
  thread: readonly LiveSupportMessage[];
  teamName: string;
  waiting?: boolean | undefined;
  empty: string;
}) {
  const avatar = (
    <span className="grid size-[26px] shrink-0 place-items-center rounded-full text-white" style={{ background: BRAND }}>
      <Headset className="size-3.5" />
    </span>
  );
  return (
    <div className="mt-auto flex flex-col text-room-text">
      {thread.length === 0 ? (
        <p className="mx-3 my-[18px] text-center text-[13.5px] leading-snug text-room-subtle">{empty}</p>
      ) : (
        <span className="my-2.5 self-center text-[11px] font-semibold text-room-subtle">Hoje</span>
      )}
      {thread.map((m) =>
        m.fromTeam ? (
          <div key={m.key} className="lv-in mt-2.5">
            <span className="mb-[3px] ml-[33px] block text-[11.5px] font-bold text-room-subtle">{teamName}</span>
            <div className="flex max-w-[86%] items-end gap-[7px]">
              {avatar}
              <div className="rounded-[20px] bg-room-raised px-[13px] py-[9px] text-[14.5px] leading-[1.38]">{m.text}</div>
            </div>
          </div>
        ) : (
          <div key={m.key} className="lv-in mt-1.5 flex max-w-[78%] flex-col items-end self-end">
            <div className="rounded-[20px] bg-[linear-gradient(135deg,#F0642E,#E8440C)] px-[13px] py-[9px] text-[14.5px] leading-[1.38] text-white">{m.text}</div>
            {m.note}
          </div>
        ),
      )}
      {waiting ? (
        <div className="lv-in mt-1.5 flex items-end gap-[7px]">
          {avatar}
          <span className="inline-flex h-[38px] items-center gap-1 rounded-[20px] bg-room-raised px-[13px]" aria-label="A escrever">
            {[0, 0.15, 0.3].map((d) => (
              <i key={d} className="lv-dot size-1.5 rounded-full bg-room-subtle" style={{ animationDelay: `${d}s` }} />
            ))}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export const NETWORK_ICONS: Record<FollowNetwork, ReactNode> = {
  instagram: (
    <svg viewBox="0 0 24 24" className="size-[21px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" className="size-[21px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" className="size-[21px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" className="size-[21px]" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  ),
};

export type LiveNetworkRow = { id: FollowNetwork; name: string; handle: string; href: string; done: boolean };

/** As redes de quem apresenta: cada linha abre a rede (na app, no telemóvel) e passa a «A seguir». */
export function LiveFollowSheet({
  host,
  networks,
  onTap,
  onClose,
  note,
}: {
  host: LiveHost;
  networks: readonly LiveNetworkRow[];
  onTap: (id: FollowNetwork, event: React.MouseEvent<HTMLAnchorElement>) => void;
  onClose: () => void;
  note: string;
}) {
  const any = networks.some((n) => n.done);
  return (
    <LiveSheet onClose={onClose} label={`Seguir ${host.name}`} className="px-4 pb-3">
      <div className="flex items-center gap-3 px-0.5 pb-3 pt-2.5">
        <span className="shrink-0 rounded-full shadow-[0_0_0_2px_var(--room-surface),0_0_0_4px_#E8440C]">
          <Avatar host={host} size={52} />
        </span>
        <span className="min-w-0">
          <b className="flex items-center gap-[5px] text-[16px] font-extrabold">
            <span className="truncate">{host.name}</span>
            {host.verified ? <HostBadge size={16} /> : null}
          </b>
          <span className="mt-0.5 block text-[13px] leading-snug text-room-subtle">Siga nas redes para não perder a próxima aula.</span>
        </span>
      </div>
      <div className="grid border-t border-room-line">
        {networks.map((n) => (
          <div key={n.id} className="flex min-h-[60px] items-center gap-3 border-b border-room-line">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-room-raised">{NETWORK_ICONS[n.id]}</span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <b className="text-[14.5px] font-extrabold">{n.name}</b>
              <span className="truncate text-[12.5px] font-semibold text-room-subtle">{n.handle}</span>
            </span>
            <a
              href={n.href}
              target="_blank"
              rel="noopener"
              onClick={(event) => onTap(n.id, event)}
              className={cn(
                "inline-flex h-[34px] min-w-[104px] shrink-0 items-center justify-center gap-1 rounded-[10px] px-3.5 text-[13.5px] font-extrabold",
                n.done ? "bg-room-raised text-room-text" : "text-white",
              )}
              style={n.done ? undefined : { background: BRAND }}
            >
              {n.done ? <Check className="size-[15px]" strokeWidth={2.6} /> : null}
              {n.done ? (n.id === "youtube" ? "Subscrito" : "A seguir") : n.id === "youtube" ? "Subscrever" : "Seguir"}
            </a>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-center text-[12px] leading-snug text-room-subtle">{note}</p>
      <button type="button" onClick={onClose} className="mt-2.5 h-[46px] rounded-xl bg-room-text text-[15px] font-extrabold text-room-bg">
        {any ? "Feito" : "Continuar a ver a aula"}
      </button>
    </LiveSheet>
  );
}

/** A oferta inteira numa folha: «Reduzir» volta à barra. Por dentro usa o cartão de oferta da sala. */
export function LiveOfferSheet({
  countdown,
  onClose,
  onSupport,
  children,
}: {
  countdown: number | null;
  onClose: () => void;
  onSupport: () => void;
  children: ReactNode;
}) {
  return (
    <LiveSheet onClose={onClose} label="Oferta" className="top-10 overflow-hidden rounded-t-[18px]">
      <div className="flex shrink-0 items-center gap-2 pb-2.5 pl-3 pr-2">
        <button type="button" onClick={onClose} className="inline-flex h-8 items-center gap-1 rounded-full pl-2 pr-3 text-[13px] font-bold ring-1 ring-room-line">
          <ChevronDown className="size-4" strokeWidth={2.4} />
          Reduzir
        </button>
        {countdown !== null ? (
          <span className="ml-auto inline-flex h-7 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--of)_18%,transparent)] px-2.5 text-[12.5px] font-extrabold tabular-nums text-[var(--of-ink)]">
            <Clock className="size-[13px]" strokeWidth={2.4} />
            Termina em {clockOf(countdown)}
          </span>
        ) : (
          <span className="ml-auto" />
        )}
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-9 place-items-center rounded-full text-room-subtle">
          <X className="size-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <button type="button" onClick={onSupport} className="flex h-11 shrink-0 items-center justify-center gap-2 border-t border-room-line text-[13.5px] font-semibold">
        <Headset className="size-4" />
        Dúvidas? Falar com o Suporte
      </button>
    </LiveSheet>
  );
}
