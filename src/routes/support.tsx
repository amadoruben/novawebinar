import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Bot, CalendarClock, MessageCircle, Radio, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptySection } from "@/components/page-primitives";
import { Avatar, hourLabel, PresenceDot } from "@/components/support/badges";
import { ContactPanel } from "@/components/support/contact-panel";
import { ConversationView } from "@/components/support/conversation-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useWebinars, useWorkspace } from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import { useLiveViewers } from "@/lib/live-presence";
import { sessionWindow } from "@/lib/schedule";
import {
  setMyStatus,
  useCases,
  useDepartments,
  useSkills,
  useStaff,
  useSupportConversations,
  useSupportInvalidate,
  useSupportRealtime,
  useSupportSetup,
  type SupportConversation,
} from "@/lib/support/hooks";
import {
  canAttend,
  intentLabel,
  isOpenStatus,
  priorityRank,
  slaState,
  STAFF_STATUSES,
  type CaseRow,
  type StaffStatus,
} from "@/lib/support/model";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/support")({
  validateSearch: (search: Record<string, unknown>) => ({
    c: typeof search["c"] === "string" ? (search["c"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Atendimento | Convertewebinar" },
      {
        name: "description",
        content: "A IA responde primeiro; o que precisa de uma pessoa chega à equipa certa, com o contexto todo.",
      },
    ],
  }),
  component: SupportPage,
});

type Tab = "all" | "human" | "mine" | "ai";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "human", label: "Precisam de pessoa" },
  { id: "mine", label: "Minhas" },
  { id: "ai", label: "Com a IA" },
];

/** O que a IA fez hoje: quantas conversas resolveu sozinha e quantas passou à equipa. */
function useAiToday(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["support", "events", "ai-today", organizationId],
    enabled: Boolean(organizationId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const count = async (name: string) => {
        const { count: total } = await supabase
          .from("activity_events")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId!)
          .eq("name", name)
          .gte("occurred_at", start.toISOString());
        return total ?? 0;
      };
      const [resolved, escalated] = await Promise.all([count("ai_resolution"), count("ai_escalation")]);
      return { resolved, escalated };
    },
  });
}

function useRegistrations(webinarIds: string[]) {
  return useQuery({
    queryKey: ["support", "registrations", webinarIds],
    enabled: webinarIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const rows = await Promise.all(
        webinarIds.map(async (id) => {
          const { count } = await supabase
            .from("participants")
            .select("id", { count: "exact", head: true })
            .eq("webinar_id", id);
          return [id, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(rows) as Record<string, number>;
    },
  });
}

function SupportPage() {
  const { c: requested } = Route.useSearch();
  const navigate = useNavigate();
  const { data: workspace } = useWorkspace();
  const organizationId = workspace?.organizationId;
  const allowed = canAttend(workspace?.role);
  const scope = allowed ? organizationId : undefined;

  const { data: setup } = useSupportSetup(scope);
  useSupportRealtime(scope);
  const invalidate = useSupportInvalidate();
  const { data: webinars = [] } = useWebinars(scope);
  const { data: conversations = [], isLoading } = useSupportConversations(scope);
  const { data: cases = [] } = useCases(scope);
  const { data: staff = [] } = useStaff(scope);
  const { data: departments = [] } = useDepartments(scope);
  const { data: skills = [] } = useSkills(scope);
  const { data: aiToday } = useAiToday(scope);
  const viewers = useLiveViewers(scope);

  const [tab, setTab] = useState<Tab>("all");
  const [webinarId, setWebinarId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<"list" | "chat" | "contact">("list");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const myStaffId = setup?.staffId ?? null;
  const me = staff.find((s) => s.id === myStaffId);

  const openCases = useMemo(() => {
    const map = new Map<string, CaseRow>();
    for (const c of cases) if (c.conversation_id && isOpenStatus(c.status)) map.set(c.conversation_id, c);
    return map;
  }, [cases]);

  const needsPerson = (c: SupportConversation) => openCases.has(c.id) || c.needs_human || c.ai_paused;

  const counts = useMemo(
    () => ({
      all: conversations.length,
      human: conversations.filter(needsPerson).length,
      mine: conversations.filter((c) => myStaffId && openCases.get(c.id)?.assigned_staff_id === myStaffId).length,
      ai: conversations.filter((c) => !needsPerson(c)).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversations, openCases, myStaffId],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations
      .filter((c) => !webinarId || c.webinar_id === webinarId)
      .filter((c) => {
        if (tab === "human") return needsPerson(c);
        if (tab === "mine") return myStaffId !== null && openCases.get(c.id)?.assigned_staff_id === myStaffId;
        if (tab === "ai") return !needsPerson(c);
        return true;
      })
      .filter(
        (c) =>
          !term ||
          [c.participants?.name, c.participants?.email, c.last_message_preview]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(term)),
      )
      .sort((a, b) => {
        // Primeiro quem espera por uma pessoa, do mais urgente para o menos urgente.
        const caseA = openCases.get(a.id);
        const caseB = openCases.get(b.id);
        if (Boolean(caseA) !== Boolean(caseB)) return caseA ? -1 : 1;
        if (caseA && caseB) {
          const rank = priorityRank(caseA.priority) - priorityRank(caseB.priority);
          if (rank !== 0) return rank;
        }
        return b.last_message_at.localeCompare(a.last_message_at);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, openCases, webinarId, tab, search, myStaffId]);

  const active =
    conversations.find((c) => c.id === requested) ?? (requested ? undefined : visible[0]) ?? visible[0];
  const activeCase = active ? (openCases.get(active.id) ?? null) : null;

  const select = (id: string) => {
    void navigate({ to: "/support", search: { c: id }, replace: true });
    setStep("chat");
  };

  const strip = useMemo(() => {
    void tick;
    const now = Date.now();
    return webinars
      .filter((w) => w.status !== "draft")
      .map((w) => {
        const duration = w.video_sources?.duration_seconds || w.duration_seconds || 0;
        const window = sessionWindow({ ...w, duration_seconds: duration }, now);
        const state: "live" | "soon" | "replay" =
          window.live && (window.endMs === null || window.endMs > now)
            ? "live"
            : window.startMs !== null && window.startMs > now
              ? "soon"
              : "replay";
        const talks = conversations.filter((c) => c.webinar_id === w.id);
        return {
          id: w.id,
          title: w.public_title,
          cover: w.cover_url ?? w.registration_cover_url ?? null,
          state,
          startMs: window.startMs,
          online: viewers.filter((v) => v.webinarId === w.id).length,
          conversations: talks.length,
          waiting: talks.filter(needsPerson).length,
        };
      })
      .filter((w) => w.state !== "replay" || w.conversations > 0 || w.online > 0)
      .sort(
        (a, b) =>
          Number(b.state === "live") - Number(a.state === "live") ||
          b.waiting - a.waiting ||
          (a.startMs ?? Infinity) - (b.startMs ?? Infinity),
      )
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webinars, conversations, viewers, openCases, tick]);
  const { data: registrations = {} } = useRegistrations(strip.map((w) => w.id));

  if (workspace && !allowed) {
    return (
      <AppShell title="Atendimento" action={false}>
        <EmptySection
          title="Sem acesso ao atendimento"
          description="As conversas com os participantes são vistas pelo proprietário, pelos administradores e pela equipa de suporte."
        />
      </AppShell>
    );
  }

  const changeStatus = async (status: StaffStatus) => {
    if (!organizationId) return;
    try {
      await setMyStatus(organizationId, status);
      invalidate("staff");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível mudar o estado."));
    }
  };

  const total = (aiToday?.resolved ?? 0) + (aiToday?.escalated ?? 0);

  return (
    <AppShell
      title="Atendimento"
      description="A IA responde primeiro. O que precisa de uma pessoa chega à equipa certa, com o contexto todo."
      action={
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-card bg-card px-3 py-1.5 text-xs">
            <Bot className="size-4 text-primary" aria-hidden />
            <span className="text-muted-foreground">IA hoje</span>
            <strong>{aiToday?.resolved ?? 0}</strong> resolvidas
            <span className="text-muted-foreground">·</span>
            <strong>{aiToday?.escalated ?? 0}</strong> passadas à equipa
            {total > 0 && (
              <Badge variant="success">{Math.round(((aiToday?.resolved ?? 0) / total) * 100)}%</Badge>
            )}
          </div>
          {me && (
            <Select value={me.status} onValueChange={(value) => void changeStatus(value as StaffStatus)}>
              <SelectTrigger className="h-9 w-44" aria-label="O meu estado">
                <span className="flex items-center gap-2">
                  <PresenceDot status={me.presence} />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {STAFF_STATUSES.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      }
      compact
    >
      {strip.length > 0 && (
        <section className="mb-4" aria-label="Webinars activos">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {strip.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWebinarId((current) => (current === w.id ? null : w.id))}
                aria-pressed={webinarId === w.id}
                className={cn(
                  "flex w-72 shrink-0 items-center gap-3 rounded-card bg-card p-2.5 text-left transition-colors",
                  webinarId === w.id ? "border-primary ring-1 ring-primary/30" : "hover:border-foreground/20",
                )}
              >
                {w.cover ? (
                  <img src={w.cover} alt="" className="size-14 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Radio className="size-5" aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{w.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    {w.state === "live" ? (
                      <Badge variant="destructive">Ao vivo</Badge>
                    ) : w.state === "soon" ? (
                      <Badge variant="warning">Em breve</Badge>
                    ) : (
                      <Badge variant="secondary">Replay</Badge>
                    )}
                    {w.state === "soon" && w.startMs && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarClock className="size-3" aria-hidden />
                        {new Date(w.startMs).toLocaleString("pt-PT", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="size-3" aria-hidden /> {registrations[w.id] ?? "…"} inscritos
                    </span>
                    <span>{w.online} online</span>
                    {w.waiting > 0 && (
                      <span className="font-medium text-destructive">{w.waiting} à espera</span>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[21rem_1fr]">
          <Skeleton className="h-[32rem]" />
          <Skeleton className="h-[32rem]" />
        </div>
      ) : conversations.length === 0 ? (
        <EmptySection
          title="Ainda não há conversas"
          description="Quando um participante escrever numa sala, a conversa aparece aqui. A IA responde ao que sabe e passa à equipa o que precisa de uma pessoa."
        />
      ) : (
        <div className="grid min-h-0 gap-4 lg:h-[calc(100dvh-16.5rem)] lg:min-h-[34rem] lg:grid-cols-[21rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)_23rem]">
          <aside
            className={cn(
              "flex min-h-0 flex-col rounded-card bg-card",
              step !== "list" && "hidden lg:flex",
            )}
          >
            <div className="space-y-2.5 border-b p-3">
              <div className="flex flex-wrap gap-1">
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium",
                      tab === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {item.label} <span className="tabular-nums opacity-70">{counts[item.id]}</span>
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, email ou mensagem"
                  aria-label="Procurar conversas"
                  className="h-9 pl-9"
                />
              </div>
              {webinarId && (
                <button
                  type="button"
                  onClick={() => setWebinarId(null)}
                  className="text-xs text-primary hover:underline"
                >
                  Só {strip.find((w) => w.id === webinarId)?.title ?? "este webinar"} · ver todos
                </button>
              )}
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {visible.length === 0 && (
                <li className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa neste filtro.</li>
              )}
              {visible.map((c) => {
                const open = openCases.get(c.id);
                const unanswered = c.last_sender_kind === "participant";
                const late = open ? ["risk", "breached"].includes(slaState(open).state) : false;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => select(c.id)}
                      className={cn(
                        "flex w-full gap-3 border-b border-l-2 px-3 py-3 text-left transition-colors",
                        active?.id === c.id
                          ? "border-l-primary bg-primary/5"
                          : "border-l-transparent hover:bg-muted/60",
                      )}
                    >
                      <Avatar name={c.participants?.name} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn("truncate text-sm", unanswered ? "font-semibold" : "font-medium")}>
                            {c.participants?.name ?? "Participante"}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {hourLabel(c.last_message_at)}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block truncate text-xs",
                            unanswered ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {c.last_sender_kind === "ai_agent" ? "IA: " : c.last_sender_kind === "team" ? "Equipa: " : ""}
                          {c.last_message_preview || "Sem mensagens"}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1">
                          {open ? (
                            <Badge variant={late ? "destructive" : "warning"}>{intentLabel(open.intent)}</Badge>
                          ) : needsPerson(c) ? (
                            <Badge variant="warning">À espera da equipa</Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Bot className="size-3" aria-hidden /> IA
                            </Badge>
                          )}
                          {open && !open.assigned_staff_id && <Badge variant="destructive">Sem responsável</Badge>}
                          <span className="truncate text-[11px] text-muted-foreground">
                            {c.webinars?.public_title}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section
            className={cn(
              "min-h-[30rem] overflow-hidden rounded-card bg-card lg:min-h-0",
              step === "chat" ? "block" : "hidden lg:block",
            )}
          >
            {active ? (
              <ConversationView
                conversation={active}
                currentCase={activeCase}
                webinar={webinars.find((w) => w.id === active.webinar_id)}
                staff={staff}
                departments={departments}
                myStaffId={myStaffId}
                onBack={() => setStep("list")}
                onShowContact={() => setStep("contact")}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                <MessageCircle className="size-8" aria-hidden />
                <p className="text-sm">Escolha uma conversa.</p>
              </div>
            )}
          </section>

          <aside
            className={cn(
              "min-h-[30rem] overflow-hidden rounded-card bg-card xl:block xl:min-h-0",
              step === "contact" ? "block lg:col-span-2 xl:col-span-1" : "hidden",
            )}
          >
            {step === "contact" && (
              <Button variant="ghost" size="sm" className="m-2 xl:hidden" onClick={() => setStep("chat")}>
                <ArrowLeft /> Conversa
              </Button>
            )}
            {active && (
              <ContactPanel
                conversation={active}
                currentCase={activeCase}
                staff={staff}
                departments={departments}
                skills={skills}
                myStaffId={myStaffId}
              />
            )}
          </aside>
        </div>
      )}
    </AppShell>
  );
}
