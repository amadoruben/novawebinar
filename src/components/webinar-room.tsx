import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  BadgeCheck,
  Eye,
  Headset,
  Heart,
  MessagesSquare,
  Pin,
  Play,
  Radio,
  Settings,
  ShoppingCart,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useHearts, useLivePresence } from "@/lib/live-presence";
import { Input } from "@/components/ui/input";
import { VideoPlayer } from "@/components/video-player";
import { ctaButtonClass } from "@/lib/cta-colors";
import { useAudienceCount } from "@/components/audience-counter";
import { cn } from "@/lib/utils";
import { PreliveCountdown, unlockPreliveAudio } from "@/components/prelive-countdown";

type Mode = "live" | "replay";
type Tab = "chat" | "support" | "offer";
type SentMessage = { text: string; at: Date };

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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

// Tom fixo por nome: cada pessoa tem sempre a mesma cor de avatar na sala.
function avatarTone(name: string) {
  const palette = [
    "bg-blue-500/15 text-blue-500",
    "bg-emerald-500/15 text-emerald-600",
    "bg-amber-500/15 text-amber-600",
    "bg-rose-500/15 text-rose-500",
    "bg-violet-500/15 text-violet-500",
    "bg-sky-500/15 text-sky-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function formatMessageTime(value: string | number | Date | null | undefined) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

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
}: {
  webinar: RoomWebinar;
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
  onProgress?: (seconds: number, peakSeconds?: number, options?: { final?: boolean }) => void;
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
  const [showSettings, setShowSettings] = useState(false);
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
  const flushProgress = useCallback((options?: { final?: boolean }) => {
    onProgressRef.current?.(
      Math.round(contentSecondsRef.current),
      Math.round(contentPeakRef.current),
      options,
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

  const ctaStart = webinar.cta_start_seconds ?? 0;
  // Sem hora de fim definida (ou com um fim anterior ao início, por engano),
  // a oferta fica visível até ao final da sessão.
  const ctaEndRaw = webinar.cta_end_seconds;
  const ctaEnd =
    ctaEndRaw != null && ctaEndRaw > ctaStart ? ctaEndRaw : Number.POSITIVE_INFINITY;
  // A oferta segue o vídeo: abre quando a pessoa chega ao momento configurado.
  // Quem recua depois de a ter vista não a perde (já foi entregue).
  const ctaSeenRef = useRef(false);
  if (Boolean(webinar.cta_text) && contentPeak >= ctaStart && contentPeak <= ctaEnd) {
    ctaSeenRef.current = true;
  }
  const ctaVisible =
    Boolean(webinar.cta_text) && !waiting && ctaSeenRef.current && contentPeak <= ctaEnd;

  useEffect(() => {
    if (!ctaVisible || ctaLogged) return;
    setCtaLogged(true);
    onCtaView?.();
  }, [ctaVisible, ctaLogged, onCtaView]);

  // Quando a oferta abre, o separador dela salta para a frente.
  useEffect(() => {
    if (ctaVisible) setTab("offer");
    else setTab((prev) => (prev === "offer" ? "chat" : prev));
  }, [ctaVisible]);

  // Contador regressivo da oferta. Fixa-se ao relógio real no instante em que a
  // oferta abre, para continuar a andar mesmo depois de a transmissão terminar
  // (aí o relógio da sessão fica parado no fim do vídeo).
  const countdownTotal = webinar.cta_countdown_seconds ?? 0;
  const offerWallStartRef = useRef<number | null>(null);
  if (ctaVisible && offerWallStartRef.current === null) {
    offerWallStartRef.current = Date.now() - Math.max(0, contentPeak - ctaStart) * 1000;
  }
  if (!ctaVisible) offerWallStartRef.current = null;
  const offerElapsed = offerWallStartRef.current
    ? (now - offerWallStartRef.current) / 1000
    : Math.max(0, contentPeak - ctaStart);
  const offerRemaining = Math.max(0, Math.round(countdownTotal - offerElapsed));
  const offerClock = `${String(Math.floor(offerRemaining / 60)).padStart(2, "0")}:${String(offerRemaining % 60).padStart(2, "0")}`;

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

  const purchaseToast = activePurchase ? (
    <div
      className={`pointer-events-none absolute z-20 max-w-[min(20rem,80%)] rounded-2xl p-3 shadow-lg ring-1 backdrop-blur ${proofColor.panel} ${proofColor.ring} ${proofPosition} ${proofAnimation}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/25 text-white">
          <ShoppingCart className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {activePurchase.buyer_name}{" "}
            <span className="font-normal text-white/85">
              {activePurchase.message || `comprou ${activePurchase.product_name}`}
            </span>
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

  const clickCta = () => {
    setCheckout(true);
    onCtaClick?.();
    if (webinar.cta_url) window.open(webinar.cta_url, "_blank", "noopener");
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    setSent((prev) => [...prev, { text: body, at: new Date() }]);
    await onSend(body);
  };

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
      <span className="flex items-center overflow-hidden rounded-lg shadow-lg shadow-black/25">
        {prelive ? null : (
          <span className="flex items-center gap-1 bg-destructive px-2 py-1 text-[11px] font-semibold text-destructive-foreground">
            <Radio className="size-3 shrink-0 animate-pulse" aria-hidden />
            {waiting ? "Em breve" : finished ? "Terminou" : mode === "live" ? "Ao Vivo" : "Replay"}
          </span>
        )}
        {!finished ? (
          <span className="flex items-center gap-1 bg-card px-2 py-1 text-[11px] font-semibold tabular-nums text-foreground">
            <Eye className="size-3 shrink-0 text-muted-foreground" aria-hidden />
            {(prelive ? preliveViewers : viewers).toLocaleString("pt-PT")}
          </span>
        ) : null}
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

  // Controlos próprios do leitor: som e definições. Aparecem ao passar o rato
  // sobre o vídeo, sem nunca mostrar botões de play/pause nativos.
  const isMuted = !soundOn || volume === 0;
  const videoControls = videoNode ? (
    <div
      className="group absolute inset-0 z-30 hidden cursor-default sm:block"
      onMouseLeave={() => setShowSettings(false)}
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 via-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-end gap-2 px-3 pb-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="pointer-events-auto flex h-8 items-center gap-2 rounded-lg bg-black/60 px-2 text-white ring-1 ring-white/10 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => {
              if (!soundOn) {
                enableSound();
                setVolume(volume > 0 ? volume : 1);
              } else {
                setVolume(isMuted ? 1 : 0);
              }
            }}
            className="flex size-7 items-center justify-center rounded-md hover:bg-white/10"
            aria-label={isMuted ? "Ligar som" : "Desligar som"}
          >
            {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <div className="relative flex h-1 w-20 cursor-pointer items-center rounded-full bg-white/25" role="slider" aria-label="Volume" aria-valuenow={Math.round(volume * 100)} aria-valuemin={0} aria-valuemax={100}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => {
                const next = Number(e.target.value);
                setVolume(next);
                if (next > 0 && !soundOn) enableSound();
              }}
              className="h-full w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
            />
            <div
              className="pointer-events-none absolute h-1 rounded-full bg-white"
              style={{ width: `${volume * 100}%` }}
            />
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className="pointer-events-auto flex size-8 items-center justify-center rounded-lg bg-black/60 text-white ring-1 ring-white/10 backdrop-blur-sm hover:bg-black/80"
            aria-label="Definições"
          >
            <Settings className="size-4" />
          </button>
          {showSettings && (
            <div className="absolute bottom-full right-0 mb-2 w-44 rounded-xl border border-white/10 bg-black/85 p-2 text-white shadow-2xl ring-1 ring-black/50 backdrop-blur-md">
              <p className="px-2 text-[10px] text-white/50">Qualidade: Automático</p>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const needsAudioUnlock =
    !soundOn && !prelive && !waiting && !finished && Boolean(webinar.video_url);

  const liveArea = (
    <div className={cn("relative aspect-video overflow-hidden", theme === "light" ? "bg-room-surface" : "bg-black")}>
      <div
        className={cn(
          "relative h-full w-full",
          needsAudioUnlock && "blur-[6px] brightness-[0.85]",
        )}
      >
        {/* O leitor só é montado quando a transmissão está armada. Isto impede o
            navegador de desenhar um botão nativo por cima da contagem no refresh. */}
        {videoArmed && videoNode}
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
        {!showPrelive && !needsAudioUnlock && videoControls}
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
    <div className="flex aspect-video flex-col items-center justify-center gap-5 px-6 text-center">
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
  ) : finished ? (
    <div className="flex aspect-video flex-col items-center justify-center gap-4 px-6 text-center text-white">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
        Transmissão terminou
      </p>
      <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
        Obrigado por ter estado connosco
      </h2>
      <p className="max-w-md text-sm text-white/80">
        A sessão ao vivo chegou ao fim.{" "}
        {ctaVisible
          ? "A oferta continua disponível no separador Oferta."
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
      fromTeam: m.sender_kind === "team",
    }));
    const known = new Set(stored.filter((m) => !m.fromTeam).map((m) => m.text));
    const pending = sent
      .filter((m) => !known.has(m.text))
      .map((m, index) => ({ key: `pending-${index}`, text: m.text, at: m.at, fromTeam: false }));
    return [...stored, ...pending].sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [supportMessages, sent]);

  /** Compras já anunciadas: entram no chat no seu momento, com a hora correta. */
  const purchaseFeed = useMemo(() => {
    if (!socialProof?.enabled || waiting) return [];
    return proofSchedule
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
        };
      });
  }, [proofSchedule, socialProof?.enabled, activePurchase, waiting]);

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
      })),
    ];
    return items.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [visibleComments, commentArrival, sent, viewerName, purchaseFeed]);


  const feed = (
    <div ref={feedRef} className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
      {tab === "chat" ? (
        chatThread.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <MessagesSquare className="size-5 text-room-subtle" />
          </div>
        ) : (
          <>
            {chatThread.map((item) =>
              item.purchase ? (
                <div
                  key={item.key}
                  className="flex items-center gap-2.5 rounded-xl bg-emerald-500/10 px-3 py-2 ring-1 ring-emerald-500/30"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-500">
                    <ShoppingCart className="size-3.5" />
                  </span>
                  <p className="min-w-0 break-words text-[14px] leading-snug text-room-text">
                    <span className="mr-1.5 font-semibold text-emerald-500">{item.author}</span>
                    {item.message}
                  </p>
                </div>
              ) : item.mine ? (

                <div key={item.key} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {initials(viewerName || "EU")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">
                      <span className="mr-1.5 font-semibold text-room-subtle">
                        {viewerName ? `${viewerName} (Eu)` : "Eu"}
                      </span>
                      <span className="text-[11px] tabular-nums text-room-subtle">
                        {formatMessageTime(item.at)}
                      </span>
                    </p>
                    <p className="mt-0.5 break-words text-sm leading-relaxed text-room-text">
                      {item.message}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={item.key} className="flex items-start gap-3">
                  {item.avatarUrl ? (
                    <img
                      src={item.avatarUrl}
                      alt=""
                      className="mt-0.5 size-8 shrink-0 rounded-full object-cover ring-1 ring-room-line"
                    />
                  ) : (
                    <span
                      className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1 ring-room-line ${avatarTone(item.author)}`}
                    >
                      {initials(item.author)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">
                      <span className="mr-1.5 font-semibold text-room-subtle">{item.author}</span>
                      <span className="text-[11px] tabular-nums text-room-subtle">
                        {formatMessageTime(item.at)}
                      </span>
                    </p>
                    <p className="mt-0.5 break-words text-sm leading-relaxed text-room-text">
                      {item.message}
                    </p>
                  </div>
                </div>
              ),
            )}
          </>
        )
      ) : (
        <>
          {supportThread.length === 0 ? (
            <p className="px-1 text-center text-[13px] text-room-subtle">
              Escreva à equipa. A resposta aparece aqui, só para si.
            </p>
          ) : null}
          {supportThread.map((message) =>
            message.fromTeam ? (
              <div
                key={message.key}
                className="mr-auto flex max-w-[85%] flex-col items-start gap-1"
              >
                <div className="w-fit rounded-2xl rounded-bl-md bg-room-raised px-3.5 py-2 text-sm font-medium text-room-text ring-1 ring-room-line">
                  {message.text}
                </div>
                <span className="px-1 text-[10px] tabular-nums text-room-subtle">
                  Suporte · {formatMessageTime(message.at)}
                </span>
              </div>
            ) : (
              <div key={message.key} className="ml-auto flex max-w-[85%] flex-col items-end gap-1">
                <div className="w-fit rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground">
                  {message.text}
                </div>
                <span className="px-1 text-[10px] tabular-nums text-room-subtle">
                  {formatMessageTime(message.at)}
                </span>
              </div>
            ),
          )}
        </>
      )}
    </div>
  );

  const offerPanel = (
    <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
      {webinar.cta_image_url ? (
        <img
          src={webinar.cta_image_url}
          alt={webinar.cta_text ?? "Oferta"}
          className="w-full rounded-xl object-cover ring-1 ring-room-line"
        />
      ) : null}
      {(webinar.cta_price_original || webinar.cta_price_now) && (
        <div className="space-y-1 border-t border-room-line pt-4">
          {webinar.cta_price_original && (
            <p className="text-sm font-bold text-room-subtle line-through">
              De {webinar.cta_price_original}
            </p>
          )}
          {webinar.cta_price_now && (
            <p className="text-2xl font-black tracking-tight text-room-text">
              Por {webinar.cta_price_now}
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={clickCta}
        className={`flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-4 text-base font-black uppercase tracking-wide transition hover:brightness-105 ${ctaButtonClass(webinar.cta_color)}`}
      >
        <ShoppingCart className="size-5" />
        {webinar.cta_text}
      </button>
      {countdownTotal > 0 && (
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-room-subtle">
            {offerRemaining > 0 ? "Oferta termina em" : "Tempo esgotado"}
          </p>
          <p className="text-4xl font-black tabular-nums text-room-text">{offerClock}</p>
        </div>
      )}
    </div>
  );

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
        <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl bg-destructive/10 px-3 py-2 ring-1 ring-destructive/25">
          <div className="flex min-w-0 items-center gap-2">
            <Pin className="size-3.5 shrink-0 text-destructive" />
            <p className="truncate text-sm font-semibold text-room-text">
              {webinar.offer_pin_title?.trim() || "Vagas abertas :"}
            </p>
            {webinar.cta_url ? (
              <a
                href={webinar.cta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-[13px] font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {webinar.offer_pin_message?.trim() || webinar.cta_url}
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
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl bg-destructive/10 px-4 py-3.5 ring-1 ring-destructive/25">
          <Pin className="mt-0.5 size-4 shrink-0 text-destructive" />
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

  const panel = (
    <div className="flex min-h-0 flex-1 flex-col bg-room-surface text-room-text lg:rounded-2xl lg:ring-1 lg:ring-room-line">
      <div className="mx-3 -mt-2 mb-0 flex items-center gap-1 border-b border-room-line lg:mt-0">
        {(
          [
            ["chat", "Chat", MessagesSquare],
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
      <form
        className={`${tab === "offer" || mode === "replay" ? "hidden " : "flex "}gap-2 border-t border-room-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`}
        onSubmit={sendMessage}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            const viewport = window.visualViewport;
            const room = roomRef.current;
            if (viewport && room && !window.matchMedia("(min-width: 1024px)").matches) {
              room.classList.add("live-room-shell--keyboard");
              room.style.setProperty("--room-visible-height", `${Math.round(viewport.height)}px`);
              room.style.setProperty("--room-visible-top", `${Math.round(viewport.offsetTop)}px`);
              window.scrollTo({ top: 0, behavior: "instant" });
            }
            window.setTimeout(() => {
              const node = feedRef.current;
              if (node) node.scrollTop = node.scrollHeight;
            }, 180);
          }}
          onBlur={() => {
            roomRef.current?.classList.remove("live-room-shell--keyboard");
          }}
          placeholder="Escreva um comentário..."
          enterKeyHint="send"
          className="h-11 rounded-full border-room-line bg-room-raised px-4 text-base text-room-text placeholder:text-room-subtle focus-visible:ring-primary/40"
        />
        <button
          type="button"
          onClick={sendHeart}
          aria-label="Enviar coração"
          title="Enviar coração"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-room-raised text-rose-500 ring-1 ring-room-line transition hover:scale-110 hover:bg-rose-500/15 active:scale-95"
        >
          <Heart className="size-5 fill-current" />
        </button>
        <button
          type="submit"
          aria-label="Enviar"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:brightness-110"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );

  return (
    <main
      ref={roomRef}
      className={`${theme === "light" ? "room-light " : ""}live-room-shell room-ambient flex flex-col overflow-hidden text-room-text lg:min-h-dvh lg:overflow-visible`}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6 lg:p-6">
        <section className="flex min-w-0 shrink-0 flex-col">
          <div className={`relative ring-1 ring-room-line lg:overflow-hidden lg:rounded-2xl ${theme === "light" ? "bg-room-surface" : "bg-black shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8)]"}`}>
            {overlay}
            {player}
            {soundPrompt}
            {purchaseToast}
            <div className="pointer-events-none absolute bottom-2 right-6 z-20 h-56 w-24 overflow-hidden">
              {hearts.map((heart) => (
                <Heart
                  key={heart.id}
                  className="nw-heart absolute bottom-0 left-1/2 size-7 fill-rose-500 text-rose-500 drop-shadow"
                  style={{ marginLeft: `${heart.offset}px` }}
                />
              ))}
            </div>
          </div>
          <div className="px-5 pb-2 pt-1 lg:px-1 lg:pb-0 lg:pt-6">
            <p className="hidden text-[11px] font-bold uppercase tracking-[0.22em] text-primary lg:block">
              {waiting
                ? "Sessão agendada"
                : finished
                  ? "Sessão terminada"
                  : mode === "live"
                    ? "Sessão ao vivo"
                    : "Sessão em replay"}
            </p>
            <h1 className="hidden text-lg font-bold leading-snug tracking-tight text-room-text lg:mt-1.5 lg:block lg:text-2xl lg:font-extrabold">
              {webinar.public_title}
            </h1>
            {webinar.host_name ? (
              <div className="mt-0 flex items-center gap-3 lg:mt-3.5">
                {webinar.host_avatar_url ? (
                  <img
                    src={webinar.host_avatar_url}
                    alt={webinar.host_name}
                    className="size-10 shrink-0 rounded-full object-cover ring-1 ring-room-line"
                  />
                ) : (
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarTone(webinar.host_name)}`}
                  >
                    {initials(webinar.host_name) || webinar.host_name[0]?.toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-room-text">
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="truncate">{webinar.host_name}</span>
                      <BadgeCheck
                        className="size-4 shrink-0 fill-[#0095f6] text-room-surface"
                        aria-label="Verificado"
                      />
                    </span>
                  </p>
                  {webinar.host_role ? (
                    <p className="truncate text-xs text-room-subtle">{webinar.host_role}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {webinar.description && (
              <p className="mt-3.5 hidden max-w-2xl text-sm leading-relaxed text-room-subtle lg:block">
                {webinar.description}
              </p>
            )}
          </div>
        </section>
        <aside className="flex min-h-0 flex-1 flex-col overflow-hidden lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)]">
          {panel}
        </aside>
      </div>
    </main>
  );
}
