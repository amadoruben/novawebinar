import { useEffect, useState } from "react";
import { Check, ChevronRight, Loader2, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EditorStep } from "@/lib/webinar-draft";
import type { ReviewFix, ReviewIssue } from "@/lib/webinar-review";

type Row = { id: EditorStep; label: string; icon: LucideIcon };

/** Quanto tempo se fica em cada etapa: um pouco mais onde há alguma coisa a dizer. */
const PACE = { ok: 420, issue: 760 } as const;

/**
 * Revisão: corre as etapas uma a uma («A ver…») e diz como ficou cada uma. Tudo bem → visto verde; senão,
 * o que falta, com «Corrigir automaticamente» (quando o editor já sabe fazê-lo) e «Corrigir eu» (leva lá).
 * O botão Publicar fica no rodapé, como o «Continuar» das outras etapas, e acorda no fim.
 */
export function StepRevisao({
  steps,
  issues,
  summary,
  working,
  onGo,
  onFix,
  onDone,
}: {
  steps: readonly Row[];
  issues: readonly ReviewIssue[];
  summary: Partial<Record<EditorStep, string>>;
  /**
   * A geração com IA e as etapas que ela trata: a decorrer (`label`), pronta para rever (`onReview`, sem gastar
   * créditos outra vez) ou parada com um erro (`error`).
   */
  working: {
    steps: readonly EditorStep[];
    label?: string;
    onReview?: () => void;
    error?: string;
  } | null;
  onGo: (step: EditorStep) => void;
  onFix: (fix: ReviewFix) => void;
  /** A revisão chegou ao fim (o Publicar fica activo). */
  onDone: () => void;
}) {
  const [done, setDone] = useState(0);
  const total = steps.length;
  const issuesOf = (step: EditorStep) => issues.filter((issue) => issue.step === step);
  const current = steps[done];
  useEffect(() => {
    if (!current) {
      onDone();
      return;
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => setDone((d) => d + 1),
      still ? 0 : issuesOf(current.id).length ? PACE.issue : PACE.ok,
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const checking = done < total;
  const open = issues.length;

  return (
    <div className="grid gap-4">
      <div
        className={cn(
          "grid gap-2 rounded-xl px-4 py-3.5",
          checking
            ? "bg-white shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)]"
            : open
              ? "bg-warning-soft"
              : "bg-success-soft",
        )}
        aria-live="polite"
      >
        {checking ? (
          <>
            <p className="flex items-center justify-between gap-3 text-[14px] font-semibold">
              A rever o webinar…
              <span className="font-mono text-[12px] font-normal tabular-nums text-muted-foreground">
                {done}/{total}
              </span>
            </p>
            <span
              className="block h-1 overflow-hidden rounded-full bg-[var(--ds-gray-alpha-200)]"
              aria-hidden
            >
              <span
                className="block h-full rounded-full bg-foreground transition-[width] duration-300"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </span>
          </>
        ) : open ? (
          <>
            <b className="text-[15px] font-semibold text-warning">
              {open === 1 ? "Falta 1 ponto" : `Faltam ${open} pontos`}
            </b>
            <p className="text-[13px] text-foreground/80">
              Corrija agora, ou publique e corrija depois.
            </p>
          </>
        ) : (
          <>
            <b className="text-[15px] font-semibold text-success">Tudo pronto</b>
            <p className="text-[13px] text-foreground/80">
              Todas as etapas estão bem. Já pode publicar.
            </p>
          </>
        )}
      </div>

      <ol className="divide-y overflow-hidden rounded-xl bg-white shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)]">
        {steps.map((s, i) => {
          const state =
            i < done
              ? issuesOf(s.id).length
                ? "issue"
                : "ok"
              : i === done
                ? "checking"
                : "waiting";
          const job = working?.steps.includes(s.id) ? working : null;
          return (
            <li key={s.id} className="px-3.5 py-3">
              <button
                type="button"
                onClick={() => onGo(s.id)}
                className="flex w-full min-w-0 items-center gap-3 text-left"
                title={`Abrir ${s.label}`}
              >
                <Status state={state} />
                <span className="min-w-0 flex-1">
                  <b
                    className={cn(
                      "block text-[14px] font-medium",
                      state === "waiting" && "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </b>
                  {state === "checking" ? (
                    <span className="block text-[12.5px] text-muted-foreground">A ver…</span>
                  ) : state !== "waiting" && summary[s.id] ? (
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {summary[s.id]}
                    </span>
                  ) : null}
                </span>
                {state === "ok" || state === "issue" ? (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                ) : null}
              </button>
              {state === "issue"
                ? issuesOf(s.id).map((issue) => (
                    <div
                      key={issue.title}
                      className="ml-9 mt-2.5 grid gap-1 rounded-lg bg-[var(--ds-gray-alpha-100)] px-3 py-2.5 animate-in fade-in slide-in-from-top-1 duration-300"
                    >
                      <b className="text-[13px] font-semibold">{issue.title}</b>
                      {issue.detail ? (
                        <p className="text-[12.5px] text-muted-foreground">{issue.detail}</p>
                      ) : null}
                      {job?.label ? (
                        <p className="mt-1 flex items-center gap-2 text-[12.5px] font-medium">
                          <Loader2 className="size-3.5 animate-spin" />
                          {job.label}
                        </p>
                      ) : (
                        // Um por baixo do outro, à largura toda: o painel é estreito e os dois nomes ficam inteiros.
                        <div className="mt-1.5 grid gap-2">
                          {job?.error ? (
                            <p className="rounded-md bg-warning-soft px-2.5 py-2 text-[12.5px] text-warning">
                              {job.error}
                            </p>
                          ) : null}
                          {job?.onReview ? (
                            <Button
                              size="sm"
                              variant="dark"
                              className="w-full"
                              onClick={job.onReview}
                            >
                              Rever os comentários
                            </Button>
                          ) : issue.fix ? (
                            <>
                              <Button
                                size="sm"
                                variant="dark"
                                className="w-full"
                                onClick={() => onFix(issue.fix!)}
                              >
                                Corrigir automaticamente
                              </Button>
                              {issue.fix === "comments" ? (
                                <p className="-mt-1 text-center text-[12px] text-muted-foreground">
                                  Usa créditos de IA
                                </p>
                              ) : null}
                            </>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => onGo(s.id)}
                          >
                            Corrigir eu
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Status({ state }: { state: "waiting" | "checking" | "ok" | "issue" }) {
  if (state === "checking")
    return (
      <span
        aria-label="A ver"
        className="size-6 shrink-0 animate-spin rounded-full border-2 border-[var(--ds-gray-alpha-300)] border-t-foreground"
      />
    );
  if (state === "ok")
    return (
      <span
        aria-label="Está bem"
        className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--ds-green-700)] text-white animate-in zoom-in-50 duration-200"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  if (state === "issue")
    return (
      <span
        aria-label="Falta alguma coisa"
        className="grid size-6 shrink-0 place-items-center rounded-full bg-warning-soft text-warning animate-in zoom-in-50 duration-200"
      >
        <TriangleAlert className="size-3.5" />
      </span>
    );
  return (
    <span
      aria-hidden
      className="size-6 shrink-0 rounded-full border-2 border-dashed border-[var(--ds-gray-alpha-300)]"
    />
  );
}
