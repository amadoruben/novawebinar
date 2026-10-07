import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Clock,
  Eye,
  FileSpreadsheet,
  GraduationCap,
  Loader2,
  Lock,
  MessageCircle,
  MessagesSquare,
  Mic,
  Pencil,
  Pin,
  Play,
  ShieldCheck,
  Headset,
  MessageSquarePlus,
  Trash2,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/room-logic";
import { CHAT_COUNTRIES, type ChatCountryCode } from "@/lib/chat-variants";
import { alunoExample, chatPace, chatTagLabel, lateExample, namePool, type ChatRules } from "@/lib/chat-realism";
import { Field, HelpButton, MinuteWheel, Seg, Stepper, SwitchRow, Tag, TimeChip } from "../ui";
import type { HelpTopic } from "../help";
import type { EditorClock } from "./video";
import type { EditorForm, FocusProps, SetForm } from "../form";

export type ChatWay = "ai" | "file" | "one";
export type ChatComment = { id: string; at: number; author: string; message: string; type: string | null };
type Part = "quem" | "escrita" | "real" | "perguntas" | "gerar" | "ficou" | "suporte";

const TONES: { value: ChatRules["tone"]; label: string; lines: string[] }[] = [
  { value: "natural", label: "Natural", lines: ["Faz sentido, nunca tinha pensado nisso assim", "Isso acontece comigo também", "Boa noite a todos!"] },
  { value: "vendas", label: "Vendas", lines: ["Quero entrar. Até quando dá para comprar?", "Já estou dentro!", "Essa oferta vale muito"] },
  { value: "formal", label: "Formal", lines: ["Excelente explicação.", "Muito bem estruturado, obrigado.", "Ponto muito pertinente."] },
];
const TONE_EMOJI = ["👏", "🔥", "🙌"];
const GEN_STEPS = [
  "A ler a fala do vídeo",
  "A encontrar perguntas e momentos fortes",
  "A escrever no português de cada país",
  "A aplicar as regras para parecer real",
];

/** Chat: comentários simulados, sincronizados com a fala e com a audiência. Cada parte abre e fecha. */
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
  audience,
  product,
  onGenerate,
  onImport,
  onWrite,
  onRemove,
  onShow,
  onWatch,
  notify,
  onNotify,
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
  /** Para quantas pessoas o chat escreve (da Audiência); null quando a sala não mostra número. */
  audience: number | null;
  product: string;
  onGenerate: () => void;
  onImport: (file: File) => void;
  onWrite: (at: number, message: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  /** Mostra este comentário na sala (o vídeo vai para o minuto dele). */
  onShow: (comment: ChatComment) => void;
  /** Toca a sala a partir deste segundo. */
  onWatch: (seconds: number) => void;
  /** O aviso «já respondemos» no chat, nos dois formatos (fica em `chat_settings.live.notify`). */
  notify: boolean;
  onNotify: (notify: boolean) => void;
}) {
  const [open, setOpen] = useState<Part | null>(comments.length ? "ficou" : "quem");
  const toggle = (part: Part) => setOpen((current) => (current === part ? null : part));
  const fileRef = useRef<HTMLInputElement>(null);
  const people = new Set(comments.map((x) => x.author)).size;
  const pace = chatPace(audience ?? 100, rules.volume);
  const chosen = CHAT_COUNTRIES.filter((x) => rules.countries.includes(x.code));
  const names = namePool(rules.countries);
  const tone = TONES.find((t) => t.value === rules.tone)!;
  const activeRules = [rules.delay, rules.mobile, rules.late, rules.talk, rules.follow].filter(Boolean).length;
  const current = [...comments].reverse().find((x) => x.at <= c.t)?.id;
  const product0 = rules.alunos.product.trim() || product.trim();
  const emoji = (i: number) => (rules.emoji && rules.tone !== "formal" ? ` ${TONE_EMOJI[i % TONE_EMOJI.length]}` : "");
  const toggleCountry = (code: ChatCountryCode) => {
    const next = rules.countries.includes(code) ? rules.countries.filter((x) => x !== code) : [...rules.countries, code];
    if (next.length === 0) {
      toast.error("Escolha pelo menos um país.");
      return;
    }
    onRules({ countries: CHAT_COUNTRIES.map((x) => x.code).filter((x) => next.includes(x)) });
  };

  return (
    <div className="grid gap-2.5">
      <Part
        icon={Users}
        help="chatQuem"
        title="Quem está no chat"
        summary={`${chosen.map((x) => `${x.flag} ${x.name}`).join(" + ")} · ~${pace.perMinute} por minuto`}
        open={open === "quem"}
        onToggle={() => toggle("quem")}
      >
        <Field label="Países" hint="Cada pessoa escreve no português do seu país, com nome e apelido de lá. Vários países misturam-se.">
          <div className="flex flex-wrap gap-1.5">
            {CHAT_COUNTRIES.map((x) => {
              const on = rules.countries.includes(x.code);
              return (
                <button
                  key={x.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCountry(x.code)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition",
                    on ? "border-foreground bg-foreground text-background" : "bg-white hover:bg-gray-50",
                  )}
                >
                  <span className="text-base leading-none">{x.flag}</span>
                  {x.name}
                  {on ? <Check className="size-3.5" /> : null}
                </button>
              );
            })}
            <span className="inline-flex h-9 items-center rounded-full border border-dashed px-3 text-[12.5px] text-muted-foreground">
              Outros países · em breve
            </span>
          </div>
        </Field>
        <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-[12.5px] text-muted-foreground">
          <span className="font-medium text-foreground">Nomes: </span>
          {names.slice(0, 4).join(", ")}…
        </div>
        <Field label="Volume do chat">
          <div className="grid gap-2 rounded-xl border bg-white p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm">
                <b className="font-mono text-xl font-semibold tabular-nums">~{pace.perMinute}</b> comentários por minuto
              </span>
              <span className="text-[12px] text-muted-foreground">{pace.people} pessoas a escrever</span>
            </div>
            <Seg
              full
              small
              value={rules.volume}
              onChange={(volume) => onRules({ volume })}
              options={[
                { value: "menos", label: "Menos" },
                { value: "normal", label: "Normal" },
                { value: "mais", label: "Mais" },
              ]}
            />
            <p className="text-[12px] leading-snug text-muted-foreground">
              {audience !== null
                ? `Segue a Audiência: uma sala com cerca de ${audience.toLocaleString("pt-PT")} pessoas. Quando a audiência desce, o chat acalma.`
                : "A sala não mostra número de pessoas: o ritmo é o de uma sala com 100."}
            </p>
          </div>
        </Field>
        <Done onClick={() => setOpen("escrita")} label="Seguinte" />
      </Part>

      <Part
        icon={MessageCircle}
        title="Como escrevem"
        summary={`${tone.label} · ${rules.emoji && rules.tone !== "formal" ? "com emojis" : "sem emojis"}`}
        open={open === "escrita"}
        onToggle={() => toggle("escrita")}
        help="tom"
      >
        <Field label="Tom">
          <Seg
            full
            value={rules.tone}
            onChange={(t) => onRules({ tone: t })}
            options={TONES.map((t) => ({ value: t.value, label: t.label }))}
          />
        </Field>
        {/* Como fica: três mensagens no tom escolhido, com nomes dos países escolhidos. */}
        <div className="grid gap-2.5 rounded-xl border bg-white p-3">
          {tone.lines.map((line, i) => (
            <ExampleLine key={line} author={names[i * 2] ?? "Edson Mateus"} text={line + emoji(i)} />
          ))}
        </div>
        <SwitchLine
          title="Com emojis"
          description="Mais emojis, como num chat ao vivo: 🔥 👏 🙌 😍"
          checked={rules.emoji}
          onChange={(v) => onRules({ emoji: v })}
          disabled={rules.tone === "formal"}
        />
        {rules.tone === "formal" ? <p className="-mt-1 text-[12px] text-muted-foreground">No tom formal não há emojis.</p> : null}
        <Done onClick={() => setOpen("real")} label="Seguinte" />
      </Part>

      <Part
        icon={ShieldCheck}
        title="Para parecer real"
        summary={`${activeRules} de 5 regras · ${rules.alunos.on ? `${rules.alunos.count} alunos${product0 ? ` de ${product0}` : ""}` : "sem alunos"}`}
        open={open === "real"}
        onToggle={() => toggle("real")}
        help="realismo"
      >
        <div className="divide-y overflow-hidden rounded-xl border bg-white">
          <RuleRow
            title="Escrevem com atraso"
            description="3 a 15 segundos depois da frase, como quem está a ouvir."
            checked={rules.delay}
            onChange={(delay) => onRules({ delay })}
          />
          <RuleRow
            title="Há quem chegue atrasado"
            description="Nos primeiros minutos."
            example={lateExample(rules.countries)}
            checked={rules.late}
            onChange={(late) => onRules({ late })}
          />
          <RuleRow
            title="Conversam entre si"
            description="Às vezes alguém responde a outra pessoa."
            example={`@${(names[0] ?? "Edson").split(" ")[0]} verdade${emoji(1)}`}
            checked={rules.talk}
            onChange={(talk) => onRules({ talk })}
          />
          <RuleRow
            title="Escrita de telemóvel"
            description="Algumas em minúsculas, com «vc» e «tb»."
            example="tb acho isso, faz mt sentido"
            checked={rules.mobile}
            onChange={(mobile) => onRules({ mobile })}
          />
          <RuleRow
            title="Acompanham a audiência"
            description="Menos gente a ver, menos mensagens."
            checked={rules.follow}
            onChange={(follow) => onRules({ follow })}
          />
        </div>

        <div className="grid gap-3 rounded-xl border bg-white p-3">
          <SwitchLine
            icon={GraduationCap}
            title="Alunos que já compraram"
            description="Algumas pessoas dizem que já são alunas do curso."
            checked={rules.alunos.on}
            onChange={(on) => onRules({ alunos: { ...rules.alunos, on } })}
          />
          {rules.alunos.on ? (
            <>
              <Field label="Alunos de quê?">
                <Input
                  value={rules.alunos.product}
                  onChange={(e) => onRules({ alunos: { ...rules.alunos, product: e.target.value.slice(0, 80) } })}
                  placeholder={product.trim() || "Ex.: Mentoria Grupo Primo"}
                />
              </Field>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
                <Field label="Quantos">
                  <Stepper value={rules.alunos.count} min={1} max={8} onChange={(count) => onRules({ alunos: { ...rules.alunos, count } })} />
                </Field>
                <Field label="Quando">
                  <Seg
                    full
                    small
                    value={rules.alunos.when}
                    onChange={(when) => onRules({ alunos: { ...rules.alunos, when } })}
                    options={[
                      { value: "oferta", label: "Na oferta" },
                      { value: "aula", label: "Na aula" },
                    ]}
                  />
                </Field>
              </div>
              <ExampleLine author={names[3] ?? "Kátia Domingos"} text={alunoExample(product0) + emoji(2)} tag="Aluno do curso" />
              <p className="text-[12px] text-muted-foreground">
                {rules.alunos.when === "oferta"
                  ? "Aparecem depois de a oferta abrir, espaçados, quando a dúvida de quem está a ver é maior."
                  : "Aparecem espalhados pela aula, depois dos primeiros minutos."}
              </p>
            </>
          ) : null}
        </div>
        <p className="flex gap-2 text-[12px] text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          Nunca prometem resultados nem inventam números. Nenhuma mensagem se repete.
        </p>
        <Done onClick={() => setOpen("perguntas")} label="Seguinte" />
      </Part>

      <Part
        icon={Mic}
        help="perguntas"
        title="Perguntas do apresentador"
        summary={
          questions.length
            ? `${questions.length} ${questions.length === 1 ? "pergunta" : "perguntas"} no vídeo · ${rules.answersOn ? `${{ 2: "2 a 3", 4: "3 a 5", 6: "5 a 8" }[rules.answers]} respondem` : "sem respostas"}`
            : "Encontradas depois de transcrever o vídeo"
        }
        open={open === "perguntas"}
        onToggle={() => toggle("perguntas")}
      >
        <SwitchLine
          title="O chat responde"
          description="Quando o apresentador pergunta algo à audiência, algumas pessoas respondem."
          checked={rules.answersOn}
          onChange={(answersOn) => onRules({ answersOn })}
        />
        {rules.answersOn ? (
          <Field label="Quantas pessoas respondem a cada pergunta">
            <Seg
              full
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
        ) : null}
        {questions.length ? (
          <div className="divide-y overflow-hidden rounded-xl border bg-white">
            {questions.map((q) => (
              <button
                key={q.at}
                type="button"
                onClick={() => onWatch(q.at)}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-[13px] hover:bg-gray-50"
              >
                <TimeChip seconds={q.at} active={c.t >= q.at && c.t - q.at < 12} />
                <span className="min-w-0 flex-1">{q.text}</span>
                <Play className="mt-1 size-3.5 shrink-0 fill-current text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-gray-50 px-3 py-2.5 text-[12.5px] text-muted-foreground">
            O sistema ouve o vídeo e encontra as perguntas que o apresentador faz ao público. Aparecem aqui depois da transcrição
            (ao gerar os comentários).
          </p>
        )}
        <Done onClick={() => setOpen("gerar")} label="Seguinte" />
      </Part>

      <Part
        icon={MessageSquarePlus}
        help="gerar"
        title="Gerar comentários"
        summary={way === "ai" ? "Com IA, a partir da fala do vídeo" : way === "file" ? "De uma folha" : "Escritos à mão"}
        open={open === "gerar"}
        onToggle={() => toggle("gerar")}
      >
        <Seg
          full
          small
          value={way}
          onChange={onWay}
          options={[
            { value: "ai", label: "Com IA" },
            { value: "file", label: "De uma folha" },
            { value: "one", label: "À mão" },
          ]}
        />
        {way === "ai" ? (
          <>
            <div className="grid gap-1.5 rounded-xl bg-gray-50 px-3.5 py-3 text-[12.5px] text-muted-foreground">
              <span className="flex items-center gap-2">
                <Check className="size-3.5 text-[#1D8A5E]" />~{pace.perMinute} por minuto, de {pace.people} pessoas de{" "}
                {chosen.map((x) => x.name).join(", ")}
              </span>
              <span className="flex items-center gap-2">
                <Check className="size-3.5 text-[#1D8A5E]" />
                Tom {tone.label.toLowerCase()}, {rules.emoji && rules.tone !== "formal" ? "com emojis" : "sem emojis"}
              </span>
              <span className="flex items-center gap-2">
                <Check className="size-3.5 text-[#1D8A5E]" />
                {activeRules} regras{rules.alunos.on ? `, ${rules.alunos.count} alunos` : ""}
                {rules.answersOn && questions.length ? `, respostas a ${questions.length} perguntas` : ""}
              </span>
            </div>
            {job?.running ? (
              <div className="grid gap-2 rounded-xl border bg-white p-3.5">
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
              <Button variant="dark" onClick={job.onReview}>
                <Eye />
                Rever os comentários gerados
              </Button>
            ) : (
              <Button variant="dark" onClick={onGenerate} disabled={job?.running}>
                {job?.running ? <Loader2 className="animate-spin" /> : <Zap />}
                Gerar comentários com IA
              </Button>
            )}
            <p className="text-center text-[12px] text-muted-foreground">
              Grava o webinar antes de começar. Usa créditos de IA. Os gerados substituem os anteriores; os escritos à mão ficam.
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
              className="grid place-items-center gap-1.5 rounded-xl border-2 border-dashed bg-white px-4 py-6 text-center text-[13px] text-muted-foreground hover:border-foreground/40"
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
        icon={MessagesSquare}
        help="comoFicou"
        title="Como ficou"
        summary={comments.length ? `${comments.length} comentários de ${people} pessoas` : "Ainda sem comentários"}
        open={open === "ficou"}
        onToggle={() => toggle("ficou")}
      >
        {comments.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Gere os comentários em «Gerar comentários».</p>
        ) : (
          <>
            <p className="text-[12.5px] text-muted-foreground">Clique num comentário: a sala vai para esse minuto e mostra-o.</p>
            <CommentList comments={comments} current={current} onShow={onShow} onRemove={onRemove} />
            <Button variant="outline" onClick={() => onWatch(c.t < 40 || c.t > c.duration - 20 ? Math.min(63, c.duration) : c.t)}>
              <Play className="fill-current" />
              Ver o chat a correr na sala
            </Button>
          </>
        )}
        <Field label={<><Pin className="size-3.5" />Mensagem fixada no chat</>}>
          <Input
            value={form.chat_pin_title}
            onChange={(e) => set({ chat_pin_title: e.target.value })}
            placeholder="Participe no chat!"
            aria-label="Mensagem fixada"
            {...focus("pin")}
          />
        </Field>
      </Part>

      <Part
        icon={Headset}
        help="avisoSuporte"
        title="Aviso do Suporte"
        summary={notify ? "Avisa no chat quando há resposta por ler" : "Sem aviso no chat"}
        open={open === "suporte"}
        onToggle={() => toggle("suporte")}
      >
        <SwitchRow
          title="Avisar no chat quando o Suporte responde"
          description="Se a pessoa não abrir a resposta em 20 segundos, o chat mostra-lhe «@Você, já respondemos à sua dúvida». Só ela vê."
          checked={notify}
          onChange={onNotify}
        />
      </Part>
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
    <section className={cn("overflow-hidden rounded-xl border bg-white transition-shadow", open && "shadow-[0_2px_8px_rgba(0,0,0,.06)]")}>
      <div className="flex items-center gap-1 pr-2">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", open ? "bg-foreground text-background" : "bg-chip")}>
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[14px] font-semibold">{title}</b>
            <span className="block truncate text-[12.5px] text-muted-foreground">{summary}</span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {help ? <HelpButton topic={help} /> : null}
      </div>
      {open ? <div className="grid gap-3.5 border-t bg-[var(--ds-background-200,#fafafa)] px-3.5 pb-3.5 pt-3.5">{children}</div> : null}
    </section>
  );
}

function Done({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="outline" size="sm" className="justify-self-end" onClick={onClick}>
      {label}
      <ChevronDown className="-rotate-90" />
    </Button>
  );
}

/** Uma mensagem de exemplo, com o desenho do chat da sala (claro). */
function ExampleLine({ author, text, tag }: { author: string; text: string; tag?: string }) {
  const initials = author
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-chip text-[10.5px] font-bold">{initials}</span>
      <p className="min-w-0 pt-0.5 text-[13.5px] leading-snug">
        <span className="mr-1.5 font-semibold text-muted-foreground">{author}</span>
        {tag ? <Tag tone="gray">{tag}</Tag> : null} {text}
      </p>
    </div>
  );
}

/** Um interruptor com título e frase (o rótulo todo liga e desliga). */
function SwitchLine({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-center justify-between gap-3", disabled && "opacity-50")}>
      <span className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-chip">
            <Icon className="size-4" />
          </span>
        ) : null}
        <span className="min-w-0">
          <b className="block text-[13.5px] font-medium">{title}</b>
          <span className="block text-[12.5px] leading-snug text-muted-foreground">{description}</span>
        </span>
      </span>
      <Switch checked={checked && !disabled} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

/** Uma regra: o que faz, um exemplo de mensagem e o interruptor. */
function RuleRow({
  title,
  description,
  example,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  example?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 px-3 py-2.5">
      <span className="min-w-0">
        <b className="block text-[13.5px] font-medium">{title}</b>
        <span className="block text-[12.5px] leading-snug text-muted-foreground">{description}</span>
        {example ? (
          <span className={cn("mt-1.5 inline-block rounded-lg bg-gray-100 px-2.5 py-1 text-[12.5px]", !checked && "opacity-50")}>
            «{example}»
          </span>
        ) : null}
      </span>
      <Switch className="mt-0.5" checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function CommentList({
  comments,
  current,
  onShow,
  onRemove,
}: {
  comments: readonly ChatComment[];
  current: string | undefined;
  onShow: (comment: ChatComment) => void;
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
    <div ref={box} className="relative max-h-[360px] divide-y overflow-y-auto rounded-xl border bg-white">
      {comments.map((x) => {
        const tag = chatTagLabel(x.type, x.message);
        const on = x.id === current;
        return (
          <div key={x.id} data-id={x.id} className={cn("group flex items-start gap-2.5 px-3 py-2.5", on ? "bg-[#FDE4D9]/50" : "hover:bg-gray-50")}>
            <button type="button" onClick={() => onShow(x)} className="flex min-w-0 flex-1 items-start gap-2.5 text-left" title="Ver na sala">
              <TimeChip seconds={x.at} active={on} />
              <span className="min-w-0">
                <b className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold">
                  {x.author}
                  {tag ? <Tag tone="gray">{tag}</Tag> : null}
                </b>
                <span className="block break-words text-[13px] text-foreground/85">{x.message}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(x.id)}
              aria-label="Apagar o comentário"
              title="Apagar o comentário"
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 hover:bg-[var(--ds-gray-alpha-200)] hover:text-foreground group-hover:opacity-100 focus:opacity-100"
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
          <ChevronDown className={cn("size-4 transition-transform", wheel && "rotate-180")} />
        </button>
        <span className="text-[12.5px] text-muted-foreground">Escolha o minuto. O vídeo vai para lá.</span>
      </div>
      {wheel ? (
        <div className="rounded-xl border bg-white">
          <MinuteWheel
            value={at}
            maxSeconds={c.duration}
            onChange={(s) => {
              setPicked(s);
              c.seek(Math.max(0, s - 2));
            }}
          />
        </div>
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
        O nome sai da lista dos países escolhidos. <Tag tone="gray">Escrito à mão</Tag>
      </p>
    </div>
  );
}
