import { useRef, useState } from "react";
import { BarChart3, Check, Clock, Flag, Gift, Play, ShoppingBag, ShoppingCart, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { clock, discountPercent } from "@/lib/room-logic";
import { Field, MinuteWheel, RadioCard, Section, Seg, SwitchRow } from "../ui";
import type { EditorClock } from "./video";
import type { EditorForm, FocusProps, SetForm } from "../form";

const PRESETS = ["0", "300", "600", "900"] as const;

/** Oferta: o que vende, quando aparece e a urgência. */
export function StepOferta({
  form,
  set,
  focus,
  product,
  onProduct,
  suggestedPitch,
  clock: c,
  onWatch,
}: {
  form: EditorForm;
  set: SetForm;
  focus: FocusProps;
  product: string;
  onProduct: (name: string) => void;
  suggestedPitch: number | null;
  clock: EditorClock;
  onWatch: () => void;
}) {
  const visible = Boolean(form.cta_text.trim());
  const lastText = useRef(form.cta_text || "Quero minha vaga");
  const start = form.cta_start_seconds.trim() === "" ? null : Number(form.cta_start_seconds) || 0;
  const [mode, setMode] = useState<"auto" | "manual" | null>(
    start === null ? null : suggestedPitch !== null && start === suggestedPitch ? "auto" : "manual",
  );
  const [target, setTarget] = useState<"checkout" | "sales">(
    !form.cta_url || /checkout|pay\.|kambafy|hotmart|eduzz|kiwify|stripe/i.test(form.cta_url) ? "checkout" : "sales",
  );
  const countdown = Number(form.cta_countdown_seconds) || 0;
  const preset = PRESETS.includes(String(countdown) as (typeof PRESETS)[number]) ? String(countdown) : "other";
  const [other, setOther] = useState(preset === "other");
  const discount = discountPercent(form.cta_price_original, form.cta_price_now);
  const setStart = (s: number | null) => set({ cta_start_seconds: s === null ? "" : String(Math.round(s)) });

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
                className={cn(!product.trim() && "shadow-[inset_0_0_0_1px_#E3B566] bg-[#FFFBF3]")}
                {...focus("product")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Preço inicial">
                <Input
                  value={form.cta_price_original}
                  onChange={(e) => set({ cta_price_original: e.target.value })}
                  placeholder="50 000 Kz"
                  {...focus("price")}
                />
              </Field>
              <Field label="Preço com desconto">
                <Input
                  value={form.cta_price_now}
                  onChange={(e) => set({ cta_price_now: e.target.value })}
                  placeholder="6 997 Kz"
                  {...focus("price")}
                />
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
              <Input
                value={form.cta_url}
                onChange={(e) => set({ cta_url: e.target.value })}
                placeholder="https://pay.kambafy.com/checkout/..."
                {...focus("cta")}
              />
            </Field>
            <Field label="Texto do botão">
              <Input value={form.cta_text} onChange={(e) => set({ cta_text: e.target.value })} {...focus("cta")} />
            </Field>
          </Section>

          <Section icon={BarChart3} title="Origem das vendas" help="utm">
            <p className="flex items-start gap-2 text-[13px]">
              <Check className="mt-0.5 size-4 shrink-0 text-[#1D8A5E]" />
              <span>
                Cada clique leva ao checkout a origem da pessoa (UTM), onde clicou e em que minuto.
                <span className="block text-[12.5px] text-muted-foreground">Sem anúncio, a origem fica convertewebinar.</span>
              </span>
            </p>
          </Section>

          <Section icon={Flag} title="Quando a oferta aparece" help="pitch">
            <div className="grid gap-2" role="radiogroup" aria-label="Quando a oferta aparece">
              {suggestedPitch !== null ? (
                <RadioCard
                  icon={Target}
                  title={`Momento da análise · ${clock(suggestedPitch)}`}
                  description="O sistema encontrou a transição para a oferta."
                  selected={mode === "auto"}
                  onSelect={() => {
                    setMode("auto");
                    setStart(suggestedPitch);
                    c.seek(Math.max(0, suggestedPitch - 2));
                  }}
                />
              ) : null}
              <RadioCard
                icon={Clock}
                title="Escolher o minuto"
                description="Minutos e segundos, como no despertador."
                selected={mode === "manual"}
                onSelect={() => {
                  setMode("manual");
                  if (start === null) setStart(suggestedPitch ?? Math.round(c.t));
                }}
              />
            </div>
            {mode !== null && start !== null ? (
              <MinuteWheel
                value={start}
                maxSeconds={c.duration}
                onChange={(s) => {
                  setMode(s === suggestedPitch ? "auto" : "manual");
                  setStart(s);
                  c.seek(Math.max(0, s - 2));
                }}
              />
            ) : null}
            {start === null ? (
              <p className="text-[12.5px] text-warning">Escolha uma das duas. Sem minuto, a oferta abre no início.</p>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl bg-gray-100 px-3 py-2.5 text-[13px]">
                <Gift className="size-4 shrink-0" />
                <span className="flex-1">
                  A oferta abre aos <b className="font-mono">{clock(start)}</b>
                </span>
                <Button variant="outline" size="sm" onClick={onWatch}>
                  <Play className="fill-current" />
                  Ver no vídeo
                </Button>
              </div>
            )}
          </Section>

          <Section icon={Clock} title="Urgência" help="urgencia">
            <div className="grid grid-cols-2 items-start text-center">
              <Node label="A oferta abre" value={start === null ? "--:--" : clock(start)} on={start !== null} first />
              <Node label="Cronómetro" value={countdown > 0 ? `${Math.round(countdown / 60)} min` : "Sem"} on={countdown > 0} />
            </div>
            <Field label="Cronómetro na sala" hint="Começa quando a oferta abre.">
              <Seg
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
                  onChange={(e) =>
                    set({ cta_countdown_seconds: String(Math.min(240, Number(e.target.value.replace(/\D/g, "")) || 0) * 60) })
                  }
                />
              </Field>
            ) : null}
          </Section>
        </>
      ) : null}
    </>
  );
}

function Node({ label, value, on, first }: { label: string; value: string; on: boolean; first?: boolean }) {
  return (
    <div className="relative grid justify-items-center gap-1">
      {!first ? <span className="absolute right-1/2 top-[7px] h-px w-full bg-border" /> : null}
      <span
        className={cn(
          "relative z-[1] size-4 rounded-full border-[1.5px] bg-white",
          on ? "border-foreground after:absolute after:inset-[3px] after:rounded-full after:bg-foreground" : "border-gray-400",
        )}
      />
      <b className="font-mono text-sm font-semibold">{value}</b>
      <span className="text-[12px] text-muted-foreground">{label}</span>
    </div>
  );
}
