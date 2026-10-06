import { useEffect, useRef, useState, type ReactNode } from "react";
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
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/room-logic";
import { chatTagLabel, type ChatRules } from "@/lib/chat-realism";
import { HelpButton, MinuteWheel, Seg, SwitchRow, Tag, TimeChip } from "../ui";
import type { HelpTopic } from "../help";
import type { EditorClock } from "./video";
import type { EditorForm, FocusProps, SetForm } from "../form";

export type ChatWay = "ai" | "file" | "one";
export type ChatComment = { id: string; at: number; author: string; message: string; type: string | null };
type Part = "estilo" | "real" | "criar" | "ficou";

const TONES: { value: ChatRules["tone"]; label: string; who: string; text: string }[] = [
  { value: "natural", label: "Natural", who: "Ana", text: "Faz sentido, nunca tinha pensado no upsell assim" },
  { value: "vendas", label: "Vendas", who: "Paulo", text: "Quero entrar. Até quando dá para comprar?" },
  { value: "formal", label: "Formal", who: "Sérgio", text: "Excelente explicação sobre o ticket médio." },
];
const LEVELS: { value: ChatRules["level"]; label: string; perMinute: number; bars: number }[] = [
  { value: "baixa", label: "Baixa", perMinute: 5, bars: 1 },
  { value: "media", label: "Média", perMinute: 9, bars: 2 },
  { value: "alta", label: "Alta", perMinute: 15, bars: 3 },
];
const COUNTRIES: { value: ChatRules["country"]; label: string; flag: string; names: string }[] = [
  { value: "ao", label: "Angola", flag: "🇦🇴", names: "Edson, Kátia, Nelson, Yola…" },
  { value: "br", label: "Brasil", flag: "🇧🇷", names: "Ana Clara, João Pedro, Larissa…" },
  { value: "pt", label: "Portugal", flag: "🇵🇹", names: "Inês, Tiago, Beatriz…" },
  { value: "mix", label: "Vários países", flag: "🌍", names: "Angola, Brasil e Portugal misturados" },
];
const GEN_STEPS = [
  "A ler a fala do vídeo",
  "A encontrar perguntas e momentos fortes",
  "A escrever no tom escolhido",
  "A aplicar as regras para parecer real",
];

/** Chat: comentários simulados, sincronizados com a fala. Cada parte abre e fecha. */
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
  const [open, setOpen] = useState<Part | null>(comments.length ? "ficou" : "criar");
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const toggle = (part: Part) => setOpen((current) => (current === part ? null : part));
  const fileRef = useRef<HTMLInputElement>(null);
  const people = new Set(comments.map((x) => x.author)).size;
  const tone = TONES.find((t) => t.value === rules.tone)!;
  const level = LEVELS.find((l) => l.value === rules.level)!;
  const country = COUNTRIES.find((x) => x.value === rules.country)!;
  const activeRules = [rules.names, rules.delay, rules.mobile, rules.late, rules.talk, rules.follow].filter(Boolean).length;
  const current = [...comments].reverse().find((x) => x.at <= c.t)?.id;

  return (
    <div className="grid gap-2.5">
      <Part
        icon={MessageCircle}
        title="1. Estilo das mensagens"
        summary={`${tone.label} · ${level.label} · ${rules.emoji ? "com emojis" : "sem emojis"}`}
        open={open === "estilo"}
        onToggle={() => toggle("estilo")}
        help="tom"
      >
        <Label>Tom</Label>
        <div className="grid gap-2" role="radiogroup" aria-label="Tom">
          {TONES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={rules.tone === t.value}
              onClick={() => onRules({ tone: t.value })}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-white p-2.5 text-left transition hover:bg-gray-50",
                rules.tone === t.value && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
              )}
            >
              <span className="w-16 shrink-0 text-[13px] font-semibold">{t.label}</span>
              <span className="flex min-w-0 flex-1 items-start gap-2 rounded-lg bg-[#141414] px-2.5 py-2 text-white">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#2E2E2E] text-[10px] font-bold">{t.who[0]}</span>
                <span className="min-w-0">
                  <b className="block text-[11.5px] font-semibold text-white/70">{t.who}</b>
                  <span className="block text-[12.5px] leading-snug">
                    {t.text}
                    {rules.emoji && t.value !== "formal" ? " 👏" : ""}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
        <Label>Intensidade</Label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Intensidade">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={rules.level === l.value}
              onClick={() => onRules({ level: l.value })}
              className={cn(
                "grid justify-items-center gap-1.5 rounded-xl border bg-white px-2 py-3 transition hover:bg-gray-50",
                rules.level === l.value && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
              )}
            >
              <span className="flex h-5 items-end gap-[3px]" aria-hidden>
                {[1, 2, 3].map((n) => (
                  <i key={n} className={cn("w-1.5 rounded-sm", n <= l.bars ? "bg-foreground" : "bg-gray-200")} style={{ height: 6 + n * 4 }} />
                ))}
              </span>
              <b className="text-[13px] font-semibold">{l.label}</b>
              <span className="text-[11.5px] text-muted-foreground">~{l.perMinute} por minuto</span>
            </button>
          ))}
        </div>
        <SwitchRow
          title="Com emojis"
          description="Os comentários levam emojis, como num chat real."
          checked={rules.emoji}
          onChange={(emoji) => onRules({ emoji })}
        />
        <Done onClick={() => setOpen(null)} />
      </Part>

      <Part
        icon={ShieldCheck}
        title="2. Para parecer real"
        summary={`${country.flag} ${country.label} · ${rules.alunos ? `até ${rules.alunos} alunos` : "sem alunos"} · ${activeRules} de 6 regras`}
        open={open === "real"}
        onToggle={() => toggle("real")}
        help="realismo"
      >
        <Label>Nomes de quem comenta</Label>
        <div className="relative">
          <select
            value={rules.country}
            onChange={(e) => onRules({ country: e.target.value as ChatRules["country"] })}
            aria-label="País dos nomes"
            className="h-10 w-full appearance-none rounded-sm bg-white pl-3 pr-9 text-sm shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)] outline-none focus:shadow-[inset_0_0_0_1px_var(--foreground)]"
          >
            {COUNTRIES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.flag} {x.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <p className="text-[12.5px] text-muted-foreground">Ex.: {country.names}</p>

        <Label>Quem diz que já é aluno</Label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Quem diz que já é aluno">
          {(
            [
              [0, "Ninguém", "Sem prova social"],
              [2, "Até 2", "Recomendado"],
              [4, "Até 4", "Mais prova social"],
            ] as const
          ).map(([n, label, text]) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rules.alunos === n}
              onClick={() => onRules({ alunos: n })}
              className={cn(
                "grid gap-0.5 rounded-xl border bg-white px-2.5 py-2.5 text-left transition hover:bg-gray-50",
                rules.alunos === n && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
              )}
            >
              <b className="text-[13px] font-semibold">{label}</b>
              <span className="text-[11.5px] text-muted-foreground">{text}</span>
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          Perto da oferta, alguém escreve «Já fiz a mentoria, recomendo muito». Uma vez por sessão, nunca mais do que isto.
        </p>

        <Label>Regras</Label>
        <div className="grid gap-3 rounded-xl border bg-white p-3.5">
          <SwitchRow title="Não repetir nomes seguidos" description="O mesmo nome só volta 2 minutos depois." checked={rules.names} onChange={(names) => onRules({ names })} />
          <SwitchRow title="Escrevem com atraso" description="3 a 15 segundos depois da frase, como quem está a ouvir." checked={rules.delay} onChange={(delay) => onRules({ delay })} />
          <SwitchRow title="Escrita de telemóvel" description="Algumas em minúsculas, com «vc» e «tb»." checked={rules.mobile} onChange={(mobile) => onRules({ mobile })} />
          <SwitchRow title="Há quem chegue atrasado" description="«Cheguei agora», «Já começou?» nos primeiros minutos." checked={rules.late} onChange={(late) => onRules({ late })} />
          <SwitchRow title="Conversam entre si" description="Às vezes alguém responde a outra pessoa do chat." checked={rules.talk} onChange={(talk) => onRules({ talk })} />
          <SwitchRow title="Acompanham a audiência" description="Mais gente a ver, mais comentários." checked={rules.follow} onChange={(follow) => onRules({ follow })} />
        </div>
        <p className="flex gap-2 text-[12.5px] text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          Nunca prometem resultados nem inventam números. Nenhuma mensagem se repete. O que cada pessoa escreve na sala, só ela vê.
        </p>
        <Done onClick={() => setOpen(null)} />
      </Part>

      <Part
        icon={Layers}
        title="3. Criar os comentários"
        summary={way === "ai" ? "A partir da fala do vídeo" : way === "file" ? "De uma folha" : "Escritos à mão"}
        open={open === "criar"}
        onToggle={() => toggle("criar")}
      >
        <Seg
          full
          small
          value={way}
          onChange={onWay}
          options={[
            { value: "ai", label: "Da fala" },
            { value: "file", label: "De uma folha" },
            { value: "one", label: "À mão" },
          ]}
        />
        {way === "ai" ? (
          <>
            <p className="text-[13px] text-muted-foreground">
              A IA ouve o vídeo e escreve os comentários nos momentos certos, no tom e com as regras que escolheu. Ficam por
              rever antes de entrarem na sala.
            </p>
            <div className="grid gap-3 rounded-xl border bg-white p-3.5">
              <SwitchRow
                title="Responder às perguntas do apresentador"
                description={
                  questions.length
                    ? `Há ${questions.length} ${questions.length === 1 ? "pergunta" : "perguntas"} à audiência na fala.`
                    : "Quando pergunta algo à audiência, algumas pessoas respondem."
                }
                checked={rules.answersOn}
                onChange={(answersOn) => onRules({ answersOn })}
              />
              {rules.answersOn ? (
                <>
                  <Seg
                    full
                    small
                    value={String(rules.answers) as "2" | "4" | "6"}
                    onChange={(v) => onRules({ answers: Number(v) as 2 | 4 | 6 })}
                    options={[
                      { value: "2", label: "2 a 3 pessoas" },
                      { value: "4", label: "3 a 5" },
                      { value: "6", label: "5 a 8" },
                    ]}
                  />
                  {questions.length ? (
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
                  const done = job.stage > i + 1;
                  const now = !done && job.stage === Math.min(4, i + 1);
                  return (
                    <span key={label} className={cn("flex items-center gap-2 text-[13px]", now ? "font-semibold" : "text-muted-foreground")}>
                      {done ? <Check className="size-4 text-[#1D8A5E]" /> : now ? <Loader2 className="size-4 animate-spin text-[#0072F5]" /> : <span className="size-4" />}
                      {label}
                    </span>
                  );
                })}
              </div>
            ) : job?.error ? (
              <p className="rounded-lg bg-[#FBEBCF] px-3 py-2.5 text-[12.5px] text-[#6B4300]">{job.error}</p>
            ) : null}
            {job?.ready ? (
              <Button variant="dark" className="justify-self-start" onClick={job.onReview}>
                <Eye />
                Rever os comentários criados
              </Button>
            ) : (
              <Button variant="dark" className="justify-self-start" onClick={onGenerate} disabled={job?.running}>
                {job?.running ? <Loader2 className="animate-spin" /> : <Zap />}
                Criar comentários com IA
              </Button>
            )}
            <p className="text-[12px] text-muted-foreground">Usa créditos de IA. Grava o webinar antes de começar.</p>
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
              Arraste para aqui a folha
              <span className="text-xs">Três colunas: minuto, nome e mensagem. CSV ou copiada do Excel.</span>
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
      </Part>

      <Part
        icon={Eye}
        title="4. Como ficou"
        summary={comments.length ? `${comments.length} comentários de ${people} pessoas` : "Ainda sem comentários"}
        open={open === "ficou"}
        onToggle={() => toggle("ficou")}
      >
        {comments.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Crie os comentários em «3. Criar os comentários».</p>
        ) : (
          <>
            <p className="text-[12.5px] text-muted-foreground">Clique numa mensagem para ver esse momento na sala.</p>
            <CommentList comments={comments} current={current} onSeek={c.seek} onRemove={onRemove} />
            <Button variant="dark" className="justify-self-center" onClick={onWatch}>
              <Play className="fill-current" />
              Ver na sala
            </Button>
          </>
        )}
        <div className="grid gap-1.5 border-t pt-3">
          <Label>
            <Pin className="size-3.5" />
            Mensagem fixada no chat
          </Label>
          <Input
            value={form.chat_pin_title}
            onChange={(e) => set({ chat_pin_title: e.target.value })}
            placeholder="Participe no chat!"
            aria-label="Mensagem fixada"
            {...focus("pin")}
          />
        </div>
      </Part>

      <Dialog open={questionsOpen} onOpenChange={setQuestionsOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Perguntas do apresentador</DialogTitle>
            <DialogDescription>As perguntas que faz à audiência, encontradas na fala. Em cada uma, algumas pessoas respondem.</DialogDescription>
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
    </div>
  );
}

/** Uma parte do Chat: fechada mostra o resumo; aberta mostra as escolhas. */
function Part({
  icon: Icon,
  title,
  summary,
  open,
  onToggle,
  help,
  children,
}: {
  icon: LucideIcon;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  help?: HelpTopic;
  children: ReactNode;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-white", open && "shadow-[0_1px_3px_rgba(0,0,0,.06)]")}>
      <div className="flex items-center gap-1 pr-2">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-chip">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[14px] font-semibold">{title}</b>
            <span className="block truncate text-[12.5px] text-muted-foreground">{summary}</span>
          </span>
          {open ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
        </button>
        {help ? <HelpButton topic={help} /> : null}
      </div>
      {open ? <div className="grid gap-3 border-t px-3.5 pb-3.5 pt-3">{children}</div> : null}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="flex items-center gap-1.5 text-[13px] font-medium">{children}</span>;
}

function Done({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="justify-self-end" onClick={onClick}>
      <Check />
      Feito
    </Button>
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
    <div ref={box} className="relative max-h-[340px] overflow-y-auto rounded-xl bg-[#141414] py-1 text-white">
      {comments.map((x) => {
        const tag = chatTagLabel(x.type, x.message);
        const on = x.id === current;
        return (
          <div key={x.id} data-id={x.id} className={cn("group flex items-start gap-2.5 px-3 py-2", on ? "bg-white/10" : "hover:bg-white/5")}>
            <button type="button" onClick={() => onSeek(x.at)} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
              <span className={cn("inline-grid h-6 shrink-0 place-items-center rounded-[5px] px-1.5 font-mono text-[11.5px] tabular-nums", on ? "bg-[#E8440C]" : "bg-white/10")}>
                {clock(x.at)}
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
          className={cn("inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 font-mono text-sm tabular-nums", wheel && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]")}
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
        {said ? <span>Aos {clock(at)}, o apresentador diz: «{said}»</span> : "Ainda sem fala neste minuto."}
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
          {busy ? <Loader2 className="animate-spin" /> : <Pencil />}
          Adicionar
        </Button>
      </div>
      <p className="text-[12px] text-muted-foreground">
        O nome sai da lista do país escolhido. <Tag tone="gray">Escrito à mão</Tag>
      </p>
    </div>
  );
}
