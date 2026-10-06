import { useEffect, useRef, useState } from "react";
import { BarChart3, Check, Clock, Flag, Gift, Layers, Play, ShoppingBag, ShoppingCart, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { clock, discountPercent, type OfferSlot } from "@/lib/room-logic";
import { Field, Section, Seg, SwitchRow, Tag } from "../ui";
import type { EditorClock } from "./video";
import type { EditorForm, FocusProps, SetForm } from "../form";

const PRESETS = ["0", "300", "600", "900"] as const;

/** Oferta: o que vende, quando aparece (e desaparece), uma oferta seguinte e a urgência. */
export function StepOferta({
  form,
  set,
  focus,
  product,
  onProduct,
  extra,
  onExtra,
  suggestedPitch,
  clock: c,
  onWatch,
}: {
  form: EditorForm;
  set: SetForm;
  focus: FocusProps;
  product: string;
  onProduct: (name: string) => void;
  extra: OfferSlot | null;
  onExtra: (offer: OfferSlot | null) => void;
  suggestedPitch: number | null;
  clock: EditorClock;
  onWatch: (seconds: number) => void;
}) {
  const visible = Boolean(form.cta_text.trim());
  const lastText = useRef(form.cta_text || "Quero minha vaga");
  const d = Math.max(1, c.duration);
  const start = form.cta_start_seconds.trim() === "" ? null : Number(form.cta_start_seconds) || 0;
  const end = form.cta_end_seconds.trim() === "" ? null : Number(form.cta_end_seconds) || null;
  const [target, setTarget] = useState<"checkout" | "sales">(
    !form.cta_url || /checkout|pay\.|kambafy|hotmart|eduzz|kiwify|stripe/i.test(form.cta_url) ? "checkout" : "sales",
  );
  const countdown = Number(form.cta_countdown_seconds) || 0;
  const preset = PRESETS.includes(String(countdown) as (typeof PRESETS)[number]) ? String(countdown) : "other";
  const [other, setOther] = useState(preset === "other");
  const discount = discountPercent(form.cta_price_original, form.cta_price_now);
  const setStart = (s: number | null) => set({ cta_start_seconds: s === null ? "" : String(Math.round(Math.min(d, Math.max(0, s)))) });
  const setEnd = (s: number | null) => set({ cta_end_seconds: s === null ? "" : String(Math.round(Math.min(d, Math.max(0, s)))) });

  return (
    <>
      <section className="pb-[18px]">
        <SwitchRow
          icon={Gift}
          title="Mostrar a oferta na sala"
          checked={visible}
          onChange={(on) => {
            if (!on) lastText.current = form.cta_text || lastText.current;
            set({ cta_text: on ? lastText.current || "Quero minha vaga" : "" });
          }}
        />
      </section>

      {visible ? (
        <>
          <Section icon={ShoppingBag} title="Produto e preço">
            <Field label="Nome do produto" required>
              <Input
                value={product}
                onChange={(e) => onProduct(e.target.value)}
                placeholder="Ex.: Mentoria Upsell com IA"
                className={cn(!product.trim() && "bg-[#FFFBF3] shadow-[inset_0_0_0_1px_#E3B566]")}
                {...focus("product")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Preço inicial">
                <Input value={form.cta_price_original} onChange={(e) => set({ cta_price_original: e.target.value })} placeholder="50 000 Kz" {...focus("price")} />
              </Field>
              <Field label="Preço com desconto">
                <Input value={form.cta_price_now} onChange={(e) => set({ cta_price_now: e.target.value })} placeholder="6 997 Kz" {...focus("price")} />
              </Field>
            </div>
            {discount !== null ? <p className="text-[12.5px] text-muted-foreground">Desconto de {discount}%.</p> : null}
          </Section>

          <Section icon={ShoppingCart} title="Botão" help="link">
            <Field label="Leva a">
              <Seg
                full
                small
                value={target}
                onChange={setTarget}
                options={[
                  { value: "checkout", label: "Checkout", tag: "Recomendado" },
                  { value: "sales", label: "Página de vendas" },
                ]}
              />
            </Field>
            <Field label={target === "checkout" ? "Link do checkout" : "Link da página de vendas"} required>
              <Input value={form.cta_url} onChange={(e) => set({ cta_url: e.target.value })} placeholder="https://pay.kambafy.com/checkout/..." {...focus("cta")} />
            </Field>
            <Field label="Texto do botão">
              <Input value={form.cta_text} onChange={(e) => set({ cta_text: e.target.value })} {...focus("cta")} />
            </Field>
            <SwitchRow
              icon={BarChart3}
              title="Levar a origem ao checkout"
              description="O anúncio de onde a pessoa veio e o minuto do clique (UTM)."
              checked={form.offer_utm}
              onChange={(offer_utm) => set({ offer_utm })}
            />
          </Section>

          <Section icon={Flag} title="Quando a oferta aparece" help="pitch">
            {suggestedPitch !== null ? (
              <div className="flex items-center gap-3 rounded-xl border bg-white p-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#FDE4D9] text-[#A82F05]">
                  <Target className="size-4" />
                </span>
                <span className="min-w-0 flex-1 text-[13px]">
                  A análise do vídeo encontrou o pitch aos <b className="font-mono">{clock(suggestedPitch)}</b>.
                </span>
                {start === suggestedPitch ? (
                  <Tag tone="gray">
                    <Check className="mr-0.5 inline size-3" />
                    Em uso
                  </Tag>
                ) : (
                  <Button
                    size="sm"
                    variant="dark"
                    onClick={() => {
                      setStart(suggestedPitch);
                      c.seek(Math.max(0, suggestedPitch - 2));
                    }}
                  >
                    Usar
                  </Button>
                )}
              </div>
            ) : null}
            <OfferWindow
              duration={d}
              t={c.t}
              start={start ?? 0}
              end={end}
              onStart={(s) => setStart(s)}
              onEnd={(s) => setEnd(s)}
              onSeek={c.seek}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Abre aos">
                <ClockInput value={start ?? 0} max={d} onChange={(s) => setStart(s)} />
              </Field>
              <Field label="Fecha">
                {end === null ? (
                  <button
                    type="button"
                    onClick={() => setEnd(Math.min(d, (start ?? 0) + 600))}
                    className="flex h-9 items-center justify-between rounded-sm bg-white px-3 text-left text-sm shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)] hover:bg-gray-50"
                  >
                    <span className="truncate">Fim do vídeo</span>
                    <span className="shrink-0 text-[12px] text-muted-foreground">mudar</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <ClockInput value={end} max={d} onChange={(s) => setEnd(s)} />
                    <button
                      type="button"
                      onClick={() => setEnd(null)}
                      aria-label="Fechar só no fim do vídeo"
                      title="Fechar só no fim do vídeo"
                      className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-[var(--ds-gray-alpha-200)]"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
              </Field>
            </div>
            {start === null ? (
              <p className="text-[12.5px] text-warning">Sem minuto, a oferta abre no início do vídeo.</p>
            ) : null}
            <Button variant="outline" size="sm" className="justify-self-start" onClick={() => onWatch(start ?? 0)}>
              <Play className="fill-current" />
              Ver a oferta a abrir
            </Button>
          </Section>

          <Section icon={Layers} title="Depois desta oferta">
            <SwitchRow
              title="Mostrar outra oferta a seguir"
              description="Ex.: uma oferta especial até ao minuto 10 e depois a oferta geral."
              checked={Boolean(extra)}
              onChange={(on) =>
                onExtra(
                  on
                    ? {
                        id: "extra-1",
                        start: Math.min(d, end ?? (start ?? 0) + 600),
                        end: null,
                        product: "",
                        priceFrom: "",
                        priceNow: "",
                        url: "",
                        button: "Quero entrar",
                        countdown: 0,
                      }
                    : null,
                )
              }
            />
            {extra ? (
              <div className="grid gap-3 rounded-xl border bg-white p-3.5">
                <Field label="Abre aos" hint="Quando esta abre, a anterior fecha.">
                  <ClockInput value={extra.start} max={d} onChange={(s) => onExtra({ ...extra, start: s })} />
                </Field>
                <Field label="Nome do produto">
                  <Input value={extra.product} onChange={(e) => onExtra({ ...extra, product: e.target.value })} placeholder="Ex.: Mentoria (oferta geral)" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Preço inicial">
                    <Input value={extra.priceFrom} onChange={(e) => onExtra({ ...extra, priceFrom: e.target.value })} />
                  </Field>
                  <Field label="Preço com desconto">
                    <Input value={extra.priceNow} onChange={(e) => onExtra({ ...extra, priceNow: e.target.value })} />
                  </Field>
                </div>
                <Field label="Link">
                  <Input value={extra.url} onChange={(e) => onExtra({ ...extra, url: e.target.value })} placeholder="https://pay.kambafy.com/checkout/..." />
                </Field>
                <Field label="Texto do botão">
                  <Input value={extra.button} onChange={(e) => onExtra({ ...extra, button: e.target.value })} />
                </Field>
                <Button variant="outline" size="sm" className="justify-self-start" onClick={() => onWatch(extra.start)}>
                  <Play className="fill-current" />
                  Ver a troca
                </Button>
              </div>
            ) : null}
          </Section>

          <Section icon={Clock} title="Urgência" help="urgencia">
            <Field label="Cronómetro na sala" hint="Começa quando a oferta abre.">
              <Seg
                full
                small
                value={other ? "other" : preset}
                onChange={(v) => {
                  if (v === "other") {
                    setOther(true);
                    if (preset !== "other") set({ cta_countdown_seconds: "1200" });
                  } else {
                    setOther(false);
                    set({ cta_countdown_seconds: v });
                  }
                }}
                options={[
                  { value: "0", label: "Sem" },
                  { value: "300", label: "5 min" },
                  { value: "600", label: "10 min" },
                  { value: "900", label: "15 min" },
                  { value: "other", label: "Outro" },
                ]}
              />
            </Field>
            {other ? (
              <Field label="Minutos">
                <Input
                  inputMode="numeric"
                  className="w-28"
                  value={String(Math.round(countdown / 60))}
                  onChange={(e) => set({ cta_countdown_seconds: String(Math.min(240, Number(e.target.value.replace(/\D/g, "")) || 0) * 60) })}
                />
              </Field>
            ) : null}
            {countdown > 0 ? (
              <Field label="Quando chega a zero">
                <Seg
                  full
                  small
                  value={form.offer_countdown_end}
                  onChange={(offer_countdown_end) => set({ offer_countdown_end })}
                  options={[
                    { value: "keep", label: "O botão continua" },
                    { value: "close", label: "O botão fecha" },
                  ]}
                />
              </Field>
            ) : null}
            <Field label="Prazo da oferta" hint="Depois deste dia, o botão e o replay fecham.">
              <div className="flex items-center gap-1.5">
                <Input type="date" className="w-44" value={form.offer_deadline} onChange={(e) => set({ offer_deadline: e.target.value })} {...focus("deadline")} />
                {form.offer_deadline ? (
                  <button
                    type="button"
                    onClick={() => set({ offer_deadline: "" })}
                    aria-label="Tirar o prazo"
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-[var(--ds-gray-alpha-200)]"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            </Field>
          </Section>
        </>
      ) : null}
    </>
  );
}

/** «05:11», «5:11» ou «311» → segundos. */
function parseClock(value: string): number | null {
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v);
  const parts = v.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) return null;
  return parts.map(Number).reduce((total, n) => total * 60 + n, 0);
}

function ClockInput({ value, max, onChange }: { value: number; max: number; onChange: (seconds: number) => void }) {
  const [text, setText] = useState(clock(value));
  useEffect(() => setText(clock(value)), [value]);
  return (
    <Input
      value={text}
      inputMode="numeric"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const parsed = parseClock(text);
        if (parsed === null) setText(clock(value));
        else onChange(Math.min(max, parsed));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full font-mono tabular-nums"
      aria-label="Minuto e segundo"
    />
  );
}

/**
 * A barra do vídeo com a janela da oferta: arrastar o início ou o fim muda quando abre e fecha;
 * clicar noutro sítio leva o vídeo a esse minuto.
 */
function OfferWindow({
  duration,
  t,
  start,
  end,
  onStart,
  onEnd,
  onSeek,
}: {
  duration: number;
  t: number;
  start: number;
  end: number | null;
  onStart: (s: number) => void;
  onEnd: (s: number) => void;
  onSeek: (s: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<"start" | "end" | null>(null);
  const at = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return 0;
    return Math.round(Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * duration);
  };
  const pct = (s: number) => `${(Math.min(duration, Math.max(0, s)) / duration) * 100}%`;
  const closeAt = end ?? duration;
  return (
    <div className="grid gap-1.5">
      <div
        ref={track}
        className="relative h-10 cursor-pointer touch-none select-none rounded-lg bg-gray-100"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const s = at(e.clientX);
          const handle = (e.target as HTMLElement).dataset["handle"] as "start" | "end" | undefined;
          drag.current = handle ?? null;
          if (!handle) onSeek(s);
        }}
        onPointerMove={(e) => {
          if (!e.buttons || !drag.current) return;
          const s = at(e.clientX);
          if (drag.current === "start") onStart(Math.min(s, closeAt - 5));
          else onEnd(Math.max(s, start + 5));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <div
          className="absolute inset-y-1 rounded-md border-l-[3px] border-[#E8440C] bg-[#FDE4D9]"
          style={{ left: pct(start), width: `calc(${pct(closeAt)} - ${pct(start)})` }}
        >
          {(closeAt - start) / duration > 0.25 ? (
            <span className="absolute left-2 top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold text-[#A82F05]">
              Oferta aberta
            </span>
          ) : null}
        </div>
        <span
          data-handle="start"
          title="Arraste para mudar quando abre"
          className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize rounded-sm bg-[#E8440C] ring-2 ring-white"
          style={{ left: pct(start) }}
        />
        {end !== null ? (
          <span
            data-handle="end"
            title="Arraste para mudar quando fecha"
            className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize rounded-sm bg-foreground ring-2 ring-white"
            style={{ left: pct(end) }}
          />
        ) : null}
        <span className="pointer-events-none absolute -top-1 bottom-[-4px] w-0.5 -translate-x-1/2 bg-foreground/70" style={{ left: pct(t) }} />
      </div>
      <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>00:00</span>
        <span>
          {clock(start)} → {end === null ? "fim" : clock(end)}
        </span>
        <span>{clock(duration)}</span>
      </div>
    </div>
  );
}
