import { useEffect, useRef, useState, type RefObject } from "react";
import { Pause, Play } from "lucide-react";
import { clock } from "@/lib/room-logic";
import { cn } from "@/lib/utils";

/*
 * Só na sala de teste (o 👁 do editor): a barra do vídeo, como no YouTube, para ver a sala do início ao
 * fim. Um toque (ou o rato) no vídeo mostra-a em baixo: play/pausa, a barra fina para tocar ou arrastar e
 * o tempo; some sozinha passados 3 s. Os pontos na barra são onde entram as ofertas.
 *
 * A sala a sério obriga o vídeo a tocar (ninguém o pausa). Para não mexer nessa regra, a pausa daqui troca
 * o play() deste vídeo por um que não faz nada, até se carregar outra vez no play.
 */

const HIDE_MS = 3000;
const held = (video: HTMLVideoElement) => Object.prototype.hasOwnProperty.call(video, "play");

export function TestScrubber({
  videoRef,
  marks = [],
  className,
  top = false,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Os segundos em que entram as ofertas. */
  marks?: readonly number[] | undefined;
  /** A moldura do vídeo (a barra fica dentro dela). */
  className?: string | undefined;
  /** Em cima, logo abaixo da barra do Live (o vídeo ao alto enche o ecrã e o chat ocupa o fundo). */
  top?: boolean | undefined;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(true);
  const [state, setState] = useState({ at: 0, total: 0, paused: false });
  const [dragAt, setDragAt] = useState<number | null>(null);
  const hideRef = useRef<number | null>(null);

  const read = () => {
    const video = videoRef.current;
    if (!video) return;
    const total = Number.isFinite(video.duration) ? video.duration : 0;
    setState({ at: video.currentTime, total, paused: video.paused });
  };

  // Mostra e volta a contar os 3 s (parado ou a arrastar, fica).
  const poke = () => {
    setShown(true);
    if (hideRef.current !== null) window.clearTimeout(hideRef.current);
    hideRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused) setShown(false);
    }, HIDE_MS);
  };

  // Um toque ou o rato em qualquer sítio do vídeo mostra a barra.
  useEffect(() => {
    const area = rootRef.current?.parentElement;
    if (!area) return;
    const onPointer = (event: PointerEvent) => {
      if (event.type === "pointermove" && event.pointerType !== "mouse") return;
      poke();
    };
    area.addEventListener("pointerdown", onPointer);
    area.addEventListener("pointermove", onPointer);
    poke();
    return () => {
      area.removeEventListener("pointerdown", onPointer);
      area.removeEventListener("pointermove", onPointer);
      if (hideRef.current !== null) window.clearTimeout(hideRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O tempo só se lê com a barra à vista.
  useEffect(() => {
    if (!shown) return;
    read();
    const timer = window.setInterval(read, 250);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (held(video)) {
      Reflect.deleteProperty(video, "play");
      void video.play().catch(() => undefined);
    } else {
      video.play = () => Promise.resolve();
      video.pause();
    }
    read();
    poke();
  };

  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video || !state.total) return;
    // Meio segundo antes do fim, para não acabar a aula sem querer.
    video.currentTime = Math.max(0, Math.min(seconds, state.total - 0.5));
    read();
    poke();
  };
  const pointAt = (clientX: number) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || !box.width) return 0;
    return Math.max(0, Math.min(1, (clientX - box.left) / box.width)) * state.total;
  };

  const at = dragAt ?? state.at;
  const pct = (seconds: number) =>
    `${state.total ? Math.min(100, (seconds / state.total) * 100) : 0}%`;

  return (
    <div ref={rootRef} className={cn("pointer-events-none z-[25]", className, "shadow-none")}>
      <div
        className={cn(
          "absolute inset-x-0 transition-opacity duration-300",
          top
            ? "top-[calc(env(safe-area-inset-top)+64px)]"
            : "bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.55),transparent)] pt-6",
          shown || dragAt !== null ? "opacity-100" : "opacity-0 [&_*]:!pointer-events-none",
        )}
      >
        <div className="pointer-events-auto flex w-fit items-center gap-1.5 px-2 text-white">
          <button
            type="button"
            onClick={toggle}
            aria-label={state.paused ? "Continuar" : "Pausar"}
            className="grid size-9 place-items-center rounded-full drop-shadow-[0_1px_2px_rgba(0,0,0,.6)] transition active:scale-95"
          >
            {state.paused ? (
              <Play className="size-5" fill="currentColor" />
            ) : (
              <Pause className="size-5" fill="currentColor" />
            )}
          </button>
          <span className="text-[12px] font-semibold tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]">
            {clock(at)} / {clock(state.total)}
          </span>
        </div>
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Posição do vídeo"
          aria-valuemin={0}
          aria-valuemax={Math.round(state.total)}
          aria-valuenow={Math.round(at)}
          aria-valuetext={clock(at)}
          className="group/track pointer-events-auto relative mx-3 h-4 cursor-pointer touch-none"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragAt(pointAt(event.clientX));
          }}
          onPointerMove={(event) => {
            if (dragAt !== null) setDragAt(pointAt(event.clientX));
          }}
          onPointerUp={(event) => {
            seek(pointAt(event.clientX));
            setDragAt(null);
          }}
          onPointerCancel={() => setDragAt(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") seek(state.at - 5);
            if (event.key === "ArrowRight") seek(state.at + 5);
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/30 transition-[height] group-hover/track:h-[5px]">
            <div className="h-full rounded-full bg-white" style={{ width: pct(at) }} />
            {marks.map((mark, i) =>
              state.total && mark < state.total ? (
                <span
                  key={`${i}-${mark}`}
                  title={`Oferta · ${clock(mark)}`}
                  className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--of,#E8440C)] ring-2 ring-black/40"
                  style={{ left: pct(mark) }}
                />
              ) : null,
            )}
          </div>
          <span
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
            style={{ left: pct(at) }}
          />
        </div>
      </div>
    </div>
  );
}
