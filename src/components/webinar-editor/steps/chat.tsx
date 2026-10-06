import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileSpreadsheet,
  Layers,
  Loader2,
  Lock,
  MessageCircle,
  Mic,
  Pencil,
  Pin,
  Play,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/room-logic";
import { chatTagLabel, type ChatRules } from "@/lib/chat-realism";
import { CountPill, Field, MinuteWheel, RadioCard, Section, Seg, SwitchRow, Tag, TimeChip } from "../ui";
import type { EditorClock } from "./video";
import type { EditorForm, FocusProps, SetForm } from "../form";

export type ChatWay = "ai" | "file" | "one";

export type ChatComment = { id: string; at: number; author: string; message: string; type: string | null };

const EXAMPLE: Record<ChatRules["tone"], [string, string]> = {
  natural: ["Ana", "Faz sentido, nunca tinha pensado no upsell assim"],
  vendas: ["Paulo", "Quero entrar. Até quando dá para comprar?"],
  formal: ["Sérgio", "Excelente explicação sobre o ticket médio."],
};
const PER_MINUTE = { baixa: 5, media: 9, alta: 15 } as const;
const GEN_STEPS = [
  "A ler a fala do vídeo",
  "A encontrar perguntas e momentos fortes",
  "A escrever no tom escolhido",
  "A aplicar as regras para não parecer falso",
];

/** Chat: comentários simulados, sincronizados com a fala. */
export function StepChat({
  form,
  set,
  focus,
  rules,
  onRules,
  way,
  onWay,
  questions,
  comments,
  clock: c,
  speechAt,
  job,
  onGenerate,
  onImport,
  onWrite,
  onRemove,
  onWatch,
}: {
  form: EditorForm;
  set: SetForm;
  focus: FocusProps;
  rules: ChatRules;
  onRules: (patch: Partial<ChatRules>) => void;
  way: ChatWay;
  onWay: (way: ChatWay) => void;
  questions: readonly { at: number; text: string }[];
  comments: readonly ChatComment[];
  clock: EditorClock;
  speechAt: (seconds: number) => string | null;
  /** A geração em curso: em que passo vai (0 a 4) ou o erro. */
  job: { running: boolean; stage: number; error: string; ready: boolean; onReview: () => void } | null;
  onGenerate: () => void;
  onImport: (file: File) => void;
  onWrite: (at: number, message: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  onWatch: () => void;
}) {
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const people = new Set(comments.map((x) => x.author)).size;
  const [ex, exText] = EXAMPLE[rules.tone];
  const current = [...comments].reverse().find((x) => x.at <= c.t)?.id;

  return (
    <>
      <Section icon={MessageCircle} title="1. Estilo" help="tom">
        <Field label="Tom">
          <Seg
            small
            value={rules.tone}
            onChange={(tone) => onRules({ tone })}
            options={[
              { value: "natural", label: "Natural" },
              { value: "vendas", label: "Vendas" },
              { value: "formal", label: "Formal" },
            ]}
          />
        </Field>
        <div className="flex items-center gap-3 rounded-xl bg-[#141414] p-3 text-white">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#2E2E2E] text-[11px] font-bold">
            {ex[0]}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[13px] font-semibold">{ex}</b>
            <span className="text-[13px] text-[#D4D4D4]">
              {exText}
              {rules.emoji && rules.tone !== "formal" ? " 👏" : ""}
            </span>
          </span>
          <span className="text-[11px] text-[#A3A3A3]">Exemplo</span>
        </div>
        <Field label="Intensidade" hint={`Cerca de ${PER_MINUTE[rules.level]} comentários por minuto.`}>
          <Seg
            small
            value={rules.level}
            onChange={(level) => onRules({ level })}
            options={[
              { value: "baixa", label: "Baixa" },
              { value: "media", label: "Média" },
              { value: "alta", label: "Alta" },
            ]}
          />
        </Field>
        <SwitchRow
          title="Com emojis"
          description="Os comentários levam emojis, como num chat real."
          checked={rules.emoji}
          onChange={(emoji) => onRules({ emoji })}
        />
      </Section>

      <Section icon={ShieldCheck} title="2. Para não parecer falso" help="realismo">
        <Field label="Nomes de" hint="Nomes comuns no país da sua audiência.">
          <Seg
            small
            value={rules.country}
            onChange={(country) => onRules({ country })}
            options={[
              { value: "ao", label: "Angola" },
              { value: "br", label: "Brasil" },
              { value: "pt", label: "Portugal" },
              { value: "mix", label: "Vários" },
            ]}
          />
        </Field>
        <Field label="Quem diz que já é aluno" hint="Por sessão, perto da oferta.">
          <Seg
            small
            value={String(rules.alunos) as "0" | "2" | "4"}
            onChange={(v) => onRules({ alunos: Number(v) as 0 | 2 | 4 })}
            options={[
              { value: "0", label: "Ninguém" },
              { value: "2", label: "Até 2" },
              { value: "4", label: "Até 4" },
            ]}
          />
        </Field>
        <div className="grid gap-3.5 rounded-xl border bg-white p-3.5">
          <SwitchRow
            title="Não repetir nomes seguidos"
            description="O mesmo nome só volta 2 minutos depois."
            checked={rules.names}
            onChange={(names) => onRules({ names })}
          />
          <SwitchRow
            title="Escrevem com atraso"
            description="3 a 15 segundos depois da frase, como quem está a ouvir."
            checked={rules.delay}
            onChange={(delay) => onRules({ delay })}
          />
          <SwitchRow
            title="Escrita de telemóvel"
            description="Algumas em minúsculas, com «vc» e «tb». Nunca erros que mudem o sentido."
            checked={rules.mobile}
            onChange={(mobile) => onRules({ mobile })}
          />
          <SwitchRow
            title="Há quem chegue atrasado"
            description="«Cheguei agora», «Já começou?» nos primeiros minutos."
            checked={rules.late}
            onChange={(late) => onRules({ late })}
          />
          <SwitchRow
            title="Conversam entre si"
            description="Às vezes alguém responde a outra pessoa do chat."
            checked={rules.talk}
            onChange={(talk) => onRules({ talk })}
          />
          <SwitchRow
            title="Acompanham a audiência"
            description="Mais gente a ver, mais comentários. Menos gente, mais silêncio."
            checked={rules.follow}
            onChange={(follow) => onRules({ follow })}
          />
        </div>
        <p className="flex gap-2 text-[12.5px] text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          Nunca prometem resultados nem inventam números. Nenhuma mensagem se repete.
        </p>
        <p className="flex gap-2 text-[12.5px] text-muted-foreground">
          <Eye className="mt-0.5 size-3.5 shrink-0" />
          O que cada pessoa escreve na sala, só ela vê, com qualquer emoji. Não chega aos outros nem afecta o lançamento.
        </p>
      </Section>

      <Section icon={Layers} title="3. Gerar">
        <div className="grid gap-2" role="radiogroup" aria-label="Como gerar">
          <RadioCard
            icon={Zap}
            title="Da fala do vídeo"
            tag="Recomendado"
            description="Escreve nos momentos certos, a partir da fala e da oferta."
            selected={way === "ai"}
            onSelect={() => onWay("ai")}
          />
          <RadioCard
            icon={FileSpreadsheet}
            title="Importar uma folha"
            description="Uma folha com minuto, nome e mensagem."
            selected={way === "file"}
            onSelect={() => onWay("file")}
          />
          <RadioCard
            icon={Pencil}
            title="Escrever à mão"
            description="Escolhe o minuto na roda e escreve. Fica sincronizado com o vídeo."
            selected={way === "one"}
            onSelect={() => onWay("one")}
          />
        </div>

        {way === "ai" ? (
          <>
            <div className="grid gap-3 rounded-xl border bg-white p-3.5">
              <SwitchRow
                title="Responder às perguntas do apresentador"
                description={
                  questions.length === 0
                    ? "Quando pergunta algo à audiência, algumas pessoas respondem."
                    : `Quando pergunta algo à audiência, algumas pessoas respondem. Há ${questions.length} ${questions.length === 1 ? "pergunta" : "perguntas"} na fala.`
                }
                checked={rules.answersOn}
                onChange={(answersOn) => onRules({ answersOn })}
              />
              {rules.answersOn ? (
                <>
                  <Field label="Quantas pessoas respondem">
                    <Seg
                      small
                      value={String(rules.answers) as "2" | "4" | "6"}
                      onChange={(v) => onRules({ answers: Number(v) as 2 | 4 | 6 })}
                      options={[
                        { value: "2", label: "2 a 3" },
                        { value: "4", label: "3 a 5" },
                        { value: "6", label: "5 a 8" },
                      ]}
                    />
                  </Field>
                  {questions.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setQuestionsOpen(true)}
                      className="inline-flex items-center gap-1 justify-self-start text-[13px] font-medium underline decoration-gray-300 underline-offset-4 hover:decoration-foreground"
                    >
                      Ver as perguntas
                      <ArrowUpRight className="size-3.5" />
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
            {job?.running ? (
              <div className="grid gap-2 rounded-xl bg-gray-100 p-3.5">
                {GEN_STEPS.map((label, i) => {
                  const done = job.stage > i + 1 || (job.stage >= 4 && i === 3);
                  const now = !done && job.stage === Math.min(4, i + 1);
                  return (
                    <span key={label} className={cn("flex items-center gap-2 text-[13px]", now ? "font-semibold" : "text-muted-foreground")}>
                      {done ? (
                        <Check className="size-4 text-[#1D8A5E]" />
                      ) : now ? (
                        <Loader2 className="size-4 animate-spin text-[#0072F5]" />
                      ) : (
                        <span className="size-4" />
                      )}
                      {label}
                    </span>
                  );
                })}
              </div>
            ) : job?.error ? (
              <p className="text-[12.5px] text-warning">{job.error}</p>
            ) : null}
            {job?.ready ? (
              <Button variant="dark" className="justify-self-start" onClick={job.onReview}>
                <Eye />
                Rever os comentários gerados
              </Button>
            ) : (
              <Button variant="dark" className="justify-self-start" onClick={onGenerate} disabled={job?.running}>
                {job?.running ? <Loader2 className="animate-spin" /> : <Zap />}
                Gerar comentários
              </Button>
            )}
            <p className="text-[12.5px] text-muted-foreground">
              Usa créditos de IA. Os comentários ficam por rever antes de entrarem na sala.
            </p>
          </>
        ) : way === "file" ? (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) onImport(file);
              }}
              className="grid place-items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center text-[13px] text-muted-foreground hover:border-foreground/40"
            >
              <FileSpreadsheet className="size-5" />
              Arraste para aqui uma folha com três colunas: minuto, nome e mensagem.
              <span className="text-xs">CSV, ou copiada de uma folha de cálculo</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImport(file);
                e.target.value = "";
              }}
            />
          </>
        ) : (
          <HandWritten clock={c} speechAt={speechAt} onWrite={onWrite} />
        )}
      </Section>

      <Section icon={Eye} title="4. Como ficou" aside={<CountPill>{comments.length} comentários</CountPill>}>
        {comments.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Ainda sem comentários. Gere, importe ou escreva à mão.</p>
        ) : (
          <>
            <p className="text-[12.5px] text-muted-foreground">
              {comments.length} comentários de {people} pessoas diferentes. Clique numa mensagem para ver esse minuto.
            </p>
            <CommentList comments={comments} current={current} onSeek={c.seek} onRemove={onRemove} />
            <Button variant="dark" className="justify-self-center" onClick={onWatch}>
              <Play className="fill-current" />
              Ver na sala
            </Button>
          </>
        )}
      </Section>

      <Section icon={Pin} title="Mensagem fixada">
        <Input
          value={form.chat_pin_title}
          onChange={(e) => set({ chat_pin_title: e.target.value })}
          placeholder="Participe no chat!"
          aria-label="Mensagem fixada"
          {...focus("pin")}
        />
      </Section>

      <Dialog open={questionsOpen} onOpenChange={setQuestionsOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Perguntas do apresentador</DialogTitle>
            <DialogDescription>
              As perguntas que faz à audiência, encontradas na fala. Em cada uma, algumas pessoas respondem no chat.
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y overflow-hidden rounded-xl border">
            {questions.map((q) => (
              <button
                key={q.at}
                type="button"
                onClick={() => {
                  c.seek(q.at);
                  setQuestionsOpen(false);
                }}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-[13px] hover:bg-gray-50"
              >
                <TimeChip seconds={q.at} />
                <span>{q.text}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CommentList({
  comments,
  current,
  onSeek,
  onRemove,
}: {
  comments: readonly ChatComment[];
  current: string | undefined;
  onSeek: (t: number) => void;
  onRemove: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  // A mensagem do minuto actual fica à vista dentro da lista, sem mexer no resto do painel.
  useEffect(() => {
    const list = box.current;
    const node = list?.querySelector<HTMLElement>(`[data-id="${current}"]`);
    if (!list || !node) return;
    const top = node.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + node.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = Math.max(0, top - list.clientHeight / 2);
    }
  }, [current]);
  return (
    <div ref={box} className="max-h-[360px] overflow-y-auto rounded-xl bg-[#141414] py-1 text-white">
      {comments.map((x) => {
        const tag = chatTagLabel(x.type, x.message);
        const on = x.id === current;
        return (
          <div
            key={x.id}
            data-id={x.id}
            className={cn("group flex items-start gap-2.5 px-3 py-2", on ? "bg-white/10" : "hover:bg-white/5")}
          >
            <button type="button" onClick={() => onSeek(x.at)} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
              <span
                className={cn(
                  "inline-grid h-6 shrink-0 place-items-center rounded-[5px] px-1.5 font-mono text-[11.5px] tabular-nums",
                  on ? "bg-[#E8440C]" : "bg-white/10",
                )}
              >
                {clock(x.at)}
              </span>
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#2E2E2E] text-[10px] font-bold">
                {x.author
                  .split(" ")
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <span className="min-w-0">
                <b className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold">
                  {x.author}
                  {tag ? <span className="rounded bg-white/10 px-1.5 py-px text-[10.5px] font-medium text-[#A3A3A3]">{tag}</span> : null}
                </b>
                <span className="block break-words text-[13px] text-[#D4D4D4]">{x.message}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(x.id)}
              aria-label="Apagar o comentário"
              title="Apagar o comentário"
              className="grid size-6 shrink-0 place-items-center rounded text-[#737373] opacity-0 hover:text-white group-hover:opacity-100 focus:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Escrever à mão: primeiro o minuto na roda (o vídeo vai para lá), depois a mensagem. */
function HandWritten({
  clock: c,
  speechAt,
  onWrite,
}: {
  clock: EditorClock;
  speechAt: (seconds: number) => string | null;
  onWrite: (at: number, message: string) => Promise<boolean>;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [wheel, setWheel] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // O minuto segue o vídeo até a pessoa escolher outro.
  const at = picked ?? Math.round(c.t);
  const said = speechAt(at);
  const add = async () => {
    const message = text.trim();
    if (!message) {
      toast.error("Escreva o comentário primeiro.");
      return;
    }
    setBusy(true);
    const ok = await onWrite(at, message);
    setBusy(false);
    if (ok) {
      setText("");
      setWheel(false);
      c.seek(at);
      toast.success(`Comentário aos ${clock(at)}.`);
    }
  };
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setWheel((v) => !v)}
          aria-pressed={wheel}
          aria-label="Minuto do comentário"
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 font-mono text-sm tabular-nums",
            wheel && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
          )}
        >
          <Clock className="size-4" />
          {clock(at)}
          {wheel ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        <span className="text-[12.5px] text-muted-foreground">Escolha o minuto. O vídeo vai para lá.</span>
      </div>
      {wheel ? (
        <MinuteWheel
          value={at}
          maxSeconds={c.duration}
          onChange={(s) => {
            setPicked(s);
            c.seek(Math.max(0, s - 2));
          }}
        />
      ) : null}
      <p className="flex gap-2 text-[12.5px] text-muted-foreground">
        <Mic className="mt-0.5 size-3.5 shrink-0" />
        {said ? (
          <span>
            Aos {clock(at)}, o apresentador diz: «{said}»
          </span>
        ) : (
          "Ainda sem fala neste minuto."
        )}
      </p>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="Escreva o comentário"
        />
        <Button variant="dark" onClick={() => void add()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Adicionar
        </Button>
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        O nome sai da lista do país escolhido em «Nomes de». <Tag tone="gray">Escrito à mão</Tag>
      </p>
    </div>
  );
}
