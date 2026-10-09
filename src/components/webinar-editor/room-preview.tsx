import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Headset, MessagesSquare, Pin, Play, ShoppingCart, X } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { PreliveCountdown } from "@/components/prelive-countdown";
import { chatEcho, placeOf, type ChatPerson } from "@/lib/chat-reactions";
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
  offerDeadlinePassed,
  offerTimer,
  profileHandle,
  type FollowNetwork,
  type LiveSettings,
  type OfferSlot,
} from "@/lib/room-logic";
import {
  FollowButton,
  LIVE_FEED_LINES,
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
import { LessonTimer } from "@/components/room/lesson-timer";
import { ROOM_FONT } from "@/components/room/entry-screen";
import { SCREENS, TABLET_WIDE } from "./preview";
import {
  CaptionLine,
  ChatComposer,
  ChatLine,
  ENTRY_DIM,
  EntryPlay,
  LIVE_COLUMN_BG,
  LIVE_CONTAIN,
  liveFrame,
  OfferCard,
  PulseDot,
  RoomPartsStyle,
  RoomTitle,
  SALE_TOAST_SPOT,
  SaleLine,
  SaleToast,
  SupportNotice,
  VideoSettings,
  type Appearance,
  type CaptionSize,
  type Reaction,
} from "@/components/room/room-parts";

/**
 * A sala ao vivo no segundo `t` do relógio do editor, ao tamanho real (computador 1280×720,
 * tablet 820×1180, telemóvel 393×852 ao alto ou 852×393 deitado). Usa o leitor e as peças da sala pública:
 * o que se vê aqui é o que as pessoas vêem.
 */

export type RoomTab = "chat" | "support" | "offer";
export type PreviewComment = { id: string; at: number; author: string; message: string; agent?: boolean };
export type PreviewSale = { id: string; at: number; buyer: string; product: string };
export type PreviewMine = { at: number; text: string; tab: "chat" | "support" };
export type PreviewDevice = "desktop" | "tablet" | "tablet-landscape" | "phone" | "phone-landscape";

/** O ecrã ao alto: telemóvel ou tablet (a sala é a mesma, com outro tamanho e outra barra de estado). */
function tallScreen(device: PreviewDevice) {
  return device === "tablet" ? SCREENS.tablet : SCREENS.phone;
}

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
  /** O último dia da oferta principal já passou. */
  offerClosed: boolean;
  /** «O botão fecha» no zero do cronómetro (senão, no zero só o cronómetro sai). */
  offerCloseAtZero?: boolean | undefined;
  /** O fuso do webinar: o último dia de cada oferta seguinte acaba à meia-noite dele, como na sala. */
  offerTimezone?: string | undefined;
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
  /** A forma do vídeo, lida do ficheiro: com o aparelho, decide onde o vídeo fica (regras fixas, como na sala). */
  videoShape?: LiveSettings["desk"] | null | undefined;
  /** Em pausa, mostra o botão de entrar da sala (no passo Vídeo, onde se escolhe); nos outros, só um play discreto. */
  entryShown?: boolean | undefined;
};

/**
 * A contagem antes de começar, na pré-visualização: o passo Vídeo mostra-a no lugar do vídeo enquanto
 * se escolhe o estilo, a cor e os minutos (`peekCountdown`), e esconde-a ao sair.
 */
let countdownPeek = false;
const peekListeners = new Set<() => void>();
export function peekCountdown(on: boolean) {
  if (countdownPeek === on) return;
  countdownPeek = on;
  peekListeners.forEach((listener) => listener());
}
export function useCountdownPeek() {
  return useSyncExternalStore(
    (listener) => {
      peekListeners.add(listener);
      return () => peekListeners.delete(listener);
    },
    () => countdownPeek,
    () => false,
  );
}

/** A contagem a descer na pré-visualização, a partir dos minutos escolhidos (sem som). */
function PeekCountdown({ live, fill }: { live: LiveSettings; fill?: boolean }) {
  const total = (live.countdown?.minutes ?? 5) * 60;
  const [left, setLeft] = useState(total - 8);
  useEffect(() => setLeft(total - 8), [total]);
  useEffect(() => {
    const timer = window.setInterval(() => setLeft((n) => (n > 1 ? n - 1 : total)), 1000);
    return () => window.clearInterval(timer);
  }, [total]);
  return (
    <div className={cn("absolute inset-0 z-[6] bg-black", !fill && "grid place-items-center")}>
      <PreliveCountdown
        remaining={left}
        total={total}
        message=""
        soundOn={false}
        soundEnabled={false}
        template={live.countdown?.style}
        color={live.countdown?.color}
        fill={fill}
      />
    </div>
  );
}

/** Na pré-visualização, o botão de entrar aparece no passo onde se escolhe ou no início do vídeo. */
const showsEntry = (props: RoomPreviewProps) => Boolean(props.entryShown) || props.t < 1;

/**
 * Em pausa: o botão de entrar só no passo onde se escolhe, ou no início do vídeo (é aí que as pessoas o
 * vêem); a meio da sessão, um play discreto, porque na sala esse botão nunca aparece a meio.
 */
function PausedPlay({ props, compact, big }: { props: RoomPreviewProps; compact: boolean; big?: boolean }) {
  const live = props.liveSettings ?? LIVE_DEFAULTS;
  if (showsEntry(props)) return <EntryPlay look={live.entry} kicker="Aula ao vivo" compact={compact} />;
  return (
    <span className={cn("grid place-items-center rounded-full bg-black/55 backdrop-blur", big ? "size-[76px]" : compact ? "size-12" : "size-14")}>
      <Play className={cn("fill-white text-white", big ? "size-8" : compact ? "size-5" : "size-6")} />
    </span>
  );
}

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
  // Como na sala: quem tocou numa rede e fechou deixa de ver o + Seguir, se a opção estiver ligada.
  const [followed, setFollowed] = useState(false);
  const follow =
    networks.length > 0 && !offerOpen && !(followed && live.hideFollowed) && followMomentAt(live.moments, props.t) ? { label, onClick: show } : null;
  const host = { name: props.host.name, avatarUrl: props.host.avatarUrl, verified: props.host.verified };
  const sheet = open ? (
    <LiveFollowSheet
      host={host}
      networks={networks}
      note={props.device === "desktop" ? "Cada rede abre numa janela pequena ao lado. A aula continua aqui." : "Cada rede abre diretamente na app. A aula continua aqui."}
      onClose={() => {
        if (networks.some((n) => n.done)) setFollowed(true);
        setOpen(false);
      }}
      onTap={(id) => setTapped((prev) => ({ ...prev, [id]: true }))}
    />
  ) : null;
  return { follow, onHost: networks.length ? show : undefined, sheet, host };
}

/** O que a sala mostra no segundo t: a oferta aberta, a compra a aparecer e a frase dita. */
function roomMoment(props: RoomPreviewProps) {
  const open = activeOffer(props.offers, props.t);
  // O vídeo acabou: o fim da transmissão. Se a oferta fecha depois, a sala fica aberta para compras.
  const videoEnded = props.duration > 0 && props.t >= props.duration - 0.5;
  const afterVideo = videoEnded && open !== null && (open.end ?? 0) > props.duration;
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
  return { open, afterVideo, videoEnded, shown, tab, lastSale, said };
}

/** O fim da transmissão, como na sala pública: o vídeo acabou e a oferta não fica aberta depois. */
function EndedNote({ compact, offer }: { compact: boolean; offer: string | null }) {
  return (
    <div className="absolute inset-0 z-[5] grid place-items-center bg-black/90 px-6 text-center text-white">
      <div className={cn("grid justify-items-center", compact ? "gap-1.5" : "gap-3")}>
        <p className={cn("font-bold uppercase tracking-[0.18em] text-[#F28E63]", compact ? "text-[10px]" : "text-[13px]")}>Transmissão terminou</p>
        <p className={cn("font-extrabold leading-tight", compact ? "text-[17px]" : "text-[34px]")}>Obrigado por ter estado connosco</p>
        <p className={cn("text-white/75", compact ? "text-[11px]" : "text-[16px]")}>A sessão ao vivo chegou ao fim. {offer ?? "Volte para a próxima sessão."}</p>
      </div>
    </div>
  );
}

/**
 * A oferta mostrada no segundo t, como na sala (`offerTimer`): o tempo que falta, se o cronómetro ainda
 * se vê e se o botão já fechou, no zero ou no último dia (o da principal ou o de cada oferta seguinte).
 */
type OfferProps = Pick<RoomPreviewProps, "t" | "offerClosed" | "offerCloseAtZero" | "offerTimezone" | "offerImageUrl" | "liveSettings">;
function offerNow(props: OfferProps, shown: OfferSlot | null) {
  if (!shown) return { seconds: 0, left: null, closed: false };
  const seconds = offerCountdownLeft(shown.countdown, shown.start, props.t);
  const zone = props.offerTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const deadline = shown.id === "main" ? props.offerClosed : offerDeadlinePassed(shown.deadline, zone, Date.now());
  return { seconds, ...offerTimer(shown.countdown, seconds, Boolean(props.offerCloseAtZero), deadline) };
}

/** O cartão da oferta (Live, e Webinar no telemóvel ao alto), na forma escolhida. */
function cardOffer(props: OfferProps, shown: OfferSlot | null): LiveOffer | null {
  if (!shown) return null;
  const now = offerNow(props, shown);
  return {
    product: shown.product,
    priceFrom: shown.priceFrom,
    priceNow: shown.priceNow,
    button: shown.button || "Quero minha vaga",
    countdown: now.left,
    closed: now.closed,
    image: shown.id === "main" ? props.offerImageUrl : null,
    look: (props.liveSettings ?? LIVE_DEFAULTS).offerLook,
    colors: props.liveSettings?.offerColors,
    group: isGroupLink(shown.url),
  };
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

/**
 * As últimas mensagens do chat no segundo t: comentários, compras e o que se escreveu. Ao que se escreve,
 * o chat simulado reage e às vezes responde, como na sala (`chatEcho`).
 */
function chatItemsAt(props: Pick<RoomPreviewProps, "comments" | "sales" | "salesWhere" | "mine" | "t">, limit: number) {
  const crowd: ChatPerson[] = [...new Set(props.comments.filter((c) => !c.agent).map((c) => c.author))].map((name) => ({
    name,
    place: props.comments.map((c) => (c.author === name ? placeOf(c.message) : "")).find(Boolean) ?? "",
  }));
  const mine = props.mine
    .map((m, i) => ({ m, i, echo: chatEcho({ id: `previa-${i}-${m.at}`, text: m.text, author: "" }, crowd) }))
    .filter(({ m }) => m.tab === "chat" && m.at <= props.t + 1);
  return [
    ...props.comments.filter((c) => c.at <= props.t).map((c) => ({ key: c.id, at: c.at, kind: "msg" as const, c })),
    ...(props.salesWhere === "video" ? [] : props.sales)
      .filter((s) => s.at <= props.t)
      .map((s) => ({ key: `s-${s.id}`, at: s.at, kind: "sale" as const, s })),
    ...mine.map(({ m, i, echo }) => ({
      key: `m-${i}`,
      at: m.at,
      kind: "mine" as const,
      m,
      reaction: echo.reaction && props.t >= m.at + echo.reaction.after ? `${echo.reaction.emoji} ${echo.reaction.count}` : undefined,
    })),
    ...mine.flatMap(({ m, i, echo }) =>
      echo.replies
        .filter((r) => props.t >= m.at + r.after)
        .map((r, j) => ({ key: `m-${i}-r${j}`, at: m.at + r.after, kind: "msg" as const, c: { id: `m-${i}-r${j}`, at: m.at + r.after, author: r.author, message: r.text, agent: false } })),
    ),
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
  const phone = props.device === "phone" || props.device === "phone-landscape";
  const landscape = props.device === "phone-landscape";
  // O tablet usa as peças do computador (letra e botões do tamanho certo): ao alto, uma por baixo da
  // outra; deitado, o vídeo e o chat lado a lado.
  const tablet = props.device === "tablet";
  const tabletWide = props.device === "tablet-landscape";
  const hl = (key: string) =>
    props.highlight === key ? "outline outline-2 outline-offset-4 outline-[#E8440C] shadow-[0_0_0_10px_rgba(232,68,12,.25)]" : "";
  const { open, afterVideo, videoEnded, shown, tab, lastSale, said } = roomMoment(props);
  const live = props.liveSettings ?? LIVE_DEFAULTS;
  const peek = useCountdownPeek() && Boolean(live.countdown?.on);
  const social = useFollow(props, Boolean(open));
  // Deitado, o chat recolhido: abre com a oferta ou quando o editor mostra outro separador.
  const [side, setSide] = useState(false);
  useEffect(() => {
    if (props.tab !== "chat" || shown) setSide(true);
  }, [props.tab, shown?.id]);
  const followButton = (big: boolean) => (social.follow ? <FollowButton big={big} label={social.follow.label} onClick={social.follow.onClick} /> : null);
  const [captionSize, setCaptionSize] = useState<CaptionSize>("md");
  // Como na sala: o aviso de compra no canto de baixo do vídeo (`SALE_TOAST_SPOT`); a legenda sobe por cima dele.
  const saleToast = lastSale ? (
    <SaleToast
      key={lastSale.id}
      name={lastSale.buyer}
      text={`comprou ${lastSale.product}`}
      color={props.saleColor}
      compact={phone}
      className={phone ? SALE_TOAST_SPOT.phone : SALE_TOAST_SPOT.desk}
    />
  ) : null;

  const videoCard = (
    <div
      className={cn(
        "relative overflow-hidden bg-black",
        "aspect-video w-full",
        !phone && "room-panel rounded-2xl ring-1 ring-room-line",
      )}
    >
      {props.video.url ? (
        <PreviewPlayer
          url={props.video.url}
          provider={props.video.provider}
          t={props.t}
          playing={props.playing}
          volume={props.volume}
          ambient={showsEntry(props)}
        />
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
        {/* Como na sala: no fim, «Terminou» a cinzento e sem o número. */}
        <LiveBadge {...(videoEnded ? { label: "Terminou", tone: "muted" as const } : {})} />
        {props.viewers !== null && !videoEnded ? (
          <span className={hl("viewers")}>
            <LiveViewers count={props.viewers} />
          </span>
        ) : null}
      </div>
      {saleToast}
      {props.captionsOn ? <CaptionLine text={said} compact={phone} size={captionSize} raised={Boolean(lastSale)} /> : null}
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
      ) : videoEnded ? (
        <EndedNote compact={phone} offer={open && !props.offerClosed ? "A oferta continua disponível no separador Oferta." : null} />
      ) : null}
      <button
        type="button"
        onClick={props.onTogglePlay}
        aria-label={props.playing ? "Pausar" : "Tocar"}
        className="absolute inset-0"
      >
        {!props.playing && props.video.url ? (
          <span className={cn("absolute inset-0 grid place-items-center", showsEntry(props) && ENTRY_DIM)}>
            <PausedPlay props={props} compact={phone} big={!phone} />
          </span>
        ) : null}
      </button>
      {/* O temporizador da aula (também em pausa, para se ver ao escolher). */}
      {props.video.url && !videoEnded ? (
        <LessonTimer
          timer={live.timer}
          seconds={props.t}
          compact={phone}
          bar="absolute inset-x-0 bottom-0"
          chip={cn("absolute", phone ? "right-2.5 top-2.5" : "right-[18px] top-[18px]")}
        />
      ) : null}
      {peek ? <PeekCountdown live={live} /> : null}
      <div className={cn("absolute", phone ? "bottom-2 right-2" : "bottom-3 right-3")}>
        <VideoSettings
          compact={phone}
          volume={props.volume}
          onVolume={props.onVolume}
          captions={props.captionsOn}
          onCaptions={props.onCaptions}
          captionSize={captionSize}
          onCaptionSize={setCaptionSize}
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
      ? "flex h-[393px] w-[852px] bg-black"
      : phone
        ? "flex flex-col"
        : tablet
          ? "flex flex-col gap-1 px-6 pb-6"
          : tabletWide
            ? "grid grid-cols-[minmax(0,1fr)_360px] gap-6 px-6 pb-6"
            : "grid h-[720px] w-[1280px] grid-cols-[minmax(0,1fr)_380px] gap-6 p-6",
  );
  const tall = tallScreen(props.device);

  const style = {
    fontFamily: ROOM_FONT,
    ...liveOfferVars(live.offerColor),
    ...(phone && !landscape ? { width: tall.w, height: tall.h } : null),
    ...(tablet ? { width: tall.w, height: tall.h, paddingTop: tall.top + 20 } : null),
    ...(tabletWide ? { width: TABLET_WIDE.w, height: TABLET_WIDE.h, paddingTop: TABLET_WIDE.top + 16 } : null),
  };
  if (landscape) {
    // Deitado, como na sala: o vídeo inteiro com a altura toda; o chat não o aperta, fica num botão
    // e abre por cima, à direita (abre sozinho com a oferta ou noutro separador).
    return (
      <div className={cn(roomClass, "relative")} style={style}>
        <RoomPartsStyle />
        <LiveStyle />
        <div className="grid min-w-0 flex-1 place-items-center bg-black px-11 [container-type:size]">
          <div className="w-[min(100cqw,177.78cqh)]">{videoCard}</div>
        </div>
        {side ? (
          <div className="absolute inset-y-0 right-0 z-10 flex w-[340px] flex-col border-l border-room-line bg-room-surface shadow-[-24px_0_48px_-12px_rgb(0_0_0/0.5)]">
            <Panel {...props} tab={tab} shown={shown} open={open} hl={hl} phone={phone} afterVideo={afterVideo} notice={live.notify && props.agent.on} onClose={() => setSide(false)} />
            {social.sheet}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSide(true)}
            aria-label={shown ? "Abrir o chat e a oferta" : "Abrir o chat"}
            className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/15"
          >
            {shown ? <ShoppingCart className="size-5" /> : <MessagesSquare className="size-5" />}
            {shown ? (
              <span className="absolute right-1 top-1 flex">
                <PulseDot />
              </span>
            ) : null}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={roomClass} style={style}>
      <RoomPartsStyle />
      <LiveStyle />
      {/* A zona da câmara no tema da sala; o título e quem apresenta só se estiverem ligados (Vídeo). */}
      {phone ? (
        <>
          <div className="shrink-0 bg-room-bg" style={{ height: tall.top }} />
          {videoCard}
          {live.header !== false ? (
            <RoomTitle compact kicker="" title={props.title} host={props.host} highlight={props.highlight} follow={followButton(false)} onHost={social.onHost} />
          ) : null}
        </>
      ) : (
        <div className="min-w-0">
          {videoCard}
          {live.header !== false ? (
            <div className="px-1">
              <RoomTitle kicker={videoEnded ? "Sessão terminada" : "Sessão ao vivo"} title={props.title} host={props.host} highlight={props.highlight} follow={followButton(true)} onHost={social.onHost} />
            </div>
          ) : null}
        </div>
      )}
      <div className={cn("relative flex min-h-0 flex-col", phone ? "flex-1" : tablet ? "mt-4 flex-1 overflow-hidden rounded-2xl" : "overflow-hidden rounded-2xl")}>
        {/* No tema claro, o painel e o vídeo ganham uma borda que se vê (como no YouTube): `room-panel`. */}
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
  // O tablet ao alto é como o telemóvel (chat por cima do vídeo); deitado, como o computador.
  const phone = props.device === "phone" || props.device === "phone-landscape" || props.device === "tablet";
  const landscape = props.device === "phone-landscape";
  const portrait = phone && !landscape;
  const tablet = props.device === "tablet";
  const tall = tallScreen(props.device);
  // No tablet ao alto, o topo encosta às margens e o chat fica numa coluna à esquerda, à escala de um
  // telemóvel; a linha de escrever vai de margem a margem (o coração no canto de baixo à direita).
  const column = tablet ? "inset-x-5" : "inset-x-3";
  // Como na sala: o vídeo deitado num ecrã ao alto empilha-se (vídeo em cima, chat e caixa de escrever
  // por baixo, no tema da sala); o vídeo ao alto continua a encher o ecrã.
  const stack = portrait && props.videoShape !== "vertical";
  const themed = !phone || stack;
  const [captionSize, setCaptionSize] = useState<CaptionSize>("md");
  const hl = (key: string) =>
    props.highlight === key ? "outline outline-2 outline-offset-4 outline-[#E8440C] shadow-[0_0_0_10px_rgba(232,68,12,.25)]" : "";
  const { open, afterVideo, videoEnded, shown, lastSale, said } = roomMoment(props);
  const peek = useCountdownPeek() && Boolean(live.countdown?.on);
  const supportOpen = props.tab === "support";
  const { follow, onHost: openFollow, sheet: followSheet, host } = useFollow(props, Boolean(open));
  useEffect(() => {
    setOfferMin(false);
    setOfferOpen(false);
  }, [shown?.id]);

  const offer = cardOffer(props, shown);
  const cardOpen = Boolean(offer) && !offerMin && !offerOpen;

  const teamName = props.host.name ? `Equipa de ${props.host.name}` : "Equipa";

  // Empilhado, o chat enche o espaço por baixo do vídeo: mais mensagens.
  const feed: LiveFeedItem[] = chatItemsAt(props, stack ? 20 : 12).map((item) =>
    item.kind === "sale"
      ? { key: item.key, kind: "sale", text: `${item.s.buyer} comprou ${item.s.product}`, color: props.saleColor }
      : item.kind === "mine"
        ? { key: item.key, kind: "mine", text: item.m.text, reaction: item.reaction }
        : { key: item.key, kind: "msg", author: item.c.author, text: item.c.message },
  );
  // O aviso «já respondemos», como exemplo, quando está ligado e o Agente responde.
  if (live.notify && props.agent.on && !supportOpen) feed.push({ key: "notice", kind: "notice" });
  const thread = supportExample(props, shown);

  // Como na sala: no canto de baixo do vídeo, dentro da moldura (`SALE_TOAST_SPOT`); com o vídeo ao alto a encher o
  // ecrã (o chat tapa-lhe o fundo), logo acima das mensagens; com as compras também no chat, a linha do chat já é o aviso.
  const toastOverChat = portrait && !stack;
  const saleToast = lastSale && !(toastOverChat && props.salesWhere !== "video") ? (
    <SaleToast
      key={lastSale.id}
      name={lastSale.buyer}
      text={`comprou ${lastSale.product}`}
      color={props.saleColor}
      compact={!tablet && phone}
      className={toastOverChat ? SALE_TOAST_SPOT.feed : !tablet && phone ? SALE_TOAST_SPOT.phone : SALE_TOAST_SPOT.desk}
    />
  ) : null;

  const lower = (
    <>
      <div className={cn("contents", tablet && "flex w-[460px] flex-col", tablet && stack && "min-h-0 flex-1")}>
        {toastOverChat ? saleToast : null}
        <LiveFeed
          items={feed}
          onNotice={() => props.onTab("support")}
          panel={themed}
          className={!phone ? "min-h-0 flex-1 pr-0" : landscape || stack ? "min-h-0 flex-1" : LIVE_FEED_LINES}
        />
        {offer && cardOpen ? (
          <div className={hl("pitch")}>
            <LiveOfferCard offer={offer} onBuy={() => props.onBuy?.()} onMinimize={() => setOfferMin(true)} onExpand={() => setOfferOpen(true)} panel={themed} />
          </div>
        ) : null}
        {offer && !cardOpen && !offerOpen ? <LiveOfferSlim offer={offer} onOpen={() => setOfferOpen(true)} /> : null}
      </div>
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
        panel={themed}
      />
    </>
  );

  const sheets = (
    <>
      {supportOpen ? <LiveSupportSheet thread={thread} teamName={teamName} onClose={() => props.onTab("chat")} /> : null}
      {offerOpen && shown ? (
        <LiveOfferSheet
          countdown={offer?.countdown ?? null}
          closed={offer?.closed}
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
            countdownSeconds={0}
            showCountdown={false}
            closed={offer?.closed}
            group={isGroupLink(shown.url)}
            compact
            look="compact"
            colors={props.liveSettings?.offerColors}
            stickyBuy
          />
        </LiveOfferSheet>
      ) : null}
      {followSheet}
    </>
  );

  // A forma do vídeo e o aparelho, com regras fixas, sem cortar nem esticar; igual à sala (`liveFrame`).
  // Com o telemóvel deitado, o vídeo fica inteiro e ao centro.
  const frame = liveFrame(props.videoShape, phone ? "phone" : "desk");
  const videoBox = stack
    ? "absolute inset-0"
    : landscape
      ? frame.place === "fill"
        ? LIVE_CONTAIN
        : "absolute left-1/2 top-1/2 aspect-video w-[min(100cqw,177.78cqh)] -translate-x-1/2 -translate-y-1/2"
      : frame.box;
  // A legenda fica no próprio vídeo; com o vídeo ao alto a encher o ecrã, sobe acima do chat.
  const inVideoCaption = !(frame.place === "fill" && !landscape);
  // No palco, uma moldura igual à do vídeo, por cima dos véus, só para o aviso de compra.
  const frameToast =
    saleToast && !toastOverChat ? <div className={cn(props.video.url ? videoBox : "absolute inset-0", "pointer-events-none z-20 shadow-none")}>{saleToast}</div> : null;
  const video = (
    <>
      {frame.place === "column" && props.video.url ? <div className={LIVE_COLUMN_BG} /> : null}
      {props.video.url ? (
        <div className={videoBox}>
          <PreviewPlayer
            url={props.video.url}
            provider={props.video.provider}
            t={props.t}
            playing={props.playing}
            volume={props.volume}
            fit={frame.fit}
            ambient={showsEntry(props)}
          />
          {props.captionsOn && inVideoCaption ? <CaptionLine text={said} compact={phone} size={captionSize} raised={Boolean(lastSale)} /> : null}
          {!props.playing ? (
            <span className={cn("absolute inset-0 grid place-items-center", showsEntry(props) && ENTRY_DIM)}>
              <PausedPlay props={props} compact={phone && !tablet} />
            </span>
          ) : null}
        </div>
      ) : (
        <div className="absolute inset-0 grid content-center gap-2 bg-[radial-gradient(120%_90%_at_85%_10%,rgba(232,68,12,.25),transparent_55%),linear-gradient(160deg,#22262e,#111316)] px-[10%] text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#F28E63]">Sem vídeo</p>
          <p className="text-[22px] font-extrabold leading-[1.1] tracking-tight">Escolha o vídeo na etapa Vídeo</p>
        </div>
      )}
      <button type="button" onClick={props.onTogglePlay} aria-label={props.playing ? "Pausar" : "Tocar"} className="absolute inset-0" />
      {peek ? <PeekCountdown live={live} fill={!stack} /> : null}
      {props.captionsOn && !inVideoCaption ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[55%]">
          <CaptionLine text={said} compact size={captionSize} />
        </div>
      ) : null}
      {stack ? (
        // Empilhado: só um véu leve em cima do vídeo, para o nome se ler (sem faixa nem borda).
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(0,0,0,.22),transparent)]" />
      ) : (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[120px] bg-[linear-gradient(180deg,rgba(0,0,0,.24),rgba(0,0,0,.07)_55%,transparent)]" />
      )}
      {/* O escurecido de baixo só quando o chat está por cima do vídeo. */}
      {phone && !stack ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%]" style={{ background: LIVE_SCRIM }} /> : null}
      {/* Deitado, o chat fica à direita: uma sombra por trás dele, para se ler sobre qualquer vídeo. */}
      {landscape ? <div className="pointer-events-none absolute inset-y-0 right-0 w-[48%] bg-[linear-gradient(270deg,rgba(0,0,0,.62),rgba(0,0,0,.3)_60%,transparent)]" /> : null}
    </>
  );
  const settings = (
    <VideoSettings
      inline
      compact={phone}
      volume={props.volume}
      onVolume={props.onVolume}
      captions={props.captionsOn}
      onCaptions={props.onCaptions}
      captionSize={captionSize}
      onCaptionSize={setCaptionSize}
      hasCaptions={props.speech.length > 0}
      appearance={props.appearance}
      onAppearance={props.onAppearance}
    />
  );
  // O temporizador da aula, nos mesmos sítios que na sala.
  const lessonTimer = (spots: { bar?: string; chip?: string }) =>
    props.video.url && !videoEnded ? <LessonTimer timer={live.timer} seconds={props.t} compact={phone && !tablet} {...spots} /> : null;
  // Como na sala: no fim, «Terminou» a cinzento e sem o número de pessoas.
  const badge = videoEnded ? { label: "Terminou", tone: "muted" as const } : { label: "Ao vivo", tone: "live" as const };
  const corners = (
    <>
      <div className={cn("absolute z-20 flex items-center gap-[5px]", props.video.url ? "left-3 top-3" : "left-5 top-5", hl("viewers"))}>
        <LiveBadge label={badge.label} tone={badge.tone} />
        {props.viewers !== null && !videoEnded ? <LiveViewers count={props.viewers} /> : null}
      </div>
      <div className={cn("pointer-events-auto absolute z-30", props.video.url ? "right-3 top-3" : "right-5 top-5")}>{settings}</div>
      {lessonTimer({ bar: "absolute inset-x-0 bottom-0 z-20", chip: "absolute right-3 top-14 z-20" })}
    </>
  );
  const ended = afterVideo ? (
    <div className="absolute inset-0 z-[5] grid place-items-center bg-black/90 px-6 text-center text-white">
      <div className="grid justify-items-center gap-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F28E63]">A aula terminou</p>
        <p className="text-[19px] font-extrabold leading-tight">As inscrições continuam abertas</p>
        <p className="text-[11.5px] text-white/75">Mais {Math.round(((open?.end ?? props.duration) - props.duration) / 60)} min. A oferta está aqui em baixo.</p>
      </div>
    </div>
  ) : videoEnded ? (
    <EndedNote compact offer={open && !props.offerClosed ? "A oferta continua disponível aqui em baixo." : null} />
  ) : null;
  // `--live-top`: o vídeo deitado encosta logo abaixo da barra de estado do aparelho.
  const style = { fontFamily: ROOM_FONT, ...liveOfferVars(live.offerColor), "--live-top": `${portrait ? tall.top : 0}px` } as CSSProperties;
  const light = props.theme === "light" && "room-light";

  if (stack) {
    // Como na sala (`liveStack`): a zona da câmara no tema; o vídeo a toda a largura, sem borda, com a barra do
    // Live por dentro; por baixo, o chat (cinco linhas) e a caixa de escrever no fundo, no tema da sala.
    return (
      <div className={cn("room-ambient relative flex flex-col overflow-hidden text-room-text", light)} style={{ ...style, width: tall.w, height: tall.h }}>
        <RoomPartsStyle />
        <LiveStyle />
        <div className="shrink-0 bg-room-bg" style={{ height: tall.top }} />
        <div className="relative shrink-0">
          <div className="prelive-dark relative aspect-video w-full overflow-hidden bg-black text-white">
            {video}
            {lessonTimer({ bar: "absolute inset-x-0 bottom-0 z-20" })}
            {frameToast}
            {ended}
          </div>
          <div className={cn("absolute z-40", tablet ? "inset-x-5 top-4" : "inset-x-3 top-2")}>
            {lessonTimer({ chip: "absolute right-0 top-full mt-2" })}
            <LiveTopBar host={host} follow={follow} onHost={openFollow} status={badge} viewers={videoEnded ? null : props.viewers} extra={settings} />
          </div>
        </div>
        <div className={cn("flex min-h-0 flex-1 flex-col justify-end pt-3", tablet ? "px-5 pb-5" : "px-3.5 pb-8")}>{lower}</div>
        {sheets}
      </div>
    );
  }

  if (phone) {
    return (
      <div className={cn("room-ambient text-white", light, landscape && "h-[393px] w-[852px]")} style={portrait ? { ...style, width: tall.w, height: tall.h } : style}>
        <RoomPartsStyle />
        <LiveStyle />
        <div className="relative size-full overflow-hidden bg-black [container-type:size]">
          {video}
          <div className={cn("absolute z-30", portrait ? (tablet ? "inset-x-5" : "inset-x-3") : "inset-x-3 top-3")} style={portrait ? { top: tall.top + (tablet ? 16 : 10) } : undefined}>
            {lessonTimer({ chip: "absolute right-0 top-full mt-2", bar: "absolute inset-x-0 -top-1.5 rounded-full" })}
            <LiveTopBar
              host={host}
              follow={follow}
              onHost={openFollow}
              status={badge}
              viewers={videoEnded ? null : props.viewers}
              extra={settings}
            />
          </div>
          {frameToast}
          {ended}
          {/* Em baixo, logo acima da barra do iPhone: a caixa de escrever desce o mais possível sem lhe tocar. */}
          <div
            className={cn("absolute z-20 flex flex-col", portrait ? column : "bottom-3 right-3.5 top-16 w-[340px] justify-end")}
            style={portrait ? { bottom: tablet ? 20 : 32 } : undefined}
          >
            {lower}
          </div>
          {sheets}
        </div>
      </div>
    );
  }

  // Computador (e tablet deitado): ecrã inteiro, o vídeo à esquerda e o painel de cima a baixo à direita, no tema da sala.
  const wideTablet = props.device === "tablet-landscape";
  return (
    <div
      className={cn("room-ambient flex overflow-hidden bg-black text-room-text", light)}
      style={{ ...style, ...(wideTablet ? { width: TABLET_WIDE.w, height: TABLET_WIDE.h, paddingTop: TABLET_WIDE.top } : { width: 1280, height: 720 }) }}
    >
      <RoomPartsStyle />
      <LiveStyle />
      <section className="relative min-w-0 flex-1 overflow-hidden bg-black text-white [container-type:size]">
        {video}
        {/* Como na sala: o selo e o ⚙ dentro do vídeo, no canto de cima (numa moldura igual à do vídeo). */}
        {props.video.url ? <div className={cn(frame.box, "pointer-events-none z-30 shadow-none")}>{corners}</div> : corners}
        {frameToast}
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
  onClose,
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
  /** Deitado, o chat por cima do vídeo fecha-se no X. */
  onClose?: (() => void) | undefined;
}) {
  const [text, setText] = useState("");
  const tabs: [RoomTab, string, typeof MessagesSquare][] = [
    // No Live do telemóvel o chat já está por cima do vídeo: a folha só tem o Suporte e a Oferta.
    ...(sheet ? [] : ([["chat", "Chat", MessagesSquare]] as [RoomTab, string, typeof MessagesSquare][])),
    ["support", "Suporte", Headset],
    ...(shown ? ([["offer", "Oferta", ShoppingCart]] as [RoomTab, string, typeof MessagesSquare][]) : []),
  ];
  const chatItems = chatItemsAt(props, phone ? 6 : 9);
  const now = offerNow(props, shown);
  // No telemóvel ao alto, a oferta sobe por cima do chat como na sala; reduzida, fica uma barra.
  const [offerMin, setOfferMin] = useState(false);
  useEffect(() => setOfferMin(false), [shown?.id]);
  const card = props.device === "phone" && !sheet && tab === "chat" ? cardOffer(props, shown) : null;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-room-surface",
        phone ? "flex-1 pb-[22px]" : "room-panel flex-1 rounded-2xl ring-1 ring-inset ring-room-line",
        // No telemóvel ao alto o chat fica no fundo da página, da cor das barras do navegador (como na sala).
        props.device === "phone" && "bg-room-bg",
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
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Fechar o chat" className="grid w-9 shrink-0 place-items-center text-room-subtle hover:text-room-text">
            <X className="size-5" />
          </button>
        ) : null}
      </div>

      {tab === "offer" && shown ? (
        <div className={cn("min-h-0 flex-1 overflow-y-auto", hl("pitch"))}>
          <OfferCard
            productName={shown.product}
            imageUrl={shown.id === "main" ? props.offerImageUrl : undefined}
            priceFrom={shown.priceFrom}
            priceNow={shown.priceNow}
            buttonText={shown.button || "Quero entrar"}
            onBuy={props.onBuy}
            countdownSeconds={now.seconds}
            showCountdown={now.left !== null}
            closed={now.closed}
            group={isGroupLink(shown.url)}
            look={(props.liveSettings ?? LIVE_DEFAULTS).offerLook}
            colors={props.liveSettings?.offerColors}
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
          {/* As mensagens mais antigas desvanecem em cima, em vez de ficarem cortadas a meio. */}
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-3.5 overflow-hidden p-4 [mask-image:linear-gradient(transparent,#000_28px)]">
            {tab === "chat" ? (
              chatItems.length === 0 && !notice ? (
                <p className="m-auto text-center text-sm text-room-subtle">As mensagens aparecem ao longo do vídeo.</p>
              ) : (
                [
                  ...chatItems.map((item) =>
                  item.kind === "sale" ? (
                    <SaleLine key={item.key} text={`${item.s.buyer} comprou ${item.s.product}`} color={props.saleColor} />
                  ) : item.kind === "mine" ? (
                    <ChatLine key={item.key} author="Você" text={item.m.text} badge="Só você vê" tone="mine" reaction={item.reaction} big={!phone} />
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
          {card ? (
            <div className={cn("shrink-0 px-3 pb-2.5", hl("pitch"))}>
              {offerMin ? (
                <LiveOfferSlim offer={card} onOpen={() => props.onTab("offer")} />
              ) : (
                <LiveOfferCard offer={card} onBuy={() => props.onBuy?.()} onMinimize={() => setOfferMin(true)} onExpand={() => props.onTab("offer")} panel />
              )}
            </div>
          ) : null}
          <ChatComposer
            compact={phone}
            value={text}
            onChange={setText}
            onSubmit={() => {
              props.onSend(text.trim(), tab === "support" ? "support" : "chat");
              setText("");
            }}
            placeholder={tab === "support" ? "Escreva à equipa…" : "Escreva no chat…"}
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
 * Os vídeos da pré-visualização abertos (o último é o que está à frente, ex.: o ecrã completo). O
 * iPhone só deixa tocar com som dentro do próprio toque, por isso o play do editor chama
 * `playPreviewWithSound` no clique, antes de o estado mudar.
 */
const previewMedia: HTMLVideoElement[] = [];
export function playPreviewWithSound(volume: number) {
  const video = previewMedia.at(-1);
  if (!video) return;
  video.muted = volume === 0;
  video.volume = volume;
  void video.play().catch(() => {});
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
  fit = "cover",
  ambient = false,
}: {
  url: string;
  provider: string | null;
  t: number;
  playing: boolean;
  volume: number;
  fit?: "cover" | "contain" | undefined;
  /** Em pausa com o botão de entrar à frente: o vídeo corre sem som por trás, «fusco», como na sala. */
  ambient?: boolean | undefined;
}) {
  const media = useRef<HTMLVideoElement>(null);
  const running = playing || ambient;
  const embed = /youtube|youtu\.be|vimeo|mediadelivery|pandavideo|\/embed\/|player\./i.test(url);
  useEffect(() => {
    const video = media.current;
    if (!video) return;
    previewMedia.push(video);
    return () => {
      const i = previewMedia.indexOf(video);
      if (i >= 0) previewMedia.splice(i, 1);
    };
  }, [url]);
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
    if (running) void video.play().catch(() => {});
    else video.pause();
  }, [running]);
  useEffect(() => {
    const video = media.current;
    if (!video || video.readyState < 1) return;
    if (Math.abs(video.currentTime - t) > (playing ? 1.5 : 0.3)) video.currentTime = t;
  }, [t, playing]);
  useEffect(() => {
    const video = media.current;
    if (!video) return;
    video.volume = volume;
    video.muted = !playing || volume === 0;
  }, [volume, playing]);
  if (embed && !running) {
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
        fit={fit}
        controls={false}
        mediaRef={media}
        autoPlay={running}
        muted={!playing || volume === 0}
        quiet
        startAtSeconds={embed ? startAt.current : Math.floor(t)}
        // O relógio do editor é que manda; o tempo do leitor não volta para trás.
        onTime={() => {}}
        className="size-full rounded-none"
      />
    </div>
  );
}
