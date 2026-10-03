/**
 * Coluna central do Atendimento: a conversa, a leitura que a IA fez dela e a
 * resposta de quem atende. Enquanto uma pessoa tem a conversa, a IA não responde.
 */
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bot, Link2, PanelRight, Send, StickyNote, UserCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SourceList } from "@/components/ai-agent/agent-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { discardAgentSuggestion, sendAgentSuggestion } from "@/lib/ai-agent/agent.functions";
import { publicOrigin } from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import {
  useAgentAnalysis,
  useConversationMessages,
  useSupportInvalidate,
  type StaffMember,
  type SupportConversation,
} from "@/lib/support/hooks";
import { intentLabel, type CaseRow, type DepartmentRow } from "@/lib/support/model";
import {
  assumeConversation,
  replyToConversation,
  setConversationAi,
} from "@/lib/support/support.functions";
import { cn } from "@/lib/utils";
import { clockLabel } from "@/lib/webinar-metrics";
import { AiAvatar, Avatar, CaseStatusBadge, hourLabel, PriorityBadge, SlaBadge } from "./badges";
import { CaseActions, useRunCase } from "./case-tools";

const CLASSIFICATION: Record<string, string> = {
  QUESTION: "Pergunta",
  OBJECTION: "Objecção",
  PURCHASE_INTENT: "Intenção de compra",
  SUPPORT: "Pedido de ajuda",
  COMMENT: "Comentário",
  PRAISE: "Elogio",
  SMALL_TALK: "Conversa",
  HUMAN_REQUEST: "Pediu uma pessoa",
  UNKNOWN: "Por classificar",
};

const DECISION: Record<string, string> = {
  RESPOND: "Responder",
  IGNORE: "Não precisa de resposta",
  SUGGEST_TO_TEAM: "Sugerir à equipa",
  ESCALATE: "Passar para a equipa",
};

type Webinar = { id: string; slug: string; public_title: string; cta_url: string | null };

export function ConversationView({
  conversation,
  currentCase,
  webinar,
  staff,
  departments,
  myStaffId,
  onBack,
  onShowContact,
}: {
  conversation: SupportConversation;
  currentCase: CaseRow | null;
  webinar: Webinar | undefined;
  staff: StaffMember[];
  departments: DepartmentRow[];
  myStaffId: string | null;
  onBack: () => void;
  onShowContact: () => void;
}) {
  const { data: messages = [] } = useConversationMessages(conversation.id);
  const { data: analysis } = useAgentAnalysis(conversation.id);
  const invalidate = useSupportInvalidate();
  const assume = useServerFn(assumeConversation);
  const reply = useServerFn(replyToConversation);
  const toggleAi = useServerFn(setConversationAi);
  const approve = useServerFn(sendAgentSuggestion);
  const discard = useServerFn(discardAgentSuggestion);
  const { run: runCase } = useRunCase();

  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [suggestionId, setSuggestionId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setText("");
    setMode("reply");
    setSuggestionId(undefined);
  }, [conversation.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversation.id]);

  const name = conversation.participants?.name ?? "Participante";
  const owner = staff.find((s) => s.id === currentCase?.assigned_staff_id);
  const aiActive = !currentCase && !conversation.ai_paused && !conversation.needs_human;
  const suggestion = analysis && analysis.status === "suggested" && analysis.answer ? analysis : null;
  const refresh = () => invalidate("messages", "conversations", "cases", "events", "analysis", "staff");

  const guard = async (work: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await work();
      if (done) toast.success(done);
      refresh();
      return true;
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível concluir."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    if (mode === "note") {
      if (!currentCase) return;
      if (await runCase({ action: "note", caseId: currentCase.id, body })) setText("");
      return;
    }
    const sent = await guard(() =>
      reply({ data: { conversationId: conversation.id, body, ...(suggestionId ? { suggestionId } : {}) } }),
    );
    if (sent) {
      setText("");
      setSuggestionId(undefined);
    }
  };

  const insert = (value: string) => setText((current) => (current ? `${current} ${value}` : value));
  const roomLink = webinar ? `${publicOrigin()}/w/${webinar.slug}` : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" onClick={onBack} aria-label="Voltar às conversas">
          <ArrowLeft />
        </Button>
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.webinars?.public_title ?? "Webinar"}
            {conversation.participants?.email && !conversation.participants.email.endsWith("@sala.local")
              ? ` · ${conversation.participants.email}`
              : ""}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="xl:hidden" onClick={onShowContact} aria-label="Ver o contacto">
          <PanelRight />
        </Button>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {currentCase ? (
            <CaseActions c={currentCase} myStaffId={myStaffId} staff={staff} departments={departments} />
          ) : (
            <>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Bot className="size-4 text-primary" aria-hidden />
                IA
                <Switch
                  checked={!conversation.ai_paused}
                  disabled={busy}
                  aria-label="Ligar ou pausar a IA nesta conversa"
                  onCheckedChange={(checked) =>
                    void guard(
                      () => toggleAi({ data: { conversationId: conversation.id, enabled: checked } }),
                      checked ? "A IA volta a responder nesta conversa." : "IA em pausa nesta conversa.",
                    )
                  }
                />
              </label>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  void guard(
                    () => assume({ data: { conversationId: conversation.id } }),
                    "A conversa é sua. A IA não responde enquanto estiver a atender.",
                  )
                }
              >
                <UserCheck /> Assumir
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 border-b bg-muted/40 px-4 py-2 text-xs">
        {currentCase ? (
          <>
            <span className="font-medium">Caso {currentCase.number}</span>
            <CaseStatusBadge status={currentCase.status} />
            <PriorityBadge priority={currentCase.priority} />
            <Badge variant="outline">{intentLabel(currentCase.intent)}</Badge>
            <SlaBadge c={currentCase} />
            <span className="ml-auto text-muted-foreground">
              {owner ? `Com ${owner.name}` : "Sem responsável"} · IA em pausa
            </span>
          </>
        ) : aiActive ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-success" aria-hidden /> A IA está a atender esta conversa.
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-warning" aria-hidden /> IA em pausa: as próximas mensagens
            abrem um caso para a equipa.
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && <p className="text-sm text-muted-foreground">Sem mensagens nesta conversa.</p>}
        {messages.map((message) => {
          const mine = message.sender_kind !== "participant";
          const author =
            message.sender_kind === "team"
              ? (staff.find((s) => s.user_id === message.sender_user_id)?.name ?? "Equipa")
              : null;
          return (
            <div key={message.id} className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
              {!mine && <Avatar name={name} className="size-8" />}
              <div
                className={cn(
                  "max-w-[78%] rounded-xl px-3.5 py-2.5 text-sm",
                  message.sender_kind === "team"
                    ? "bg-primary text-primary-foreground"
                    : message.sender_kind === "ai_agent"
                      ? "border border-primary/25 bg-primary/5"
                      : "bg-muted",
                )}
              >
                {message.sender_kind === "ai_agent" && (
                  <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-primary">
                    <Bot className="size-3.5" aria-hidden /> Assistente IA
                  </span>
                )}
                {author && <span className="mb-1 block text-[11px] font-semibold opacity-80">{author}</span>}
                <span className="whitespace-pre-line break-words">{message.body}</span>
                <span className="mt-1 block text-[11px] opacity-70">
                  {hourLabel(message.created_at)}
                  {message.sender_kind === "participant" && message.video_second !== null
                    ? ` · no minuto ${clockLabel(message.video_second)}`
                    : ""}
                </span>
              </div>
              {message.sender_kind === "ai_agent" && <AiAvatar className="size-8" />}
            </div>
          );
        })}

        {analysis && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <AiAvatar className="size-7" /> Agente IA · Análise da mensagem
            </p>
            <p className="mt-2 rounded-md bg-card px-3 py-2 text-muted-foreground">“{analysis.inboundText}”</p>
            <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              <Fact label="Tipo" value={CLASSIFICATION[analysis.classification] ?? analysis.classification} />
              {currentCase && <Fact label="Intenção" value={intentLabel(currentCase.intent)} />}
              <Fact label="Confiança" value={`${Math.round(analysis.confidence * 100)}%`} />
              <Fact label="Decisão" value={DECISION[analysis.decision] ?? analysis.decision} />
              <Fact
                label="Precisa de uma pessoa"
                value={analysis.decision === "ESCALATE" ? (analysis.escalationReason ?? "Sim") : "Não"}
              />
              {currentCase?.recommended_action && (
                <Fact label="Acção sugerida" value={currentCase.recommended_action} />
              )}
            </dl>
            {suggestion && (
              <div className="mt-3 space-y-2.5 border-t border-primary/15 pt-3">
                <p className="text-xs text-muted-foreground">
                  Resposta preparada pela IA
                </p>
                <p className="whitespace-pre-line rounded-md bg-card px-3 py-2">{suggestion.answer}</p>
                <SourceList sources={suggestion.sources} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void guard(() =>
                        currentCase
                          ? reply({
                              data: {
                                conversationId: conversation.id,
                                body: suggestion.answer,
                                suggestionId: suggestion.id,
                              },
                            })
                          : approve({ data: { id: suggestion.id, finalAnswer: suggestion.answer } }),
                      )
                    }
                  >
                    <Send /> Enviar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setMode("reply");
                      setText(suggestion.answer);
                      setSuggestionId(suggestion.id);
                    }}
                  >
                    Editar antes de enviar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void guard(() => discard({ data: { id: suggestion.id } }))}
                  >
                    Descartar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {currentCase?.status === "waiting_customer" && (
        <p className="border-t bg-warning/10 px-4 py-2 text-center text-xs text-warning-foreground">
          A aguardar resposta do cliente. O caso volta a “Em atendimento” assim que ele escrever.
        </p>
      )}

      <form onSubmit={submit} className="border-t p-3">
        <div className="mb-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("reply")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              mode === "reply" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            Responder
          </button>
          <button
            type="button"
            onClick={() => setMode("note")}
            disabled={!currentCase}
            title={currentCase ? undefined : "As notas ficam no caso: assuma a conversa primeiro."}
            className={cn(
              "flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50",
              mode === "note" ? "bg-warning/15 text-warning-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            <StickyNote className="size-3.5" aria-hidden /> Nota interna
          </button>
          {mode === "reply" && (
            <div className="ml-auto flex flex-wrap gap-1">
              {webinar?.cta_url && (
                <Button type="button" size="sm" variant="ghost" onClick={() => insert(webinar.cta_url!)}>
                  <Link2 /> Link da oferta
                </Button>
              )}
              {roomLink && (
                <Button type="button" size="sm" variant="ghost" onClick={() => insert(roomLink)}>
                  <Link2 /> Link da sala
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!e.target.value) setSuggestionId(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(e);
            }}
            rows={2}
            maxLength={2000}
            placeholder={
              mode === "note"
                ? "Nota só para a equipa. O cliente não a vê."
                : currentCase
                  ? "Escreva a resposta para o cliente"
                  : "Ao responder, a conversa passa a ser sua e a IA fica em pausa"
            }
            className={cn("min-h-[3.25rem] resize-none", mode === "note" && "border-warning/40 bg-warning/5")}
          />
          <Button type="submit" disabled={busy || !text.trim()}>
            {mode === "note" ? "Guardar" : "Enviar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 font-medium">{value}</dd>
    </div>
  );
}
