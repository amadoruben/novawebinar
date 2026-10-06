import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Eye, Headset, MessagesSquare, Pin, Play, ShoppingCart, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { clock, offerCountdownLeft } from "@/lib/room-logic";
import { ROOM_FONT } from "@/components/room/entry-screen";
import {
  HeartButton,
  OfferCard,
  PulseDot,
  RoomPartsStyle,
  SaleLine,
  SendButton,
  type Reaction,
} from "@/components/room/room-parts";

/**
 * A sala ao vivo desenhada no segundo `t` do relógio do editor, ao tamanho real (computador
 * 1280×720, telemóvel 393×852). Usa as mesmas peças da sala pública.
 */

export type RoomTab = "chat" | "support" | "offer";
export type PreviewComment = { id: string; at: number; author: string; message: string; agent?: boolean };
export type PreviewSale = { id: string; at: number; buyer: string; product: string };
export type PreviewMine = { at: number; text: string; tab: "chat" | "support" };

export type RoomPreviewProps = {
  device: "desktop" | "phone";
  t: number;
  playing: boolean;
  onTogglePlay: () => void;
  duration: number;
  video: { url: string | null; muted: boolean };
  title: string;
  host: { name: string; role: string; avatarUrl: string };
  viewers: number | null;
  pin: string;
  comments: readonly PreviewComment[];
  sales: readonly PreviewSale[];
  offer: {
    visible: boolean;
    start: number | null;
    productName?: string | undefined;
    imageUrl?: string | undefined;
    priceFrom: string;
    priceNow: string;
    buttonText: string;
    countdown: number;
  };
  agent: { on: boolean; name: string };
  tab: RoomTab;
  onTab: (tab: RoomTab) => void;
  /** Mostra o separador Oferta antes de abrir, com o aviso do minuto. */
  forceOffer?: boolean | undefined;
  highlight?: string | null | undefined;
  mine: readonly PreviewMine[];
  onSend: (text: string, tab: "chat" | "support") => void;
  reactions: readonly Reaction[];
  onHeart: () => void;
  onBuy?: (() => void) | undefined;
};

const hlRing = "outline outline-2 outline-offset-4 outline-[#E8440C] shadow-[0_0_0_10px_rgba(232,68,12,.25)]";
const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

export function RoomPreview(props: RoomPreviewProps) {
  const phone = props.device === "phone";
  const hl = (key: string) => (props.highlight === key ? hlRing : "");
  const offerOpen = props.offer.visible && props.t >= (props.offer.start ?? 0);
  const offerTab = props.offer.visible && (offerOpen || props.forceOffer);
  const tab: RoomTab = props.tab === "offer" && !offerTab ? "chat" : props.tab;
  const lastSale = [...props.sales].reverse().find((s) => s.at <= props.t && props.t - s.at < 8);

  const videoCard = (
    <div
      className={cn(
        "relative aspect-video overflow-hidden bg-black",
        phone ? "w-full" : "rounded-2xl shadow-[0_0_0_1px_#2E2E2E]",
      )}
    >
      {props.video.url ? (
        <SyncedVideo url={props.video.url} t={props.t} playing={props.playing} muted={props.video.muted} />
      ) : (
        <div className="absolute inset-0 grid content-center gap-3.5 bg-[radial-gradient(120%_90%_at_85%_10%,rgba(232,68,12,.2),transparent_55%),linear-gradient(160deg,#22262e,#111316)] px-[8%]">
          <p className={cn("font-bold uppercase tracking-[0.16em] text-[#F28E63]", phone ? "text-[9px]" : "text-[15px]")}>
            Sessão ao vivo
          </p>
          <p className={cn("max-w-[600px] font-extrabold leading-[1.08] tracking-tight", phone ? "text-[21px]" : "text-[50px]")}>
            {props.title}
          </p>
        </div>
      )}
      <div className={cn("absolute flex", phone ? "left-2 top-2 gap-1" : "left-3.5 top-3.5 gap-1.5")}>
        <span
          className={cn(
            "inline-flex items-center rounded-md bg-[#E5243B] font-bold uppercase tracking-[0.04em]",
            phone ? "h-6 gap-1.5 px-2 text-[11px]" : "h-[30px] gap-[7px] px-3 text-[13px]",
          )}
        >
          <i className="cw-dot size-2 rounded-full bg-white" />
          Ao vivo
        </span>
        {props.viewers !== null ? (
          <span
            className={cn(
              "inline-flex items-center rounded-md bg-[rgba(20,20,20,.72)] font-medium tabular-nums",
              phone ? "h-6 gap-1.5 px-2 text-[11px]" : "h-[30px] gap-[7px] px-3 text-sm",
              hl("viewers"),
            )}
          >
            <Eye className={phone ? "size-3" : "size-4"} />
            {props.viewers.toLocaleString("pt-PT")}
          </span>
        ) : null}
      </div>
      {lastSale ? (
        <div
          className={cn(
            "absolute flex items-center rounded-[14px] bg-white/95 text-[#0F1B2D] shadow-[0_12px_30px_rgba(0,0,0,.4)]",
            phone ? "bottom-2 left-2 gap-2 py-1.5 pl-1.5 pr-2.5" : "bottom-4 left-4 gap-3 py-2.5 pl-2.5 pr-4",
          )}
        >
          <span className={cn("grid place-items-center rounded-full bg-[#FDE4D9] text-[#A82F05]", phone ? "size-[26px]" : "size-9")}>
            <ShoppingCart className={phone ? "size-3" : "size-4"} />
          </span>
          <span>
            <b className={cn("block font-bold", phone ? "text-xs" : "text-[15px]")}>
              {lastSale.buyer} comprou {lastSale.product}
            </b>
            <small className={cn("text-[#465166]", phone ? "text-[10.5px]" : "text-[12.5px]")}>agora mesmo</small>
          </span>
        </div>
      ) : null}
      {!props.playing ? (
        <button
          type="button"
          onClick={props.onTogglePlay}
          aria-label="Tocar"
          className={cn(
            "absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 backdrop-blur",
            phone ? "size-12" : "size-[76px]",
          )}
        >
          <Play className={cn("fill-white text-white", phone ? "size-5" : "size-8")} />
        </button>
      ) : (
        <button type="button" onClick={props.onTogglePlay} aria-label="Pausar" className="absolute inset-0" />
      )}
    </div>
  );

  const hostRow = (
    <div className={cn("flex items-center", phone ? "gap-2.5 px-4 py-3" : "mt-3.5 gap-3", hl("host"))}>
      {props.host.avatarUrl ? (
        <img
          src={props.host.avatarUrl}
          alt=""
          className={cn("shrink-0 rounded-full object-cover", phone ? "size-9" : "size-11")}
        />
      ) : (
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-[#2E2E2E] font-bold",
            phone ? "size-9 text-xs" : "size-11 text-sm",
          )}
        >
          {initials(props.host.name || "?")}
        </span>
      )}
      <span className="min-w-0">
        <b className={cn("flex items-center gap-1.5", phone ? "text-sm" : "text-[15px]")}>
          {props.host.name || "Quem apresenta"}
          <BadgeCheck className="size-4 shrink-0 fill-[#0095f6] text-[#141414]" aria-label="Verificado" />
        </b>
        {props.host.role ? (
          <span className={cn("block text-[#A3A3A3]", phone ? "text-xs" : "text-[13px]")}>{props.host.role}</span>
        ) : null}
      </span>
    </div>
  );

  return (
    <div
      className={cn("text-white", phone ? "flex h-[852px] w-[393px] flex-col bg-[#141414]" : "grid h-[720px] w-[1280px] grid-cols-[minmax(0,1fr)_380px] gap-6 bg-[#141414] p-6")}
      style={{ fontFamily: ROOM_FONT }}
    >
      <RoomPartsStyle />
      {phone ? (
        <>
          <div className="h-[54px] shrink-0" />
          {videoCard}
          {hostRow}
        </>
      ) : (
        <div className="min-w-0">
          {videoCard}
          <div className="px-1 pt-[22px]">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E8440C]">Sessão ao vivo</p>
            <h1 className={cn("mt-1.5 text-[28px] font-extrabold leading-tight tracking-tight", hl("title"))}>
              {props.title}
            </h1>
            {hostRow}
          </div>
        </div>
      )}
      <Panel {...props} tab={tab} offerTab={offerTab} offerOpen={offerOpen} hl={hl} phone={phone} />
    </div>
  );
}

function Panel({
  phone,
  tab,
  offerTab,
  offerOpen,
  hl,
  ...props
}: RoomPreviewProps & { phone: boolean; tab: RoomTab; offerTab: boolean | undefined; offerOpen: boolean; hl: (k: string) => string }) {
  const [text, setText] = useState("");
  const tabs: [RoomTab, string, typeof MessagesSquare][] = [
    ["chat", "Chat", MessagesSquare],
    ["support", "Suporte", Headset],
    ...(offerTab ? ([["offer", "Oferta", ShoppingCart]] as [RoomTab, string, typeof MessagesSquare][]) : []),
  ];
  const visible = props.comments.filter((c) => c.at <= props.t);
  const chatItems = [
    ...visible.map((c) => ({ key: c.id, at: c.at, kind: "msg" as const, c })),
    ...props.sales
      .filter((s) => s.at <= props.t)
      .map((s) => ({ key: `s-${s.id}`, at: s.at, kind: "sale" as const, s })),
    ...props.mine
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.tab === "chat" && m.at <= props.t + 1)
      .map(({ m, i }) => ({ key: `m-${i}`, at: m.at, kind: "mine" as const, m })),
  ]
    .sort((a, b) => a.at - b.at)
    .slice(phone ? -6 : -9);

  const supportMine = props.mine.filter((m) => m.tab === "support");
  const countdownLeft = offerCountdownLeft(props.offer.countdown, props.offer.start, props.t);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-[#1F1F1F]",
        phone ? "flex-1 pb-[26px]" : "h-[672px] rounded-2xl shadow-[0_0_0_1px_#2E2E2E]",
      )}
    >
      <div className="mx-3 flex shrink-0 border-b border-[#2E2E2E]">
        {tabs.map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => props.onTab(value)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-2 font-semibold transition",
              phone ? "h-[46px] text-sm" : "h-[54px] text-[15px]",
              tab === value ? "text-[#E8440C]" : "text-[#A3A3A3] hover:text-[#E5E5E5]",
            )}
          >
            <Icon className="size-4" />
            {label}
            {value === "offer" && tab !== "offer" ? <PulseDot /> : null}
            {tab === value ? <span className="absolute inset-x-5 -bottom-px h-[3px] rounded-full bg-[#E8440C]" /> : null}
          </button>
        ))}
      </div>

      {tab === "offer" ? (
        <div className={cn("min-h-0 flex-1 overflow-hidden", hl("pitch"))}>
          <OfferCard
            productName={props.offer.productName}
            imageUrl={props.offer.imageUrl}
            priceFrom={props.offer.priceFrom}
            priceNow={props.offer.priceNow}
            buttonText={props.offer.buttonText}
            onBuy={props.onBuy}
            countdownSeconds={countdownLeft}
            showCountdown={props.offer.countdown > 0}
            note={!offerOpen ? `Na sala, a oferta abre aos ${clock(props.offer.start ?? 0)}.` : null}
            compact={phone}
            highlight={props.highlight}
          />
        </div>
      ) : (
        <>
          {tab === "chat" && props.pin ? (
            <div className={cn("mx-3 mt-3 flex shrink-0 items-center gap-2.5 rounded-xl bg-[#262626] px-3.5 py-3 text-sm", hl("pin"))}>
              <Pin className="size-4 shrink-0 text-[#E8440C]" />
              <span className="min-w-0 truncate">{props.pin}</span>
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-3.5 overflow-hidden p-4">
            {tab === "chat" ? (
              chatItems.length === 0 ? (
                <p className="m-auto text-center text-sm text-[#737373]">As mensagens aparecem ao longo do vídeo.</p>
              ) : (
                chatItems.map((item) =>
                  item.kind === "sale" ? (
                    <SaleLine key={item.key} text={`${item.s.buyer} comprou ${item.s.product}`} />
                  ) : item.kind === "mine" ? (
                    <Message key={item.key} author="Você" text={item.m.text} badge="Só você vê" mine />
                  ) : (
                    <Message key={item.key} author={item.c.author} text={item.c.message} agent={item.c.agent} />
                  ),
                )
              )
            ) : (
              <SupportThread agent={props.agent} offer={props.offer} mine={supportMine} hl={hl} />
            )}
          </div>
          <form
            className="flex shrink-0 gap-2 border-t border-[#2E2E2E] p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const body = text.trim();
              if (!body) return;
              props.onSend(body, tab === "support" ? "support" : "chat");
              setText("");
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={tab === "support" ? "Escreva à equipa..." : "Escreva um comentário..."}
              className="h-11 min-w-0 flex-1 rounded-full bg-[#262626] px-4 text-sm text-[#F5F5F5] shadow-[0_0_0_1px_#2E2E2E] outline-none placeholder:text-[#7A7A7A] focus:shadow-[0_0_0_1px_#E8440C]"
            />
            {tab === "chat" ? <HeartButton onHeart={props.onHeart} reactions={props.reactions} compact={phone} /> : null}
            <SendButton compact={phone} />
          </form>
        </>
      )}
    </div>
  );
}

function Message({
  author,
  text,
  agent,
  mine,
  badge,
}: {
  author: string;
  text: string;
  agent?: boolean | undefined;
  mine?: boolean | undefined;
  badge?: string | undefined;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold",
          mine ? "bg-[#3A3A3A]" : agent ? "bg-[#E8440C]" : "bg-[#2E2E2E]",
        )}
      >
        {mine ? "EU" : initials(author)}
      </span>
      <div className="min-w-0">
        <b className={cn("flex items-center gap-1.5 text-[13.5px] font-bold", agent && "text-[#F28E63]")}>
          {author}
          {agent ? <Zap className="size-3 text-[#F28E63]" /> : null}
          {badge ? (
            <em className="rounded bg-[#262626] px-1.5 py-px text-[10.5px] font-medium not-italic text-[#A3A3A3]">{badge}</em>
          ) : null}
        </b>
        <p className="break-words text-sm leading-[1.4] text-[#D4D4D4]">{text}</p>
      </div>
    </div>
  );
}

function SupportThread({
  agent,
  offer,
  mine,
  hl,
}: {
  agent: RoomPreviewProps["agent"];
  offer: RoomPreviewProps["offer"];
  mine: readonly PreviewMine[];
  hl: (k: string) => string;
}) {
  const system = (text: string) => (
    <span className="self-center rounded-full bg-[#262626] px-3 py-1.5 text-[12.5px] text-[#A3A3A3]">{text}</span>
  );
  return (
    <div className={cn("flex flex-col gap-3.5", agent.on && hl("support"))}>
      {agent.on ? (
        <>
          <Message author="Marta" text="Qual é o preço da vaga?" />
          <Message
            author={agent.name}
            agent
            text={
              offer.priceNow
                ? `Marta, a vaga está por ${offer.priceNow}${offer.priceFrom ? ` em vez de ${offer.priceFrom}` : ""}. Está no separador Oferta.`
                : "Marta, os valores aparecem no separador Oferta quando abrir."
            }
          />
          <Message author="Marta" text="Posso pagar por transferência?" />
          <Message author={agent.name} agent text="Vou passar-te a alguém da equipa, só um momento." />
          {system("Passou para a equipa no Atendimento")}
        </>
      ) : (
        <>
          <Message author="Marta" text="Posso pagar por transferência?" />
          {system("Enviada para o Atendimento")}
        </>
      )}
      {mine.map((m, i) => (
        <Message key={i} author="Você" text={m.text} badge="Só a equipa vê" mine />
      ))}
    </div>
  );
}

/** O vídeo da sala a seguir o relógio do editor (o relógio manda, o vídeo acompanha). */
export function SyncedVideo({
  url,
  t,
  playing,
  muted,
  className,
}: {
  url: string;
  t: number;
  playing: boolean;
  muted: boolean;
  className?: string | undefined;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || video.readyState < 1) return;
    if (Math.abs(video.currentTime - t) > (playing ? 1.2 : 0.25)) video.currentTime = t;
  }, [t, playing]);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (playing) void video.play().catch(() => {});
    else video.pause();
  }, [playing]);
  return (
    <video
      ref={ref}
      src={url}
      muted={muted}
      playsInline
      preload="metadata"
      onLoadedMetadata={(e) => {
        e.currentTarget.currentTime = t;
      }}
      className={cn("absolute inset-0 size-full object-cover", className)}
    />
  );
}
