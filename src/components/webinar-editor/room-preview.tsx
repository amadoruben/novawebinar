import { useEffect, useRef, useState } from "react";
import { Eye, Headset, MessagesSquare, Pin, Play, ShoppingCart, Zap } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { cn } from "@/lib/utils";
import { activeOffer, clock, isGroupLink, offerCountdownLeft, type OfferSlot } from "@/lib/room-logic";
import { ROOM_FONT } from "@/components/room/entry-screen";
import {
  CaptionLine,
  ChatComposer,
  ChatLine,
  OfferCard,
  PulseDot,
  RoomPartsStyle,
  RoomTitle,
  SaleLine,
  saleColor,
  VideoSettings,
  type Appearance,
  type Reaction,
} from "@/components/room/room-parts";

/**
 * A sala ao vivo no segundo `t` do relógio do editor, ao tamanho real (computador 1280×720,
 * telemóvel 393×852 ao alto ou 852×393 deitado). Usa o leitor e as peças da sala pública:
 * o que se vê aqui é o que as pessoas vêem.
 */

export type RoomTab = "chat" | "support" | "offer";
export type PreviewComment = { id: string; at: number; author: string; message: string; agent?: boolean };
export type PreviewSale = { id: string; at: number; buyer: string; product: string };
export type PreviewMine = { at: number; text: string; tab: "chat" | "support" };
export type PreviewDevice = "desktop" | "phone" | "phone-landscape";

export type RoomPreviewProps = {
  device: PreviewDevice;
  theme: "dark" | "light";
  appearance: Appearance;
  onAppearance: (appearance: Appearance) => void;
  t: number;
  playing: boolean;
  onTogglePlay: () => void;
  duration: number;
  video: { url: string | null; provider: string | null };
  volume: number;
  onVolume: (volume: number) => void;
  captionsOn: boolean;
  onCaptions: (on: boolean) => void;
  speech: readonly { at: number; text: string }[];
  title: string;
  host: { name: string; role: string; avatarUrl: string; verified: boolean };
  viewers: number | null;
  pin: string;
  comments: readonly PreviewComment[];
  sales: readonly PreviewSale[];
  salesWhere: "chat" | "video" | "both";
  /** A cor das compras (Vendas). */
  saleColor?: string | null | undefined;
  offers: readonly OfferSlot[];
  offerImageUrl?: string | undefined;
  offerClosed: boolean;
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

export function RoomPreview(props: RoomPreviewProps) {
  const phone = props.device !== "desktop";
  const landscape = props.device === "phone-landscape";
  const hl = (key: string) =>
    props.highlight === key ? "outline outline-2 outline-offset-4 outline-[#E8440C] shadow-[0_0_0_10px_rgba(232,68,12,.25)]" : "";
  const open = activeOffer(props.offers, props.t);
  // O vídeo acabou, mas a oferta fecha depois: a sala fica aberta para compras.
  const afterVideo = props.duration > 0 && props.t >= props.duration - 0.5 && open !== null && (open.end ?? 0) > props.duration;
  // No separador Oferta do editor, mostra-se a primeira oferta mesmo antes de abrir.
  const shown = open ?? (props.forceOffer ? props.offers[0] ?? null : null);
  const offerTab = shown !== null;
  const tab: RoomTab = props.tab === "offer" && !offerTab ? "chat" : props.tab;
  const lastSale =
    props.salesWhere === "chat" ? undefined : [...props.sales].reverse().find((s) => s.at <= props.t && props.t - s.at < 8);
  let said: string | null = null;
  for (const line of props.speech) {
    if (line.at > props.t) break;
    said = props.t - line.at < 7 ? line.text : null;
  }

  const videoCard = (
    <div
      className={cn(
        "relative overflow-hidden bg-black",
        landscape ? "h-full w-full" : "aspect-video w-full",
        !phone && "rounded-2xl ring-1 ring-room-line",
      )}
    >
      {props.video.url ? (
        <PreviewPlayer url={props.video.url} provider={props.video.provider} t={props.t} playing={props.playing} volume={props.volume} />
      ) : (
        <div className="absolute inset-0 grid content-center gap-3 bg-[radial-gradient(120%_90%_at_85%_10%,rgba(232,68,12,.2),transparent_55%),linear-gradient(160deg,#22262e,#111316)] px-[8%] text-white">
          <p className={cn("font-bold uppercase tracking-[0.16em] text-[#F28E63]", phone ? "text-[10px]" : "text-[15px]")}>
            Sem vídeo
          </p>
          <p className={cn("max-w-[640px] font-extrabold leading-[1.1] tracking-tight", phone ? "text-[20px]" : "text-[44px]")}>
            Escolha o vídeo na etapa Vídeo
          </p>
        </div>
      )}
      <div className={cn("absolute flex", phone ? "left-2.5 top-2.5 gap-1" : "left-3.5 top-3.5 gap-1.5")}>
        <span
          className={cn(
            "inline-flex items-center rounded-md bg-[#E5243B] font-bold uppercase tracking-[0.04em] text-white",
            phone ? "h-6 gap-1.5 px-2 text-[11px]" : "h-[30px] gap-[7px] px-3 text-[13px]",
          )}
        >
          <i className="cw-dot size-2 rounded-full bg-white" />
          Ao vivo
        </span>
        {props.viewers !== null ? (
          <span
            className={cn(
              "inline-flex items-center rounded-md bg-black/70 font-medium tabular-nums text-white",
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
            "absolute flex items-center rounded-[14px] text-white shadow-[0_12px_30px_rgba(0,0,0,.4)]",
            phone ? "bottom-2 left-2 gap-2 py-1.5 pl-1.5 pr-2.5" : "bottom-4 left-4 gap-3 py-2.5 pl-2.5 pr-4",
          )}
          style={{ background: saleColor(props.saleColor).solid }}
        >
          <span className={cn("grid place-items-center rounded-full bg-white/25 text-white", phone ? "size-[26px]" : "size-9")}>
            <ShoppingCart className={phone ? "size-3" : "size-4"} />
          </span>
          <span>
            <b className={cn("block font-bold", phone ? "text-xs" : "text-[15px]")}>
              {lastSale.buyer} comprou {lastSale.product}
            </b>
            <small className={cn("text-white/80", phone ? "text-[10.5px]" : "text-[12.5px]")}>agora mesmo</small>
          </span>
        </div>
      ) : null}
      {props.captionsOn ? <CaptionLine text={said} compact={phone} /> : null}
      {afterVideo ? (
        <div className="absolute inset-0 z-[5] grid place-items-center bg-black/90 px-6 text-center text-white">
          <div className={cn("grid justify-items-center", phone ? "gap-1.5" : "gap-3")}>
            <p className={cn("font-bold uppercase tracking-[0.18em] text-[#F28E63]", phone ? "text-[10px]" : "text-[13px]")}>A aula terminou</p>
            <p className={cn("font-extrabold leading-tight", phone ? "text-[17px]" : "text-[34px]")}>As inscrições continuam abertas</p>
            <p className={cn("text-white/75", phone ? "text-[11px]" : "text-[16px]")}>
              Mais {Math.round(((open?.end ?? props.duration) - props.duration) / 60)} min, no separador Oferta. Dúvidas? Fale com a equipa no Suporte.
            </p>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={props.onTogglePlay}
        aria-label={props.playing ? "Pausar" : "Tocar"}
        className="absolute inset-0"
      >
        {!props.playing && props.video.url ? (
          <span
            className={cn(
              "absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 backdrop-blur",
              phone ? "size-12" : "size-[76px]",
            )}
          >
            <Play className={cn("fill-white text-white", phone ? "size-5" : "size-8")} />
          </span>
        ) : null}
      </button>
      <div className={cn("absolute", phone ? "bottom-2 right-2" : "bottom-3 right-3")}>
        <VideoSettings
          compact={phone}
          volume={props.volume}
          onVolume={props.onVolume}
          captions={props.captionsOn}
          onCaptions={props.onCaptions}
          hasCaptions={props.speech.length > 0}
          appearance={props.appearance}
          onAppearance={props.onAppearance}
        />
      </div>
    </div>
  );

  const roomClass = cn(
    "room-ambient text-room-text",
    props.theme === "light" && "room-light",
    landscape
      ? "flex h-[393px] w-[852px] items-center justify-center bg-black"
      : phone
        ? "flex h-[852px] w-[393px] flex-col"
        : "grid h-[720px] w-[1280px] grid-cols-[minmax(0,1fr)_380px] gap-6 p-6",
  );

  if (landscape) {
    // Deitado, o telemóvel mostra o vídeo em ecrã inteiro, como no YouTube.
    return (
      <div className={roomClass} style={{ fontFamily: ROOM_FONT }}>
        <RoomPartsStyle />
        <div className="aspect-video h-full">{videoCard}</div>
      </div>
    );
  }

  return (
    <div className={roomClass} style={{ fontFamily: ROOM_FONT }}>
      <RoomPartsStyle />
      {phone ? (
        <>
          <div className="h-[54px] shrink-0 bg-black" />
          {videoCard}
          <RoomTitle compact kicker="" title={props.title} host={props.host} highlight={props.highlight} />
        </>
      ) : (
        <div className="min-w-0">
          {videoCard}
          <div className="px-1">
            <RoomTitle kicker="Sessão ao vivo" title={props.title} host={props.host} highlight={props.highlight} />
          </div>
        </div>
      )}
      <Panel {...props} tab={tab} shown={shown} open={open} hl={hl} phone={phone} afterVideo={afterVideo} />
    </div>
  );
}

function Panel({
  phone,
  tab,
  shown,
  open,
  hl,
  afterVideo,
  ...props
}: RoomPreviewProps & {
  phone: boolean;
  tab: RoomTab;
  shown: OfferSlot | null;
  open: OfferSlot | null;
  hl: (k: string) => string;
  afterVideo: boolean;
}) {
  const [text, setText] = useState("");
  const tabs: [RoomTab, string, typeof MessagesSquare][] = [
    ["chat", "Chat", MessagesSquare],
    ["support", "Suporte", Headset],
    ...(shown ? ([["offer", "Oferta", ShoppingCart]] as [RoomTab, string, typeof MessagesSquare][]) : []),
  ];
  const visible = props.comments.filter((c) => c.at <= props.t);
  const chatItems = [
    ...visible.map((c) => ({ key: c.id, at: c.at, kind: "msg" as const, c })),
    ...(props.salesWhere === "video" ? [] : props.sales)
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
  const countdownLeft = shown ? offerCountdownLeft(shown.countdown, shown.start, props.t) : 0;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-room-surface",
        phone ? "flex-1 pb-[22px]" : "h-[672px] rounded-2xl ring-1 ring-room-line",
      )}
    >
      <div className="mx-3 flex shrink-0 border-b border-room-line">
        {tabs.map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => props.onTab(value)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-2 font-semibold transition",
              phone ? "h-[46px] text-sm" : "h-[54px] text-[15px]",
              tab === value ? "text-primary" : "text-room-subtle hover:text-room-text",
            )}
          >
            <Icon className="size-4" />
            {label}
            {value === "offer" && tab !== "offer" ? <PulseDot /> : null}
            {tab === value ? <span className="absolute inset-x-5 -bottom-px h-[3px] rounded-full bg-primary" /> : null}
          </button>
        ))}
      </div>

      {tab === "offer" && shown ? (
        <div className={cn("min-h-0 flex-1 overflow-hidden", hl("pitch"))}>
          <OfferCard
            productName={shown.product}
            imageUrl={shown.id === "main" ? props.offerImageUrl : undefined}
            priceFrom={shown.priceFrom}
            priceNow={shown.priceNow}
            buttonText={shown.button || "Quero entrar"}
            onBuy={props.onBuy}
            countdownSeconds={countdownLeft}
            showCountdown={shown.countdown > 0}
            closed={shown.id === "main" && props.offerClosed}
            group={isGroupLink(shown.url)}
            banner={
              afterVideo ? (
                <>
                  <b className="block font-semibold">A aula terminou, mas as inscrições continuam abertas.</b>
                  Mais {Math.round(((open?.end ?? props.duration) - props.duration) / 60)} minutos.
                </>
              ) : null
            }
            note={!open ? `Na sala, esta oferta abre aos ${clock(shown.start)}.` : null}
            compact={phone}
            highlight={props.highlight}
          />
        </div>
      ) : (
        <>
          {tab === "chat" && props.pin ? (
            <div className={cn("mx-3 mt-3 flex shrink-0 items-center gap-2.5 rounded-xl bg-room-raised px-3.5 py-3 text-sm", hl("pin"))}>
              <Pin className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate">{props.pin}</span>
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-3.5 overflow-hidden p-4">
            {tab === "chat" ? (
              chatItems.length === 0 ? (
                <p className="m-auto text-center text-sm text-room-subtle">As mensagens aparecem ao longo do vídeo.</p>
              ) : (
                chatItems.map((item) =>
                  item.kind === "sale" ? (
                    <SaleLine key={item.key} text={`${item.s.buyer} comprou ${item.s.product}`} color={props.saleColor} />
                  ) : item.kind === "mine" ? (
                    <ChatLine key={item.key} author="Você" text={item.m.text} badge="Só você vê" tone="mine" big={!phone} />
                  ) : (
                    <div key={item.key} className={cn(props.highlight === `comment:${item.c.id}` && "-mx-2 rounded-lg bg-primary/15 px-2 py-1")}>
                      <ChatLine author={item.c.author} text={item.c.message} tone={item.c.agent ? "agent" : "people"} big={!phone} />
                    </div>
                  ),
                )
              )
            ) : (
              <SupportThread agent={props.agent} offer={props.offers[0] ?? null} mine={supportMine} hl={hl} />
            )}
          </div>
          <ChatComposer
            compact={phone}
            value={text}
            onChange={setText}
            onSubmit={() => {
              props.onSend(text.trim(), tab === "support" ? "support" : "chat");
              setText("");
            }}
            placeholder={tab === "support" ? "Escreva à equipa..." : "Chat..."}
            withReactions={tab === "chat"}
            onHeart={props.onHeart}
            reactions={props.reactions}
          />
        </>
      )}
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
  offer: OfferSlot | null;
  mine: readonly PreviewMine[];
  hl: (k: string) => string;
}) {
  const system = (text: string) => (
    <span className="self-center rounded-full bg-room-raised px-3 py-1.5 text-[12.5px] text-room-subtle">{text}</span>
  );
  return (
    <div className={cn("flex flex-col gap-3.5", agent.on && hl("support"))}>
      {agent.on ? (
        <>
          <ChatLine author="Marta" text="Qual é o preço da vaga?" />
          <ChatLine
            author={agent.name}
            tone="agent"
            text={
              offer?.priceNow
                ? `Marta, a vaga está por ${offer.priceNow}${offer.priceFrom ? ` em vez de ${offer.priceFrom}` : ""}. Está no separador Oferta.`
                : "Marta, os valores aparecem no separador Oferta quando abrir."
            }
          />
          <ChatLine author="Marta" text="Posso pagar por transferência?" />
          <ChatLine author={agent.name} tone="agent" text="Vou passar-te a alguém da equipa, só um momento." />
          {system("Passou para a equipa no Atendimento")}
        </>
      ) : (
        <>
          <ChatLine author="Marta" text="Posso pagar por transferência?" />
          {system("Enviada para o Atendimento")}
        </>
      )}
      {mine.map((m, i) => (
        <ChatLine key={i} author="Você" text={m.text} badge="Só a equipa vê" tone="mine" />
      ))}
    </div>
  );
}

/**
 * O leitor da sala a seguir o relógio do editor (o relógio manda, o vídeo acompanha). Serve
 * ficheiros, HLS e as plataformas (Vimeo, Panda, Bunny) com o mesmo leitor da sala pública.
 */
function PreviewPlayer({
  url,
  provider,
  t,
  playing,
  volume,
}: {
  url: string;
  provider: string | null;
  t: number;
  playing: boolean;
  volume: number;
}) {
  const media = useRef<HTMLVideoElement>(null);
  const embed = /youtube|youtu\.be|vimeo|mediadelivery|pandavideo|\/embed\/|player\./i.test(url);
  // Leitores embebidos não deixam pausar por fora: em pausa mostra-se a imagem parada por cima.
  const [session, setSession] = useState(0);
  const startAt = useRef(Math.floor(t));
  useEffect(() => {
    if (!embed || !playing) return;
    startAt.current = Math.floor(t);
    setSession((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, embed]);
  useEffect(() => {
    const video = media.current;
    if (!video) return;
    if (playing) void video.play().catch(() => {});
    else video.pause();
  }, [playing]);
  useEffect(() => {
    const video = media.current;
    if (!video || video.readyState < 1) return;
    if (Math.abs(video.currentTime - t) > (playing ? 1.5 : 0.3)) video.currentTime = t;
  }, [t, playing]);
  useEffect(() => {
    const video = media.current;
    if (!video) return;
    video.volume = volume;
    video.muted = volume === 0;
  }, [volume]);
  if (embed && !playing) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#111] text-xs text-white/60">
        <span className="rounded-full bg-black/60 px-3 py-1">{clock(t)}</span>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 [&_video]:size-full [&_video]:object-cover">
      <VideoPlayer
        key={embed ? session : url}
        url={url}
        provider={provider}
        controls={false}
        mediaRef={media}
        autoPlay={playing}
        muted={volume === 0}
        quiet
        startAtSeconds={embed ? startAt.current : Math.floor(t)}
        // O relógio do editor é que manda; o tempo do leitor não volta para trás.
        onTime={() => {}}
        className="size-full rounded-none"
      />
    </div>
  );
}
