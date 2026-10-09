/**
 * O Painel por agora: o próximo webinar e o atalho para criar um. O resto volta quando o
 * Painel for desenhado (as peças antigas continuam em panels.tsx).
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Plus, Radio } from "lucide-react";
import { Spheres } from "@/components/ds/imagery";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NextWebinar = {
  id: string;
  title: string;
  /** live: a decorrer; next: marcado; open: just in time ou sempre disponível (sempre a receber). */
  state: "live" | "next" | "open";
  /** «A cada 15 min», «Sempre disponível»: a etiqueta do open. */
  badge?: string;
  /** «Começa quinta-feira, 9 de outubro às 20:00.» */
  detail: string;
};

export function DashboardHome({
  loading,
  next,
  latestId,
}: {
  loading: boolean;
  next: NextWebinar | null;
  /** O webinar mais recente (onde marcar a data), ou null sem nenhum. */
  latestId: string | null;
}) {
  const hasWebinars = latestId !== null;
  const running = next?.state === "live" || next?.state === "open";
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <section
        className={cn(
          "relative flex min-h-[248px] min-w-0 flex-col justify-between gap-6 overflow-hidden rounded-card bg-card p-5 sm:p-7",
          hasWebinars ? "md:col-span-2" : "md:col-span-3",
        )}
      >
        <Spheres className="absolute -top-10 -right-16 hidden h-[115%] w-[48%] opacity-90 sm:block" />
        <div className="relative min-w-0 sm:max-w-[62%]">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium",
              !hasWebinars && !loading && "hidden",
              next?.state === "live"
                ? "bg-live text-white"
                : next?.state === "open"
                  ? "bg-success-soft text-success"
                  : "bg-chip text-foreground",
            )}
          >
            {running ? (
              <Radio className="size-3.5" strokeWidth={1.75} />
            ) : (
              <CalendarDays className="size-3.5" strokeWidth={1.75} />
            )}
            {next?.state === "live"
              ? "A decorrer agora"
              : next?.state === "open"
                ? next.badge
                : "Próximo webinar"}
          </span>
          {loading ? (
            <div className="mt-4 h-8 w-64 max-w-full animate-pulse rounded-sm bg-chip" />
          ) : (
            <>
              <h2 className="mt-4 text-[22px] leading-7 font-semibold tracking-[var(--tracking-heading)] sm:text-[26px] sm:leading-8">
                {next
                  ? next.title
                  : hasWebinars
                    ? "Nenhuma sessão marcada"
                    : "Crie o primeiro webinar"}
              </h2>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {next
                  ? next.detail
                  : hasWebinars
                    ? "Marque a data na agenda do webinar."
                    : "Vídeo, chat e oferta, num só sítio."}
              </p>
            </>
          )}
        </div>
        {!loading && (
          <div className="relative flex flex-wrap gap-2">
            {next ? (
              <>
                <Button asChild size="lg">
                  <Link to="/live/$webinarId" params={{ webinarId: next.id }}>
                    {running ? "Abrir sala" : "Testar sala"} <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/webinars/$webinarId/edit" params={{ webinarId: next.id }}>
                    Editar
                  </Link>
                </Button>
              </>
            ) : latestId ? (
              // A data marca-se na etapa Agenda do editor, não na página Agenda.
              <Button asChild size="lg">
                <Link
                  to="/webinars/$webinarId/edit"
                  params={{ webinarId: latestId }}
                  search={{ step: "agenda" }}
                >
                  Marcar data <ArrowRight />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link to="/webinars/new">
                  Criar webinar <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        )}
      </section>

      {/* Atalho: criar um webinar, do tamanho de um botão grande no telemóvel. Sem nenhum
          webinar, o botão do cartão de cima já é este atalho. */}
      {hasWebinars && (
        <Link
          to="/webinars/new"
          className="group flex min-h-[88px] items-center gap-4 rounded-card bg-card p-5 transition-shadow hover:shadow-[var(--shadow-raised)] focus-visible:outline-none focus-visible:ring-focus sm:p-7 md:flex-col md:items-start md:justify-between"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform group-hover:scale-105">
            <Plus className="size-6" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 md:flex-none">
            <span className="block text-[17px] font-semibold tracking-[-0.01em]">
              Criar webinar
            </span>
            <span className="block text-[13px] text-muted-foreground">Começa em rascunho.</span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-gray-600 md:hidden" aria-hidden />
        </Link>
      )}
    </div>
  );
}
