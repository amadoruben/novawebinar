import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CalendarClock,
  Check,
  Lightbulb,
  PartyPopper,
  Rocket,
  TrendingUp,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useParticipants, useWebinars, useWorkspace } from "@/lib/data";
import { AI_JOB_STAGES, useAiJobs } from "@/lib/ai-comment-jobs";
import { useSyncJobs } from "@/lib/sync-jobs";
import { friendlyError } from "@/lib/friendly-error";
import { cn } from "@/lib/utils";

type Notice = {
  id: string;
  icon: "rocket" | "party" | "trend" | "ai" | "ai-done" | "calendar" | "tip";
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
} as const;

const READ_KEY = "novawebinar:notices-read";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function useNotices() {
  const { data: workspace } = useWorkspace();
  const { data: webinars } = useWebinars(workspace?.organizationId);
  const { data: participants } = useParticipants(workspace?.organizationId);
  const aiJobs = useAiJobs();
  const syncJobs = useSyncJobs();

  return useMemo<Notice[]>(() => {
    if (!workspace || !webinars) return [];
    const notices: Notice[] = [];
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

    // Webinar a começar em breve
    for (const w of webinars) {
      if (w.status === "draft" || !w.scheduled_at) continue;
      const start = new Date(w.scheduled_at).getTime();
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
  }, [workspace, webinars, participants, aiJobs, syncJobs]);
}

export function NotificationsBell() {
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
        <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
          <Bell />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,380px)] p-0">
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
