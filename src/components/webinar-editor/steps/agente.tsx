import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, BookOpen, Check, FileText, Inbox, Info, Lock, Shield, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AgentPanel } from "@/components/ai-agent/agent-panel";
import { getAgent, saveAgent } from "@/lib/ai-agent/agent.functions";
import { friendlyError } from "@/lib/friendly-error";
import { cn } from "@/lib/utils";
import { Field, Note, Section, Seg, SwitchRow } from "../ui";

type Mode = "copiloto" | "hibrido" | "automatico";
const LEVELS: { mode: Mode; short: string; name: string; text: string }[] = [
  { mode: "copiloto", short: "Sugere", name: "Sugere.", text: "Prepara a resposta e a equipa aprova." },
  { mode: "hibrido", short: "Controlo", name: "Executa com controlo.", text: "Responde dentro das regras; o que é de risco passa à equipa." },
  { mode: "automatico", short: "Automático", name: "Automático.", text: "Responde sozinho a tudo o que sabe, dentro das regras." },
];
const UNKNOWN = "Pergunta não coberta pela base de conhecimento";
const PERSON = "Participante pediu uma pessoa da equipa";

/** Agente IA: o agente da plataforma a responder no Suporte da sala deste webinar. */
export function StepAgente({
  webinarId,
  onState,
  onSeek,
}: {
  webinarId: string;
  /** Para a pré-visualização: se está ligado e o nome no chat. */
  onState: (state: { on: boolean; name: string }) => void;
  onSeek: (seconds: number) => void;
}) {
  const fetchAgent = useServerFn(getAgent);
  const save = useServerFn(saveAgent);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["ai-agent", webinarId],
    queryFn: () => fetchAgent({ data: { webinarId } }),
  });
  const [tab, setTab] = useState<"faz" | "regras">("faz");
  const [more, setMore] = useState(false);
  const [name, setName] = useState("");
  const agent = data?.agent as
    | {
        enabled?: boolean;
        mode?: string;
        agent_name?: string;
        use_webinar_transcript?: boolean;
        permissions?: Record<string, boolean>;
        escalation?: { reasons?: string[]; message?: string };
      }
    | undefined;
  useEffect(() => {
    if (agent) setName(agent.agent_name ?? "");
  }, [agent?.agent_name]);
  useEffect(() => {
    if (agent) onState({ on: Boolean(agent.enabled), name: agent.agent_name || "Equipa" });
  }, [agent?.enabled, agent?.agent_name]);

  const patch = async (changes: Record<string, unknown>) => {
    qc.setQueryData(["ai-agent", webinarId], (old: typeof data) =>
      old ? { ...old, agent: { ...old.agent, ...changes } } : old,
    );
    try {
      await save({ data: { webinarId, patch: changes } });
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível guardar o agente."));
      void qc.invalidateQueries({ queryKey: ["ai-agent", webinarId] });
    }
  };
  // O nome grava quando se pára de escrever.
  const nameTimer = useRef<number | null>(null);
  const onName = (value: string) => {
    setName(value);
    if (nameTimer.current) window.clearTimeout(nameTimer.current);
    nameTimer.current = window.setTimeout(() => void patch({ agent_name: value.trim() || "Assistente" }), 600);
  };

  if (isLoading || !agent) return <Skeleton className="h-40 w-full" />;
  const on = Boolean(agent.enabled);
  const mode: Mode = agent.mode === "copiloto" || agent.mode === "automatico" ? agent.mode : "hibrido";
  const level = LEVELS.findIndex((l) => l.mode === mode);
  const perms = agent.permissions ?? {};
  const reasons = agent.escalation?.reasons ?? [];
  const toggleReason = (reason: string) => {
    const next = reasons.includes(reason) ? reasons.filter((r) => r !== reason) : [...reasons, reason];
    void patch({ escalation: { ...(agent.escalation ?? {}), reasons: next } });
  };
  const pill = (id: string, risky?: boolean) => {
    if (risky) return { text: "Nunca sozinho", tone: "gray" as const, lock: true };
    if (perms[id] === false) return { text: "Passa à equipa", tone: "gray" as const };
    return mode === "copiloto" ? { text: "Sugere", tone: "warn" as const } : { text: "Sozinho", tone: "ok" as const };
  };
  const rows: [string, string, boolean?][] = [
    ["conteudo", "Responder dúvidas do conteúdo"],
    ["link", "Enviar o link da oferta"],
    ["pagamento", "Responder sobre pagamento"],
    ["negociar", "Negociar ou dar desconto", true],
  ];

  return (
    <>
      <section className="pb-[18px]">
        <SwitchRow
          icon={Bot}
          title="Ligar o agente neste webinar"
          description="É o mesmo agente do Atendimento."
          checked={on}
          onChange={(v) => void patch({ enabled: v, ...(v && agent.mode === "desativado" ? { mode: "hibrido" } : {}) })}
        />
      </section>
      {!on ? (
        <Note icon={Info}>Desligado, as mensagens do Suporte vão directo para o Atendimento.</Note>
      ) : (
        <>
          <div className="pb-[18px]">
            <Seg
              full
              value={tab}
              onChange={setTab}
              options={[
                { value: "faz", label: "O que faz" },
                { value: "regras", label: "Regras" },
              ]}
            />
          </div>
          {tab === "faz" ? (
            <>
              <Section icon={Shield} title="Autonomia" help="autonomia">
                <div className="grid grid-cols-3 gap-1.5">
                  {LEVELS.map((l, i) => (
                    <button
                      key={l.mode}
                      type="button"
                      onClick={() => void patch({ mode: l.mode })}
                      aria-pressed={i === level}
                      className={cn(
                        "grid gap-1.5 rounded-lg border bg-white px-2 pb-2 pt-2.5 text-[12.5px] font-medium",
                        i === level && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
                      )}
                    >
                      <span className={cn("h-1 rounded-full", i <= level ? "bg-foreground" : "bg-gray-200")} />
                      {l.short}
                    </button>
                  ))}
                </div>
                <p className="text-[12.5px] text-muted-foreground">
                  <b className="font-semibold text-foreground">{LEVELS[level]!.name}</b> {LEVELS[level]!.text}
                </p>
                <div className="divide-y overflow-hidden rounded-xl border bg-white">
                  {rows.map(([id, label, risky]) => {
                    const p = pill(id, risky);
                    return (
                      <div key={id} className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]">
                        <span className="flex-1">{label}</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium",
                            p.tone === "ok" && "bg-[#DDF1E7] text-[#1D8A5E]",
                            p.tone === "warn" && "bg-[#FBEBCF] text-[#A86400]",
                            p.tone === "gray" && "bg-chip text-muted-foreground",
                          )}
                        >
                          {"lock" in p && p.lock ? <Lock className="size-3" /> : null}
                          {p.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>
              <Section icon={FileText} title="Responde com" help="agenteFontes">
                <div className="flex flex-wrap gap-2">
                  <Chip on={agent.use_webinar_transcript !== false} onClick={() => void patch({ use_webinar_transcript: agent.use_webinar_transcript === false })}>
                    Transcrição do vídeo
                  </Chip>
                  <Chip on={(data?.faqs?.length ?? 0) > 0} onClick={() => setMore(true)}>
                    Perguntas frequentes{data?.faqs?.length ? ` (${data.faqs.length})` : ""}
                  </Chip>
                  <Chip on={(data?.knowledge ?? []).some((k) => String(k["value"] ?? "").trim())} onClick={() => setMore(true)}>
                    Produto e negócio
                  </Chip>
                </div>
                <p className="text-[12.5px] leading-snug text-muted-foreground">
                  A oferta (nome, preço, link e último dia) vem sempre da etapa Oferta: muda lá e o Agente acompanha. Cada oferta só
                  entra depois de abrir na sala, para o Agente não dizer o preço antes do pitch.
                </p>
              </Section>
            </>
          ) : (
            <>
              <Section icon={Inbox} title="Passa à equipa quando" help="agenteEquipa">
                <div className="flex flex-wrap gap-2">
                  <Chip on={reasons.includes(UNKNOWN)} onClick={() => toggleReason(UNKNOWN)}>
                    Não sabe responder
                  </Chip>
                  <Chip on={reasons.includes(PERSON)} onClick={() => toggleReason(PERSON)}>
                    Pedem uma pessoa
                  </Chip>
                  <Chip on={perms["pagamento"] === false} onClick={() => void patch({ permissions: { ...perms, pagamento: perms["pagamento"] === false } })}>
                    É sobre pagamento
                  </Chip>
                </div>
              </Section>
              <Section icon={Bot} title="Nome no chat" help="agenteNome">
                <Field>
                  <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Equipa" />
                </Field>
              </Section>
            </>
          )}
          <div className="pt-[18px]">
            <Button variant="outline" size="sm" onClick={() => setMore(true)}>
              <SlidersHorizontal />
              Conhecimento, perguntas e simulador
            </Button>
          </div>
        </>
      )}
      <Dialog open={more} onOpenChange={setMore}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <BookOpen className="size-4" />
              O que o agente sabe
            </DialogTitle>
            <DialogDescription>Base de conhecimento, perguntas frequentes, objeções e o simulador.</DialogDescription>
          </DialogHeader>
          <AgentPanel webinarId={webinarId} onSeek={onSeek} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-[34px] items-center gap-1.5 rounded-lg border bg-white pl-2.5 pr-3.5 text-[13px] font-medium text-muted-foreground",
        on && "border-foreground text-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
      )}
    >
      <Check className={cn("size-3.5", on ? "text-[#1D8A5E]" : "opacity-30")} />
      {children}
    </button>
  );
}
