import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { cn, isHttpUrl } from "@/lib/utils";

type Props = {
  url: string | null;
  /** «cover» enche a moldura (corta o que sobra); «contain» mostra o vídeo inteiro, com preto à volta. */
  fit?: "cover" | "contain";
  provider?: string | null;
  controls: boolean;
  onTime: (seconds: number) => void;
  /** Chamado quando o vídeo chega ao fim. */
  onEnded?: () => void;
  /** Chamado quando a reprodução pausa (antes de qualquer retoma automática). */
  onPause?: () => void;
  /** Confirma que a reprodução começou de facto. */
  onPlaying?: () => void;
  /** Dá ao ecrã da sala acesso ao leitor para autorizar o áudio no toque inicial. */
  mediaRef?: RefObject<HTMLVideoElement | null>;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  quiet?: boolean;
  loop?: boolean;
  /** Segundo em que o vídeo deve arrancar (sincronizar com a hora da sessão). */
  startAtSeconds?: number;
  /**
   * Segundo em que o vídeo deveria estar agora, segundo o relógio da sessão.
   * Quando definido, o leitor corrige desvios (sair e voltar ao separador,
   * bloquear o telemóvel, falhas de rede) apanhando o momento real.
   */
  liveTargetSeconds?: number | null;
  /** Desvio tolerado antes de corrigir, em segundos. */
  syncToleranceSeconds?: number;
  /** Tema visual do leitor. */
  theme?: "dark" | "light";
};

function embedUrl(url: string, provider?: string | null): string | null {
  const lower = url.toLowerCase();
  if (provider === "vimeo" || lower.includes("vimeo.com")) {
    const id = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
    if (id) return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&controls=0`;
    if (lower.includes("player.vimeo.com")) {
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}autoplay=1&muted=1&controls=0`;
    }
  }
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
    const id = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/)?.[1];
    if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&playsinline=1`;
  }
  if (provider === "bunny" || lower.includes("iframe.mediadelivery.net")) {
    if (lower.includes("iframe.mediadelivery.net")) {
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}autoplay=true&muted=true&preload=true`;
    }
  }
  if (provider === "panda" || lower.includes("pandavideo")) {
    if (lower.includes("player") || lower.includes("embed")) {
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}autoplay=true&muted=true`;
    }
  }
  if (lower.includes("/embed/") || lower.includes("player.")) return url;
  return null;
}

function browserVideoUrl(url: string, provider?: string | null): string {
  const isBunnyCdnFile = /\/\/[^/]*b-cdn\.net\/[0-9a-f-]+\/play_[^/]+\.mp4(?:\?.*)?$/i.test(url);
  if ((provider === "bunny" || provider === "hls") && isBunnyCdnFile) {
    return url.replace(/play_[^/]+\.mp4(?:\?.*)?$/i, "playlist.m3u8");
  }
  return url;
}

const frameClass = "aspect-video w-full rounded-md bg-foreground/90";

export function VideoPlayer({
  url,
  provider,
  controls,
  onTime,
  onEnded,
  onPause,
  onPlaying,
  mediaRef,
  className,
  autoPlay = true,
  muted = true,
  quiet = false,
  loop = false,
  startAtSeconds = 0,
  liveTargetSeconds = null,
  syncToleranceSeconds = 4,
  theme = "dark",
  fit = "cover",
}: Props) {
  const ownVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = mediaRef ?? ownVideoRef;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seekedRef = useRef(false);
  const targetRef = useRef<number | null>(liveTargetSeconds);
  const hlsRef = useRef<{ startLoad: () => void; recoverMediaError: () => void } | null>(null);
  const recoveryRef = useRef(0);
  const [failed, setFailed] = useState(false);
  const [playbackVisible, setPlaybackVisible] = useState(controls);
  const valid = isHttpUrl(url);
  const embed = valid ? embedUrl(url, provider) : null;
  const playbackUrl = valid ? browserVideoUrl(url, provider) : "";
  const isHls = valid && !embed && playbackUrl.toLowerCase().includes(".m3u8");

  targetRef.current = liveTargetSeconds;

  useEffect(() => {
    setFailed(false);
    setPlaybackVisible(controls);
    seekedRef.current = false;
    recoveryRef.current = 0;
  }, [controls, url]);

  // Corrige o desvio entre o relógio da sessão e o vídeo. Sem isto, quem sai e
  // volta (separador em segundo plano, telemóvel bloqueado, falha de rede) fica
  // com a imagem atrás do chat e da oferta — parece que o vídeo travou.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || controls) return;

    const resync = (force = false) => {
      const target = targetRef.current;
      if (target == null || !Number.isFinite(target)) return;
      const duration = video.duration;
      const limit = Number.isFinite(duration) && duration > 0 ? duration - 0.5 : undefined;
      const wanted = limit !== undefined ? Math.min(target, limit) : target;
      if (wanted < 0) return;
      const drift = wanted - video.currentTime;
      if (!force && Math.abs(drift) < syncToleranceSeconds) return;
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) return;
      video.currentTime = wanted;
    };

    const wake = () => {
      if (document.visibilityState !== "visible") return;
      resync();
      if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) hlsRef.current?.startLoad();
      if (autoPlay && video.paused) void video.play().catch(() => undefined);
    };


    const interval = window.setInterval(() => resync(), 2000);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    video.addEventListener("stalled", wake);
    video.addEventListener("waiting", wake);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
      video.removeEventListener("stalled", wake);
      video.removeEventListener("waiting", wake);
    };
  }, [autoPlay, controls, syncToleranceSeconds, url]);


  // Mantém o leitor carregado e garante a reprodução assim que a sala o arma.
  // Durante a passagem ele arranca mudo atrás do preto, evitando bloqueios de autoplay.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!autoPlay) {
      video.pause();
      return;
    }

    let active = true;
    const ensurePlaying = async () => {
      if (!active || !video.paused) return;
      video.muted = muted;
      try {
        await video.play();
      } catch {
        // Se o navegador bloquear o arranque com áudio, começa mudo em vez de
        // deixar uma imagem parada. O som volta a ser tentado logo a seguir.
        video.muted = true;
        await video.play().catch(() => undefined);
      }
    };

    video.muted = muted;
    if (!muted) video.volume = 1;
    void ensurePlaying();
    const retry = window.setInterval(() => void ensurePlaying(), 350);
    video.addEventListener("canplay", ensurePlaying);
    video.addEventListener("pause", ensurePlaying);
    return () => {
      active = false;
      window.clearInterval(retry);
      video.removeEventListener("canplay", ensurePlaying);
      video.removeEventListener("pause", ensurePlaying);
    };
  }, [autoPlay, muted]);

  // Na sala ao vivo, a imagem é desenhada num canvas e o elemento de vídeo fica
  // fora da superfície visível. Assim nenhum navegador consegue sobrepor os
  // seus próprios botões de play/pause durante carregamentos ou atualizações.
  useEffect(() => {
    if (controls) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let frame = 0;
    const paint = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const width = Math.max(1, canvas.clientWidth);
        const height = Math.max(1, canvas.clientHeight);
        const ratio = window.devicePixelRatio || 1;
        const pixelWidth = Math.round(width * ratio);
        const pixelHeight = Math.round(height * ratio);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
        }
        const context = canvas.getContext("2d");
        if (context) {
          if (theme === "light") {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, pixelWidth, pixelHeight);
          } else if (fit === "contain") {
            context.clearRect(0, 0, pixelWidth, pixelHeight);
          }
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            const scale = (fit === "contain" ? Math.min : Math.max)(pixelWidth / video.videoWidth, pixelHeight / video.videoHeight);
            const drawWidth = video.videoWidth * scale;
            const drawHeight = video.videoHeight * scale;
            context.drawImage(
              video,
              (pixelWidth - drawWidth) / 2,
              (pixelHeight - drawHeight) / 2,
              drawWidth,
              drawHeight,
            );
          }
          setPlaybackVisible(true);
        }
      }
      frame = window.requestAnimationFrame(paint);
    };
    frame = window.requestAnimationFrame(paint);
    return () => window.cancelAnimationFrame(frame);
  }, [controls, theme, fit]);


  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isHls || !valid) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playbackUrl;
      return;
    }
    let destroy: (() => void) | undefined;
    void import("hls.js").then(({ default: Hls }) => {
      if (!Hls.isSupported()) {
        setFailed(true);
        return;
      }
      // Sem limitar a qualidade ao tamanho do elemento: a imagem é desenhada
      // num canvas em ecrã inteiro, por isso queremos sempre a resolução máxima.
      const hls = new Hls({
        capLevelToPlayerSize: false,
        startLevel: -1,
        maxBufferLength: 30,
      });
      hls.autoLevelCapping = -1;
      hlsRef.current = hls;
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const best = hls.levels.length - 1;
        if (best >= 0) {
          hls.startLevel = best;
        }
        if (autoPlay) void video.play().catch(() => undefined);
      });
      // Antes de desistir, tentamos recuperar: falhas de rede recarregam o
      // fluxo, falhas de imagem são reparadas pelo próprio motor. Só depois de
      // várias tentativas é que o participante vê uma mensagem de erro.
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (recoveryRef.current >= 6) {
          setFailed(true);
          return;
        }
        recoveryRef.current += 1;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }
        setFailed(true);
      });
      destroy = () => {
        hlsRef.current = null;
        hls.destroy();
      };
    });
    return () => destroy?.();
  }, [autoPlay, isHls, playbackUrl, valid]);


  const cls = cn(frameClass, className);

  const quietFallback = (
    <div className={cn(cls, "relative flex items-center justify-center overflow-hidden", theme === "light" ? "bg-room-surface" : "bg-black")}>
      <div className={cn("absolute inset-0", theme === "light" ? "bg-gradient-to-br from-room-text/[0.03] to-transparent" : "bg-gradient-to-br from-white/5 to-transparent")} />
      <div className={cn("relative flex size-16 items-center justify-center rounded-full shadow-lg ring-1 backdrop-blur-md", theme === "light" ? "bg-room-text/10 text-room-text ring-room-line" : "bg-white/10 text-white ring-white/20")}>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M8 5v14l11-7L8 5z" />
        </svg>
      </div>
    </div>
  );

  if (!valid)
    return quiet ? (
      quietFallback
    ) : (
      <div
        className={cn(
          cls,
          "flex items-center justify-center px-6 text-center text-sm text-background/70",
        )}
      >
        O vídeo deste webinar não tem um endereço válido. Abra a Biblioteca e guarde o link do vídeo
        (começado por https://).
      </div>
    );

  if (embed)
    return (
      <iframe
        src={embed}
        title="Vídeo do webinar"
        className={cls}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
      />
    );

  if (failed)
    return quiet ? (
      quietFallback
    ) : (
      <div
        className={cn(
          cls,
          "flex items-center justify-center px-6 text-center text-sm text-background/70",
        )}
      >
        Não foi possível reproduzir este vídeo. Verifique o link na Biblioteca.
      </div>
    );

  const videoElement = (
    <video
      ref={videoRef}
      {...(isHls ? {} : { src: playbackUrl })}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      playsInline
      preload="auto"
      disablePictureInPicture
      controlsList="nodownload noplaybackrate noremoteplayback"
      className={controls ? cn(cls, "object-cover") : "nw-live-video pointer-events-none absolute inset-0 size-full object-cover opacity-0"}
      onLoadedMetadata={(e) => {
        const video = e.currentTarget;
        const wanted = targetRef.current ?? startAtSeconds;
        if (wanted > 0 && !seekedRef.current && Number.isFinite(video.duration)) {
          seekedRef.current = true;
          video.currentTime = Math.min(wanted, Math.max(0, video.duration - 1));
        }
        if (autoPlay) void video.play().catch(() => undefined);
      }}
      tabIndex={-1}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (controls) return;
        e.preventDefault();
        const video = e.currentTarget;
        if (video.paused) void video.play().catch(() => undefined);
      }}
      onPause={(e) => {
        onPause?.();
        if (controls || !autoPlay) return;
        void e.currentTarget.play().catch(() => undefined);
      }}
      onError={(e) => {
        // Uma falha isolada do ficheiro (rede a oscilar, sessão retomada) não
        // deve terminar a transmissão: recarregamos antes de mostrar erro.
        if (recoveryRef.current >= 3) {
          setFailed(true);
          return;
        }
        recoveryRef.current += 1;
        const video = e.currentTarget;
        window.setTimeout(() => {
          video.load();
          if (autoPlay) void video.play().catch(() => undefined);
        }, 800);
      }}

      onTimeUpdate={(e) => onTime(Math.floor(e.currentTarget.currentTime))}
      onPlaying={() => {
        onPlaying?.();
      }}
      onEnded={() => onEnded?.()}
    />
  );

  if (controls) return videoElement;

  return (
    <div className={cn(cls, "relative overflow-hidden", theme === "light" ? "bg-room-surface" : "bg-black")}>
      {videoElement}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={cn("absolute inset-0 size-full", !playbackVisible && "opacity-0")}
      />
    </div>
  );
}
