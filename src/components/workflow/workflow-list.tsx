import { Link } from "@tanstack/react-router";
import { ChevronRight, Plus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, useAutomationStats, type Automation, type Workflow } from "@/lib/data";
import { cn } from "@/lib/utils";

type Stats = ReturnType<typeof useAutomationStats>["data"];

/** Os fluxos da organização, um por webinar: nome, webinar, estado e o que está a correr. */
export function WorkflowList({
  workflows,
  automations,
  stats,
  loading,
}: {
  workflows: Workflow[];
  automations: Automation[];
  stats: Stats;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-32 w-full" />;
  if (!workflows.length)
    return (
      <div className="rounded-card bg-card p-10 text-center">
        <Video className="mx-auto size-8 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        <p className="mt-3 font-medium">Ainda sem fluxos</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Um fluxo por webinar. Primeiro escolhe o webinar, o grupo e os canais; depois desenha o que sai antes, no dia e
          depois.
        </p>
        <Button className="mt-5" asChild>
          <Link to="/automations/new">
            <Plus /> Novo fluxo
          </Link>
        </Button>
      </div>
    );
  return (
    <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-card bg-card">
      {workflows.map((w) => {
        const own = automations.filter((a) => a.workflow_id === w.id && !a.archived_at);
        const active = own.filter((a) => a.active).length;
        const s = own.map((a) => stats?.get(a.id));
        const sum = (k: "pending" | "failed") => s.reduce((n, x) => n + (x?.[k] ?? 0), 0);
        const next = s.map((x) => x?.nextRunAt).filter(Boolean).sort()[0] ?? null;
        const state = !w.webinar_id
          ? { label: "Sem webinar", cls: "bg-white text-muted-foreground ring-1 ring-[var(--border-subtle)]" }
          : active
            ? { label: `${active} ${active === 1 ? "ligada" : "ligadas"}`, cls: "bg-success-soft text-success" }
            : { label: "Rascunho", cls: "bg-warning/10 text-warning" };
        const webinar = w.webinars
          ? `${w.webinars.public_title || w.webinars.internal_name}${w.webinars.scheduled_at ? ` · ${formatDateTime(w.webinars.scheduled_at)}` : ""}`
          : "Escolha o webinar para ligar";
        const bits = [
          webinar,
          `${own.length} ${own.length === 1 ? "automação" : "automações"}`,
          sum("pending") > 0 ? `${sum("pending")} em curso` : null,
          sum("failed") > 0 ? `${sum("failed")} ${sum("failed") === 1 ? "falha" : "falhas"}` : null,
          next ? `próxima ${formatDateTime(next)}` : null,
        ].filter(Boolean);
        return (
          <li key={w.id}>
            <Link
              to="/automations/workflows/$workflowId"
              params={{ workflowId: w.id }}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy text-white">
                <Video className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{w.name}</span>
                <span className="block truncate text-sm text-muted-foreground">{bits.join(" · ")}</span>
              </span>
              <span className={cn("shrink-0 rounded-pill px-2.5 py-1 text-xs font-medium", state.cls)}>{state.label}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
