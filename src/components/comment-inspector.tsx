/**
 * Inspeção temporal de um comentário: mostra qual trecho do webinar o
 * provocou, a relação, o atraso humano e o motivo, com as palavras reais
 * da transcrição e ligação directa ao ponto do vídeo.
 */
import { useMemo } from "react";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TranscriptInspection } from "@/lib/temporal/inspect.functions";

export type InspectableComment = {
  id: string;
  author_name: string;
  message: string;
  offset_seconds: number;
  offset_ms?: number | null;
  trigger_type?: string | null;
  trigger_id?: string | null;
  trigger_start_ms?: number | null;
  trigger_end_ms?: number | null;
  temporal_relation?: string | null;
  reaction_latency_ms?: number | null;
  generation_reason?: string | null;
  causality_confidence?: number | null;
  validation_action?: string | null;
  validation_rule?: string | null;
};

const RELATION_LABEL: Record<string, string> = {
  REACTION_TO_PRESENTER: "Reação ao que foi dito",
  ANSWER_TO_PRESENTER: "Resposta a um pedido do apresentador",
  CAUSE_OF_PRESENTER_SPEECH: "Motivou a fala seguinte",
  SPONTANEOUS: "Espontâneo",
};

export function msClock(ms: number) {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  const base = `${h > 0 ? `${String(h).padStart(2, "0")}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${base}.${String(millis).padStart(3, "0")}`;
}

export function CommentInspector({
  comment,
  inspection,
  open,
  onOpenChange,
  onSeek,
}: {
  comment: InspectableComment | null;
  inspection: TranscriptInspection | null;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSeek?: (seconds: number) => void;
}) {
  const atMs = comment ? (comment.offset_ms ?? comment.offset_seconds * 1000) : 0;

  const words = useMemo(() => {
    if (!comment || !inspection) return [];
    const from = comment.trigger_start_ms;
    const to = comment.trigger_end_ms;
    if (from == null || to == null) return [];
    return inspection.words.filter((w) => w.endMs >= from - 200 && w.startMs <= to + 200);
  }, [comment, inspection]);

  const triggerText = useMemo(() => {
    if (!comment || !inspection) return "";
    if (comment.trigger_id) {
      const sentence = inspection.sentences.find((s) => s.id === comment.trigger_id);
      if (sentence) return sentence.text;
      const event = inspection.events.find((e) => e.id === comment.trigger_id);
      if (event) return event.triggerText;
    }
    return words.map((w) => w.word).join(" ");
  }, [comment, inspection, words]);

  const relation = comment?.temporal_relation ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Porque é que esta mensagem existe</SheetTitle>
          <SheetDescription>
            Relação entre o que aconteceu no webinar e o que esta pessoa escreveu.
          </SheetDescription>
        </SheetHeader>

        {comment ? (
          <div className="space-y-5 px-4 pb-8 text-sm">
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                {comment.author_name} · {msClock(atMs)}
              </p>
              <p className="mt-1 text-foreground">{comment.message}</p>
            </div>

            {relation ? (
              <dl className="grid grid-cols-2 gap-3">
                <Item label="Relação" value={RELATION_LABEL[relation] ?? relation} />
                <Item
                  label="Atraso humano"
                  value={
                    comment.reaction_latency_ms != null
                      ? `${(comment.reaction_latency_ms / 1000).toFixed(3)} s`
                      : "—"
                  }
                />
                <Item
                  label="Trecho"
                  value={
                    comment.trigger_start_ms != null && comment.trigger_end_ms != null
                      ? `${msClock(comment.trigger_start_ms)} → ${msClock(comment.trigger_end_ms)}`
                      : "Sem trecho específico"
                  }
                />
                <Item
                  label="Confiança"
                  value={
                    comment.causality_confidence != null
                      ? `${Math.round(Number(comment.causality_confidence) * 100)}%`
                      : "—"
                  }
                />
              </dl>
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Esta mensagem foi criada antes da nova análise temporal, por isso não tem
                causa registada.
              </p>
            )}

            {comment.generation_reason ? (
              <div>
                <p className="text-xs text-muted-foreground">
                  Motivo
                </p>
                <p className="mt-1 text-foreground/90">{comment.generation_reason}</p>
              </div>
            ) : null}

            {triggerText ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    O que foi dito
                  </p>
                  {onSeek && comment.trigger_start_ms != null ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSeek(Math.floor(comment.trigger_start_ms! / 1000))}
                    >
                      <Play className="size-3.5" />
                      Ouvir o trecho
                    </Button>
                  ) : null}
                </div>
                <p className="rounded-xl border bg-background p-3 leading-relaxed text-foreground/90">
                  {triggerText}
                </p>
              </div>
            ) : null}

            {words.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Palavra a palavra
                </p>
                <div className="flex flex-wrap gap-1">
                  {words.map((word, index) => (
                    <button
                      key={`${word.startMs}-${index}`}
                      type="button"
                      title={`${msClock(word.startMs)} → ${msClock(word.endMs)}${
                        word.confidence != null
                          ? ` · confiança ${Math.round(word.confidence * 100)}%`
                          : ""
                      }`}
                      onClick={() => onSeek?.(Math.floor(word.startMs / 1000))}
                      className="rounded-md border px-1.5 py-0.5 text-xs hover:bg-muted"
                    >
                      {word.word}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {comment.validation_action ? (
              <p className="text-xs text-muted-foreground">
                Verificação: {comment.validation_action}
                {comment.validation_rule ? ` (${comment.validation_rule})` : ""}
              </p>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}
