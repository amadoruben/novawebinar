import { useEffect, useRef } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  countdownParts,
  normalizeAppearance,
  templateById,
  type PreliveAppearance,
  type PreliveTemplateId,
} from "@/lib/prelive-templates";
import trackOne from "@/assets/local/Event_Countdown.mp3";
import trackTwo from "@/assets/local/Countdown_to_Impact.mp3";
import trackThree from "@/assets/local/Countdown_to_Impact-2.mp3";
import trackFour from "@/assets/local/Countdown_Impact.mp3";

/** As quatro faixas tocam por ordem e recomeçam se a contagem for mais longa. */
const PLAYLIST = [trackOne, trackTwo, trackThree, trackFour];

/** Seis segundos inteiros de descida, terminando em silêncio antes da mudança de imagem. */
const FADE_TRIGGER_SECONDS = 6;
const FADE_DURATION_MS = 5600;

let audioUnlocked = false;

/**
 * Tem de ser chamada diretamente pelo clique da pessoa, senão o navegador
 * mantém o áudio bloqueado.
 */
export function unlockPreliveAudio() {
  audioUnlocked = true;
}

/** Sequência das faixas de evento, em ciclo, com fecho suave no fim da contagem. */
function useAmbientSound(active: boolean, remaining: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const indexRef = useRef(0);
  const fadingRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (typeof Audio === "undefined") return;
    if (!audioUnlocked) audioUnlocked = true;

    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = 0.9;
    audioRef.current = audio;
    fadingRef.current = false;

    const playCurrent = () => {
      const source = PLAYLIST[indexRef.current % PLAYLIST.length] ?? PLAYLIST[0];
      if (!source) return;
      audio.src = source;
      void audio.play().catch(() => {
        /* o navegador ainda não permite som */
      });
    };
    const next = () => {
      indexRef.current += 1;
      playCurrent();
    };
    audio.addEventListener("ended", next);
    playCurrent();

    // Alguns navegadores (sobretudo no telemóvel) pausam esta música quando
    // outro leitor toca. Se isso acontecer antes do fecho, retomamos sozinhos.
    const watchdog = window.setInterval(() => {
      const current = audioRef.current;
      if (!current || fadingRef.current) return;
      if (current.paused && current.src) {
        void current.play().catch(() => undefined);
      }
    }, 700);

    return () => {
      window.clearInterval(watchdog);
      audio.removeEventListener("ended", next);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };

  }, [active]);

  // Fecho suave: a música desce aos poucos nos últimos segundos, até ao silêncio.
  const fadeStarted = active && remaining >= 0 && remaining <= FADE_TRIGGER_SECONDS;
  useEffect(() => {
    const audio = audioRef.current;
    if (!fadeStarted || !audio) return;
    if (fadingRef.current) return;
    fadingRef.current = true;

    const from = Math.max(audio.volume, 0.9);
    const startedAt = performance.now();
    let frame = 0;

    // Curva em duas fases: a descida é claramente audível desde o início, mas
    // conserva corpo; nos dois segundos finais fecha com força e sem corte.
    const fadeFrame = (now: number) => {
      const current = audioRef.current;
      if (!current) return;
      const ratio = Math.min(1, (now - startedAt) / FADE_DURATION_MS);
      const level =
        ratio < 0.6
          ? 1 - 0.42 * (ratio / 0.6)
          : 0.58 * (1 - (ratio - 0.6) / 0.4) ** 2;
      current.volume = Math.max(0, Math.min(1, from * level));
      if (ratio >= 1) {
        current.volume = 0;
        current.pause();
        return;
      }
      frame = window.requestAnimationFrame(fadeFrame);
    };
    frame = window.requestAnimationFrame(fadeFrame);

    return () => window.cancelAnimationFrame(frame);
  }, [fadeStarted]);

}

function clock(total: number) {
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/** Tamanhos dos números por opção de tamanho, iguais em todos os modelos. */
const DIGIT_SIZE: Record<PreliveAppearance["size"], string> = {
  sm: "text-2xl sm:text-4xl",
  md: "text-3xl sm:text-5xl",
  lg: "text-4xl sm:text-7xl",
};

type ViewProps = {
  remaining: number;
  total: number;
  message: string;
  appearance: PreliveAppearance;
};

function Digits({
  remaining,
  appearance,
  className,
  labels = true,
}: {
  remaining: number;
  appearance: PreliveAppearance;
  className?: string;
  labels?: boolean;
}) {
  const parts = countdownParts(remaining, appearance);
  return (
    <div className={cn("flex items-end gap-2 sm:gap-3", className)}>
      {parts.map((part, index) => (
        <div key={part.key} className="flex items-end gap-2 sm:gap-3">
          {index > 0 ? (
            <span className={cn("pb-1 opacity-35", DIGIT_SIZE[appearance.size])}>:</span>
          ) : null}
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "font-black tabular-nums leading-none tracking-tight",
                DIGIT_SIZE[appearance.size],
              )}
            >
              {part.value}
            </span>
            {labels ? (
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] opacity-60 sm:text-[10px]">
                {part.label}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function Texts({ message, appearance }: { message: string; appearance: PreliveAppearance }) {
  const title = appearance.title.trim() || message;
  return (
    <div className={cn("space-y-1", appearance.align === "left" ? "text-left" : "text-center")}>
      {title ? (
        <p className="line-clamp-2 max-w-md text-sm font-semibold sm:text-lg">{title}</p>
      ) : null}
      {appearance.subtitle ? (
        <p className="line-clamp-2 max-w-md text-xs opacity-70 sm:text-sm">{appearance.subtitle}</p>
      ) : null}
    </div>
  );
}

function Shell({
  children,
  appearance,
  className,
}: {
  children: React.ReactNode;
  appearance: PreliveAppearance;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prelive-dark relative flex aspect-video items-center overflow-hidden bg-room-bg px-4 text-room-text sm:px-8",
        appearance.align === "left" ? "justify-start text-left" : "justify-center text-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Cada modelo só muda a apresentação — os segundos chegam sempre de fora. */
function TemplateView({
  template,
  remaining,
  total,
  message,
  appearance,
}: ViewProps & { template: PreliveTemplateId }) {
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;

  if (template === "premium") {
    return (
      <Shell appearance={appearance}>
        <div
          className={cn(
            "flex flex-col gap-4",
            appearance.align === "left" ? "items-start" : "items-center",
          )}
        >
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
            A começar
          </span>
          <Digits
            remaining={remaining}
            appearance={appearance}
            className="[&_span]:text-room-text"
          />
          <Texts message={message} appearance={appearance} />
        </div>
      </Shell>
    );
  }

  if (template === "dark") {
    return (
      <Shell appearance={appearance}>
        <div
          className={cn(
            "flex flex-col gap-3",
            appearance.align === "left" ? "items-start" : "items-center",
          )}
        >
          <Digits remaining={remaining} appearance={appearance} labels={false} />
          <Texts message={message} appearance={appearance} />
        </div>
      </Shell>
    );
  }

  if (template === "glass") {
    return (
      <Shell
        appearance={appearance}
        className="prelive-glow"
      >
        <div
          className={cn(
            "glass-chip flex flex-col gap-3 rounded-2xl px-6 py-6 sm:px-10",
            appearance.align === "left" ? "items-start" : "items-center",
          )}
        >
          <Digits remaining={remaining} appearance={appearance} />
          <Texts message={message} appearance={appearance} />
        </div>
      </Shell>
    );
  }

  if (template === "split") {
    return (
      <Shell appearance={appearance}>
        <div className="grid w-full max-w-3xl items-center gap-4 sm:grid-cols-2">
          <div className="text-left">
            <Texts message={message} appearance={{ ...appearance, align: "left" }} />
          </div>
          <div className="border-t border-room-line pt-3 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <Digits remaining={remaining} appearance={appearance} />
          </div>
        </div>
      </Shell>
    );
  }

  if (template === "compact") {
    return (
      <Shell appearance={appearance}>
        <div className="flex w-full max-w-md items-center justify-between gap-4 rounded-xl border border-room-line bg-room-surface px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold sm:text-sm">
              {appearance.title.trim() || message}
            </p>
            {appearance.subtitle ? (
              <p className="truncate text-[11px] opacity-65">{appearance.subtitle}</p>
            ) : null}
          </div>
          <Digits remaining={remaining} appearance={appearance} labels={false} />
        </div>
      </Shell>
    );
  }

  if (template === "urgency") {
    return (
      <Shell appearance={appearance}>
        <div
          className={cn(
            "flex flex-col gap-3",
            appearance.align === "left" ? "items-start" : "items-center",
          )}
        >
          <span className="flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" />
            Quase a começar
          </span>
          <Digits remaining={remaining} appearance={appearance} className="text-primary" />
          <div className="h-1 w-48 overflow-hidden rounded-full bg-room-line sm:w-72">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <Texts message={message} appearance={appearance} />
        </div>
      </Shell>
    );
  }

  if (template === "editorial") {
    return (
      <Shell appearance={appearance}>
        <div className="w-full max-w-2xl space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-55">
            transmissão em direto
          </p>
          <Texts message={message} appearance={{ ...appearance, align: "left" }} />
          <div className="h-px w-full bg-room-line" />
          <Digits remaining={remaining} appearance={appearance} />
        </div>
      </Shell>
    );
  }

  if (template === "pulse") {
    const box = 240;
    const r = 96;
    const circ = 2 * Math.PI * r;
    const left = Math.max(0, Math.min(1, 1 - progress));
    const digits = countdownParts(remaining, appearance)
      .map((part) => part.value)
      .join(":");

    return (
      <Shell appearance={{ ...appearance, align: "center" }} className="prelive-pulse justify-center">
        <div className="relative flex flex-col items-center gap-3">
          <div className="relative size-[150px] sm:size-[260px]">
            <svg viewBox={`0 0 ${box} ${box}`} className="size-full -rotate-90" aria-hidden>
              <circle
                cx={box / 2}
                cy={box / 2}
                r={r}
                fill="none"
                stroke="oklch(0.55 0.21 25)"
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray="14 12"
                opacity={0.85}
              />
              <circle
                cx={box / 2}
                cy={box / 2}
                r={r}
                fill="none"
                stroke="oklch(0.72 0.2 40)"
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - left)}
                className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                style={{ filter: "drop-shadow(0 0 10px oklch(0.72 0.2 40 / 70%))" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className={cn(
                  "font-black tabular-nums leading-none tracking-tight text-white",
                  appearance.size === "sm"
                    ? "text-4xl sm:text-5xl"
                    : appearance.size === "md"
                      ? "text-5xl sm:text-6xl"
                      : "text-5xl sm:text-7xl",
                )}
                style={{ textShadow: "0 0 26px oklch(0.85 0.1 40 / 55%)" }}
              >
                {digits}
              </span>
            </div>
          </div>
          <Texts message={message} appearance={{ ...appearance, align: "center" }} />
        </div>
      </Shell>
    );
  }

  // Minimal: o desenho original, com anel de progresso e relógio ao centro.
  const size = 240;
  const radius = 104;
  const circumference = 2 * Math.PI * radius;
  const parts = countdownParts(remaining, appearance);
  const showRing = parts.length <= 2;

  return (
    <Shell
      appearance={{ ...appearance, align: "center" }}
      className="prelive-glow justify-center"
    >
      <span className="pointer-events-none absolute size-40 rounded-full border border-primary/30 [animation:ping_3s_cubic-bezier(0,0,0.2,1)_infinite] sm:size-56" />
      <span className="pointer-events-none absolute size-52 rounded-full border border-primary/20 [animation:ping_3s_cubic-bezier(0,0,0.2,1)_infinite_600ms] sm:size-72" />

      <div className="relative flex flex-col items-center gap-1.5 sm:gap-4">
        <div className="relative size-[120px] sm:size-[240px]">
          <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              className="fill-none stroke-white/15"
              strokeWidth={8}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              className="fill-none stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <Globe
              className="size-4 text-primary/80 [animation:spin_14s_linear_infinite] sm:size-8"
              aria-hidden
            />
            {showRing ? (
              <p className="text-2xl font-black tabular-nums text-white drop-shadow sm:text-6xl">
                {clock(remaining)}
              </p>
            ) : (
              <Digits remaining={remaining} appearance={{ ...appearance, size: "sm" }} />
            )}
            <p className="text-[7px] font-bold uppercase tracking-[0.28em] text-white/60 sm:text-[10px]">
              para começar
            </p>
          </div>
        </div>
        <Texts message={message} appearance={{ ...appearance, align: "center" }} />
      </div>
    </Shell>
  );
}

/**
 * Contagem de arranque da transmissão: fica no lugar do vídeo, com o relógio a
 * descer, enquanto o chat já está aberto ao lado. O modelo escolhido só muda a
 * apresentação — os segundos continuam a vir da sala.
 */
export function PreliveCountdown({
  remaining,
  total,
  message,
  soundOn,
  soundEnabled,
  template,
  appearance,
}: {
  remaining: number;
  total: number;
  message: string;
  soundOn: boolean;
  soundEnabled: boolean;
  template?: string | null;
  appearance?: unknown;
}) {
  useAmbientSound(soundEnabled && soundOn, remaining);

  const resolved = templateById(template);
  const look = normalizeAppearance(resolved.id, appearance);

  return (
    <TemplateView
      template={resolved.id}
      remaining={remaining}
      total={total}
      message={message}
      appearance={look}
    />
  );
}
