import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Info, Minus, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/room-logic";
import { HELP, type HelpTopic } from "./help";

/** As peças do painel de cada etapa, com a medida do protótipo aprovado (versão 13). */

export function HelpButton({ topic, className }: { topic: HelpTopic; className?: string }) {
  const [open, setOpen] = useState(false);
  const help = HELP[topic];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Como funciona"
        title="Como funciona"
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-[var(--ds-gray-alpha-200)] hover:text-foreground",
          className,
        )}
      >
        <Info className="size-[15px]" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[520px] gap-0 overflow-y-auto p-0 sm:p-0">
          <DialogHeader className="flex-row items-start gap-3 space-y-0 border-b px-5 pb-4 pt-5 text-left sm:px-6">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-chip">
              <Info className="size-4" />
            </span>
            <div className="min-w-0 space-y-1 pr-6">
              <DialogTitle className="text-base font-semibold tracking-tight">{help.title}</DialogTitle>
              <DialogDescription className="leading-relaxed">{help.what}</DialogDescription>
            </div>
          </DialogHeader>
          <div className="grid gap-5 px-5 py-5 sm:px-6">
            <section className="grid gap-2.5">
              <h4 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Como usar</h4>
              <ol className="grid gap-2.5">
                {help.steps.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-chip font-mono text-[12px] font-semibold">{i + 1}</span>
                    <span className="pt-0.5 text-sm leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </section>
            <section className="grid gap-2.5">
              <h4 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Exemplo</h4>
              <p className="rounded-xl border bg-[var(--ds-background-200,#fafafa)] px-4 py-3 text-sm leading-relaxed">{help.example}</p>
            </section>
            {"tips" in help && help.tips?.length ? (
              <section className="grid gap-2.5">
                <h4 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Dicas</h4>
                <ul className="grid gap-2">
                  {help.tips.map((tip) => (
                    <li key={tip} className="flex gap-2.5 text-sm leading-relaxed">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#E8440C]" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
          <div className="flex justify-end border-t px-5 py-3 sm:px-6">
            <Button variant="dark" size="sm" onClick={() => setOpen(false)}>
              Percebi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Uma secção do painel: título com ícone e, se houver, o (i). As secções separam-se por uma linha. */
export function Section({
  icon: Icon,
  title,
  help,
  aside,
  children,
  className,
}: {
  icon?: LucideIcon | undefined;
  title?: ReactNode;
  help?: HelpTopic | undefined;
  aside?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section
      className={cn(
        "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 border-t py-[18px] first:border-t-0 first:pt-0 last:pb-0",
        className,
      )}
    >
      {title ? (
        <h3 className="flex items-center gap-2 text-[14.5px] font-semibold tracking-tight">
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
          {title}
          {help ? <HelpButton topic={help} /> : null}
          {aside ? <span className="ml-auto">{aside}</span> : null}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

export function Field({
  label,
  required,
  hint,
  warn,
  children,
  htmlFor,
}: {
  label?: ReactNode;
  required?: boolean | undefined;
  hint?: ReactNode;
  warn?: boolean | undefined;
  children: ReactNode;
  htmlFor?: string | undefined;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1.5">
      {label ? (
        <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-[13px] font-medium">
          {label}
          {required ? <i className="not-italic text-[#E8440C]">*</i> : null}
        </label>
      ) : null}
      {children}
      {hint ? <p className={cn("text-[12.5px] leading-snug", warn ? "text-warning" : "text-muted-foreground")}>{hint}</p> : null}
    </div>
  );
}

export function SwitchRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon?: LucideIcon | undefined;
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean | undefined;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <span className="grid size-[34px] shrink-0 place-items-center rounded-lg bg-chip text-foreground/80">
            <Icon className="size-4" />
          </span>
        ) : null}
        <span className="min-w-0">
          <b className="block text-sm font-medium">{title}</b>
          {description ? <span className="block text-[12.5px] leading-snug text-muted-foreground">{description}</span> : null}
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

export type SegOption<T extends string> = { value: T; label: ReactNode; tag?: string | undefined };

/** Escolha segmentada; `full` reparte a largura por igual. */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  full,
  small,
  label,
}: {
  options: readonly SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  full?: boolean | undefined;
  small?: boolean | undefined;
  label?: string | undefined;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "max-w-full gap-0.5 rounded-[9px] bg-chip p-[3px]",
        full ? "grid auto-cols-fr grid-flow-col" : "inline-flex flex-wrap",
      )}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition",
              small ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3.5 text-[13px]",
              on ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,.1)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            {option.tag ? <Tag>{option.tag}</Tag> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Tag({ children, tone = "orange" }: { children: ReactNode; tone?: "orange" | "gray" | "blue" }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-md px-1.5 py-px text-[10.5px] font-semibold",
        tone === "orange" && "bg-[#FDE4D9] text-[#A82F05]",
        tone === "gray" && "bg-chip text-muted-foreground",
        tone === "blue" && "bg-[#E1E9FB] text-[#2D5FD3]",
      )}
    >
      {children}
    </span>
  );
}

/** Um cartão de escolha com ícone, título, frase e o ponto de rádio. */
export function RadioCard({
  icon: Icon,
  title,
  description,
  selected,
  onSelect,
  tag,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  selected: boolean;
  onSelect: () => void;
  tag?: string | undefined;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition hover:bg-gray-50",
        selected && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
      )}
    >
      <span className="grid size-[34px] shrink-0 place-items-center rounded-lg bg-chip">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
          {title}
          {tag ? <Tag>{tag}</Tag> : null}
        </b>
        {description ? <span className="block text-[12.5px] leading-snug text-muted-foreground">{description}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]",
          selected ? "border-foreground" : "border-gray-400",
        )}
      >
        {selected ? <span className="size-2 rounded-full bg-foreground" /> : null}
      </span>
    </button>
  );
}

export function Note({
  icon: Icon,
  tone = "gray",
  children,
}: {
  icon?: LucideIcon | undefined;
  tone?: "gray" | "warn";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-snug",
        tone === "gray" ? "bg-gray-50 text-muted-foreground" : "border-[#F1D59E] bg-[#FBEBCF] text-[#6B4300]",
      )}
    >
      {Icon ? <Icon className="mt-0.5 size-4 shrink-0" /> : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function TimeChip({ seconds, active }: { seconds: number; active?: boolean | undefined }) {
  return (
    <span
      className={cn(
        "inline-grid h-6 shrink-0 place-items-center rounded-[5px] px-1.5 font-mono text-[11.5px] font-medium tabular-nums",
        active ? "bg-[#E8440C] text-white" : "bg-chip text-foreground",
      )}
    >
      {clock(seconds)}
    </span>
  );
}

export function CountPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full border bg-white px-2.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * A roda de minutos e segundos, como no despertador: duas colunas que se rodam e param numa
 * linha. Muda o valor quando a roda pára.
 */
export function MinuteWheel({
  value,
  maxSeconds,
  onChange,
}: {
  value: number;
  maxSeconds: number;
  onChange: (seconds: number) => void;
}) {
  const maxMinutes = Math.max(0, Math.floor(Math.max(0, maxSeconds) / 60));
  const minutes = Array.from({ length: maxMinutes + 1 }, (_, i) => String(i).padStart(2, "0"));
  const seconds = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  const m = Math.min(maxMinutes, Math.floor(Math.max(0, value) / 60));
  const s = Math.floor(Math.max(0, value) % 60);
  const emit = (nm: number, ns: number) => onChange(Math.min(maxSeconds || Infinity, nm * 60 + ns));
  return (
    <WheelBox>
      <WheelColumn label="Minutos" unit="min" items={minutes} index={m} onSettle={(nm) => emit(nm, s)} />
      <WheelColumn label="Segundos" unit="seg" items={seconds} index={s} onSettle={(ns) => emit(m, ns)} />
    </WheelBox>
  );
}

/** A moldura das rodas: a faixa do valor escolhido ao centro e o desvanecer em cima e em baixo. */
export function WheelBox({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-[170px] items-stretch justify-center gap-5 overflow-hidden rounded-xl bg-white">
      <div aria-hidden className="pointer-events-none absolute inset-x-2 top-1/2 h-[34px] -translate-y-1/2 rounded-lg bg-chip" />
      {children}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(#fff,transparent_35%,transparent_65%,#fff)]"
      />
    </div>
  );
}

const ROW = 34;

/** Uma coluna da roda: rola e pára numa linha; a mudança só sai quando pára. */
export function WheelColumn({
  label,
  unit,
  items,
  index,
  onSettle,
  wide,
}: {
  label: string;
  unit?: string | undefined;
  items: readonly string[];
  index: number;
  onSettle: (index: number) => void;
  wide?: boolean | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const settling = useRef(false);
  // Leva a roda ao valor de fora (sem disparar a mudança).
  useEffect(() => {
    const node = ref.current;
    if (!node || settling.current) return;
    const top = index * ROW;
    if (Math.abs(node.scrollTop - top) > 2) node.scrollTop = top;
  }, [index]);
  return (
    <div className="relative z-[1] flex items-center gap-1.5">
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          onSettle(Math.min(items.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1))));
        }}
        onScroll={() => {
          settling.current = true;
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            settling.current = false;
            const node = ref.current;
            if (!node) return;
            const next = Math.min(items.length - 1, Math.max(0, Math.round(node.scrollTop / ROW)));
            if (next !== index) onSettle(next);
          }, 160);
        }}
        className={cn(
          "h-full snap-y snap-mandatory overflow-y-scroll py-[68px] [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-foreground [&::-webkit-scrollbar]:hidden",
          wide ? "w-[92px]" : "w-16",
        )}
      >
        {items.map((item, i) => (
          <div
            key={`${item}-${i}`}
            className={cn(
              "grid h-[34px] snap-center place-items-center font-mono text-[21px] tabular-nums",
              i === index ? "font-semibold text-foreground" : "text-gray-400",
            )}
          >
            {item}
          </div>
        ))}
      </div>
      {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
    </div>
  );
}

/**
 * Um botão com o valor que abre a roda num pop-up, como o relógio do iPhone: clica-se, roda-se
 * e fica. Serve para minutos, pessoas e quantidades.
 */
export function PickerButton({
  value,
  title,
  hint,
  icon: Icon,
  children,
  className,
}: {
  value: ReactNode;
  title: string;
  hint?: ReactNode;
  icon?: LucideIcon | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-11 w-full min-w-0 items-center gap-2.5 rounded-lg bg-white px-3.5 text-left shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)] transition hover:bg-gray-50 data-[state=open]:shadow-[inset_0_0_0_1.5px_var(--foreground)]",
            className,
          )}
        >
          {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tabular-nums">{value}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[296px] p-3" onOpenAutoFocus={(event) => event.preventDefault()}>
        <p className="text-[13.5px] font-semibold">{title}</p>
        {hint ? <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{hint}</p> : null}
        <div className="mt-2.5">{children}</div>
        <Button size="sm" variant="dark" className="mt-3 w-full" onClick={() => setOpen(false)}>
          Feito
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** Menos e mais, com o número ao meio (escreve-se também). */
export function Stepper({
  value,
  min,
  max,
  onChange,
  unit,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  unit?: string | undefined;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v) || min)));
  const btn =
    "grid size-9 shrink-0 place-items-center rounded-md text-foreground transition hover:bg-[var(--ds-gray-alpha-200)] disabled:opacity-40";
  return (
    <div className="inline-flex h-11 items-center gap-1 rounded-lg bg-white px-1 shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)]">
      <button type="button" className={btn} onClick={() => set(value - 1)} disabled={value <= min} aria-label="Menos">
        <Minus className="size-4" />
      </button>
      <label className="flex items-baseline gap-1 px-1">
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")))}
          aria-label={unit ?? "Quantidade"}
          className="w-10 bg-transparent text-center font-mono text-[17px] font-semibold tabular-nums outline-none"
        />
        {unit ? <span className="text-[12.5px] text-muted-foreground">{unit}</span> : null}
      </label>
      <button type="button" className={btn} onClick={() => set(value + 1)} disabled={value >= max} aria-label="Mais">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** Cores à escolha: sugestões, o seletor do sistema (a roda) e o código hex escrito à mão. */
export function Swatches({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  const [hex, setHex] = useState(value);
  // Se a cor mudar por fora (sugestão, gravação), o código acompanha.
  useEffect(() => setHex(value), [value]);
  return (
    <Field label={label}>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => {
              onChange(color);
              setHex(color);
            }}
            aria-label={`Cor ${color}`}
            aria-pressed={value.toUpperCase() === color.toUpperCase()}
            className={cn(
              "size-7 rounded-full ring-1 ring-black/10",
              value.toUpperCase() === color.toUpperCase() && "ring-2 ring-foreground ring-offset-2",
            )}
            style={{ background: color }}
          />
        ))}
        <label className="relative size-7 cursor-pointer overflow-hidden rounded-full bg-[conic-gradient(#f43f5e,#f59e0b,#22c55e,#3b82f6,#a855f7,#f43f5e)] ring-1 ring-black/10" title="Outra cor">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
            onChange={(e) => {
              onChange(e.target.value.toUpperCase());
              setHex(e.target.value.toUpperCase());
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={`Outra cor para ${label}`}
          />
        </label>
        <Input
          value={hex}
          maxLength={7}
          onChange={(e) => {
            const next = e.target.value.toUpperCase();
            setHex(next);
            if (/^#[0-9A-F]{6}$/.test(next)) onChange(next);
          }}
          aria-label={`Código da cor de ${label}`}
          className="h-8 w-[92px] font-mono text-xs"
        />
      </div>
    </Field>
  );
}
