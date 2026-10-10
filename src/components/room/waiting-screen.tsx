import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { formatSessionStart } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { useDataSaver } from "@/lib/room-data-saver";
import { PreliveCountdown } from "@/components/prelive-countdown";
import { VideoPlayer } from "@/components/video-player";

const NOOP = () => {};

/**
 * A sala de espera, antes de a sala abrir: o mesmo relógio da contagem (estilo e cor escolhidos no
 * editor), a contar até à hora da sessão, sem som. Quando a sala abre (`opensMs`), a contagem segue lá dentro.
 * Com um vídeo de fundo, ele enche o ecrã (em ciclo, mudo até se tocar em «Ativar som») e o resto fica
 * por cima; a poupar dados, o vídeo não descarrega e fica como sem vídeo.
 */
export function WaitingScreen({
  title,
  startMs,
  opensMs,
  timezone,
  themeClass,
  style,
  color,
  onZero,
  highlight,
  video,
  showCountdown = true,
}: {
  title: string;
  /** A hora da sessão. */
  startMs: number;
  /** A hora a que a sala abre (a contagem antes de começar abre-a uns minutos antes). */
  opensMs: number;
  timezone?: string | null;
  themeClass?: string;
  style: string;
  color: string;
  onZero: () => void;
  /** No editor: realça a data enquanto se escolhe na Agenda. */
  highlight?: boolean | undefined;
  /** O vídeo de fundo (da Biblioteca); sem ele, o fundo da sala. */
  video?: { url: string; provider?: string | null | undefined } | null | undefined;
  /** A contagem por cima; desligada, ficam o título e a hora. */
  showCountdown?: boolean | undefined;
}) {
  const [now, setNow] = useState(() => Date.now());
  const saveData = useDataSaver();
  const bg = video && !saveData ? video : null;
  const [sound, setSound] = useState(false);
  const media = useRef<HTMLVideoElement>(null);
  // O som liga-se no próprio toque (o iPhone não deixa fora dele); se o navegador recusar, volta a mudo.
  const toggleSound = () => {
    const next = !sound;
    const el = media.current;
    if (el) {
      el.muted = !next;
      if (next) void el.play().catch(() => setSound(false));
    }
    setSound(next);
  };
  // O anel e a barra enchem desde que a pessoa chegou.
  const [total] = useState(() => Math.max(1, Math.floor((startMs - Date.now()) / 1000)));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = Math.max(0, Math.floor((startMs - now) / 1000));
  const opened = now >= opensMs;
  useEffect(() => {
    if (opened) onZero();
  }, [opened, onZero]);

  return (
    // `@container`: as letras medem o ecrã da sala (na pré-visualização do editor, o ecrã do aparelho, não a janela).
    // Com o vídeo de fundo, a parte de cima fica escura: na pré-visualização, o relógio do aparelho fica branco.
    <main
      className={cn("room-ambient @container relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10", themeClass)}
      data-status-dark={bg ? "" : undefined}
    >
      {bg ? (
        <>
          <div className="absolute inset-0" aria-hidden>
            <VideoPlayer
              url={bg.url}
              provider={bg.provider ?? null}
              controls={false}
              onTime={NOOP}
              loop
              muted={!sound}
              onSoundBlocked={() => setSound(false)}
              mediaRef={media}
              quiet
              className="h-full aspect-auto rounded-none"
            />
          </div>
          {/* Um véu escuro: o título e a contagem lêem-se por cima de qualquer vídeo. */}
          <div className="absolute inset-0 bg-black/45" aria-hidden />
        </>
      ) : null}
      <div className={cn("relative w-full max-w-2xl text-center", bg ? "text-white" : "text-room-text")}>
        <h1 className="text-2xl font-black leading-tight @min-[640px]:text-3xl">{title}</h1>
        <p className={cn("mt-2 text-sm", bg ? "text-white/75" : "text-room-subtle")}>
          <span
            className={
              highlight
                ? "rounded-sm outline outline-2 outline-offset-4 outline-[#E8440C]"
                : undefined
            }
          >
            Começa {formatSessionStart(startMs, timezone)}
          </span>
        </p>
        {showCountdown ? (
          <div
            className={cn(
              "mt-6 overflow-hidden rounded-2xl shadow-2xl ring-1",
              // Por cima do vídeo, o fundo do relógio fica meio transparente: vê-se o vídeo por trás. O `!` passa
              // à frente do `.prelive-dark` do styles.css (fora das camadas do Tailwind).
              bg ? "ring-white/15 [&_.prelive-dark]:[--room-bg:rgb(0_0_0/0.4)]! [&_.prelive-dark]:backdrop-blur-sm" : "ring-room-line",
            )}
          >
            <PreliveCountdown
              remaining={remaining}
              total={total}
              message=""
              soundOn={false}
              soundEnabled={false}
              template={style}
              color={color}
              appearance={{ subtitle: "", showDays: remaining >= 86400, showHours: remaining >= 3600 }}
            />
          </div>
        ) : null}
      </div>
      {bg ? (
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={sound}
          className="absolute bottom-[max(2.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] inline-flex h-9 items-center gap-1.5 rounded-full bg-black/55 px-3.5 text-[13px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/70"
        >
          {sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
          {sound ? "Som ligado" : "Ativar som"}
        </button>
      ) : null}
    </main>
  );
}
