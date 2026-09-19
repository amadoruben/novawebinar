import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  Gauge,
  MessageCircleQuestion,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  clockLabel,
  OBJECTIVE_LABEL,
  RISK_LABEL,
  type AnalysisSegment,
  type DropRisk,
  type WebinarAnalysis,
} from "@/lib/engagement-analysis";
import { cn } from "@/lib/utils";

const RISK_COLOR: Record<DropRisk, string> = {
  baixo: "bg-emerald-500",
  moderado: "bg-amber-400",
  alto: "bg-orange-500",
  critico: "bg-destructive",
};

const RISK_TEXT: Record<DropRisk, string> = {
  baixo: "text-emerald-600",
  moderado: "text-amber-600",
  alto: "text-orange-600",
  critico: "text-destructive",
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-400" : "bg-destructive",
          )}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Diagnóstico do webinar: heatmap do minuto zero ao fim, insights para o
 * apresentador, recuperação de atenção e pontuação global.
 */
export function EngagementDiagnostics({
  analysis,
  onSeek,
}: {
  analysis: WebinarAnalysis;
  onSeek?: (seconds: number) => void;
}) {
  const duration = useMemo(() => {
    const last = analysis.segments.reduce((max, s) => Math.max(max, s.to), 0);
    return Math.max(60, analysis.durationSeconds || last);
  }, [analysis]);

  const percent = (seconds: number) => Math.max(0, Math.min(100, (seconds / duration) * 100));

  const click = (segment: AnalysisSegment) => onSeek?.(segment.from);

  return (
    <div className="@container space-y-4">
      <div className="rounded-2xl border bg-background p-4 @md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Flame className="size-4 text-primary" />
              Mapa de atenção
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Estratégia para {OBJECTIVE_LABEL[analysis.objective].toLowerCase()}. Verde é interesse
              alto, amarelo atenção média, laranja e vermelho risco de abandono.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {(["baixo", "moderado", "alto", "critico"] as DropRisk[]).map((risk) => (
              <span key={risk} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-full", RISK_COLOR[risk])} />
                {RISK_LABEL[risk]}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="relative h-8 overflow-hidden rounded-xl border bg-muted/40">
            {analysis.segments.map((segment, index) => (
              <button
                key={`${segment.from}-${index}`}
                type="button"
                onClick={() => click(segment)}
                title={`${clockLabel(segment.from)} – ${clockLabel(segment.to)} · ${segment.kind} · risco ${RISK_LABEL[segment.dropRisk]}\n${segment.summary}`}
                className={cn(
                  "absolute inset-y-0 border-r border-background/40 transition-opacity hover:opacity-80",
                  RISK_COLOR[segment.dropRisk],
                )}
                style={{
                  left: `${percent(segment.from)}%`,
                  width: `${Math.max(0.6, percent(segment.to) - percent(segment.from))}%`,
                }}
                aria-label={`Abrir o trecho ${clockLabel(segment.from)}`}
              />
            ))}
          </div>
          <div className="relative h-5">
            {analysis.segments
              .filter((s) => s.hostQuestion || s.readsChat || s.ctaProximity >= 70)
              .map((segment, index) => (
                <span
                  key={`marker-${segment.from}-${index}`}
                  className="absolute -translate-x-1/2 text-[13px]"
                  style={{ left: `${percent(segment.from)}%` }}
                  title={
                    segment.hostQuestion
                      ? `Pergunta ao público: ${segment.hostQuestion}`
                      : segment.readsChat
                        ? "O apresentador lê o chat"
                        : "Perto do CTA"
                  }
                >
                  {segment.hostQuestion ? "❓" : segment.readsChat ? "💬" : "🎯"}
                </span>
              ))}
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>{clockLabel(0)}</span>
            <span>{clockLabel(duration / 2)}</span>
            <span>{clockLabel(duration)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 @3xl:grid-cols-2">
        <div className="space-y-3 rounded-2xl border bg-background p-4 @md:p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Gauge className="size-4 text-primary" />
            Pontuação do webinar
          </h3>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black tabular-nums">{analysis.score.overall}</span>
            <span className="pb-1.5 text-sm text-muted-foreground">/100</span>
          </div>
          {analysis.score.summary ? (
            <p className="text-xs text-muted-foreground">{analysis.score.summary}</p>
          ) : null}
          <div className="grid gap-3 @sm:grid-cols-2">
            <ScoreBar label="Retenção prevista" value={analysis.score.retention} />
            <ScoreBar label="Engajamento" value={analysis.score.engagement} />
            <ScoreBar label="Clareza" value={analysis.score.clarity} />
            <ScoreBar label="Ritmo" value={analysis.score.pace} />
            <ScoreBar label="Oferta" value={analysis.score.offer} />
            <ScoreBar label="CTA" value={analysis.score.cta} />
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border bg-background p-4 @md:p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Target className="size-4 text-primary" />
            Insights da IA
          </h3>
          {analysis.insights.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem observações para este webinar.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {analysis.insights.map((insight, index) => (
                <li key={`${insight.at}-${index}`}>
                  <button
                    type="button"
                    onClick={() => onSeek?.(insight.at)}
                    className="flex w-full items-start gap-2 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    {insight.level === "bom" ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    ) : insight.level === "risco" ? (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold tabular-nums text-muted-foreground">
                        {clockLabel(insight.at)}
                      </span>
                      <span className="block text-sm font-medium">{insight.title}</span>
                      {insight.note ? (
                        <span className="block text-xs text-muted-foreground">{insight.note}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {analysis.rescue.length > 0 ? (
        <div className="space-y-3 rounded-2xl border bg-background p-4 @md:p-5">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <AlertTriangle className="size-4 text-orange-500" />
              Recuperar a atenção
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Trechos com previsão de queda. Nem tudo se resolve com mais comentários — algumas
              sugestões melhoram o próprio webinar.
            </p>
          </div>
          <div className="grid gap-3 @2xl:grid-cols-2">
            {analysis.rescue.map((item, index) => (
              <div key={`${item.from}-${index}`} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {clockLabel(item.from)} – {clockLabel(item.to)}
                  </span>
                  <span className={cn("text-xs font-semibold", RISK_TEXT[item.risk])}>
                    Risco {RISK_LABEL[item.risk].toLowerCase()}
                  </span>
                </div>
                {item.reason ? (
                  <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                ) : null}
                <ul className="mt-2 space-y-1 text-sm">
                  {item.suggestions.map((suggestion, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">+</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
                {onSeek ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => onSeek(item.from)}
                  >
                    Abrir este trecho
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {analysis.personas.length > 0 ? (
        <div className="rounded-2xl border bg-background p-4 @md:p-5">
          <h3 className="text-sm font-bold">Pessoas desta sessão</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Participantes simulados, com jeito próprio e memória do que já disseram. Nunca são
            apresentados como clientes ou compradores reais.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {analysis.personas.map((persona) => (
              <span
                key={persona.name}
                className="rounded-full border px-3 py-1 text-xs"
                title={persona.profile}
              >
                <strong className="font-semibold">{persona.name}</strong>
                <span className="text-muted-foreground"> · {persona.style}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
