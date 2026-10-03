import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CalendarClock,
  Check,
  Headset,
  Lightbulb,
  PartyPopper,
  Rocket,
  TrendingUp,
  Wand2,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { lifecycleOf, useParticipants, useWebinars, useWorkspace } from "@/lib/data";
import { formatSessionStart } from "@/lib/schedule";
import { AI_JOB_STAGES, useAiJobs } from "@/lib/ai-comment-jobs";
import { useSyncJobs } from "@/lib/sync-jobs";
import { friendlyError } from "@/lib/friendly-error";
import { supabase } from "@/integrations/supabase/client";
import { useSupportSetup } from "@/lib/support/hooks";
import { canAttend, slaState } from "@/lib/support/model";
import { cn } from "@/lib/utils";

type Notice = {
  id: string;
  icon: "rocket" | "party" | "trend" | "ai" | "ai-done" | "calendar" | "tip" | "case";
  title: string;
  body: string;
  to?: string;
  live?: boolean;
};

const ICONS = {
  rocket: Rocket,
  party: PartyPopper,
  trend: TrendingUp,
  ai: Wand2,
  "ai-done": Check,
  calendar: CalendarClock,
  tip: Lightbulb,
  case: Headset,
} as const;

const READ_KEY = "novawebinar:notices-read";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** O que pede a atenção de quem atende: casos sem dono, prazos e o que lhe foi atribuído. */
function useCaseNotices(organizationId: string | undefined, enabled: boolean): Notice[] {
  const scope = enabled ? organizationId : undefined;
  const { data: setup } = useSupportSetup(scope);
  const { data: open } = useQuery({
    queryKey: ["support", "cases", "bell", scope],
    enabled: Boolean(scope),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_cases")
        .select(
          "id, status, assigned_staff_id, sla_deadline, sla_minutes, first_response_at, sla_breached_at",
        )
        .eq("organization_id", scope!)
        .not("status", "in", "(resolved,closed)")
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  return useMemo(() => {
    if (!open?.length) return [];
    const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);
    const notices: Notice[] = [];
    const late = open.filter((c) => slaState(c).state === "breached" && !c.first_response_at).length;
    const risk = open.filter((c) => slaState(c).state === "risk").length;
    const unassigned = open.filter((c) => !c.assigned_staff_id).length;
    const mine = open.filter(
      (c) => c.assigned_staff_id === setup?.staffId && !c.first_response_at,
    ).length;
    if (late > 0) {
      notices.push({
        id: "cases-late",
        icon: "case",
        title: count(late, "Um caso passou o prazo de resposta", "casos passaram o prazo de resposta"),
        body: "O cliente ainda está à espera da primeira resposta de uma pessoa.",
        to: "/cases",
        live: true,
      });
    }
    if (risk > 0) {
      notices.push({
        id: "cases-risk",
        icon: "case",
        title: count(risk, "Um caso com o prazo quase a terminar", "casos com o prazo quase a terminar"),
        body: "Responda antes de o prazo acabar.",
        to: "/cases",
        live: true,
      });
    }
    if (setup?.staffId && mine > 0) {
      notices.push({
        id: "cases-mine",
        icon: "case",
        title: count(mine, "Tem um caso à sua espera", "casos à sua espera"),
        body: "Foram-lhe atribuídos e ainda não tiveram resposta.",
        to: "/cases",
        live: true,
      });
    }
    if (unassigned > 0) {
      notices.push({
        id: "cases-unassigned",
        icon: "case",
        title: count(unassigned, "Um caso sem responsável", "casos sem responsável"),
        body: "Ninguém disponível tinha as competências pedidas. Atribua-os à mão.",
        to: "/cases",
        live: true,
      });
    }
    return notices;
  }, [open, setup?.staffId]);
}

/** Sessões que a base de dados deu como terminadas nas últimas 24 horas. */
function useEndedSessions(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["webinar-sessions", "ended", organizationId],
    enabled: Boolean(organizationId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webinar_sessions")
        .select("id, webinar_id, ends_at, ended_at, webinars(public_title, internal_name, timezone)")
        .eq("organization_id", organizationId!)
        .gte("ended_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .order("ended_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Automações que pedem atenção: execuções falhadas nas últimas 24 horas e execuções
 * prontas há mais de 5 minutos sem ninguém as executar (o servidor não está a correr).
 */
function useAutomationAlerts(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["automation-runs", "alerts", organizationId],
    enabled: Boolean(organizationId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const stale = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("automation_runs")
        .select("id, status, error, finished_at, automations(name)")
        .eq("organization_id", organizationId!)
        .or(`and(status.eq.failed,finished_at.gte.${dayAgo}),and(status.eq.ready,scheduled_for.lt.${stale})`)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useNotices() {
  const { data: workspace } = useWorkspace();
  const { data: webinars } = useWebinars(workspace?.organizationId);
  const { data: ended = [] } = useEndedSessions(workspace?.organizationId);
  const { data: automationAlerts = [] } = useAutomationAlerts(workspace?.organizationId);
  const { data: participants } = useParticipants(workspace?.organizationId);
  const aiJobs = useAiJobs();
  const syncJobs = useSyncJobs();
  const caseNotices = useCaseNotices(workspace?.organizationId, canAttend(workspace?.role));

  return useMemo<Notice[]>(() => {
    if (!workspace || !webinars) return caseNotices;
    // Quem só atende não cria webinars: as dicas de configuração não são para si.
    if (workspace.role === "support") return caseNotices;
    const notices: Notice[] = [...caseNotices];
    const now = Date.now();

    // Trabalhos de IA em curso / concluídos
    for (const job of aiJobs) {
      if (job.status === "running") {
        notices.push({
          id: `ai-running-${job.webinarId}`,
          icon: "ai",
          title: "A gerar chat com IA",
          body: `${job.webinarTitle} · ${AI_JOB_STAGES[job.stage]}…`,
          to: `/webinars/${job.webinarId}/edit`,
          live: true,
        });
      } else if (job.status === "ready") {
        notices.push({
          id: `ai-ready-${job.webinarId}-${job.startedAt}`,
          icon: "ai-done",
          title: "Acabámos de gerar o chat com IA",
          body: `${job.drafts?.length ?? 0} comentários prontos a rever em “${job.webinarTitle}”. Nada foi publicado.`,
          to: `/webinars/${job.webinarId}/edit`,
          live: true,
        });
      } else {
        notices.push({
          id: `ai-error-${job.webinarId}-${job.startedAt}`,
          icon: "ai",
          title: "A geração de chat com IA falhou",
          body: `${job.webinarTitle} · ${friendlyError(job.error, "Não foi possível concluir a geração. Tente novamente.")}`,
          to: `/webinars/${job.webinarId}/edit`,
        });
      }
    }

    // Sincronização dos comentários com a fala
    for (const job of syncJobs) {
      notices.push({
        id: `sync-${job.status}-${job.webinarId}-${job.startedAt}`,
        icon: "calendar",
        title:
          job.status === "running"
            ? "A sincronizar comentários com a fala"
            : job.status === "done"
              ? "Comentários sincronizados com a fala"
              : "A sincronização falhou",
        body: `${job.webinarTitle} · ${job.note}`,
        to: `/webinars/${job.webinarId}/edit`,
        ...(job.status === "running" ? { live: true } : {}),
      });
    }

    // Sem webinars
    if (webinars.length === 0) {
      notices.push({
        id: "first-webinar",
        icon: "rocket",
        title: "Crie o seu primeiro webinar",
        body: "Demora menos de 5 minutos: escolha o vídeo, marque a data e partilhe o link.",
        to: "/webinars/new",
      });
      return notices;
    }

    // Primeiro webinar criado há pouco
    const newest = webinars[0]!;
    const newestAge = now - new Date(newest.created_at).getTime();
    if (webinars.length === 1 && newestAge < 24 * 3600 * 1000) {
      notices.push({
        id: `created-${newest.id}`,
        icon: "party",
        title: "Criou o seu primeiro webinar 🎉",
        body: "Veja as dicas: defina a capa do login, programe o chat e teste a sala antes de partilhar.",
        to: `/webinars/${newest.id}/edit`,
      });
    }

    // Sessões que terminaram: o registo é da base de dados, feito à hora prevista.
    for (const session of ended) {
      const title = session.webinars?.public_title || session.webinars?.internal_name || "O webinar";
      notices.push({
        id: `session-ended-${session.id}`,
        icon: "calendar",
        title: "A sessão terminou",
        body: `“${title}” terminou ${formatSessionStart(Date.parse(session.ends_at ?? session.ended_at!), session.webinars?.timezone)}. Veja quem assistiu e quem comprou.`,
        to: `/webinars/${session.webinar_id}/metrics`,
      });
    }

    // Automações: o que falhou e o que ficou pronto sem ninguém o executar.
    const failedRuns = automationAlerts.filter((r) => r.status === "failed");
    if (failedRuns.length > 0) {
      const last = failedRuns[0]!;
      notices.push({
        id: `automations-failed-${last.id}`,
        icon: "tip",
        title:
          failedRuns.length === 1
            ? "Uma execução de automação falhou"
            : `${failedRuns.length} execuções de automações falharam`,
        body: `${last.automations?.name ?? "Automação"}: ${last.error ?? "sem resposta do destino"}`,
        to: "/automations",
      });
    }
    const stuck = automationAlerts.filter((r) => r.status === "ready").length;
    if (stuck > 0) {
      notices.push({
        id: "automations-stuck",
        icon: "tip",
        title: "Automações à espera do servidor",
        body: `${stuck === 1 ? "Uma execução está pronta" : `${stuck} execuções estão prontas`} há mais de 5 minutos e ainda não foi executada. O servidor da aplicação tem de estar a correr.`,
        to: "/automations",
        live: true,
      });
    }

    // Webinar a começar em breve (data única ou repetição, pelo ciclo de vida)
    for (const w of webinars) {
      const lifecycle = lifecycleOf(w);
      if (lifecycle.kind !== "session" || lifecycle.state !== "scheduled") continue;
      const start = lifecycle.startMs;
      const diff = start - now;
      if (diff > 0 && diff < 24 * 3600 * 1000) {
        const hours = Math.max(1, Math.round(diff / 3600000));
        notices.push({
          id: `soon-${w.id}`,
          icon: "calendar",
          title: "O seu webinar começa em breve",
          body: `“${w.public_title || w.internal_name}” arranca ${diff < 3600000 ? "dentro de minutos" : `em cerca de ${hours} ${hours === 1 ? "hora" : "horas"}`}.`,
          to: `/webinars/${w.id}/edit`,
        });
      }
    }

    // Crescimento de participantes
    const recent = (participants ?? []).filter(
      (p) => now - new Date(p.joined_at).getTime() < 24 * 3600 * 1000,
    );
    if (recent.length >= 5) {
      notices.push({
        id: `growth-${new Date().toDateString()}`,
        icon: "trend",
        title: "O seu webinar está a crescer",
        body: `${recent.length} participantes entraram nas últimas 24 horas. Continue a partilhar o link.`,
        to: "/contacts",
      });
    }

    // Dicas de configuração
    const withoutVideo = webinars.find((w) => !w.video_source_id);
    if (withoutVideo) {
      notices.push({
        id: `tip-video-${withoutVideo.id}`,
        icon: "tip",
        title: "Veja esta dica",
        body: `“${withoutVideo.public_title || withoutVideo.internal_name}” ainda não tem vídeo. Escolha a fonte no passo Vídeo.`,
        to: `/webinars/${withoutVideo.id}/edit`,
      });
    }
    return notices.slice(0, 8);
  }, [workspace, webinars, participants, aiJobs, syncJobs, caseNotices, ended, automationAlerts]);
}

export function NotificationsBell({
  quiet = false,
  side = "bottom",
  align = "end",
}: {
  /** Na barra lateral: botão discreto (sem fundo), menu a abrir para cima. */
  quiet?: boolean;
  side?: "top" | "bottom" | "right";
  align?: "start" | "end";
} = {}) {
  const navigate = useNavigate();
  const notices = useNotices();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const visible = notices.filter((n) => n.live || !dismissed.includes(n.id));
  const unread = visible.length;

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = [...prev, id];
      localStorage.setItem(READ_KEY, JSON.stringify(next.slice(-50)));
      return next;
    });
  };

  const markAllRead = () => {
    const next = [...dismissed, ...visible.filter((n) => !n.live).map((n) => n.id)];
    localStorage.setItem(READ_KEY, JSON.stringify(next.slice(-50)));
    setDismissed(next);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificações"
          className={cn(
            "relative data-[state=open]:bg-navy data-[state=open]:text-white",
            quiet ? "size-9 text-gray-700 hover:bg-[var(--hover-ghost)]" : "bg-white hover:bg-gray-100",
          )}
        >
          <Bell strokeWidth={1.5} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-white ring-2 ring-canvas">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          {unread > 0 && (
            <button
              className="text-xs font-medium text-primary hover:underline"
              onClick={markAllRead}
            >
              Marcar tudo como lido
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Bell className="size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">Está tudo em dia</p>
              <p className="text-xs text-muted-foreground">
                Quando houver novidades sobre os seus webinars, aparecem aqui.
              </p>
            </div>
          ) : (
            visible.map((notice) => {
              const Icon = ICONS[notice.icon];
              const inner = (
                <div className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                      notice.live
                        ? "nw-ai-pulse bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">{notice.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {notice.body}
                    </span>
                  </span>
                  {!notice.live && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Dispensar notificação"
                      className="mt-1 shrink-0 cursor-pointer text-muted-foreground/60 transition-colors hover:text-foreground"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        dismiss(notice.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        event.stopPropagation();
                        dismiss(notice.id);
                      }}
                    >
                      <X className="size-3.5" />
                    </span>
                  )}
                </div>
              );
              return (
                <div
                  key={notice.id}
                  role="button"
                  tabIndex={0}
                  className="block w-full cursor-pointer border-b text-left last:border-0 hover:bg-muted/50"
                  onClick={() => {
                    if (notice.to) {
                      setOpen(false);
                      void navigate({ to: notice.to });
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    if (notice.to) {
                      setOpen(false);
                      void navigate({ to: notice.to });
                    }
                  }}
                >
                  {inner}
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
