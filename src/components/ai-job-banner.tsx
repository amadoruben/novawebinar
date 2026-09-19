import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, Check, Wand2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AI_JOB_STAGES, dismissAiJob, useAiJobs, type AiJob } from "@/lib/ai-comment-jobs";
import { dismissSyncJob, useSyncJobs, type SyncJob } from "@/lib/sync-jobs";
import { friendlyError } from "@/lib/friendly-error";
import { cn } from "@/lib/utils";

function Bars() {
  return (
    <span className="flex items-end gap-0.5" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="nw-ai-bar w-1 rounded-full bg-primary"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

function Shell({ job, children }: { job: AiJob; children: React.ReactNode }) {
  const running = job.status === "running";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4",
        job.status === "error"
          ? "border-destructive/40 bg-destructive/5"
          : "border-primary/30 bg-primary/5",
      )}
    >
      {running && <span className="nw-ai-sweep pointer-events-none absolute inset-0" aria-hidden />}
      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            job.status === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
            running && "nw-ai-pulse",
          )}
        >
          {job.status === "error" ? (
            <AlertTriangle className="size-5" />
          ) : job.status === "ready" ? (
            <Check className="size-5" />
          ) : (
            <Wand2 className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {running && (
        <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-primary/15">
          <span
            className="block h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${Math.min(95, 12 + job.stage * 22)}%` }}
          />
        </div>
      )}
    </div>
  );
}

/** Estado do gerador de chat para um webinar, dentro do editor. */
export function AiJobBanner({ job, onOpen }: { job: AiJob; onOpen: () => void }) {
  return (
    <Shell job={job}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {job.status === "running"
              ? "A gerar chat com IA"
              : job.status === "ready"
                ? "Chat gerado e pronto a rever"
                : "A geração falhou"}
            {job.status === "running" && <Bars />}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {job.status === "running"
              ? `${AI_JOB_STAGES[job.stage]}… pode continuar a trabalhar, isto corre em segundo plano.`
              : job.status === "ready"
                ? `${job.drafts?.length ?? 0} comentários à sua espera. Nada foi publicado.`
                : friendlyError(job.error, "Não foi possível concluir a geração. Tente novamente.")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant={job.status === "ready" ? "default" : "outline"}
            onClick={onOpen}
          >
            {job.status === "ready" ? "Rever comentários" : "Ver progresso"}
          </Button>
          {job.status === "error" && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Dispensar"
              onClick={() => dismissAiJob(job.webinarId)}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </Shell>
  );
}

/** Lista global, para a página inicial. */
export function AiJobsOverview({ className }: { className?: string }) {
  const jobs = useAiJobs();
  if (jobs.length === 0) return null;
  return (
    <section className={cn("grid gap-3", className)}>
      {jobs.map((job) => (
        <Shell key={job.webinarId} job={job}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {job.status === "running"
                  ? "A gerar chat com IA"
                  : job.status === "ready"
                    ? "Chat gerado e pronto a rever"
                    : "A geração falhou"}
                {job.status === "running" && <Bars />}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {job.webinarTitle}
                {job.status === "running" ? ` · ${AI_JOB_STAGES[job.stage]}…` : ""}
              </p>
            </div>
            <Button size="sm" variant={job.status === "ready" ? "default" : "outline"} asChild>
              <Link to="/webinars/$webinarId/edit" params={{ webinarId: job.webinarId }}>
                {job.status === "ready" ? "Rever comentários" : "Abrir editor"}
              </Link>
            </Button>
          </div>
        </Shell>
      ))}
    </section>
  );
}

function SyncShell({ job, children }: { job: SyncJob; children: React.ReactNode }) {
  const running = job.status === "running";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4",
        job.status === "error"
          ? "border-destructive/40 bg-destructive/5"
          : "border-primary/30 bg-primary/5",
      )}
    >
      {running && <span className="nw-ai-sweep pointer-events-none absolute inset-0" aria-hidden />}
      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            job.status === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
            running && "nw-ai-pulse",
          )}
        >
          {job.status === "error" ? (
            <AlertTriangle className="size-5" />
          ) : job.status === "done" ? (
            <Check className="size-5" />
          ) : (
            <CalendarClock className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {running && (
        <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-primary/15">
          <span
            className="block h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${Math.max(8, job.progress)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function syncTitle(job: SyncJob) {
  return job.status === "running"
    ? "A sincronizar comentários com a fala"
    : job.status === "done"
      ? "Comentários sincronizados com a fala"
      : "A sincronização falhou";
}

/** Estado da sincronização de um webinar, dentro do editor. */
export function SyncJobBanner({ job }: { job: SyncJob }) {
  return (
    <SyncShell job={job}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {syncTitle(job)}
            {job.status === "running" && <Bars />}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {job.status === "running"
              ? `${job.note} Pode continuar a trabalhar, isto corre em segundo plano.`
              : job.note}
          </p>
        </div>
        {job.status !== "running" && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Dispensar"
            onClick={() => dismissSyncJob(job.webinarId)}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </SyncShell>
  );
}

/** Lista global das sincronizações, para a página inicial. */
export function SyncJobsOverview({ className }: { className?: string }) {
  const jobs = useSyncJobs();
  if (jobs.length === 0) return null;
  return (
    <section className={cn("grid gap-3", className)}>
      {jobs.map((job) => (
        <SyncShell key={job.webinarId} job={job}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {syncTitle(job)}
                {job.status === "running" && <Bars />}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {job.webinarTitle} · {job.note}
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link to="/webinars/$webinarId/edit" params={{ webinarId: job.webinarId }}>
                Abrir editor
              </Link>
            </Button>
          </div>
        </SyncShell>
      ))}
    </section>
  );
}
