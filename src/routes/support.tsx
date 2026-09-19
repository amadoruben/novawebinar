import { friendlyError } from "@/lib/friendly-error";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Headset, Radio, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptySection } from "@/components/page-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  useConversations,
  useInvalidate,
  useMessages,
  useWebinars,
  useWorkspace,
} from "@/lib/data";
import { useLiveViewers } from "@/lib/live-presence";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot } from "lucide-react";
import {
  discardAgentSuggestion,
  listAgentSuggestions,
  sendAgentSuggestion,
} from "@/lib/ai-agent/agent.functions";
import { SourceList } from "@/components/ai-agent/agent-panel";
import { sessionWindow } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Suporte ao vivo | NovaWebinar" },
      {
        name: "description",
        content: "Atenda em tempo real quem está agora dentro das suas sessões a decorrer.",
      },
      { property: "og:title", content: "Suporte ao vivo | NovaWebinar" },
      {
        property: "og:description",
        content: "Responda de imediato aos participantes das sessões em curso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});

function hourLabel(value: string) {
  return new Date(value).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function SupportPage() {
  const { data: workspace } = useWorkspace();
  const organizationId = workspace?.organizationId;
  const invalidate = useInvalidate();
  const { data: webinars = [] } = useWebinars(organizationId);
  const { data: conversations = [] } = useConversations(organizationId);
  const viewers = useLiveViewers(organizationId);
  const [activeWebinar, setActiveWebinar] = useState<string | undefined>();
  const [activeId, setActiveId] = useState<string | undefined>();
  const [mobileStep, setMobileStep] = useState<"sessions" | "conversations" | "messages">(
    "sessions",
  );
  const [reply, setReply] = useState("");
  const [tick, setTick] = useState(0);
  const endRef = useRef<HTMLDivElement | null>(null);

  /** Recalcula de minuto a minuto quais as sessões que estão mesmo a decorrer. */
  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const liveWebinars = useMemo(() => {
    void tick;
    return webinars.filter((w) => {
      if (w.status === "draft") return false;
      const duration = w.video_sources?.duration_seconds || w.duration_seconds || 0;
      return sessionWindow({ ...w, duration_seconds: duration }, Date.now()).live;
    });
  }, [webinars, tick]);

  const selected = liveWebinars.find((w) => w.id === activeWebinar) ?? liveWebinars[0];

  const roomConversations = useMemo(
    () => (selected ? conversations.filter((c) => c.webinar_id === selected.id) : []),
    [conversations, selected],
  );
  const active = roomConversations.find((c) => c.id === activeId) ?? roomConversations[0];
  const { data: messages = [] } = useMessages(active?.id);

  // Sugestões do Agente IA à espera de aprovação da equipa.
  const fetchSuggestions = useServerFn(listAgentSuggestions);
  const approveSuggestion = useServerFn(sendAgentSuggestion);
  const dropSuggestion = useServerFn(discardAgentSuggestion);
  const { data: suggestions = [], refetch: refetchSuggestions } = useQuery({
    queryKey: ["agent-suggestions", selected?.id],
    enabled: Boolean(selected?.id),
    refetchInterval: 8000,
    queryFn: () => fetchSuggestions({ data: { webinarId: selected!.id } }),
  });
  const suggestion = suggestions.find((item) => item.conversationId === active?.id) ?? null;
  const [draftAnswer, setDraftAnswer] = useState("");
  useEffect(() => {
    setDraftAnswer(suggestion?.answer ?? "");
  }, [suggestion?.id, suggestion?.answer]);

  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel("support-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "private_messages" }, () => {
        invalidate(["messages", "conversations"]);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "private_conversations" },
        () => {
          invalidate(["conversations"]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, invalidate]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, active?.id]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active || !workspace || !reply.trim()) return;
    const body = reply.trim();
    setReply("");
    const { error } = await supabase.from("private_messages").insert({
      conversation_id: active.id,
      organization_id: workspace.organizationId,
      participant_id: active.participant_id,
      sender_kind: "team",
      sender_user_id: workspace.userId,
      body,
    });
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    await supabase
      .from("private_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        status: "active",
        assigned_to: workspace.userId,
      })
      .eq("id", active.id);
    invalidate(["messages", "conversations"]);
  };

  const online = selected ? viewers.filter((v) => v.webinarId === selected.id).length : 0;

  return (
    <AppShell
      title="Suporte ao vivo"
      description="Sessões a decorrer neste momento e as pessoas que precisam de resposta já."
      action={false}
    >
      {liveWebinars.length === 0 ? (
        <EmptySection
          title="Nenhuma sessão a decorrer"
          description="Quando uma sessão entrar no ar, ela aparece aqui com as conversas a precisar de resposta."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_20rem_1fr]">
          <aside
            className={cn(
              "rounded-lg border bg-card p-3",
              mobileStep !== "sessions" && "hidden lg:block",
            )}
          >
            <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              A decorrer
            </p>
            <ul className="space-y-1.5">
              {liveWebinars.map((w) => {
                const count = viewers.filter((v) => v.webinarId === w.id).length;
                const pending = conversations.filter(
                  (c) => c.webinar_id === w.id && c.status === "waiting",
                ).length;
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveWebinar(w.id);
                        setActiveId(undefined);
                        setMobileStep("conversations");
                      }}
                      className={cn(
                        "w-full rounded-md px-3 py-2.5 text-left transition-colors",
                        selected?.id === w.id ? "bg-primary/10 text-foreground" : "hover:bg-muted",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Radio className="size-4 text-success" />
                        <span className="truncate">{w.public_title}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5" /> {count}
                        </span>
                        {pending > 0 ? (
                          <span className="text-warning-foreground">{pending} à espera</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <aside
            className={cn(
              "rounded-lg border bg-card p-3",
              mobileStep !== "conversations" && "hidden lg:block",
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 lg:hidden"
              onClick={() => setMobileStep("sessions")}
            >
              <ArrowLeft /> Sessões
            </Button>
            <p className="flex items-center justify-between px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Conversas
              <span className="normal-case">{online} na sala</span>
            </p>
            {roomConversations.length === 0 ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">
                Ninguém escreveu ainda nesta sessão. As mensagens privadas chegam aqui em tempo
                real.
              </p>
            ) : (
              <ul className="max-h-[32rem] space-y-1.5 overflow-y-auto">
                {roomConversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveId(c.id);
                        setMobileStep("messages");
                      }}
                      className={cn(
                        "w-full rounded-md px-3 py-2.5 text-left transition-colors",
                        active?.id === c.id ? "bg-muted" : "hover:bg-muted/60",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {c.participants?.name ?? "Participante"}
                        </span>
                        {(c as { needs_human?: boolean }).needs_human ? (
                          <Badge variant="destructive" className="shrink-0">
                            precisa de humano
                          </Badge>
                        ) : c.status === "waiting" ? (
                          <Badge variant="warning" className="shrink-0">
                            à espera
                          </Badge>
                        ) : null}
                      </span>
                      {(c as { escalation_reason?: string | null }).escalation_reason ? (
                        <span className="mt-0.5 block truncate text-xs text-destructive">
                          {(c as { escalation_reason?: string | null }).escalation_reason}
                        </span>
                      ) : null}
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {hourLabel(c.last_message_at)} · {c.participants?.email ?? "sem email"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section
            className={cn(
              "min-h-[34rem] flex-col rounded-lg border bg-card",
              mobileStep === "messages" ? "flex" : "hidden lg:flex",
            )}
          >
            <header className="flex items-center gap-2 border-b px-5 py-4">
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 lg:hidden"
                onClick={() => setMobileStep("conversations")}
                aria-label="Voltar às conversas"
              >
                <ArrowLeft />
              </Button>
              <Headset className="size-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {active?.participants?.name ?? "Selecione uma conversa"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {selected?.public_title ?? ""}
                </p>
              </div>
              {active ? (
                <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <Bot className="size-4 text-primary" />
                  Assistente IA
                  <Switch
                    checked={!active.ai_paused}
                    onCheckedChange={async (checked) => {
                      const { error } = await supabase
                        .from("private_conversations")
                        .update({ ai_paused: !checked })
                        .eq("id", active.id);
                      if (error) {
                        toast.error(friendlyError(error));
                        return;
                      }
                      toast.success(
                        checked
                          ? "Assistente IA ativo nesta conversa."
                          : "Assistente IA em pausa nesta conversa.",
                      );
                      invalidate(["conversations"]);
                    }}
                    aria-label="Ativar ou pausar o assistente IA"
                  />
                </label>
              ) : null}
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex",
                    m.sender_kind === "participant" ? "justify-start" : "justify-end",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[82%] rounded-lg px-3.5 py-2.5 text-sm",
                      m.sender_kind === "team"
                        ? "bg-primary text-primary-foreground"
                        : m.sender_kind === "ai_agent"
                          ? "border border-primary/30 bg-primary/5"
                          : "bg-muted",
                    )}
                  >
                    {m.sender_kind === "ai_agent" ? (
                      <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-primary">
                        <Bot className="size-3.5" /> Assistente
                      </span>
                    ) : null}
                    {m.body}
                    <span className="mt-1 block text-[11px] opacity-70">
                      {hourLabel(m.created_at)}
                    </span>
                  </div>
                </div>
              ))}
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem mensagens nesta conversa.</p>
              ) : null}
              <div ref={endRef} />
            </div>

            {suggestion ? (
              <div className="space-y-3 border-t bg-primary/5 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  <Bot className="size-4" /> Resposta do assistente ·{" "}
                  {Math.round(suggestion.confidence * 100)}% de confiança
                </p>
                <Input value={draftAnswer} onChange={(e) => setDraftAnswer(e.target.value)} />
                <SourceList sources={suggestion.sources} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!draftAnswer.trim()}
                    onClick={async () => {
                      try {
                        await approveSuggestion({
                          data: { id: suggestion.id, finalAnswer: draftAnswer.trim() },
                        });
                        invalidate(["messages", "conversations"]);
                        void refetchSuggestions();
                      } catch (error) {
                        toast.error(friendlyError(error));
                      }
                    }}
                  >
                    Enviar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await dropSuggestion({ data: { id: suggestion.id } });
                      void refetchSuggestions();
                      toast.success("Assumiu a conversa. A sugestão foi descartada.");
                    }}
                  >
                    Assumir conversa
                  </Button>
                </div>
              </div>
            ) : null}

            <form onSubmit={send} className="flex items-center gap-2 border-t p-4">
              <Input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Escreva a resposta para o participante"
                disabled={!active}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!active || !reply.trim()}
                aria-label="Enviar resposta"
              >
                <ArrowUp className="size-4" />
              </Button>
            </form>
          </section>
        </div>
      )}
    </AppShell>
  );
}
