import { useEffect, useRef, useState } from "react";
import { Eye, Headset, MessagesSquare, Pin, Play, ShoppingCart, X, Zap } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { cn } from "@/lib/utils";
import {
  activeOffer,
  clock,
  FOLLOW_NETWORKS,
  followMomentAt,
  followWebLink,
  isGroupLink,
  LIVE_DEFAULTS,
  offerCountdownLeft,
  profileHandle,
  type FollowNetwork,
  type LiveSettings,
  type OfferSlot,
} from "@/lib/room-logic";
import {
  FollowButton,
  LIVE_SCRIM,
  LiveBadge,
  LiveComposer,
  LiveFeed,
  LiveFollowSheet,
  LiveOfferCard,
  LiveOfferSheet,
  LiveOfferSlim,
  LivePanelHead,
  LiveStyle,
  LiveSupportSheet,
  LiveTopBar,
  LiveViewers,
  liveOfferVars,
  SupportMessages,
  type LiveFeedItem,
  type LiveOffer,
  type LiveSupportMessage,
} from "@/components/room/live-parts";
import { ROOM_FONT } from "@/components/room/entry-screen";
import {
  CaptionLine,
  ChatComposer,
  ChatLine,
  LIVE_CONTAIN,
  LIVE_COVER,
  OfferCard,
  PulseDot,
  RoomPartsStyle,
  RoomTitle,
  SaleLine,
  saleColor,
  SupportNotice,
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
  /** Formato Live: o vídeo com o chat por cima no telemóvel, e o chat num painel ao lado no computador. */
  live?: boolean | undefined;
  /** As opções da sala, iguais nos dois formatos: redes, momentos do + Seguir, cor do botão e aviso. */
  liveSettings?: LiveSettings | undefined;
};

/** As redes de quem apresenta e o + Seguir (só nos momentos escolhidos e fora da oferta), nos dois formatos. */
function useFollow(props: RoomPreviewProps, offerOpen: boolean) {
  const [open, setOpen] = useState(false);
  const [tapped, setTapped] = useState<Partial<Record<FollowNetwork, boolean>>>({});
  const live = props.liveSettings ?? LIVE_DEFAULTS;
  const networks = FOLLOW_NETWORKS.filter((n) => live.links[n.id]).map((n) => {
    const web = followWebLink(n.id, live.links[n.id] ?? "");
    return { id: n.id, name: n.name, handle: profileHandle(web), href: web, done: Boolean(tapped[n.id]) };
  });
  const label = networks.length === 1 && networks[0]?.id === "youtube" ? "Subscrever" : "Seguir";
  const show = () => setOpen(true);
  const follow = networks.length > 0 && !offerOpen && followMomentAt(live.moments, props.t) ? { label, onClick: show } : null;
  const host = { name: props.host.name, avatarUrl: props.host.avatarUrl, verified: props.host.verified };
  const sheet = open ? (
    <LiveFollowSheet
      host={host}
      networks={networks}
      note={props.device === "desktop" ? "Cada rede abre numa janela pequena ao lado. A aula continua aqui." : "Cada rede abre diretamente na app. A aula continua aqui."}
      onClose={() => setOpen(false)}
      onTap={(id) => setTapped((prev) => ({ ...prev, [id]: true }))}
    />
  ) : null;
  return { follow, onHost: networks.length ? show : undefined, sheet, host };
}

/** O que a sala mostra no segundo t: a oferta aberta, a compra a aparecer e a frase dita. */
function roomMoment(props: RoomPreviewProps) {
  const open = activeOffer(props.offers, props.t);
  // O vídeo acabou, mas a oferta fecha depois: a sala fica aberta para compras.
  const afterVideo = props.duration > 0 && props.t >= props.duration - 0.5 && open !== null && (open.end ?? 0) > props.duration;
  // No separador Oferta do editor, mostra-se a primeira oferta mesmo antes de abrir.
  const shown = open ?? (props.forceOffer ? props.offers[0] ?? null : null);
  const tab: RoomTab = props.tab === "offer" && !shown ? "chat" : props.tab;
  const lastSale =
    props.salesWhere === "chat" ? undefined : [...props.sales].reverse().find((s) => s.at <= props.t && props.t - s.at < 8);
  let said: string | null = null;
  for (const line of props.speech) {
    if (line.at > props.t) break;
    said = props.t - line.at < 7 ? line.text : null;
  }
  return { open, afterVideo, shown, tab, lastSale, said };
}

/** No editor, o Suporte mostra um exemplo: a pergunta de uma pessoa, a resposta do Agente e o que se escreveu. */
function supportExample(props: Pick<RoomPreviewProps, "agent" | "mine">, offer: OfferSlot | null): LiveSupportMessage[] {
  return [
    { key: "q", text: "Qual é o preço da vaga?", fromTeam: false },
    ...(props.agent.on
      ? [
          {
            key: "a",
            fromTeam: true,
            text: offer?.priceNow
              ? `A vaga está por ${offer.priceNow}${offer.priceFrom ? ` em vez de ${offer.priceFrom}` : ""}, enquanto a oferta estiver aberta.`
              : "Os valores aparecem na oferta quando ela abrir.",
          },
        ]
      : []),
    ...props.mine.filter((m) => m.tab === "support").map((m, i) => ({ key: `m${i}`, text: m.text, fromTeam: false })),
  ];
}

/** As últimas mensagens do chat no segundo t: comentários, compras e o que se escreveu. */
function chatItemsAt(props: Pick<RoomPreviewProps, "comments" | "sales" | "salesWhere" | "mine" | "t">, limit: number) {
  return [
    ...props.comments.filter((c) => c.at <= props.t).map((c) => ({ key: c.id, at: c.at, kind: "msg" as const, c })),
    ...(props.salesWhere === "video" ? [] : props.sales)
      .filter((s) => s.at <= props.t)
      .map((s) => ({ key: `s-${s.id}`, at: s.at, kind: "sale" as const, s })),
    ...props.mine
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.tab === "chat" && m.at <= props.t + 1)
      .map(({ m, i }) => ({ key: `m-${i}`, at: m.at, kind: "mine" as const, m })),
  ]
    .sort((a, b) => a.at - b.at)
    .slice(-limit);
}

export function RoomPreview(props: RoomPreviewProps) {
  if (props.live) return <LivePreview {...props} />;
  return <WebinarPreview {...props} />;
}

/** O formato Webinar: o vídeo deitado e o chat ao lado (no telemóvel, por baixo). */
function WebinarPreview(props: RoomPreviewProps) {
  const phone = props.device !== "desktop";
  const landscape = props.device === "phone-landscape";
  const hl = (key: string) =>
    props.highlight === key ? "outline outline-2 outline-offset-4 outline-[#E8440C] shadow-[0_0_0_10px_rgba(232,68,12,.25)]" : "";
  const { open, afterVideo, shown, tab, lastSale, said } = roomMoment(props);
  const live = props.liveSettings ?? LIVE_DEFAULTS;
  const social = useFollow(props, Boolean(open));
  const followButton = (big: boolean) => (social.follow ? <FollowButton big={big} label={social.follow.label} onClick={social.follow.onClick} /> : null);

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
      <div className={cn("absolute z-[1] flex items-center gap-[5px]", phone ? "left-2.5 top-2.5" : "left-[18px] top-[18px]")}>
        <LiveBadge />
        {props.viewers !== null ? (
          <span className={hl("viewers")}>
            <LiveViewers count={props.viewers} />
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

  const style = { fontFamily: ROOM_FONT, ...liveOfferVars(live.offerColor) };
  if (landscape) {
    // Deitado, o telemóvel mostra o vídeo em ecrã inteiro, como no YouTube.
    return (
      <div className={roomClass} style={style}>
        <RoomPartsStyle />
        <LiveStyle />
        <div className="aspect-video h-full">{videoCard}</div>
      </div>
    );
  }

  return (
    <div className={roomClass} style={style}>
      <RoomPartsStyle />
      <LiveStyle />
      {phone ? (
        <>
          <div className="h-[54px] shrink-0 bg-black" />
          {videoCard}
          <RoomTitle compact kicker="" title={props.title} host={props.host} highlight={props.highlight} follow={followButton(false)} onHost={social.onHost} />
        </>
      ) : (
        <div className="min-w-0">
          {videoCard}
          <div className="px-1">
            <RoomTitle kicker="Sessão ao vivo" title={props.title} host={props.host} highlight={props.highlight} follow={followButton(true)} onHost={social.onHost} />
          </div>
        </div>
      )}
      <div className={cn("relative flex min-h-0 flex-col", phone ? "flex-1" : "overflow-hidden rounded-2xl")}>
        <Panel {...props} tab={tab} shown={shown} open={open} hl={hl} phone={phone} afterVideo={afterVideo} notice={live.notify && props.agent.on} />
        {social.sheet}
      </div>
    </div>
  );
}

/**
 * A sala em formato Live, com as mesmas peças da sala pública: no telemóvel o vídeo enche o ecrã e
 * o chat fica por cima; no computador o vídeo (16:9 ou 9:16) tem o chat num painel ao lado.
 */
function LivePreview(props: RoomPreviewProps) {
  const [text, setText] = useState("");
  const [offerMin, setOfferMin] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const live = props.liveSettings ?? LIVE_DEFAULTS;
  const phone = props.device !== "desktop";
  const landscape = props.device === "phone-landscape";
  const portrait = phone && !landscape;
  const horizontal = live.desk !== "vertical";
  const hl = (key: string) =>
    props.highlight === key ? "outline outline-2 outline-offset-4 outline-[#E8440C] shadow-[0_0_0_10px_rgba(232,68,12,.25)]" : "";
  const { open, afterVideo, shown, lastSale, said } = roomMoment(props);
  const supportOpen = props.tab === "support";
  const { follow, onHost: openFollow, sheet: followSheet, host } = useFollow(props, Boolean(open));
  useEffect(() => {
    setOfferMin(false);
    setOfferOpen(false);
  }, [shown?.id]);

  const countdownLeft = shown ? offerCountdownLeft(shown.countdown, shown.start, props.t) : 0;
  const offer: LiveOffer | null = shown
    ? {
        product: shown.product,
        priceFrom: shown.priceFrom,
        priceNow: shown.priceNow,
        button: shown.button || "Quero minha vaga",
        countdown: shown.countdown > 0 ? countdownLeft : null,
        closed: shown.id === "main" && props.offerClosed,
      }
    : null;
  const cardOpen = Boolean(offer) && !offerMin && !offerOpen;

  const teamName = props.host.name ? `Equipa de ${props.host.name}` : "Equipa";

  const feed: LiveFeedItem[] = chatItemsAt(props, 12).map((item) =>
    item.kind === "sale"
      ? { key: item.key, kind: "sale", text: `${item.s.buyer} comprou ${item.s.product}`, color: props.saleColor }
      : item.kind === "mine"
        ? { key: item.key, kind: "mine", text: item.m.text }
        : { key: item.key, kind: "msg", author: item.c.author, text: item.c.message },
  );
  // O aviso «já respondemos», como exemplo, quando está ligado e o Agente responde.
  if (live.notify && props.agent.on && !supportOpen) feed.push({ key: "notice", kind: "notice" });
  const thread = supportExample(props, shown);

  const lower = (
    <>
      <LiveFeed
        items={feed}
        onNotice={() => props.onTab("support")}
        panel={!phone}
        className={!phone ? "min-h-0 flex-1 pr-0" : landscape ? "max-h-[120px]" : cardOpen ? "max-h-[150px]" : "max-h-[250px]"}
      />
      {offer && cardOpen ? (
        <div className={hl("pitch")}>
          <LiveOfferCard offer={offer} onBuy={() => props.onBuy?.()} onMinimize={() => setOfferMin(true)} onExpand={() => setOfferOpen(true)} panel={!phone} />
        </div>
      ) : null}
      {offer && !cardOpen && !offerOpen ? <LiveOfferSlim offer={offer} onOpen={() => setOfferOpen(true)} /> : null}
      <LiveComposer
        value={text}
        onChange={setText}
        onSubmit={() => {
          props.onSend(text.trim(), "chat");
          setText("");
        }}
        bag={offer ? { blink: !cardOpen && !offerOpen, onClick: () => setOfferOpen(true) } : null}
        support={{ unread: props.agent.on && !supportOpen ? 1 : 0, open: supportOpen, onClick: () => props.onTab(supportOpen ? "chat" : "support") }}
        onHeart={props.onHeart}
        reactions={props.reactions}
        panel={!phone}
      />
    </>
  );

  const sheets = (
    <>
      {supportOpen ? <LiveSupportSheet thread={thread} teamName={teamName} onClose={() => props.onTab("chat")} /> : null}
      {offerOpen && shown ? (
        <LiveOfferSheet
          countdown={offer?.countdown ?? null}
          onClose={() => setOfferOpen(false)}
          onSupport={() => {
            setOfferOpen(false);
            props.onTab("support");
          }}
        >
          <OfferCard
            productName={shown.product}
            imageUrl={shown.id === "main" ? props.offerImageUrl : undefined}
            priceFrom={shown.priceFrom}
            priceNow={shown.priceNow}
            buttonText={shown.button || "Quero minha vaga"}
            onBuy={props.onBuy}
            countdownSeconds={countdownLeft}
            showCountdown={shown.countdown > 0}
            closed={shown.id === "main" && props.offerClosed}
            group={isGroupLink(shown.url)}
            compact
          />
        </LiveOfferSheet>
      ) : null}
      {followSheet}
    </>
  );

  // No telemóvel ao alto, o vídeo ao alto cobre o ecrã e o deitado fica inteiro no terço de cima,
  // longe do chat. No computador (e no telemóvel deitado) fica inteiro. À volta, sempre preto.
  const videoBox = !horizontal
    ? portrait
      ? LIVE_COVER
      : LIVE_CONTAIN
    : portrait
      ? "absolute inset-x-0 top-[30%] aspect-video w-full -translate-y-1/2"
      : "absolute left-1/2 top-1/2 aspect-video w-[min(100cqw,177.78cqh)] -translate-x-1/2 -translate-y-1/2";
  const video = (
    <>
      {props.video.url ? (
        <div className={videoBox}>
          <PreviewPlayer url={props.video.url} provider={props.video.provider} t={props.t} playing={props.playing} volume={props.volume} />
        </div>
      ) : (
        <div className="absolute inset-0 grid content-center gap-2 bg-[radial-gradient(120%_90%_at_85%_10%,rgba(232,68,12,.25),transparent_55%),linear-gradient(160deg,#22262e,#111316)] px-[10%] text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#F28E63]">Sem vídeo</p>
          <p className="text-[22px] font-extrabold leading-[1.1] tracking-tight">Escolha o vídeo na etapa Vídeo</p>
        </div>
      )}
      <button type="button" onClick={props.onTogglePlay} aria-label={props.playing ? "Pausar" : "Tocar"} className="absolute inset-0">
        {!props.playing && props.video.url ? (
          <span
            className={cn(
              "absolute left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 backdrop-blur",
              portrait && horizontal ? "top-[30%]" : "top-1/2",
            )}
          >
            <Play className="size-6 fill-white text-white" />
          </span>
        ) : null}
      </button>
      {props.captionsOn ? (
        <div className={cn("pointer-events-none absolute inset-x-0 top-0", phone ? "h-[55%]" : "h-full")}>
          <CaptionLine text={said} compact />
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[120px] bg-[linear-gradient(180deg,rgba(0,0,0,.24),rgba(0,0,0,.07)_55%,transparent)]" />
      {/* O escurecido de baixo só quando o chat está por cima do vídeo. */}
      {phone ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%]" style={{ background: LIVE_SCRIM }} /> : null}
    </>
  );
  const settings = (
    <VideoSettings
      compact
      volume={props.volume}
      onVolume={props.onVolume}
      captions={props.captionsOn}
      onCaptions={props.onCaptions}
      hasCaptions={props.speech.length > 0}
      appearance={props.appearance}
      onAppearance={props.onAppearance}
    />
  );
  const saleToast = lastSale ? (
    <div
      className={cn(
        "absolute left-3 z-20 flex items-center gap-2 rounded-[14px] py-1.5 pl-1.5 pr-2.5 text-white shadow-[0_12px_30px_rgba(0,0,0,.4)]",
        portrait ? "top-[104px]" : "top-[56px]",
      )}
      style={{ background: saleColor(props.saleColor).solid }}
    >
      <span className="grid size-[26px] place-items-center rounded-full bg-white/25">
        <ShoppingCart className="size-3" />
      </span>
      <span>
        <b className="block text-xs font-bold">
          {lastSale.buyer} comprou {lastSale.product}
        </b>
        <small className="text-[10.5px] text-white/80">agora mesmo</small>
      </span>
    </div>
  ) : null;
  const ended = afterVideo ? (
    <div className="absolute inset-0 z-[5] grid place-items-center bg-black/90 px-6 text-center text-white">
      <div className="grid justify-items-center gap-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F28E63]">A aula terminou</p>
        <p className="text-[19px] font-extrabold leading-tight">As inscrições continuam abertas</p>
        <p className="text-[11.5px] text-white/75">Mais {Math.round(((open?.end ?? props.duration) - props.duration) / 60)} min. A oferta está aqui em baixo.</p>
      </div>
    </div>
  ) : null;
  const style = { fontFamily: ROOM_FONT, ...liveOfferVars(live.offerColor) };
  const light = props.theme === "light" && "room-light";

  if (phone) {
    return (
      <div className={cn("room-ambient text-white", light, landscape ? "h-[393px] w-[852px]" : "h-[852px] w-[393px]")} style={style}>
        <RoomPartsStyle />
        <LiveStyle />
        <div className="relative size-full overflow-hidden bg-black [container-type:size]">
          {video}
          <div className={cn("absolute inset-x-3 z-20", portrait ? "top-[54px]" : "top-3")}>
            <LiveTopBar
              host={host}
              follow={follow}
              onHost={openFollow}
              status={{ label: "Ao vivo", tone: "live" }}
              viewers={props.viewers}
              extra={settings}
            />
          </div>
          {saleToast}
          {ended}
          {/* Em baixo, acima da barra do iPhone: a caixa de escrever fica com folga, como numa app. */}
          <div className={cn("absolute z-20 flex flex-col", portrait ? "inset-x-3 bottom-[38px]" : "bottom-3 left-3.5 w-[400px]")}>{lower}</div>
          {sheets}
        </div>
      </div>
    );
  }

  // Computador: ecrã inteiro, o vídeo à esquerda e o painel de cima a baixo à direita, no tema da sala.
  return (
    <div className={cn("room-ambient flex h-[720px] w-[1280px] overflow-hidden bg-black text-room-text", light)} style={style}>
      <RoomPartsStyle />
      <LiveStyle />
      <section className="relative min-w-0 flex-1 overflow-hidden bg-black text-white [container-type:size]">
        {video}
        <div className={cn("absolute left-5 top-5 z-20 flex items-center gap-[5px]", hl("viewers"))}>
          <LiveBadge />
          {props.viewers !== null ? <LiveViewers count={props.viewers} /> : null}
        </div>
        <div className="absolute bottom-4 right-4 z-20">{settings}</div>
        {saleToast}
        {ended}
      </section>
      <aside className="relative flex h-full w-[400px] shrink-0 flex-col border-l border-room-line bg-room-surface">
        <div className={hl("title")}>
          <LivePanelHead title={props.title} host={host} follow={follow} onHost={openFollow} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">{lower}</div>
        {sheets}
      </aside>
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
  sheet,
  notice,
  ...props
}: RoomPreviewProps & {
  phone: boolean;
  tab: RoomTab;
  shown: OfferSlot | null;
  open: OfferSlot | null;
  hl: (k: string) => string;
  afterVideo: boolean;
  /** Dentro da folha do Live (telemóvel): sem o separador Chat. */
  sheet?: boolean | undefined;
  /** O aviso «já respondemos» no chat (exemplo do editor, com o Agente ligado). */
  notice?: boolean | undefined;
}) {
  const [text, setText] = useState("");
  const tabs: [RoomTab, string, typeof MessagesSquare][] = [
    // No Live do telemóvel o chat já está por cima do vídeo: a folha só tem o Suporte e a Oferta.
    ...(sheet ? [] : ([["chat", "Chat", MessagesSquare]] as [RoomTab, string, typeof MessagesSquare][])),
    ["support", "Suporte", Headset],
    ...(shown ? ([["offer", "Oferta", ShoppingCart]] as [RoomTab, string, typeof MessagesSquare][]) : []),
  ];
  const chatItems = chatItemsAt(props, phone ? 6 : 9);
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
              chatItems.length === 0 && !notice ? (
                <p className="m-auto text-center text-sm text-room-subtle">As mensagens aparecem ao longo do vídeo.</p>
              ) : (
                [
                  ...chatItems.map((item) =>
                  item.kind === "sale" ? (
                    <SaleLine key={item.key} text={`${item.s.buyer} comprou ${item.s.product}`} color={props.saleColor} />
                  ) : item.kind === "mine" ? (
                    <ChatLine key={item.key} author="Você" text={item.m.text} badge="Só você vê" tone="mine" big={!phone} />
                  ) : (
                    <div key={item.key} className={cn(props.highlight === `comment:${item.c.id}` && "-mx-2 rounded-lg bg-primary/15 px-2 py-1")}>
                      <ChatLine author={item.c.author} text={item.c.message} tone={item.c.agent ? "agent" : "people"} big={!phone} />
                    </div>
                  ),
                  ),
                  notice ? <SupportNotice key="notice" big={!phone} onOpen={() => props.onTab("support")} /> : null,
                ]
              )
            ) : (
              <div className={cn("flex min-h-0 flex-1 flex-col", props.agent.on && hl("support"))}>
                <SupportMessages
                  thread={supportExample(props, shown ?? props.offers[0] ?? null)}
                  teamName={props.host.name ? `Equipa de ${props.host.name}` : "Equipa"}
                  empty="Escreva à equipa. A resposta aparece aqui, só para si."
                />
              </div>
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
