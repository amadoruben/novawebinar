/**
 * Transcrição palavra a palavra.
 *
 * Cada palavra é um elemento próprio com o tempo real devolvido pelo motor de
 * transcrição. O relógio grande à esquerda é apenas leitura: a fonte temporal
 * do sistema é sempre word.startMs / word.endMs.
 */
import { useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TranscriptInspection } from "@/lib/temporal/inspect.functions";
import { mediaForTranscription } from "@/lib/temporal/media";
import { PRECISION_LABEL } from "@/lib/temporal/types";

function msClock(ms: number) {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  const base = `${h > 0 ? `${String(h).padStart(2, "0")}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${base}.${String(millis).padStart(3, "0")}`;
}

function shortClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function TranscriptWords({
  inspection,
  mediaUrl,
  onSeek,
}: {
  inspection: TranscriptInspection;
  mediaUrl?: string | null;
  onSeek?: (seconds: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState<number | null>(null);

  const playable = useMemo(() => {
    if (!mediaUrl) return null;
    return mediaForTranscription(mediaUrl).url;
  }, [mediaUrl]);

  const offset = inspection.mediaTimeOffsetMs ?? 0;

  const goTo = (startMs: number) => {
    const canonical = (startMs + offset) / 1000;
    onSeek?.(Math.floor(canonical));
    const video = videoRef.current;
    if (video) {
      video.currentTime = canonical;
      void video.play().catch(() => undefined);
    }
  };

  if (inspection.words.length === 0) {
    return (
      <p className="px-4 py-3 text-xs text-muted-foreground">
        Esta transcrição não tem tempos por palavra. Volte a transcrever o vídeo para poder
        inspecionar palavra a palavra.
      </p>
    );
  }

  return (
    <div className="space-y-3 border-t px-4 py-3">
      <p className="text-xs text-muted-foreground">
        {PRECISION_LABEL[inspection.precision]} · {inspection.provider} ·{" "}
        {inspection.words.length} palavras · clique numa palavra para ver o tempo exato
      </p>

      {playable ? (
        <video
          ref={videoRef}
          src={playable}
          controls
          preload="metadata"
          className="max-h-40 w-full rounded-lg bg-black"
        />
      ) : null}

      <div className="max-h-72 space-y-2 overflow-y-auto text-xs leading-relaxed">
        {inspection.sentences.map((sentence) => (
          <p key={sentence.id} className="flex gap-3">
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {shortClock(sentence.startMs)}
            </span>
            <span className="flex flex-wrap gap-x-1 gap-y-0.5">
              {sentence.wordIndexes.map((index) => {
                const word = inspection.words[index];
                if (!word) return null;
                return (
                  <Popover
                    key={index}
                    open={active === index}
                    onOpenChange={(value) => setActive(value ? index : null)}
                  >
                    <PopoverTrigger asChild>
                      <span
                        role="button"
                        tabIndex={0}
                        data-start-ms={word.startMs}
                        data-end-ms={word.endMs}
                        className="cursor-pointer rounded px-0.5 text-foreground/90 hover:bg-primary/10 hover:text-foreground"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") setActive(index);
                        }}
                      >
                        {word.word}
                      </span>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 space-y-2 text-xs">
                      <p className="text-sm font-semibold">{word.word}</p>
                      <dl className="grid grid-cols-2 gap-2">
                        <Field label="Início" value={msClock(word.startMs + offset)} />
                        <Field label="Fim" value={msClock(word.endMs + offset)} />
                        <Field label="Duração" value={`${Math.max(0, word.endMs - word.startMs)} ms`} />
                        <Field
                          label="Confiança"
                          value={
                            word.confidence != null
                              ? `${Math.round(word.confidence * 100)}%`
                              : "—"
                          }
                        />
                        <Field label="Motor" value={inspection.provider} />
                        <Field label="Precisão" value={inspection.precision.toUpperCase()} />
                      </dl>
                      <Button size="sm" className="w-full" onClick={() => goTo(word.startMs)}>
                        <Play className="size-3.5" />
                        Ir para palavra
                      </Button>
                    </PopoverContent>
                  </Popover>
                );
              })}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
