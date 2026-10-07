import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Eye,
  Headset,
  MessagesSquare,
  Pin,
  Play,
  Settings,
  ShoppingCart,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useHearts, useLivePresence } from "@/lib/live-presence";
import { Input } from "@/components/ui/input";
import { VideoPlayer } from "@/components/video-player";
import {
  activeOffer,
  checkoutLink,
  FOLLOW_NETWORKS,
  followAppLink,
  followMomentAt,
  followWebLink,
  isGroupLink,
  LIVE_DEFAULTS,
  profileHandle,
  type FollowNetwork,
  type LiveSettings,
  type OfferSlot,
  type RoomFormat,
} from "@/lib/room-logic";
import { useServerFn } from "@tanstack/react-start";
import { getPublicRoomPurchases } from "@/lib/public-room.functions";
import {
  CaptionLine,
  ChatComposer,
  ChatLine,
  LIVE_CONTAIN,
  LIVE_COVER,
  LIVE_TOP,
  LIVE_WIDE,
  OfferCard,
  PulseDot,
  RoomPartsStyle,
  RoomTitle,
  RotateHint,
  SaleLine,
  SupportNotice,
  VideoSettings,
  type Appearance,
} from "@/components/room/room-parts";
import { useAudienceCount } from "@/components/audience-counter";
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
} from "@/components/room/live-parts";
import { GroupJoinDialog } from "@/components/room/group-join";
import { cn, isHttpUrl } from "@/lib/utils";
import { PreliveCountdown, unlockPreliveAudio } from "@/components/prelive-countdown";
import { watchedStep } from "@/lib/participant-facts";

/** O que a sala envia com cada sinal de progresso. */
export type RoomProgressOptions = {
  final?: boolean;
  /** Posição em que a pessoa começou a ver; null até começar. */
  entry?: number | null;
  /** Segundos vistos desde o sinal anterior. */
  played?: number;
};

type Mode = "live" | "replay";
type Tab = "chat" | "support" | "offer";
type SentMessage = { text: string; at: Date; failed?: boolean };

export type RoomWebinar = {
  id: string;
  public_title: string;
  description: string;
  host_name?: string | null;
  host_role?: string | null;
  host_avatar_url?: string | null;
  chat_pin_title?: string | null;
  chat_pin_message?: string | null;
  offer_pin_title?: string | null;
  offer_pin_message?: string | null;
  cta_text: string | null;
  cta_url: string | null;
  cta_color: string | null;
  cta_price_original?: string | null;
  cta_price_now?: string | null;
  cta_image_url?: string | null;
  cta_countdown_seconds?: number | null;
  cta_start_seconds: number | null;
  cta_end_seconds: number | null;
  video_url: string | null;
  video_provider: string | null;
  duration_seconds: number;
};

export type RoomSocialProof = {
  enabled: boolean;
  product_name: string;
  start_mode: string;
  start_delay_seconds: number;
  start_seconds: number | null;
  end_seconds: number | null;
  min_interval_seconds?: number | null;

  position: string;
  display_seconds: number;
  animation: string;
  sound_enabled: boolean;
  notification_color?: string | null;
};

export type RoomPurchase = {
  id: string;
  buyer_name: string;
  product_name: string;
  message: string;
  offset_seconds: number;
};

export type RoomComment = {
  id: string;
  author_name: string;
  avatar_url?: string | null;
  message: string;
  offset_seconds: number;
  created_at?: string | null;
};

function purchaseColorClasses(value?: string | null) {
  switch (value) {
    case "amber":
      return {
        bg: "bg-amber-500/20",
        text: "text-amber-600",
        panel: "bg-amber-500/90",
        ring: "ring-amber-400/60",
      };
    case "blue":
      return {
        bg: "bg-blue-500/20",
        text: "text-blue-600",
        panel: "bg-blue-500/90",
        ring: "ring-blue-400/60",
      };
    case "rose":
      return {
        bg: "bg-rose-500/20",
        text: "text-rose-600",
        panel: "bg-rose-500/90",
        ring: "ring-rose-400/60",
      };
    case "violet":
      return {
        bg: "bg-violet-500/20",
        text: "text-violet-600",
        panel: "bg-violet-500/90",
        ring: "ring-violet-400/60",
      };
    case "orange":
      return {
        bg: "bg-orange-500/20",
        text: "text-orange-600",
        panel: "bg-[#E8440C]/90",
        ring: "ring-orange-400/60",
      };
    case "slate":
      return {
        bg: "bg-slate-500/20",
        text: "text-slate-700",
        panel: "bg-slate-500/90",
        ring: "ring-slate-400/60",
      };
    default:
      return {
        bg: "bg-emerald-500/20",
        text: "text-emerald-700",
        panel: "bg-emerald-500/90",
        ring: "ring-emerald-400/60",
      };
  }
}

export function WebinarRoom({
  webinar,
  comments,
  audienceMode,
  curve,
  mode,
  theme = "dark",
  startsAt,
  socialProof,
  purchases = [],
  syncWithStart = false,
  resumeSeconds,
  resumePeakSeconds,
  preliveSeconds = 0,
  preliveSound = true,
  preliveMessage = "A transmissão começa já a seguir",
  preliveTemplate = null,
  preliveAppearance,
  viewerName,
  organizationId,
  onSend,
  supportMessages = [],
  onCtaView,
  onCtaClick,
  onProgress,
  checkoutOrigin,
  appearance = "dark",
  onAppearance,
  captions = [],
  offers,
  sales,
  audienceFormat,
  hostVerified = true,
  onJoinGroup,
  prefill,
  format = "webinar",
  live = LIVE_DEFAULTS,
}: {
  webinar: RoomWebinar;
  /** «live»: vídeo em ecrã inteiro no telemóvel, com o chat por cima; no computador, o vídeo e o chat ao lado. */
  format?: RoomFormat | undefined;
  /** Definições do formato Live (orientação no computador, selo, redes, momentos do + Seguir, cor da oferta). */
  live?: LiveSettings | undefined;
  /** A aparência escolhida (do organizador ou desta pessoa); `theme` é o resultado. */
  appearance?: Appearance;
  onAppearance?: ((appearance: Appearance) => void) | undefined;
  /** A fala do vídeo, para as legendas. */
  captions?: readonly { at: number; text: string }[];
  /** As ofertas seguintes à principal, o prazo, o fecho no zero e a origem no link. */
  offers?: { extra: readonly OfferSlot[]; closed: boolean; closeAtZero: boolean; utm: boolean } | undefined;
  /** Onde aparecem as compras e se as reais da Kambafy entram na sala. */
  sales?: { where: "chat" | "video" | "both"; real: boolean } | undefined;
  /** «off»: a sala não mostra quantas pessoas estão a ver. */
  audienceFormat?: string | null | undefined;
  hostVerified?: boolean | undefined;
  /** Entrar no grupo da oferta: grava os dados confirmados (nome, e-mail, WhatsApp). */
  onJoinGroup?: ((data: { name: string; email: string; phone: string }) => void) | undefined;
  /** O que a pessoa escreveu na entrada, para não ter de repetir no pop-up do grupo. */
  prefill?: { name?: string; email?: string; phone?: string } | undefined;
  /** O anúncio de onde a pessoa veio, para o link do checkout. */
  checkoutOrigin?: { source?: string | null; medium?: string | null; campaign?: string | null } | undefined;
  comments: RoomComment[];
  audienceMode: string;
  curve: unknown;
  mode: Mode;
  /** Tema visual da sala: escuro (predefinido) ou claro. */
  theme?: "dark" | "light";
  /** Data e hora marcadas. Com ela a sessão arranca sozinha e termina ao fim da duração. */
  startsAt?: string | null;
  /** Regras das notificações de compra. */
  socialProof?: RoomSocialProof | null;
  /** Notificações de compra de demonstração, marcadas como simulação. */
  purchases?: RoomPurchase[];
  /** Faz o vídeo arrancar no minuto correspondente à hora marcada. */
  syncWithStart?: boolean;
  /** Posição guardada desta pessoa no vídeo: usada quando a sincronização está desligada. */
  resumeSeconds?: number | null;
  /** Ponto mais avançado já visto por esta pessoa: evita repetir eventos ao recuar. */
  resumePeakSeconds?: number | null;
  /** Contagem animada antes do arranque, em segundos. Zero desliga. */
  preliveSeconds?: number;
  /** Som de fundo durante a contagem de arranque. */
  preliveSound?: boolean;
  /** Frase mostrada durante a contagem de arranque. */
  preliveMessage?: string;
  /** Modelo visual da contagem de arranque. */
  preliveTemplate?: string | null;
  /** Ajustes de aparência do modelo escolhido. */
  preliveAppearance?: unknown;
  viewerName: string;
  /** Workspace da sessão. Com ele a sala aparece na vista ao vivo. */
  organizationId?: string | null;
  onSend: (body: string) => Promise<void>;
  /** Conversa privada com a equipa: o que o participante escreveu e as respostas do suporte. */
  supportMessages?: { id: string; body: string; sender_kind: string; created_at: string }[];
  onCtaView?: () => void;
  onCtaClick?: () => void;
  onProgress?: (seconds: number, peakSeconds?: number, options?: RoomProgressOptions) => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [videoDriven, setVideoDriven] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const lastVideoRef = useRef(0);
  // Relógio de conteúdo: a posição real do vídeo desta pessoa. Chat, oferta,
  // notificações simuladas e o assistente seguem este relógio, não o da sessão.
  const [videoSeconds, setVideoSeconds] = useState(0);
  const contentPeakRef = useRef(0);

  const [text, setText] = useState("");
  const [sent, setSent] = useState<SentMessage[]>([]);
  const [ctaLogged, setCtaLogged] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [pinDismissed, setPinDismissed] = useState(false);
  const [commentArrival, setCommentArrival] = useState<Record<string, Date>>({});
  const roomRef = useRef<HTMLElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const keyboardFrameRef = useRef<number | null>(null);
  const { hearts, sendHeart } = useHearts(webinar.id);
  const [checkout, setCheckout] = useState(false);
  // O navegador só deixa arrancar sem som. Pedimos um toque para ligar o áudio.
  const [soundOn, setSoundOn] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [captionsOn, setCaptionsOn] = useState(false);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const joinOffsetRef = useRef<number | null>(null);
  const [preliveEnding, setPreliveEnding] = useState(false);
  const [preliveReady, setPreliveReady] = useState(false);
  const [preliveBlack, setPreliveBlack] = useState(false);
  const [preliveReveal, setPreliveReveal] = useState(false);
  const revealTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const playbackFallbackRef = useRef<number | null>(null);

  const wasPreliveRef = useRef(false);

  // Formato Live: no telemóvel o vídeo enche o ecrã e o chat fica por cima; o Suporte e a oferta
  // inteira abrem numa folha por baixo. No computador o vídeo fica ao centro e o chat ao lado.
  const liveLayout = format === "live";
  // O vídeo diz se é deitado ou ao alto: assim nunca se corta, mesmo que a opção gravada seja a outra.
  // Sem o ficheiro à mão (Vimeo, Panda, Bunny embebidos), vale a opção do editor.
  const [videoShape, setVideoShape] = useState<LiveSettings["desk"] | null>(null);
  const desk = videoShape ?? live.desk;
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  // No Live o Suporte, a oferta inteira e as redes abrem numa folha por cima da sala.
  const [sheet, setSheet] = useState<null | "support" | "offer" | "follow">(null);
  // A dica «melhor na horizontal» (só no telemóvel ao alto, com o vídeo deitado); fecha-se no X.
  const [rotateHint, setRotateHint] = useState(true);
  const [offerMin, setOfferMin] = useState(false);
  const [tapped, setTapped] = useState<Partial<Record<FollowNetwork, boolean>>>({});
  // Quem já seguiu (tocou numa rede e fechou) deixa de ver o + Seguir neste webinar.
  const followKey = `cw:seguiu:${webinar.id}`;
  const [followed, setFollowed] = useState(false);
  useEffect(() => {
    try {
      setFollowed(window.localStorage.getItem(followKey) === "1");
    } catch {
      // Sem armazenamento (navegação privada): o + Seguir volta a aparecer nos momentos.
    }
  }, [followKey]);
  // As respostas do Suporte que chegam depois de a pessoa entrar contam como por ler até abrir o Suporte.
  const enteredAtRef = useRef(Date.now());
  const [supportSeenAt, setSupportSeenAt] = useState(0);
  const [notices, setNotices] = useState<Date[]>([]);
  const liveFeedRef = useRef<HTMLDivElement>(null);

  // A transição suave de fim de contagem é ativada depois de `prelive` ser calculada.

  useLivePresence({
    organizationId: organizationId ?? null,
    webinarId: webinar.id,
    webinarTitle: webinar.public_title,
    name: viewerName,
    mode,
    checkout,
  });

  const startMs = useMemo(() => {
    if (!startsAt) return null;
    const value = new Date(startsAt).getTime();
    return Number.isNaN(value) ? null : value;
  }, [startsAt]);

  useEffect(() => {
    // O relógio real também alimenta o contador da oferta. Tem de continuar
    // ativo mesmo nas sessões sem uma data marcada e depois do fim do vídeo.
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // No telemóvel, acompanhamos a abertura do teclado quadro a quadro. O bloqueio
  // do scroll evita o salto inicial do Safari para a composição antiga da sala.
  useEffect(() => {
    const viewport = window.visualViewport;
    const room = roomRef.current;
    if (!viewport || !room) return;

    const paintVisibleRoom = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        room.style.removeProperty("--room-visible-height");
        room.style.removeProperty("--room-visible-top");
        return;
      }
      room.style.setProperty("--room-visible-height", `${Math.round(viewport.height)}px`);
      room.style.setProperty("--room-visible-top", `${Math.round(viewport.offsetTop)}px`);
    };

    const updateVisibleRoom = () => {
      if (keyboardFrameRef.current !== null) {
        window.cancelAnimationFrame(keyboardFrameRef.current);
      }
      keyboardFrameRef.current = window.requestAnimationFrame(() => {
        paintVisibleRoom();
        keyboardFrameRef.current = null;
      });
    };

    paintVisibleRoom();
    viewport.addEventListener("resize", updateVisibleRoom);
    viewport.addEventListener("scroll", updateVisibleRoom);
    window.addEventListener("orientationchange", updateVisibleRoom);
    return () => {
      if (keyboardFrameRef.current !== null) {
        window.cancelAnimationFrame(keyboardFrameRef.current);
      }
      viewport.removeEventListener("resize", updateVisibleRoom);
      viewport.removeEventListener("scroll", updateVisibleRoom);
      window.removeEventListener("orientationchange", updateVisibleRoom);
    };
  }, []);

  const scheduled = mode === "live" && startMs !== null;
  const elapsed = startMs === null ? 0 : (now - startMs) / 1000;
  const waiting = scheduled && elapsed < 0;
  const untilStart = Math.max(0, Math.round(-elapsed));
  const embedLike = /youtube|youtu\.be|vimeo|mediadelivery|pandavideo|\/embed\/|player\./i.test(
    webinar.video_url ?? "",
  );
  // Contagem de arranque: o chat já está aberto e o lugar do vídeo mostra o
  // relógio animado até a transmissão entrar no ar.
  const prelive = waiting && preliveSeconds > 0 && untilStart <= preliveSeconds;

  // Ligar o som: serve o aviso no rodapé e qualquer toque no ecrã.
  const enableSound = useCallback(() => {
    unlockPreliveAudio();
    const video = liveVideoRef.current;
    if (video) {
      video.volume = volume > 0 ? volume : 1;
      if (!prelive) {
        // Já em transmissão: o vídeo nunca pára, o toque só liga o som.
        video.muted = false;
        void video.play().catch(() => undefined);
      }
    }
    setSoundOn(true);
  }, [prelive, volume]);

  // Enquanto o som estiver desligado, qualquer toque no ecrã liga-o.
  useEffect(() => {
    if (soundOn) return;
    const handler = () => enableSound();
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [soundOn, enableSound]);

  // Sincroniza volume e velocidade com o leitor real (canvas/video).
  useEffect(() => {
    const video = liveVideoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = !soundOn || volume === 0;
  }, [volume, soundOn]);

  useEffect(() => {
    const video = liveVideoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);
  useEffect(() => {
    if (!wasPreliveRef.current || prelive) {
      wasPreliveRef.current = prelive;
      return;
    }
    // A contagem e a transmissão comportam-se como uma sequência contínua:
    // escurece, o vídeo arranca escondido e só depois é revelado já em movimento.
    setPreliveEnding(true);
    setPreliveReady(false);
    setPreliveBlack(false);
    setPreliveReveal(false);
    const cover = window.setTimeout(() => setPreliveBlack(true), 20);
    const arm = window.setTimeout(() => setPreliveReady(true), 700);
    // Leitores externos não comunicam o evento de reprodução à página. Nesses
    // casos mantemos os dois segundos de transição e revelamos após o autoplay.
    if (embedLike) {
      playbackFallbackRef.current = window.setTimeout(() => {
        setPreliveReveal(true);
        setPreliveBlack(false);
        playbackFallbackRef.current = null;
        finishTimerRef.current = window.setTimeout(() => {
          setPreliveEnding(false);
          finishTimerRef.current = null;
        }, 1000);
      }, 1400);
    }
    wasPreliveRef.current = false;
    return () => {
      window.clearTimeout(cover);
      window.clearTimeout(arm);
    };
  }, [embedLike, prelive]);

  useEffect(
    () => () => {
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
      if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current);
      if (playbackFallbackRef.current !== null) window.clearTimeout(playbackFallbackRef.current);
    },
    [],
  );

  // A transmissão termina à hora prevista ou logo que o vídeo chegue ao fim.
  const finished =
    (scheduled && webinar.duration_seconds > 0 && elapsed > webinar.duration_seconds) || videoEnded;
  // Quando a hora está definida, o relógio da sessão segue a data marcada.
  const timeline = scheduled
    ? Math.max(
        0,
        webinar.duration_seconds > 0 ? Math.min(elapsed, webinar.duration_seconds) : elapsed,
      )
    : seconds;

  // Relógio de conteúdo: sem vídeo não há posição própria, por isso a sessão
  // serve de fallback. Com vídeo, é o ponto exato que esta pessoa está a ver.
  const contentSeconds = webinar.video_url ? videoSeconds : timeline;
  if (contentSeconds > contentPeakRef.current) contentPeakRef.current = contentSeconds;
  const contentPeak = contentPeakRef.current;
  // Quem volta à sala retoma também o ponto mais avançado que já tinha visto.
  useEffect(() => {
    const seed = Math.max(0, Math.floor(resumePeakSeconds ?? 0));
    if (seed > contentPeakRef.current) contentPeakRef.current = seed;
  }, [resumePeakSeconds]);

  // Quem entra a meio apanha a sessão no ponto certo, quando isso está ligado.
  // Com a sincronização desligada, o vídeo continua onde esta pessoa deixou.
  if (joinOffsetRef.current === null && scheduled && !waiting) {
    joinOffsetRef.current = Math.max(0, Math.floor(elapsed));
  }
  const startAtSeconds = syncWithStart
    ? (joinOffsetRef.current ?? 0)
    : Math.max(0, Math.floor(resumeSeconds ?? 0));

  const viewers = useAudienceCount({
    webinarId: webinar.id,
    seconds: timeline,
    mode: audienceMode,
    curve,
    durationSeconds: webinar.duration_seconds,
  });

  // Relógio próprio da sessão. Só para quando o vídeo estiver mesmo a correr
  // e a dar o seu tempo; se o vídeo falhar, a sessão continua a avançar.
  useEffect(() => {
    if (scheduled) return;
    const timer = window.setInterval(() => {
      if (videoDriven && Date.now() - lastVideoRef.current < 2500) return;
      setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [scheduled, videoDriven]);

  // O progresso guardado e o assistente seguem a posição real do vídeo.
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const contentSecondsRef = useRef(contentSeconds);
  contentSecondsRef.current = contentSeconds;

  // Tempo efectivamente visto: só conta o avanço natural do conteúdo, com a sala
  // visível ou, no vídeo próprio, com o som ligado. Sem vídeo, ou com vídeo
  // embutido (a sala não sabe a posição), conta o relógio da sessão com a sala visível.
  const ownVideo = Boolean(webinar.video_url) && !embedLike;
  const watchClockRef = useRef(0);
  watchClockRef.current = ownVideo ? videoSeconds : timeline;
  const listeningRef = useRef(false);
  listeningRef.current = ownVideo && soundOn && volume > 0;
  const playedRef = useRef(0);
  const entryRef = useRef<number | null>(null);
  useEffect(() => {
    if (!onProgress) return;
    let previous: number | null = null;
    const timer = window.setInterval(() => {
      const clock = watchClockRef.current;
      const present = document.visibilityState === "visible" || listeningRef.current;
      const step = watchedStep(previous, clock, present);
      if (step > 0) {
        entryRef.current ??= Math.max(0, Math.round(clock - step));
        playedRef.current += step;
      }
      previous = clock;
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onProgress]);

  const flushProgress = useCallback((options?: { final?: boolean }) => {
    const played = Math.floor(playedRef.current);
    playedRef.current -= played;
    onProgressRef.current?.(
      Math.round(contentSecondsRef.current),
      Math.round(contentPeakRef.current),
      { ...options, entry: entryRef.current, played },
    );
  }, []);
  // Batimento fixo de 15 s (não reinicia com o tempo do vídeo), mais uma
  // gravação ao esconder ou fechar a página e ao sair da sala.
  useEffect(() => {
    if (!onProgress) return;
    const timer = window.setInterval(() => flushProgress(), 15000);
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushProgress({ final: true });
    };
    const onPageHide = () => flushProgress({ final: true });
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      flushProgress({ final: true });
    };
  }, [onProgress, flushProgress]);

  // As ofertas no tempo do vídeo: a principal (colunas cta_*) e as seguintes. A que está aberta
  // segue o ponto mais avançado que a pessoa viu: quem recua não perde a oferta já entregue.
  const offerList = useMemo<OfferSlot[]>(() => {
    const mainStart = webinar.cta_start_seconds ?? 0;
    const main: OfferSlot[] = webinar.cta_text
      ? [
          {
            id: "main",
            start: mainStart,
            end: webinar.cta_end_seconds != null && webinar.cta_end_seconds > mainStart ? webinar.cta_end_seconds : null,
            product: socialProof?.product_name?.trim() ?? "",
            priceFrom: webinar.cta_price_original ?? "",
            priceNow: webinar.cta_price_now ?? "",
            url: webinar.cta_url ?? "",
            button: webinar.cta_text,
            countdown: webinar.cta_countdown_seconds ?? 0,
          },
        ]
      : [];
    return [...main, ...(offers?.extra ?? [])];
  }, [webinar, socialProof?.product_name, offers?.extra]);
  // Depois do vídeo, o tempo das ofertas continua pelo relógio real: uma oferta que fecha depois
  // do fim mantém a sala aberta para compras até lá.
  const endedAtRef = useRef<number | null>(null);
  if (finished && endedAtRef.current === null) endedAtRef.current = Date.now();
  const afterSeconds = finished && endedAtRef.current !== null ? Math.max(0, (now - endedAtRef.current) / 1000) : 0;
  const offerClock = finished ? Math.max(contentPeak, webinar.duration_seconds) + afterSeconds : contentPeak;
  const currentOffer = waiting ? null : activeOffer(offerList, offerClock);
  const ctaVisible = currentOffer !== null;
  /** A sala continua aberta depois da aula: quanto falta para fechar, em segundos. */
  const openAfter =
    finished && currentOffer?.end != null && currentOffer.end > webinar.duration_seconds
      ? Math.max(0, Math.round(currentOffer.end - offerClock))
      : null;
  const [groupOpen, setGroupOpen] = useState(false);

  useEffect(() => {
    if (!ctaVisible || ctaLogged) return;
    setCtaLogged(true);
    onCtaView?.();
  }, [ctaVisible, ctaLogged, onCtaView]);

  // Quando uma oferta abre, o separador dela salta para a frente.
  useEffect(() => {
    if (currentOffer) setTab("offer");
    else setTab((prev) => (prev === "offer" ? "chat" : prev));
    // No Live, cada oferta nova abre como cartão; a folha da oferta fecha quando ela acaba.
    setOfferMin(false);
    if (!currentOffer) setSheet((prev) => (prev === "offer" ? null : prev));
  }, [currentOffer?.id]);

  // Contador regressivo da oferta aberta. Fixa-se ao relógio real no instante em que ela abre,
  // para continuar a andar mesmo depois de a transmissão terminar.
  const countdownTotal = currentOffer?.countdown ?? 0;
  const offerWallStartRef = useRef<{ id: string; at: number } | null>(null);
  if (currentOffer && offerWallStartRef.current?.id !== currentOffer.id) {
    offerWallStartRef.current = {
      id: currentOffer.id,
      at: Date.now() - Math.max(0, contentPeak - currentOffer.start) * 1000,
    };
  }
  if (!currentOffer) offerWallStartRef.current = null;
  const offerElapsed = offerWallStartRef.current ? (now - offerWallStartRef.current.at) / 1000 : 0;
  const offerRemaining = Math.max(0, Math.round(countdownTotal - offerElapsed));
  // O botão fecha no fim do prazo, ou quando o cronómetro chega a zero se assim foi escolhido.
  const offerClosed =
    Boolean(offers?.closed) || (Boolean(offers?.closeAtZero) && countdownTotal > 0 && offerRemaining === 0);

  // Notificação de compra visível neste segundo, dentro da janela configurada.
  // Cada notificação tem o seu momento definido à mão, por isso não há janela
  // de tempo: basta a prova social estar ligada.
  const proofWindow = useMemo(() => {
    if (!socialProof?.enabled) return null;
    return { begin: Number.NEGATIVE_INFINITY, stop: Number.POSITIVE_INFINITY };
  }, [socialProof?.enabled]);

  // Cada compra tem o seu lugar na linha de tempo: entra no seu momento, fica
  // o tempo configurado e nunca se sobrepõe à anterior.
  const proofSchedule = useMemo(() => {
    if (!proofWindow) return [];
    const show = Math.max(3, socialProof?.display_seconds ?? 6);
    const gap = Math.max(1, socialProof?.min_interval_seconds ?? 3);
    let cursor = Number.NEGATIVE_INFINITY;
    return purchases
      .filter((p) => p.offset_seconds >= proofWindow.begin && p.offset_seconds <= proofWindow.stop)
      .sort((a, b) => a.offset_seconds - b.offset_seconds)
      .map((purchase) => {
        const from = Math.max(purchase.offset_seconds, cursor + gap);
        cursor = from + show;
        return { purchase, from, to: from + show };
      });
  }, [proofWindow, purchases, socialProof?.display_seconds, socialProof?.min_interval_seconds]);

  // Notificações de compra simuladas: seguem o vídeo e cada uma é entregue uma
  // única vez — recuar no vídeo não as repete.
  const shownPurchasesRef = useRef<Set<string>>(new Set());
  const purchaseArrivalRef = useRef<Record<string, Date>>({});
  const activePurchase = useMemo(() => {
    if (waiting) return null;
    const slot = proofSchedule.find(
      (s) =>
        !shownPurchasesRef.current.has(s.purchase.id) &&
        contentSeconds >= s.from &&
        contentSeconds < s.to,
    );
    if (slot) shownPurchasesRef.current.add(slot.purchase.id);
    return slot?.purchase ?? null;
  }, [proofSchedule, contentSeconds, waiting]);

  // Ao voltar à sala, tudo o que já passou do ponto mais avançado visto entra
  // logo no histórico do chat, sem voltar a soar como notificação.
  useEffect(() => {
    if (waiting) return;
    for (const slot of proofSchedule) {
      if (slot.from > contentPeakRef.current) break;
      if (shownPurchasesRef.current.has(slot.purchase.id)) continue;
      shownPurchasesRef.current.add(slot.purchase.id);
      const behind = Math.max(0, contentPeakRef.current - slot.from);
      purchaseArrivalRef.current[`purchase-${slot.purchase.id}`] = new Date(
        Date.now() - behind * 1000,
      );
    }
  }, [proofSchedule, waiting]);

  const proofPosition = (() => {
    switch (socialProof?.position) {
      case "bottom-right":
        return "bottom-4 right-4";
      case "top-left":
        return "top-16 left-4";
      case "top-right":
        return "top-16 right-4";
      default:
        return "bottom-4 left-4";
    }
  })();

  const proofAnimation =
    socialProof?.animation === "fade"
      ? "animate-in fade-in duration-500"
      : socialProof?.animation === "pop"
        ? "animate-in zoom-in-95 fade-in duration-300"
        : "animate-in slide-in-from-left-4 fade-in duration-400";

  const proofColor = purchaseColorClasses(socialProof?.notification_color);

  // Compras reais da Kambafy: chegam no momento em que acontecem (de 20 em 20 segundos).
  const fetchRealPurchases = useServerFn(getPublicRoomPurchases);
  const [realPurchases, setRealPurchases] = useState<{ id: string; buyer: string; product: string; arrived: Date }[]>([]);
  const realSinceRef = useRef(Date.now() - 10 * 60 * 1000);
  useEffect(() => {
    if (!sales?.real || mode !== "live") return;
    let stopped = false;
    const load = async () => {
      try {
        const rows = await fetchRealPurchases({ data: { webinarId: webinar.id, since: realSinceRef.current } });
        if (stopped || rows.length === 0) return;
        setRealPurchases((prev) => {
          const known = new Set(prev.map((p) => p.id));
          const fresh = rows
            .filter((row) => !known.has(row.id))
            .map((row) => ({ id: row.id, buyer: row.buyer, product: row.product, arrived: new Date() }));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
      } catch {
        /* tenta outra vez na próxima volta */
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [sales?.real, mode, webinar.id, fetchRealPurchases]);

  // Onde aparecem as compras: no vídeo (aviso), no chat (linha) ou nos dois.
  const showToasts = (sales?.where ?? "both") !== "chat";
  const showChatSales = (sales?.where ?? "both") !== "video";
  const latestReal = realPurchases[realPurchases.length - 1];
  const realActive = latestReal && now - latestReal.arrived.getTime() < 7000 ? latestReal : null;
  const toastPurchase = activePurchase
    ? { name: activePurchase.buyer_name, text: activePurchase.message || `comprou ${activePurchase.product_name}` }
    : realActive
      ? { name: realActive.buyer, text: `comprou ${realActive.product || "a vaga"}` }
      : null;
  const purchaseToast = showToasts && toastPurchase ? (
    <div
      className={`pointer-events-none absolute z-20 max-w-[min(20rem,80%)] rounded-2xl p-3 shadow-lg ring-1 backdrop-blur ${proofColor.panel} ${proofColor.ring} ${liveLayout ? "left-3 top-16" : proofPosition} ${proofAnimation}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/25 text-white">
          <ShoppingCart className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {toastPurchase.name}{" "}
            <span className="font-normal text-white/85">{toastPurchase.text}</span>
          </p>
        </div>
      </div>
    </div>
  ) : null;

  // O histórico de comentários segue o ponto mais avançado do vídeo: recuar
  // num replay não apaga o que já foi mostrado.
  const visibleComments = useMemo(
    () => comments.filter((c) => c.offset_seconds <= contentPeak),
    [comments, contentPeak],
  );

  // A hora mostrada é a do momento do vídeo em que o comentário foi dito.
  // Quem entra a meio (ou recarrega) vê o histórico com as horas certas,
  // em vez de tudo a chegar ao mesmo segundo.
  const contentPeakSnapshotRef = useRef(contentPeak);
  contentPeakSnapshotRef.current = contentPeak;

  useEffect(() => {
    setCommentArrival((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const comment of visibleComments) {
        if (!(comment.id in next)) {
          const behind = Math.max(0, contentPeakSnapshotRef.current - comment.offset_seconds);
          next[comment.id] = new Date(Date.now() - behind * 1000);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [visibleComments]);

  useEffect(() => {
    const node = feedRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [visibleComments.length, sent.length, supportMessages.length, tab]);

  // O link vem da base de dados: só http(s) chega ao browser do participante.
  const ctaUrl = currentOffer && isHttpUrl(currentOffer.url) ? currentOffer.url : null;

  // Cada clique leva até ao checkout a origem da pessoa, onde clicou e em que minuto.
  const clickCta = () => {
    if (offerClosed) return;
    // Um grupo (WhatsApp ou Telegram) pede primeiro os dados, para saber quem entrou.
    if (ctaUrl && isGroupLink(ctaUrl)) {
      setGroupOpen(true);
      return;
    }
    setCheckout(true);
    onCtaClick?.();
    if (!ctaUrl) return;
    const link =
      offers?.utm === false
        ? ctaUrl
        : checkoutLink(ctaUrl, { ...checkoutOrigin, place: "sala", seconds: contentSeconds });
    window.open(link, "_blank", "noopener");
  };

  // Uma mensagem que não chegou ao servidor fica à vista, com a opção de repetir.
  const deliver = async (message: SentMessage) => {
    const mark = (failed: boolean) =>
      setSent((prev) => prev.map((m) => (m.at === message.at ? { ...m, failed } : m)));
    mark(false);
    try {
      await onSend(message.text);
    } catch {
      mark(true);
    }
  };

  const sendMessage = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    const message = { text: body, at: new Date() };
    setSent((prev) => [...prev, message]);
    await deliver(message);
  };

  const retryNote = (message: SentMessage) =>
    message.failed ? (
      <button
        type="button"
        onClick={() => void deliver(message)}
        className="text-[11px] font-semibold text-destructive underline underline-offset-2"
      >
        Não enviada. Tentar de novo
      </button>
    ) : null;

  // Durante a contagem a sala continua a encher: a audiência sobe a caminho do
  // arranque, em vez de ficar parada no mesmo número.
  const preliveViewers = (() => {
    const base = Math.max(1, viewers);
    const span = Math.max(1, preliveSeconds);
    const done = Math.min(1, Math.max(0, 1 - untilStart / span));
    const ramp = 0.28 + 0.72 * done ** 1.35;
    const wave = Math.sin(untilStart / 5) * 0.012 + Math.sin(untilStart / 1.7) * 0.006;
    return Math.max(1, Math.round(base * (ramp + wave)));
  })();

  const overlay = (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
      {/* Selo da referência: vermelho só para AO VIVO; replay a azul; resto neutro. */}
      <span className="flex items-center gap-[5px]">
        {prelive ? null : (
          <LiveBadge
            label={waiting ? "Em breve" : finished ? "Terminou" : mode === "live" ? "Ao vivo" : "Replay"}
            tone={waiting || finished ? "muted" : mode === "live" ? "live" : "replay"}
          />
        )}
        {!finished && audienceFormat !== "off" ? <LiveViewers count={prelive ? preliveViewers : viewers} /> : null}
      </span>
      <span />
    </div>
  );

  const countdown = (() => {
    const remaining = Math.max(0, Math.round(-elapsed));
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const secs = remaining % 60;
    const parts =
      days > 0
        ? [
            [days, "dias"],
            [hours, "horas"],
            [minutes, "min"],
          ]
        : [
            [hours, "horas"],
            [minutes, "min"],
            [secs, "seg"],
          ];
    return parts as [number, string][];
  })();

  const showPrelive = prelive || preliveEnding;
  // O vídeo arranca sem som atrás do preto; ao ser revelado, recebe o som que a
  // pessoa já autorizou na contagem. Assim nunca aparece parado nem pede play.
  const videoArmed = !prelive && (!preliveEnding || preliveReady);
  useEffect(() => {
    const video = liveVideoRef.current;
    if (!liveLayout || !video) return;
    const read = () => {
      if (video.videoWidth && video.videoHeight) setVideoShape(video.videoWidth >= video.videoHeight ? "horizontal" : "vertical");
    };
    read();
    video.addEventListener("loadedmetadata", read);
    return () => video.removeEventListener("loadedmetadata", read);
  }, [liveLayout, videoArmed]);
  const videoNode = webinar.video_url ? (
    <VideoPlayer
      url={webinar.video_url}
      provider={webinar.video_provider}
      // Nem ao vivo nem em replay se pode avançar ou recuar a sessão.
      controls={false}
      mediaRef={liveVideoRef}
      autoPlay={videoArmed}
      muted={!videoArmed || (preliveEnding && !preliveReveal) || !soundOn}
      startAtSeconds={startAtSeconds}
      // Numa sessão com hora marcada, o vídeo segue o relógio da sessão: quem
      // sai e volta apanha o momento real em vez de ficar com a imagem presa.
      liveTargetSeconds={scheduled && syncWithStart && !waiting && !finished ? timeline : null}
      theme={theme}
      className={liveLayout ? "size-full rounded-none" : ""}

      onEnded={() => {
        setVideoEnded(true);
        flushProgress({ final: true });
      }}
      onPause={() => flushProgress()}
      onPlaying={() => {
        if (!preliveEnding || preliveReveal || revealTimerRef.current !== null) return;
        if (playbackFallbackRef.current !== null) {
          window.clearTimeout(playbackFallbackRef.current);
          playbackFallbackRef.current = null;
        }
        // Mantém um breve momento totalmente escuro depois de confirmar que o
        // vídeo já corre por trás; a revelação demora mais um segundo.
        revealTimerRef.current = window.setTimeout(() => {
          setPreliveReveal(true);
          setPreliveBlack(false);
          revealTimerRef.current = null;
          finishTimerRef.current = window.setTimeout(() => {
            setPreliveEnding(false);
            finishTimerRef.current = null;
          }, 1050);
        }, 350);
      }}
      onTime={(value) => {
        if (waiting) return;
        if (value <= 0) return;
        lastVideoRef.current = Date.now();
        setVideoDriven(true);
        // Relógio de conteúdo: tudo o que depende do momento do vídeo segue daqui.
        setVideoSeconds(value);
        if (!scheduled) setSeconds(value);
      }}
    />
  ) : null;

  // As definições do vídeo, como no YouTube: volume, legendas, qualidade e aparência.
  // Sem velocidade nem avançar: a sessão parece sempre ao vivo.
  const changeVolume = (next: number) => {
    setVolume(next);
    if (next > 0 && !soundOn) enableSound();
  };
  const videoControls = videoNode ? (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="pointer-events-auto absolute bottom-3 right-3">
        <VideoSettings
          volume={soundOn ? volume : 0}
          onVolume={changeVolume}
          captions={captionsOn}
          onCaptions={setCaptionsOn}
          hasCaptions={captions.length > 0}
          appearance={appearance}
          onAppearance={(next) => onAppearance?.(next)}
        />
      </div>
    </div>
  ) : null;
  // A legenda do momento: a frase dita há menos de sete segundos.
  const caption = useMemo(() => {
    if (!captionsOn || captions.length === 0) return null;
    let current: { at: number; text: string } | null = null;
    for (const line of captions) {
      if (line.at > contentSeconds) break;
      current = line;
    }
    return current && contentSeconds - current.at < 7 ? current.text : null;
  }, [captionsOn, captions, contentSeconds]);

  const needsAudioUnlock =
    !soundOn && !prelive && !waiting && !finished && Boolean(webinar.video_url);

  // No Live o ecrã de cada estado enche o palco ao alto; no webinar tem a proporção do vídeo.
  // No Webinar, o telemóvel deitado mostra o vídeo em ecrã inteiro, como no YouTube.
  const frame = liveLayout ? "size-full" : "aspect-video max-lg:landscape:h-full max-lg:landscape:w-auto max-lg:landscape:max-w-full";
  const liveArea = (
    <div
      className={cn(
        "relative overflow-hidden",
        frame,
        liveLayout ? "" : theme === "light" ? "bg-room-surface" : "bg-black",
      )}
    >
      <div
        className={cn(
          "relative h-full w-full",
          needsAudioUnlock && "blur-[6px] brightness-[0.85]",
        )}
      >
        {/* O leitor só é montado quando a transmissão está armada. Isto impede o
            navegador de desenhar um botão nativo por cima da contagem no refresh. */}
        {videoArmed &&
          (liveLayout ? (
            desk === "vertical" ? (
              wide ? (
                // Vídeo ao alto no computador: inteiro, ao centro, em fundo preto.
                <div className={LIVE_CONTAIN}>{videoNode}</div>
              ) : (
                // Vídeo ao alto no telemóvel: cobre o ecrã, sem faixas pretas.
                <div className={cn(LIVE_COVER, "max-lg:landscape:h-full max-lg:landscape:w-[56.25cqh]")}>{videoNode}</div>
              )
            ) : wide ? (
              // Vídeo deitado no computador: 16:9 inteiro, com uma margem preta à volta, como no cinema.
              <div className={LIVE_WIDE}>{videoNode}</div>
            ) : (
              // Vídeo deitado no telemóvel: inteiro, no terço de cima, longe do chat, em fundo preto, com as
              // bordas a desvanecer. Com o telemóvel deitado, fica inteiro e ao centro.
              <div
                className={cn(
                  LIVE_TOP,
                  "max-lg:landscape:left-1/2 max-lg:landscape:top-1/2 max-lg:landscape:w-[min(100cqw,177.78cqh)] max-lg:landscape:-translate-x-1/2",
                )}
              >
                {videoNode}
              </div>
            )
          ) : (
            videoNode
          ))}
        {!videoNode && (
          <div className="flex size-full items-center justify-center px-6 text-center text-sm text-room-subtle">
            Sem vídeo associado. Adicione uma fonte na biblioteca.
          </div>
        )}
        {/* Escudo de toque: ninguém consegue pausar nem aparece qualquer botão de
            play/pause — a transmissão parece sempre ao vivo, nunca um vídeo gravado. */}
        {videoNode && <div className="absolute inset-0 z-10 cursor-default" />}


        {showPrelive && (
          <div
            className={cn(
              "absolute inset-0 bg-black transition-opacity duration-500",
              preliveEnding ? "opacity-0" : "opacity-100",
            )}
          >
            <PreliveCountdown
              remaining={untilStart}
              total={preliveSeconds}
              message={preliveMessage}
              soundOn={soundOn}
              soundEnabled={preliveSound}
              template={preliveTemplate}
              appearance={preliveAppearance}
            />
          </div>
        )}
        {preliveEnding && (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-20 bg-black transition-opacity ease-in-out",
              preliveBlack ? "opacity-100 duration-700" : "opacity-0 duration-1000",
            )}
          />
        )}
        {!showPrelive && !needsAudioUnlock ? (
          liveLayout && !wide ? (
            // No telemóvel o chat ocupa o fundo do ecrã: a legenda sobe para o meio.
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[55%]">
              <CaptionLine text={caption} />
            </div>
          ) : (
            <CaptionLine text={caption} />
          )
        ) : null}
        {!showPrelive && !needsAudioUnlock && !liveLayout && videoControls}
      </div>

      {needsAudioUnlock && (
        <button
          type="button"
          onClick={enableSound}
          className={cn(
            "absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 px-3 py-4 text-center transition-colors sm:gap-6",
            "bg-black/40 text-white hover:bg-black/45",
          )}
        >
          <div className={cn(
            "flex w-full max-w-[min(24rem,calc(100%-1rem))] flex-col items-center gap-3 rounded-xl p-4 ring-1 sm:max-w-lg sm:rounded-2xl sm:p-10 sm:gap-5",
            "bg-black/70 text-white ring-white/10 shadow-2xl",
          )}>
            <span className="relative flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg sm:size-20">
              <Play className="size-5 sm:size-9" fill="currentColor" />
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary sm:text-xs">
                {mode === "replay" ? "Replay" : "Ao Vivo"}
              </p>
              <h2 className="mt-1 text-lg font-bold sm:text-3xl">
                A sua aula começou
              </h2>
            </div>
            <p className="max-w-[16rem] text-xs leading-relaxed text-white/85 sm:max-w-sm sm:text-base">
              Clique para assistir.
            </p>
            <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg ring-1 ring-white/10 sm:px-7 sm:py-3 sm:text-base">
              Clique aqui para assistir
            </span>
          </div>
        </button>
      )}
    </div>
  );

  const player = showPrelive ? (
    liveArea

  ) : waiting ? (
    <div className={cn("flex flex-col items-center justify-center gap-5 px-6 text-center", frame)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
        A transmissão começa em
      </p>
      <div className="flex gap-3">
        {countdown.map(([value, label]) => (
          <div
            key={label}
            className="min-w-20 rounded-2xl bg-room-raised px-4 py-3 ring-1 ring-room-line"
          >
            <p className="text-2xl font-black tabular-nums text-room-text">
              {String(value).padStart(2, "0")}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-room-subtle">
              {label}
            </p>
          </div>
        ))}
      </div>
      <p className="text-sm text-room-subtle">Fique por aqui. Entramos no ar à hora marcada.</p>
    </div>
  ) : finished && openAfter !== null ? (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 text-center text-white", frame)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">A aula terminou</p>
      <h2 className="text-2xl font-extrabold text-white sm:text-3xl">As inscrições continuam abertas</h2>
      <p className="font-mono text-3xl font-bold tabular-nums text-white sm:text-4xl">
        {String(Math.floor(openAfter / 3600)).padStart(2, "0")}:{String(Math.floor((openAfter % 3600) / 60)).padStart(2, "0")}:
        {String(openAfter % 60).padStart(2, "0")}
      </p>
      <p className="max-w-md text-sm text-white/80">Garanta a sua vaga no separador Oferta. Dúvidas? A equipa responde no Suporte.</p>
      <button
        type="button"
        onClick={() => {
          setTab("offer");
          setSheet("offer");
        }}
        className="mt-1 h-11 rounded-xl bg-primary px-5 text-[15px] font-bold text-primary-foreground transition hover:brightness-110"
      >
        Ver a oferta
      </button>
    </div>
  ) : finished ? (
    <div className={cn("flex flex-col items-center justify-center gap-4 px-6 text-center text-white", frame)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
        Transmissão terminou
      </p>
      <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
        Obrigado por ter estado connosco
      </h2>
      <p className="max-w-md text-sm text-white/80">
        A sessão ao vivo chegou ao fim.{" "}
        {ctaVisible
          ? liveLayout
            ? "A oferta continua disponível aqui em baixo."
            : "A oferta continua disponível no separador Oferta."
          : "Volte para a próxima sessão."}
      </p>
    </div>
  ) : (
    liveArea
  );


  /** Junta o histórico guardado com o que acabou de ser escrito, sem repetir. */
  const supportThread = useMemo(() => {
    const stored = supportMessages.map((m) => ({
      key: m.id,
      text: m.body,
      at: new Date(m.created_at),
      // Equipa e assistente IA respondem do mesmo lado; só o participante é "eu".
      fromTeam: m.sender_kind !== "participant",
      source: undefined as SentMessage | undefined,
    }));
    const known = new Set(stored.filter((m) => !m.fromTeam).map((m) => m.text));
    const pending = sent
      .filter((m) => !known.has(m.text))
      .map((m, index) => ({ key: `pending-${index}`, text: m.text, at: m.at, fromTeam: false, source: m }));
    return [...stored, ...pending].sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [supportMessages, sent]);

  // Respostas da equipa ou do Agente que chegaram depois de a pessoa entrar e que ela ainda não viu.
  const supportOpenNow = liveLayout ? sheet === "support" : tab === "support";
  const supportUnread = supportOpenNow
    ? 0
    : supportThread.filter((m) => m.fromTeam && m.at.getTime() > Math.max(enteredAtRef.current, supportSeenAt)).length;
  useEffect(() => {
    if (supportOpenNow) setSupportSeenAt(Date.now());
  }, [supportOpenNow, supportThread.length]);
  // Se a resposta ficar por ler, o chat avisa a pessoa (só ela vê) ao fim de 20 s, nos dois formatos.
  useEffect(() => {
    if (!live.notify || supportUnread === 0) return;
    const timer = window.setTimeout(() => setNotices((list) => [...list, new Date()]), 20000);
    return () => window.clearTimeout(timer);
  }, [supportUnread, live.notify]);

  /** Compras já anunciadas: entram no chat no seu momento, com a hora correta. */
  const purchaseFeed = useMemo(() => {
    if (!showChatSales || waiting) return [];
    const real = realPurchases.map((p) => ({
      key: `real-${p.id}`,
      author: p.buyer,
      avatarUrl: null as string | null,
      message: `comprou ${p.product || "a vaga"}`,
      at: p.arrived,
      mine: false,
      purchase: true,
      source: undefined as SentMessage | undefined,
    }));
    if (!socialProof?.enabled) return real;
    return [...real, ...proofSchedule
      .filter((slot) => shownPurchasesRef.current.has(slot.purchase.id))
      .map((slot) => {
        const key = `purchase-${slot.purchase.id}`;
        if (!purchaseArrivalRef.current[key]) {
          purchaseArrivalRef.current[key] = new Date();
        }
        return {
          key,
          author: slot.purchase.buyer_name,
          avatarUrl: null as string | null,
          message: slot.purchase.message || `comprou ${slot.purchase.product_name}`,
          at: purchaseArrivalRef.current[key]!,
          mine: false,
          purchase: true,
          source: undefined as SentMessage | undefined,
        };
      })];
  }, [proofSchedule, socialProof?.enabled, activePurchase, waiting, showChatSales, realPurchases]);

  /** Chat público por ordem cronológica real: o que eu escrevi fica no momento em que escrevi. */
  const chatThread = useMemo(() => {
    const items = [
      ...visibleComments.map((c) => ({
        key: c.id,
        author: c.author_name,
        avatarUrl: c.avatar_url ?? null,
        message: c.message,
        at: commentArrival[c.id] ?? new Date(c.created_at ?? Date.now()),
        mine: false,
        purchase: false,
        source: undefined as SentMessage | undefined,
      })),
      ...purchaseFeed,
      ...sent.map((m, index) => ({
        key: `sent-${index}`,
        author: viewerName || "Eu",
        avatarUrl: null,
        message: m.text,
        at: m.at,
        mine: true,
        purchase: false,
        source: m,
      })),
    ];
    return items.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [visibleComments, commentArrival, sent, viewerName, purchaseFeed]);

  // As compras também entram no chat: a última fica à vista (também no chat por cima do vídeo).
  useEffect(() => {
    for (const node of [feedRef.current, liveFeedRef.current]) if (node) node.scrollTop = node.scrollHeight;
  }, [chatThread.length]);


  // Quem responde no Suporte (nos dois formatos): a equipa de quem apresenta.
  const supportName = webinar.host_name ? `Equipa de ${webinar.host_name}` : "Equipa";

  // O chat começa em baixo e cresce para cima, como no YouTube: a mensagem mais recente fica
  // sempre junto da caixa de escrever.
  const feed = (
    <div ref={feedRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4">
      <div className="mt-auto grid gap-3.5">
        {tab === "chat" ? (
          chatThread.length === 0 ? (
            <p className="py-6 text-center text-[13.5px] text-room-subtle">As mensagens aparecem aqui.</p>
          ) : (
            [...chatThread, ...notices.map((at, i) => ({ key: `notice-${i}`, at, notice: true as const }))]
              .sort((a, b) => a.at.getTime() - b.at.getTime())
              .map((item) =>
              "notice" in item ? (
                <SupportNotice key={item.key} onOpen={() => setTab("support")} />
              ) : item.purchase ? (
                <SaleLine key={item.key} text={`${item.author} ${item.message}`} color={socialProof?.notification_color} />
              ) : item.mine ? (
                <div key={item.key}>
                  {/* O que a pessoa escreve só ela vê: não chega aos outros nem afecta o lançamento. */}
                  <ChatLine author="Você" text={item.message} tone="mine" badge="Só você vê" big />
                  {item.source ? retryNote(item.source) : null}
                </div>
              ) : (
                <ChatLine key={item.key} author={item.author} text={item.message} avatarUrl={item.avatarUrl} big />
              ),
            )
          )
        ) : (
          <SupportMessages
            thread={supportThread.map((m) => ({ key: m.key, text: m.text, fromTeam: m.fromTeam, note: m.source ? retryNote(m.source) : null }))}
            teamName={supportName}
            empty="Escreva à equipa. A resposta aparece aqui, só para si."
          />
        )}
      </div>
    </div>
  );

  const offerPanel = currentOffer ? (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <OfferCard
        productName={currentOffer.product || undefined}
        imageUrl={currentOffer.id === "main" ? webinar.cta_image_url || undefined : undefined}
        priceFrom={currentOffer.priceFrom}
        priceNow={currentOffer.priceNow}
        buttonText={currentOffer.button || "Quero entrar"}
        onBuy={clickCta}
        countdownSeconds={offerRemaining}
        showCountdown={countdownTotal > 0}
        closed={offerClosed}
        group={isGroupLink(currentOffer.url)}
        banner={
          openAfter !== null ? (
            <>
              <b className="block font-semibold">A aula terminou, mas as inscrições continuam abertas.</b>
              Fecham daqui a {Math.ceil(openAfter / 60)} min.
            </>
          ) : null
        }
      />
    </div>
  ) : null;

  // Aviso durante a contagem de arranque: o vídeo ainda não entrou no ar e o
  // som precisa de um toque para ser desbloqueado.
  const soundPrompt =
    !soundOn && prelive ? (
      <button
        type="button"
        onClick={enableSound}
        className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center px-4 pb-4 pt-16 text-white"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)" }}
      >
        <span className="pointer-events-none flex items-center gap-3 rounded-full bg-black/70 py-2.5 pl-3 pr-5 shadow-xl ring-1 ring-white/20 backdrop-blur">
          <span className="relative flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Volume2 className="size-4" />
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
              A começar em instantes
            </span>
            <span className="text-sm font-bold">Toque para ligar o som</span>
          </span>
        </span>
      </button>
    ) : null;

  const offerPinActive =
    tab === "chat" &&
    ctaVisible &&
    !pinDismissed &&
    (webinar.offer_pin_title?.trim() || webinar.offer_pin_message?.trim());

  const chatPin =
    tab === "chat" && !pinDismissed ? (
      offerPinActive ? (
        <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-md bg-primary/10 px-3.5 py-2.5 ring-1 ring-primary/30">
          <div className="flex min-w-0 items-center gap-2">
            <Pin className="size-3.5 shrink-0 text-primary" />
            <p className="truncate text-sm font-semibold text-room-text">
              {webinar.offer_pin_title?.trim() || "Vagas abertas :"}
            </p>
            {ctaUrl ? (
              <a
                href={ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-[13px] font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {webinar.offer_pin_message?.trim() || ctaUrl}
              </a>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setPinDismissed(true)}
            aria-label="Fechar"
            className="shrink-0 rounded-md p-0.5 text-room-subtle transition hover:text-room-text"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : webinar.chat_pin_message ? (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-md bg-room-raised px-4 py-3.5 ring-1 ring-room-line">
          <Pin className="mt-0.5 size-4 shrink-0 text-room-subtle" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-room-text">
              {webinar.chat_pin_title || "Participe no chat!"}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-room-subtle">
              {webinar.chat_pin_message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPinDismissed(true)}
            aria-label="Fechar"
            className="shrink-0 rounded-md p-0.5 text-room-subtle transition hover:text-room-text"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null
    ) : null;

  // No telemóvel, o teclado encolhe a sala para a parte visível e a última mensagem fica à vista.
  const composerInput: React.InputHTMLAttributes<HTMLInputElement> = {
    onFocus: () => {
      const viewport = window.visualViewport;
      const room = roomRef.current;
      if (viewport && room && !window.matchMedia("(min-width: 1024px)").matches) {
        room.classList.add("live-room-shell--keyboard");
        room.style.setProperty("--room-visible-height", `${Math.round(viewport.height)}px`);
        room.style.setProperty("--room-visible-top", `${Math.round(viewport.offsetTop)}px`);
        window.scrollTo({ top: 0, behavior: "instant" });
      }
      window.setTimeout(() => {
        for (const node of [feedRef.current, liveFeedRef.current]) if (node) node.scrollTop = node.scrollHeight;
      }, 180);
    },
    onBlur: () => roomRef.current?.classList.remove("live-room-shell--keyboard"),
  };

  // No Live do telemóvel o chat já está por cima do vídeo: a folha só tem o Suporte e a Oferta.
  const sheetMode = liveLayout && !wide;
  const panel = (
    <div className="flex min-h-0 flex-1 flex-col bg-room-surface text-room-text md:rounded-2xl md:ring-1 md:ring-room-line">
      <div className="mx-3 -mt-2 mb-0 flex items-center gap-1 border-b border-room-line md:mt-0">
        {(
          [
            ...(sheetMode ? [] : [["chat", "Chat", MessagesSquare]]),
            ["support", "Suporte", Headset],
            ...(ctaVisible ? [["offer", "Oferta", ShoppingCart]] : []),
          ] as [Tab, string, typeof MessagesSquare][]
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`relative flex flex-1 items-center justify-center gap-2 px-3 py-3.5 text-sm font-semibold transition ${
              tab === value ? "text-primary" : "text-room-subtle hover:text-room-text"
            }`}
          >
            <Icon className="size-4" strokeWidth={1.9} />
            {label}
            {value === "offer" && tab !== "offer" ? <PulseDot /> : null}
            {value === "support" && supportUnread > 0 ? (
              <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground">
                {supportUnread}
              </span>
            ) : null}
            {tab === value ? (
              <span className="absolute inset-x-5 bottom-0 h-[3px] rounded-full bg-primary" />
            ) : null}
          </button>
        ))}
      </div>
      {chatPin}
      {tab === "offer" ? offerPanel : feed}
      {mode === "replay" && tab !== "offer" ? (
        <p className="border-t border-room-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs text-room-subtle">
          Esta é uma gravação. O chat está fechado — vê as mensagens tal como aconteceram ao vivo.
        </p>
      ) : null}
      {tab === "offer" || mode === "replay" ? null : (
        <div className="pb-[max(0px,env(safe-area-inset-bottom))]">
          <ChatComposer
            value={text}
            onChange={setText}
            onSubmit={() => void sendMessage()}
            placeholder={tab === "support" ? "Escreva à equipa..." : "Chat..."}
            withReactions={tab === "chat"}
            onHeart={sendHeart}
            reactions={hearts}
            inputProps={composerInput}
          />
        </div>
      )}
    </div>
  );

  const groupDialog =
    groupOpen && currentOffer && ctaUrl ? (
      <GroupJoinDialog
        product={currentOffer.product}
        host={webinar.host_name ?? ""}
        prefill={{ name: prefill?.name || viewerName, email: prefill?.email ?? "", phone: prefill?.phone ?? "" }}
        onClose={() => setGroupOpen(false)}
        onJoin={(data) => {
          setGroupOpen(false);
          setCheckout(true);
          onJoinGroup?.(data);
          window.open(ctaUrl, "_blank", "noopener");
        }}
      />
    ) : null;

  // As redes de quem apresenta, nos dois formatos. No telemóvel abrem na app; no computador numa janela pequena ao lado.
  const platform =
    typeof navigator === "undefined" ? "other" : /Android/i.test(navigator.userAgent) ? "android" : /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios" : "other";
  const networks = FOLLOW_NETWORKS.filter((n) => live.links[n.id]).map((n) => {
    const web = followWebLink(n.id, live.links[n.id] ?? "");
    return { id: n.id, name: n.name, handle: profileHandle(web), web, href: wide ? web : followAppLink(n.id, web, platform), done: Boolean(tapped[n.id]) };
  });
  const followLabel = networks.length === 1 && networks[0]?.id === "youtube" ? "Subscrever" : "Seguir";
  // O + Seguir só aparece nos momentos escolhidos (quando o apresentador pede para seguir), nunca durante a oferta.
  const followShown =
    networks.length > 0 && !(followed && live.hideFollowed) && !currentOffer && !prelive && !waiting && !finished && followMomentAt(live.moments, contentPeak);
  const openFollow = networks.length ? () => setSheet("follow") : undefined;
  const follow = followShown ? { label: followLabel, onClick: () => setSheet("follow") } : null;
  const closeSheet = () => {
    if (sheet === "follow" && networks.some((n) => n.done)) {
      setFollowed(true);
      try {
        window.localStorage.setItem(followKey, "1");
      } catch {
        // Sem armazenamento, só fica escondido até sair da sala.
      }
    }
    setSheet(null);
  };
  const followHost = { name: webinar.host_name ?? "", avatarUrl: webinar.host_avatar_url ?? "", verified: hostVerified };
  const followSheet =
    sheet === "follow" ? (
      <LiveFollowSheet
        host={followHost}
        networks={networks}
        note={wide ? "Cada rede abre numa janela pequena ao lado. A aula continua aqui." : "Cada rede abre diretamente na app. A aula continua aqui."}
        onClose={closeSheet}
        onTap={(id, event) => {
          const row = networks.find((n) => n.id === id);
          if (wide && row) {
            const w = 480;
            const h = Math.min(780, window.screen.availHeight - 80);
            const win = window.open(row.web, `cw-${id}`, `popup,width=${w},height=${h},left=${Math.max(0, window.screen.availWidth - w - 40)},top=40`);
            if (win) event.preventDefault();
          }
          setTapped((prev) => ({ ...prev, [id]: true }));
        }}
      />
    ) : null;

  if (liveLayout) {
    const host = followHost;
    const status = prelive
      ? null
      : waiting
        ? { label: "Em breve", tone: "muted" as const }
        : finished
          ? { label: "Terminou", tone: "muted" as const }
          : mode === "live"
            ? { label: "Ao vivo", tone: "live" as const }
            : { label: "Replay", tone: "replay" as const };
    const viewerCount = !finished && audienceFormat !== "off" ? (prelive ? preliveViewers : viewers) : null;
    const settings =
      videoNode && !showPrelive && !needsAudioUnlock ? (
        <VideoSettings
          compact={!wide}
          volume={soundOn ? volume : 0}
          onVolume={changeVolume}
          captions={captionsOn}
          onCaptions={setCaptionsOn}
          hasCaptions={captions.length > 0}
          appearance={appearance}
          onAppearance={(next) => onAppearance?.(next)}
        />
      ) : null;


    // O chat por cima do vídeo, com o aviso do Suporte no seu momento.
    const feedItems: LiveFeedItem[] = [
      ...chatThread.map((item) => ({
        at: item.at.getTime(),
        item: item.purchase
          ? ({ key: item.key, kind: "sale", text: `${item.author} ${item.message}`, color: socialProof?.notification_color } as const)
          : item.mine
            ? ({ key: item.key, kind: "mine", text: item.message, note: item.source ? retryNote(item.source) : null } as const)
            : ({ key: item.key, kind: "msg", author: item.author, text: item.message } as const),
      })),
      ...notices.map((at, i) => ({ at: at.getTime(), item: { key: `notice-${i}`, kind: "notice" } as const })),
    ]
      .sort((a, b) => a.at - b.at)
      .map((x) => x.item);

    // No Suporte do Live só entram as perguntas que tiveram resposta (e as respostas).
    const answered = supportThread.filter((m, i) => m.fromTeam || supportThread.slice(i + 1).some((n) => n.fromTeam));
    const liveOffer = currentOffer
      ? {
          product: currentOffer.product,
          priceFrom: currentOffer.priceFrom,
          priceNow: currentOffer.priceNow,
          button: currentOffer.button || "Quero minha vaga",
          countdown: countdownTotal > 0 ? offerRemaining : null,
          closed: offerClosed,
        }
      : null;
    const offerCardOpen = Boolean(liveOffer) && !offerMin && sheet !== "offer";

    const pin =
      !currentOffer && webinar.chat_pin_message && !pinDismissed ? (
        <div className={cn("mt-2 flex items-start gap-2 rounded-xl px-3 py-2", wide ? "bg-room-raised text-room-text" : "bg-black/40 text-white backdrop-blur-md")}>
          <Pin className="mt-0.5 size-3.5 shrink-0" />
          <p className="min-w-0 flex-1 text-[13px] leading-snug">
            <b className="font-[600]">{webinar.chat_pin_title || "Participe no chat!"}</b> {webinar.chat_pin_message}
          </p>
          <button type="button" onClick={() => setPinDismissed(true)} aria-label="Fechar" className="shrink-0 opacity-75 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      ) : null;

    // A parte de baixo: o chat, a oferta (cartão ou barra) e a caixa de escrever.
    const lower = (
      <>
        <LiveFeed
          feedRef={liveFeedRef}
          items={feedItems}
          onNotice={() => setSheet("support")}
          panel={wide}
          className={wide ? "min-h-0 flex-1 pr-0" : offerCardOpen ? "max-h-[18cqh]" : "max-h-[30cqh]"}
        />
        {pin}
        {liveOffer && offerCardOpen ? (
          <LiveOfferCard offer={liveOffer} onBuy={clickCta} onMinimize={() => setOfferMin(true)} onExpand={() => setSheet("offer")} panel={wide} />
        ) : null}
        {liveOffer && !offerCardOpen && sheet !== "offer" ? <LiveOfferSlim offer={liveOffer} onOpen={() => setSheet("offer")} /> : null}
        {mode === "replay" ? (
          <p className="mt-3 text-center text-xs text-white/75">Esta é uma gravação. O chat está fechado.</p>
        ) : (
          <LiveComposer
            value={text}
            onChange={setText}
            onSubmit={() => void sendMessage()}
            inputProps={composerInput}
            bag={liveOffer ? { blink: !offerCardOpen && sheet !== "offer", onClick: () => setSheet("offer") } : null}
            support={{ unread: supportUnread, open: sheet === "support", onClick: () => setSheet(sheet === "support" ? null : "support") }}
            onHeart={sendHeart}
            reactions={hearts}
            panel={wide}
          />
        )}
      </>
    );

    const sheets = (
      <>
        {sheet === "support" ? <LiveSupportSheet thread={answered.map((m) => ({ key: m.key, text: m.text, fromTeam: m.fromTeam }))} teamName={supportName} onClose={closeSheet} /> : null}
        {sheet === "offer" && currentOffer ? (
          <LiveOfferSheet countdown={liveOffer?.countdown ?? null} onClose={closeSheet} onSupport={() => setSheet("support")}>
            {offerPanel}
          </LiveOfferSheet>
        ) : null}
        {followSheet}
      </>
    );

    const shades = (
      <>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[120px] bg-[linear-gradient(180deg,rgba(0,0,0,.24),rgba(0,0,0,.07)_55%,transparent)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[42%]" style={{ background: LIVE_SCRIM }} />
      </>
    );

    if (wide) {
      // Computador: ecrã inteiro. O vídeo (16:9 ou 9:16) fica inteiro à esquerda, em fundo preto; o
      // painel à direita vai de cima a baixo e segue o tema da sala.
      return (
        <main
          ref={roomRef}
          className={cn("live-room-shell room-ambient min-h-dvh overflow-hidden bg-black text-room-text", theme === "light" && "room-light")}
          style={liveOfferVars(live.offerColor)}
        >
          <RoomPartsStyle />
          <LiveStyle />
          <div className="flex h-dvh">
            <section className="relative min-w-0 flex-1 overflow-hidden bg-black text-white [container-type:size]">
              {player}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[120px] bg-[linear-gradient(180deg,rgba(0,0,0,.24),rgba(0,0,0,.07)_55%,transparent)]" />
              <div className="absolute left-5 top-5 z-20 flex items-center gap-[5px]">
                {status ? <LiveBadge label={status.label} tone={status.tone} /> : null}
                {viewerCount !== null ? <LiveViewers count={viewerCount} /> : null}
              </div>
              {settings ? <div className="absolute bottom-4 right-4 z-20">{settings}</div> : null}
              {soundPrompt}
              {purchaseToast}
            </section>
            <aside className="relative flex h-full w-[400px] shrink-0 flex-col border-l border-room-line bg-room-surface">
              <LivePanelHead title={webinar.public_title} host={host} follow={follow} onHost={openFollow} />
              <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">{lower}</div>
              {sheets}
            </aside>
          </div>
          {groupDialog}
        </main>
      );
    }

    return (
      <main
        ref={roomRef}
        className={cn("live-room-shell room-ambient relative flex h-dvh flex-col overflow-hidden bg-black text-white", theme === "light" && "room-light")}
        style={liveOfferVars(live.offerColor)}
      >
        <RoomPartsStyle />
        <LiveStyle />
        <div className="relative min-h-0 flex-1 overflow-hidden bg-black [container-type:size]">
          {player}
          {shades}
          <div className="absolute inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-20">
            <LiveTopBar host={host} follow={follow} onHost={openFollow} status={status} viewers={viewerCount} extra={settings} />
          </div>
          {soundPrompt}
          {purchaseToast}
          {rotateHint && desk === "horizontal" && videoNode && !finished ? (
            <RotateHint
              onClose={() => setRotateHint(false)}
              className="absolute left-1/2 z-20 -translate-x-1/2 md:hidden landscape:hidden"
              style={{ top: "calc(30% + 28.125cqw + 14px)" }}
            />
          ) : null}
          <div className="absolute inset-x-3.5 bottom-[max(16px,env(safe-area-inset-bottom))] z-20 flex flex-col">{lower}</div>
          {sheets}
        </div>
        {groupDialog}
      </main>
    );
  }
  return (
    <main
      ref={roomRef}
      className={`${theme === "light" ? "room-light " : ""}live-room-shell room-ambient flex flex-col overflow-hidden text-room-text lg:min-h-dvh lg:overflow-visible`}
      style={liveOfferVars(live.offerColor)}
    >
      <RoomPartsStyle />
      <LiveStyle />
      <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col md:gap-4 md:p-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
        <section className="flex min-w-0 shrink-0 flex-col">
          <div
            className={cn(
              "relative ring-1 ring-room-line md:overflow-hidden md:rounded-2xl",
              "max-lg:landscape:fixed max-lg:landscape:inset-0 max-lg:landscape:z-40 max-lg:landscape:grid max-lg:landscape:place-items-center max-lg:landscape:rounded-none max-lg:landscape:bg-black max-lg:landscape:ring-0",
              theme === "light" ? "bg-room-surface" : "bg-black shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8)]",
            )}
          >
            {overlay}
            {player}
            {soundPrompt}
            {purchaseToast}
          </div>
          {rotateHint && videoNode && !finished ? (
            <div className="flex justify-center px-3 pt-2.5 md:hidden landscape:hidden">
              <RotateHint onClose={() => setRotateHint(false)} />
            </div>
          ) : null}
          <div className="md:hidden">
            <RoomTitle
              compact
              kicker=""
              title={webinar.public_title}
              host={{ name: webinar.host_name ?? "", role: webinar.host_role ?? "", avatarUrl: webinar.host_avatar_url ?? "", verified: hostVerified }}
              follow={follow ? <FollowButton label={follow.label} onClick={follow.onClick} /> : null}
              onHost={openFollow}
            />
          </div>
          <div className="hidden px-1 md:block">
            <RoomTitle
              kicker={
                waiting ? "Sessão agendada" : finished ? "Sessão terminada" : mode === "live" ? "Sessão ao vivo" : "Sessão em replay"
              }
              title={webinar.public_title}
              host={{ name: webinar.host_name ?? "", role: webinar.host_role ?? "", avatarUrl: webinar.host_avatar_url ?? "", verified: hostVerified }}
              follow={follow ? <FollowButton big label={follow.label} onClick={follow.onClick} /> : null}
              onHost={openFollow}
            />
            {webinar.description ? (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-room-subtle">{webinar.description}</p>
            ) : null}
          </div>
        </section>
        <aside className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:rounded-2xl lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)]">
          {panel}
          {/* As redes abrem por cima do painel, como no Live. */}
          {followSheet}
        </aside>
      </div>
      {groupDialog}
    </main>
  );
}
