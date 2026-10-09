/**
 * Agente IA do webinar: configuração completa numa secção do editor.
 *
 * O agente atende apenas mensagens REAIS de participantes. Nunca se mistura
 * com o chat simulado (Engagement Intelligence) nem com a equipa.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bot,
  BookOpen,
  Check,
  FlaskConical,
  Loader2,
  MessageSquareQuote,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRoundCog,
  Wand2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/friendly-error";
import {
  EMOJI_LEVELS,
  ESCALATION_REASONS,
  LANGUAGES,
  LENGTHS,
  PERMISSIONS,
  SPEEDS,
  TONES,
  type AgentSource,
} from "@/lib/ai-agent/defaults";
import {
  deleteAgentItem,
  generateAgentContent,
  getAgent,
  saveAgent,
  saveAgentFaq,
  saveAgentKnowledge,
  saveAgentObjection,
  simulateAgentReply,
  type GeneratedContent,
  type SimulationResult,
} from "@/lib/ai-agent/agent.functions";


type Row = Record<string, any>;

const SUBTABS = [
  { id: "visao", label: "Visão geral", icon: Bot },
  { id: "conhecimento", label: "Conhecimento", icon: BookOpen },
  { id: "faqs", label: "FAQs", icon: MessageSquareQuote },
  { id: "objecoes", label: "Objeções", icon: ShieldCheck },
  { id: "personalidade", label: "Personalidade", icon: UserRoundCog },
  { id: "regras", label: "Regras e escalação", icon: ShieldCheck },
  { id: "testar", label: "Testar agente", icon: FlaskConical },
] as const;

function clock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function SourceList({
  sources,
  onSeek,
}: {
  sources: AgentSource[];
  onSeek?: ((seconds: number) => void) | undefined;
}) {
  if (sources.length === 0)
    return <p className="text-xs text-muted-foreground">Sem fontes indicadas.</p>;
  return (
    <ul className="space-y-1.5">
      {sources.map((source, index) => (
        <li key={index} className="flex flex-wrap items-center gap-2 text-xs">
          <Check className="size-3.5 text-emerald-600" />
          <span className="font-medium">{source.label}</span>
          {source.quote ? (
            <span className="text-muted-foreground">“{source.quote.slice(0, 90)}…”</span>
          ) : null}
          {source.kind === "webinar" && source.startMs != null ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              onClick={() => onSeek?.(Math.floor((source.startMs ?? 0) / 1000))}
            >
              Ouvir trecho ({clock(source.startMs)})
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export type AgentPanelTab = (typeof SUBTABS)[number]["id"];

export function AgentPanel({
  webinarId,
  onSeek,
  initialTab = "conhecimento",
}: {
  webinarId: string;
  onSeek?: ((seconds: number) => void) | undefined;
  initialTab?: AgentPanelTab | undefined;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(getAgent);
  const persist = useServerFn(saveAgent);
  const persistKnowledge = useServerFn(saveAgentKnowledge);
  const persistFaq = useServerFn(saveAgentFaq);
  const persistObjection = useServerFn(saveAgentObjection);
  const removeItem = useServerFn(deleteAgentItem);
  const simulate = useServerFn(simulateAgentReply);
  const generate = useServerFn(generateAgentContent);

  /** "Gerar com IA": usa o que já está preenchido e, se existir, a transcrição. */
  const runGenerate = async (
    target: "knowledge" | "faqs" | "objections",
  ): Promise<GeneratedContent | null> => {
    try {
      const result = await generate({ data: { webinarId, target } });
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível gerar sugestões agora.");
        return null;
      }
      toast.success(
        result.usedTranscript
          ? "Sugestões geradas com base na transcrição deste webinar."
          : "Sugestões geradas a partir da informação já preenchida.",
      );
      return result;
    } catch (error) {
      toast.error(friendlyError(error));
      return null;
    }
  };



  // O interruptor, a autonomia e as fontes ficam no passo Agente; aqui abre-se no que se pediu.
  const [tab, setTab] = useState<AgentPanelTab>(initialTab);
  const { data, isLoading } = useQuery({
    queryKey: ["ai-agent", webinarId],
    queryFn: () => load({ data: { webinarId } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["ai-agent", webinarId] });

  const [agent, setAgent] = useState<Row | null>(null);
  const [knowledge, setKnowledge] = useState<Row[]>([]);
  useEffect(() => {
    if (!data) return;
    setAgent(data.agent as Row);
    setKnowledge(data.knowledge as Row[]);
  }, [data]);

  const saveAgentPatch = useMutation({
    mutationFn: (patch: Record<string, unknown>) => persist({ data: { webinarId, patch } }),
    onSuccess: () => {
      toast.success("Agente guardado.");
      void refresh();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const update = (patch: Record<string, unknown>) => {
    setAgent((current) => (current ? { ...current, ...patch } : current));
    saveAgentPatch.mutate(patch);
  };

  if (isLoading || !agent) {
    return (
      <div className="flex items-center gap-2 rounded-card bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> A carregar o agente…
      </div>
    );
  }

  const personality = (agent["personality"] ?? {}) as Record<string, any>;
  const permissions = (agent["permissions"] ?? {}) as Record<string, boolean>;
  const escalation = (agent["escalation"] ?? {}) as Record<string, any>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 rounded-card bg-card p-1.5">
        {SUBTABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              tab === item.id ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            <item.icon className="size-4" /> {item.label}
          </button>
        ))}
      </div>

      {tab === "visao" ? (
        <section className="space-y-4 rounded-card bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome do assistente</Label>
              <Input
                value={String(agent["agent_name"] ?? "")}
                onChange={(e) => setAgent({ ...agent, agent_name: e.target.value })}
                onBlur={(e) => update({ agent_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Apresentação</Label>
              <Input
                value={String(agent["intro"] ?? "")}
                onChange={(e) => setAgent({ ...agent, intro: e.target.value })}
                onBlur={(e) => update({ intro: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            O assistente identifica-se sempre como assistente. Nunca se faz passar por uma pessoa da
            equipa nem por um participante.
          </p>
        </section>
      ) : null}

      {tab === "conhecimento" ? (
        <KnowledgeTab
          knowledge={knowledge}
          setKnowledge={setKnowledge}
          onGenerate={async () => (await runGenerate("knowledge"))?.knowledge ?? []}
          onSave={(items) =>
            persistKnowledge({ data: { webinarId, items } })
              .then(() => {
                toast.success("Conhecimento guardado.");
                void refresh();
              })
              .catch((error: unknown) => toast.error(friendlyError(error)))
          }
        />
      ) : null}

      {tab === "faqs" ? (
        <FaqTab
          rows={(data?.faqs ?? []) as Row[]}
          onSave={(payload) =>
            persistFaq({ data: { webinarId, ...payload } })
              .then(() => void refresh())
              .catch((error: unknown) => toast.error(friendlyError(error)))
          }
          onDelete={(id) =>
            removeItem({ data: { table: "ai_agent_faqs", id } })
              .then(() => void refresh())
              .catch((error: unknown) => toast.error(friendlyError(error)))
          }
          onLearn={async () => (await runGenerate("faqs"))?.faqs ?? []}
        />
      ) : null}

      {tab === "objecoes" ? (
        <ObjectionTab
          rows={(data?.objections ?? []) as Row[]}
          onSave={(payload) =>
            persistObjection({ data: { webinarId, ...payload } })
              .then(() => void refresh())
              .catch((error: unknown) => toast.error(friendlyError(error)))
          }
          onDelete={(id) =>
            removeItem({ data: { table: "ai_agent_objections", id } })
              .then(() => void refresh())
              .catch((error: unknown) => toast.error(friendlyError(error)))
          }
          onGenerate={async () => (await runGenerate("objections"))?.objections ?? []}
        />
      ) : null}



      {tab === "personalidade" ? (
        <section className="space-y-4 rounded-card bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice
              label="Tom"
              value={String(personality["tone"] ?? "proximo")}
              options={TONES}
              onChange={(value) => update({ personality: { ...personality, tone: value } })}
            />
            <Choice
              label="Comprimento das respostas"
              value={String(personality["length"] ?? "equilibrado")}
              options={LENGTHS}
              onChange={(value) => update({ personality: { ...personality, length: value } })}
            />
            <Choice
              label="Emojis"
              value={String(personality["emojis"] ?? "poucos")}
              options={EMOJI_LEVELS}
              onChange={(value) => update({ personality: { ...personality, emojis: value } })}
            />
            <Choice
              label="Idioma"
              value={String(personality["language"] ?? "pt-PT")}
              options={LANGUAGES}
              onChange={(value) => update({ personality: { ...personality, language: value } })}
            />
            <Choice
              label="Tempo de resposta"
              value={String(agent["response_speed"] ?? "natural")}
              options={SPEEDS}
              onChange={(value) => update({ response_speed: value })}
            />
            <div className="flex items-end justify-between gap-3 rounded-xl border px-3 py-2">
              <span className="text-sm">Mostrar “a escrever…”</span>
              <Switch
                checked={Boolean(agent["show_typing"])}
                onCheckedChange={(checked) => update({ show_typing: checked })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Exemplos de respostas reais da equipa (uma por linha)</Label>
            <Textarea
              rows={6}
              defaultValue={((personality["examples"] ?? []) as string[]).join("\n")}
              onBlur={(e) =>
                update({
                  personality: {
                    ...personality,
                    examples: e.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .slice(0, 10),
                  },
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Entre 3 e 10 exemplos ajudam o assistente a escrever como a sua equipa.
            </p>
          </div>
        </section>
      ) : null}

      {tab === "regras" ? (
        <section className="space-y-4 rounded-card bg-card p-5">
          <div>
            <p className="text-sm font-semibold">O que o agente pode fazer</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PERMISSIONS.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
                >
                  <span>
                    {item.label}
                    {item.risky ? (
                      <Badge variant="secondary" className="ml-2 text-amber-600">
                        risco
                      </Badge>
                    ) : null}
                  </span>
                  <Switch
                    checked={Boolean(permissions[item.id])}
                    onCheckedChange={(checked) =>
                      update({ permissions: { ...permissions, [item.id]: checked } })
                    }
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nunca diga isto</Label>
            <Textarea
              rows={3}
              defaultValue={String(agent["never_say"] ?? "")}
              onBlur={(e) => update({ never_say: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Quando deve chamar uma pessoa da equipa</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {ESCALATION_REASONS.map((reason) => {
                const list = (escalation["reasons"] ?? []) as string[];
                const active = list.includes(reason);
                return (
                  <label
                    key={reason}
                    className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
                  >
                    <span>{reason}</span>
                    <Switch
                      checked={active}
                      onCheckedChange={(checked) =>
                        update({
                          escalation: {
                            ...escalation,
                            reasons: checked
                              ? [...list, reason]
                              : list.filter((item) => item !== reason),
                          },
                        })
                      }
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Mensagem ao passar para a equipa</Label>
              <Input
                defaultValue={String(
                  escalation["message"] ??
                    "Vou chamar alguém da equipa para confirmar isso para si.",
                )}
                onBlur={(e) => update({ escalation: { ...escalation, message: e.target.value } })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confiança mínima para responder sozinho</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                defaultValue={Number(agent["confidence_threshold"] ?? 0.75)}
                onBlur={(e) =>
                  update({ confidence_threshold: Math.min(1, Math.max(0, Number(e.target.value))) })
                }
              />
            </div>
          </div>
        </section>
      ) : null}

      {tab === "testar" ? <SimulatorTab webinarId={webinarId} run={simulate} onSeek={onSeek} /> : null}
    </div>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function KnowledgeTab({
  knowledge,
  setKnowledge,
  onSave,
  onGenerate,
}: {
  knowledge: Row[];
  setKnowledge: (rows: Row[]) => void;
  onSave: (
    items: {
      id: string;
      value: string;
      visibility: "always" | "after_presented";
      presentedAfterMs: number | null;
    }[],
  ) => void;
  onGenerate: () => Promise<{ field: string; value: string }[]>;
}) {
  const [loading, setLoading] = useState(false);
  const sections = useMemo(
    () => [
      { id: "negocio", title: "Negócio" },
      { id: "produto", title: "Produto" },
      { id: "oferta", title: "Oferta" },
    ],
    [],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-card px-5 py-4">
        <p className="text-xs text-muted-foreground">
          Se este webinar já tiver transcrição, a geração usa-a como fonte. Reveja sempre antes de
          guardar.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            const suggestions = await onGenerate();
            if (suggestions.length > 0) {
              setKnowledge(
                knowledge.map((row) => {
                  const match = suggestions.find((item) => item.field === row["field"]);
                  return match ? { ...row, value: match.value } : row;
                }),
              );
            }
            setLoading(false);
          }}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Gerar com IA
        </Button>
      </div>
      {sections.map((section) => (

        <div key={section.id} className="space-y-3 rounded-card bg-card p-5">
          <p className="text-sm font-semibold">{section.title}</p>
          {knowledge
            .filter((row) => row["section"] === section.id)
            .map((row) => (
              <div key={row["id"]} className="grid gap-2 sm:grid-cols-[1fr_11rem]">
                <div className="space-y-1.5">
                  <Label className="text-xs">{row["label"]}</Label>
                  <Textarea
                    rows={2}
                    value={String(row["value"] ?? "")}
                    onChange={(e) =>
                      setKnowledge(
                        knowledge.map((item) =>
                          item["id"] === row["id"] ? { ...item, value: e.target.value } : item,
                        ),
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pode revelar</Label>
                  <Select
                    value={String(row["visibility"] ?? "always")}
                    onValueChange={(value) =>
                      setKnowledge(
                        knowledge.map((item) =>
                          item["id"] === row["id"] ? { ...item, visibility: value } : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always">A qualquer momento</SelectItem>
                      <SelectItem value="after_presented">Só depois de apresentado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
        </div>
      ))}
      <Button
        type="button"
        onClick={() =>
          onSave(
            knowledge.map((row) => ({
              id: String(row["id"]),
              value: String(row["value"] ?? ""),
              visibility: (row["visibility"] === "after_presented"
                ? "after_presented"
                : "always") as "always" | "after_presented",
              presentedAfterMs:
                typeof row["presented_after_ms"] === "number" ? row["presented_after_ms"] : null,
            })),
          )
        }
      >
        Guardar conhecimento
      </Button>
    </section>
  );
}

function FaqTab({
  rows,
  onSave,
  onDelete,
  onLearn,
}: {
  rows: Row[];
  onSave: (payload: {
    id: string | null;
    question: string;
    answer: string;
    visibility: "always" | "after_presented";
    approved: boolean;
  }) => void;
  onDelete: (id: string) => void;
  onLearn: () => Promise<{ question: string; answer: string }[]>;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [suggestions, setSuggestions] = useState<{ question: string; answer: string }[]>([]);
  const [loading, setLoading] = useState(false);

  return (
    <section className="space-y-4 rounded-card bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Perguntas frequentes</p>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setSuggestions(await onLearn());
            setLoading(false);
          }}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Gerar com IA
        </Button>
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            Sugestões a partir deste webinar. Nada entra como facto sem a sua aprovação.
          </p>
          {suggestions.map((item, index) => (
            <div key={index} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">{item.question}</p>
                <p className="text-muted-foreground">{item.answer}</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onSave({ ...item, id: null, visibility: "always", approved: true });
                  setSuggestions(suggestions.filter((_, i) => i !== index));
                }}
              >
                Aprovar
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input placeholder="Pergunta" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <Input placeholder="Resposta" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <Button
          type="button"
          disabled={!question.trim()}
          onClick={() => {
            onSave({ id: null, question, answer, visibility: "always", approved: true });
            setQuestion("");
            setAnswer("");
          }}
        >
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row["id"]} className="flex items-start justify-between gap-3 rounded-xl border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{row["question"]}</p>
              <p className="text-sm text-muted-foreground">{row["answer"]}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(row["id"])}>
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="text-sm text-muted-foreground">Sem perguntas frequentes.</li>
        ) : null}
      </ul>
    </section>
  );
}

type ObjectionDraft = {
  objection: string;
  response: string;
  keyPoints: string;
  neverSay: string;
  allowedCta: string;
  escalateWhen: string;
};

function ObjectionTab({
  rows,
  onSave,
  onDelete,
  onGenerate,
}: {
  rows: Row[];
  onSave: (payload: ObjectionDraft & { id: string | null; approved: boolean }) => void;
  onDelete: (id: string) => void;
  onGenerate: () => Promise<ObjectionDraft[]>;
}) {
  const [draft, setDraft] = useState<ObjectionDraft>({
    objection: "",
    response: "",
    keyPoints: "",
    neverSay: "",
    allowedCta: "",
    escalateWhen: "",
  });
  const [suggestions, setSuggestions] = useState<ObjectionDraft[]>([]);
  const [loading, setLoading] = useState(false);

  return (
    <section className="space-y-4 rounded-card bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Objeções</p>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setSuggestions(await onGenerate());
            setLoading(false);
          }}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Gerar com IA
        </Button>
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            Sugestões a partir deste webinar. Nada entra sem a sua aprovação.
          </p>
          {suggestions.map((item, index) => (
            <div key={index} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{item.objection}</p>
                <p className="text-muted-foreground">{item.response}</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onSave({ ...item, id: null, approved: true });
                  setSuggestions(suggestions.filter((_, i) => i !== index));
                }}
              >
                Aprovar
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">

        <Input
          placeholder="Objeção"
          value={draft.objection}
          onChange={(e) => setDraft({ ...draft, objection: e.target.value })}
        />
        <Input
          placeholder="Resposta recomendada"
          value={draft.response}
          onChange={(e) => setDraft({ ...draft, response: e.target.value })}
        />
        <Input
          placeholder="Pontos-chave"
          value={draft.keyPoints}
          onChange={(e) => setDraft({ ...draft, keyPoints: e.target.value })}
        />
        <Input
          placeholder="O que não dizer"
          value={draft.neverSay}
          onChange={(e) => setDraft({ ...draft, neverSay: e.target.value })}
        />
        <Input
          placeholder="Chamada à ação permitida"
          value={draft.allowedCta}
          onChange={(e) => setDraft({ ...draft, allowedCta: e.target.value })}
        />
        <Input
          placeholder="Quando chamar uma pessoa"
          value={draft.escalateWhen}
          onChange={(e) => setDraft({ ...draft, escalateWhen: e.target.value })}
        />
      </div>
      <Button
        type="button"
        disabled={!draft.objection.trim()}
        onClick={() => {
          onSave({ id: null, approved: true, ...draft });
          setDraft({
            objection: "",
            response: "",
            keyPoints: "",
            neverSay: "",
            allowedCta: "",
            escalateWhen: "",
          });
        }}
      >
        <Plus className="size-4" /> Adicionar objeção
      </Button>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row["id"]} className="flex items-start justify-between gap-3 rounded-xl border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{row["objection"]}</p>
              <p className="text-sm text-muted-foreground">{row["response"]}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(row["id"])}>
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
        {rows.length === 0 ? <li className="text-sm text-muted-foreground">Sem objeções.</li> : null}
      </ul>
    </section>
  );
}

function SimulatorTab({
  webinarId,
  run,
  onSeek,
}: {
  webinarId: string;
  run: (input: {
    data: { webinarId: string; question: string; sessionSeconds: number };
  }) => Promise<SimulationResult>;
  onSeek?: ((seconds: number) => void) | undefined;
}) {
  const [question, setQuestion] = useState("");
  const [minute, setMinute] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  return (
    <section className="space-y-4 rounded-card bg-card p-5">
      <p className="text-sm font-semibold">Testar agente</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
        <Input
          placeholder="Pergunta do participante"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
          />
          <span className="text-xs text-muted-foreground">min</span>
        </div>
        <Button
          type="button"
          disabled={!question.trim() || loading}
          onClick={async () => {
            setLoading(true);
            setResult(
              await run({
                data: { webinarId, question, sessionSeconds: Math.max(0, minute) * 60 },
              }),
            );
            setLoading(false);
          }}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          Testar
        </Button>
      </div>

      {result ? (
        <div className="space-y-3 rounded-xl border p-4">
          {result.ok ? null : (
            <p className="text-sm text-amber-600">
              {result.error ?? "O assistente não conseguiu responder agora."}
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{result.classification}</Badge>
            <Badge variant="secondary">{result.decision}</Badge>
            <Badge variant="secondary">
              confiança {Math.round(result.confidence * 100)}%
            </Badge>
            {result.escalationReason ? (
              <Badge variant="secondary" className="text-amber-600">
                {result.escalationReason}
              </Badge>
            ) : null}
          </div>
          {result.answer ? <p className="text-sm">{result.answer}</p> : null}
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              Fontes
            </p>
            <SourceList sources={result.sources} onSeek={onSeek} />
          </div>
          {result.reason ? (
            <p className="text-xs text-muted-foreground">Porquê: {result.reason}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
