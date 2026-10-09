import { useRef, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronDown,
  Clock,
  DoorOpen,
  Gift,
  Loader2,
  Palette,
  Play,
  Plus,
  Target,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  clock,
  discountPercent,
  entryPalette,
  isGroupLink,
  OFFER_COLOR_SUGGESTIONS,
  OFFER_LOOKS,
  type OfferColors,
  type OfferLook,
  type OfferSlot,
} from "@/lib/room-logic";
import { OfferThumb } from "@/components/room/room-parts";
import { Field, Note, Section, Seg, SwitchRow, Swatches, Tag, TimeWindow } from "../ui";
import type { EditorClock } from "./video";
import type { EditorForm, FocusProps, SetForm } from "../form";

/** Para onde leva o botão: uma página onde se paga (checkout ou página de vendas) ou um grupo. */
type Target = "link" | "group";
const MAX_EXTRAS = 3;
const COUNTDOWNS = ["0", "300", "600", "900", "1800"] as const;
const AFTER = [0, 15, 30, 60, 120] as const;

/** Para onde leva o botão, a partir do link. */
function targetOf(url: string): Target {
  return isGroupLink(url) ? "group" : "link";
}
/** Os textos de botão que se trocam sozinhos ao mudar o destino (os escritos à mão ficam). */
const BUTTON_DEFAULT: Record<Target, string> = { link: "Quero minha vaga", group: "Entrar no grupo" };
const AUTO_BUTTONS = new Set(["", "Quero minha vaga", "Quero entrar", "Entrar no grupo"]);
const LOOK_HINT: Record<OfferLook, string> = {
  square: "Imagem grande",
  compact: "Numa linha",
  classic: "Fundo transparente",
};
/** Sugestões para o fundo e o texto do cartão (claros e escuros que combinam com as cores do botão). */
const CARD_COLORS = ["#FFFFFF", "#F5F5F4", "#171717", "#0F172A", "#1E3A8A"] as const;
const TEXT_COLORS = ["#FFFFFF", "#171717", "#FACC15", "#E8440C"] as const;

/** Uma oferta no ecrã: a principal (campos do webinar) ou uma das seguintes. */
type OfferView = {
  id: string;
  product: string;
  priceFrom: string;
  priceNow: string;
  url: string;
  button: string;
  start: number | null;
  end: number | null;
};

/** Oferta: as ofertas da sala (a principal e as seguintes), a urgência e o que fica depois do vídeo. */
export function StepOferta({
  form,
  set,
  focus,
  product,
  onProduct,
  extras,
  onExtras,
  suggestedPitch,
  clock: c,
  onWatch,
  onAfter,
  upload,
}: {
  form: EditorForm;
  set: SetForm;
  focus: FocusProps;
  product: string;
  onProduct: (name: string) => void;
  extras: readonly OfferSlot[];
  onExtras: (offers: OfferSlot[]) => void;
  suggestedPitch: number | null;
  clock: EditorClock;
  /** Toca a sala uns segundos antes deste minuto. */
  onWatch: (seconds: number) => void;
  /** Mostra a sala no fim do vídeo, com a oferta ainda aberta. */
  onAfter: () => void;
  /** Carregar a imagem do produto (a oferta principal); sem isto, o campo não aparece. */
  upload?: { uploading: boolean; onFile: (file: File) => void } | undefined;
}) {
  const visible = Boolean(form.cta_text.trim());
  const lastText = useRef(form.cta_text || "Quero minha vaga");
  const d = Math.max(1, c.duration);
  const [open, setOpen] = useState<string | null>("main");
  // As cores próprias da oferta; uma vazia segue a cor do botão de entrar ou o tema da sala.
  const offerColors = form.live.offerColors ?? {};
  const setOfferColors = (patch: { [K in keyof OfferColors]?: string | undefined }) => {
    const next = Object.fromEntries(Object.entries({ ...offerColors, ...patch }).filter(([, v]) => v));
    set({ live: { ...form.live, offerColors: next } });
  };
  const start = form.cta_start_seconds.trim() === "" ? null : Number(form.cta_start_seconds) || 0;
  // Sem minuto escolhido, a sala abre a oferta no início do vídeo (`cta_start_seconds ?? 0`).
  const opensAt = start ?? 0;
  const end = form.cta_end_seconds.trim() === "" ? null : Number(form.cta_end_seconds) || null;
  const countdown = Number(form.cta_countdown_seconds) || 0;
  const countdownOptions = [
    ...COUNTDOWNS.map((v) => ({ value: v as string, label: v === "0" ? "Sem" : `${Number(v) / 60} min` })),
    ...(COUNTDOWNS.includes(String(countdown) as (typeof COUNTDOWNS)[number])
      ? []
      : [{ value: String(countdown), label: `${Math.round(countdown / 60)} min` }]),
  ];
  // «Depois do vídeo» vale para a última oferta: é ela que fica aberta.
  const last = extras.length ? extras[extras.length - 1]! : null;
  const lastEnd = last ? last.end : end;
  const afterMinutes = lastEnd !== null && lastEnd > d ? Math.round((lastEnd - d) / 60) : 0;
  const setAfter = (minutes: number) => {
    const value = minutes > 0 ? Math.round(d + minutes * 60) : null;
    if (last) onExtras(extras.map((x) => (x.id === last.id ? { ...x, end: value } : x)));
    else set({ cta_end_seconds: value === null ? "" : String(value) });
  };

  const main: OfferView = {
    id: "main",
    product,
    priceFrom: form.cta_price_original,
    priceNow: form.cta_price_now,
    url: form.cta_url,
    button: form.cta_text,
    start,
    end,
  };
  const updateMain = (patch: Partial<OfferView>) => {
    if (patch.product !== undefined) onProduct(patch.product);
    set({
      ...(patch.priceFrom !== undefined ? { cta_price_original: patch.priceFrom } : {}),
      ...(patch.priceNow !== undefined ? { cta_price_now: patch.priceNow } : {}),
      ...(patch.url !== undefined ? { cta_url: patch.url } : {}),
      ...(patch.button !== undefined ? { cta_text: patch.button } : {}),
      ...("start" in patch ? { cta_start_seconds: patch.start == null ? "" : String(Math.round(patch.start)) } : {}),
      ...("end" in patch ? { cta_end_seconds: patch.end == null ? "" : String(Math.round(patch.end)) } : {}),
    });
  };
  const updateExtra = (id: string, patch: Partial<OfferSlot>) =>
    onExtras(extras.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort((a, b) => a.start - b.start));
  const addExtra = () => {
    const after = Math.max(start ?? 0, ...extras.map((x) => x.start));
    const id = `extra-${Date.now().toString(36)}`;
    onExtras([
      ...extras,
      {
        id,
        start: Math.min(d - 30, after + 300),
        end: null,
        product: "",
        priceFrom: "",
        priceNow: "",
        url: "",
        button: "Quero minha vaga",
        countdown,
        deadline: null,
      },
    ]);
    setOpen(id);
  };

  return (
    <>
      <section className="pb-[18px]">
        <SwitchRow
          icon={Gift}
          title="Mostrar a oferta na sala"
          description="O cartão da oferta aparece na sala no minuto que escolher."
          checked={visible}
          onChange={(on) => {
            if (!on) lastText.current = form.cta_text || lastText.current;
            set({ cta_text: on ? lastText.current || "Quero minha vaga" : "" });
          }}
        />
      </section>

      {visible ? (
        <>
          <Section icon={Gift} title="Ofertas" help="oferta">
            <OfferCardEditor
              index={1}
              label="Oferta principal"
              offer={main}
              open={open === "main"}
              onToggle={() => setOpen((o) => (o === "main" ? null : "main"))}
              onChange={updateMain}
              duration={d}
              clock={c}
              suggested={suggestedPitch}
              onWatch={onWatch}
              focus={focus}
              required
              image={
                upload
                  ? { url: form.cta_image_url, uploading: upload.uploading, onFile: upload.onFile, onRemove: () => set({ cta_image_url: "" }) }
                  : undefined
              }
            />
            {extras.map((x, i) => (
              <OfferCardEditor
                key={x.id}
                index={i + 2}
                label={`Oferta relâmpago ${i + 1}`}
                offer={x}
                open={open === x.id}
                onToggle={() => setOpen((o) => (o === x.id ? null : x.id))}
                onChange={(patch) =>
                  updateExtra(x.id, {
                    ...patch,
                    ...("start" in patch ? { start: patch.start ?? 0 } : {}),
                  } as Partial<OfferSlot>)
                }
                duration={d}
                clock={c}
                onWatch={onWatch}
                deadline={{ value: x.deadline ?? "", onChange: (deadline) => updateExtra(x.id, { deadline: deadline || null }) }}
                onRemove={() => onExtras(extras.filter((y) => y.id !== x.id))}
              />
            ))}
            {extras.length < MAX_EXTRAS ? (
              <button
                type="button"
                onClick={addExtra}
                className="flex items-center gap-2.5 rounded-xl border border-dashed bg-white px-3.5 py-3 text-left text-[13.5px] font-medium hover:border-foreground/40 hover:bg-gray-50"
              >
                <span className="grid size-7 place-items-center rounded-full bg-foreground text-background">
                  <Plus className="size-3.5" />
                </span>
                <span className="min-w-0">
                  Adicionar oferta relâmpago
                  <span className="block text-[12px] font-normal text-muted-foreground">
                    Outro produto, ou a entrada num grupo exclusivo, com o seu minuto.
                  </span>
                </span>
              </button>
            ) : null}
            {extras.length ? (
              <p className="text-[12.5px] text-muted-foreground">Quando a oferta seguinte abre, a anterior fecha.</p>
            ) : null}
          </Section>

          <Section icon={Palette} title="Aparência" help="aparenciaOferta">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Forma da oferta">
              {OFFER_LOOKS.map(({ id, name }) => {
                const on = form.live.offerLook === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ live: { ...form.live, offerLook: id } })}
                    className="group grid content-start gap-2 text-left"
                  >
                    <span
                      className={cn(
                        "relative block overflow-hidden rounded-xl ring-1 ring-black/10 transition",
                        on ? "ring-2 ring-foreground ring-offset-2" : "group-hover:ring-black/25",
                      )}
                    >
                      <OfferLookThumb look={id} color={offerColors.button ?? form.live.offerColor} card={offerColors.card} />
                      {on ? (
                        <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-foreground text-background">
                          <Check className="size-3" />
                        </span>
                      ) : null}
                    </span>
                    <span className="grid">
                      <span className={cn("text-[13px]", on ? "font-semibold" : "font-medium text-muted-foreground")}>{name}</span>
                      <span className="text-[12px] leading-snug text-muted-foreground">{LOOK_HINT[id]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <OfferColorField
              label="Cor do botão"
              value={offerColors.button}
              fallback={form.live.offerColor}
              reset="Usar a cor do botão de entrar"
              hint="Por omissão, a cor do botão de entrar."
              onChange={(button) => setOfferColors({ button })}
            />
            <details className="group rounded-xl border" open={Boolean(offerColors.card || offerColors.text) || undefined}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
                Fundo e texto do cartão
                <span className="ml-auto text-[12px] font-normal text-muted-foreground">{offerColors.card || offerColors.text ? "Escolhidos" : "Do tema da sala"}</span>
                <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
              </summary>
              <div className="grid gap-3.5 border-t px-3.5 pb-3.5 pt-3">
                <OfferColorField
                  label="Fundo"
                  value={offerColors.card}
                  fallback=""
                  reset="Usar o fundo do tema"
                  options={CARD_COLORS}
                  onChange={(card) => setOfferColors({ card })}
                />
                <OfferColorField
                  label="Texto"
                  value={offerColors.text}
                  fallback=""
                  reset="Texto automático"
                  options={TEXT_COLORS}
                  onChange={(text) => setOfferColors({ text })}
                />
              </div>
            </details>
          </Section>

          <Section icon={Clock} title="Cronómetro e prazo" help="urgencia">
            <p className="text-[12.5px] leading-snug text-muted-foreground">
              O <b className="font-medium text-foreground">cronómetro</b> conta desde que a oferta abre; o{" "}
              <b className="font-medium text-foreground">último dia</b> fecha a oferta também no replay.
            </p>
            <Field label="1. Cronómetro na oferta">
              <Seg
                full
                small
                label="Cronómetro na oferta"
                value={String(countdown)}
                onChange={(v) => {
                  set({ cta_countdown_seconds: v });
                  if (extras.length) onExtras(extras.map((x) => ({ ...x, countdown: Number(v) })));
                }}
                options={countdownOptions}
              />
            </Field>
            {countdown > 0 ? (
              <>
                <p className="-mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  Na sala:
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#FDE4D9] px-1.5 py-0.5 font-mono text-[12px] font-semibold text-[#A82F05]">
                    <Clock className="size-3" />A oferta termina em {clock(Math.max(0, countdown - 1))}
                  </span>
                  <span>(de {clock(opensAt)} a {clock(opensAt + countdown)} do vídeo)</span>
                </p>
                <Field label="2. Quando o cronómetro chega a zero">
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Quando o cronómetro chega a zero">
                    {(
                      [
                        ["keep", "O botão continua", "O cronómetro sai e quem decide tarde ainda compra.", false],
                        ["close", "O botão fecha", "O botão passa a «Oferta encerrada» e deixa de abrir.", true],
                      ] as const
                    ).map(([value, title, text, closed]) => {
                      const on = form.offer_countdown_end === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => set({ offer_countdown_end: value })}
                          className={cn(
                            "grid content-start gap-2 rounded-xl border bg-white p-2.5 text-left transition hover:bg-gray-50",
                            on && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
                          )}
                        >
                          {/* Como o botão fica na sala no zero, em pequeno, na cor escolhida. */}
                          <span
                            className={cn("block truncate rounded-md py-1.5 text-center text-[11.5px] font-bold", closed && "bg-chip text-muted-foreground")}
                            style={closed ? undefined : { background: form.live.offerColor, color: entryPalette(null, form.live.offerColor).buttonText }}
                          >
                            {closed ? "Oferta encerrada" : form.cta_text || "Quero minha vaga"}
                          </span>
                          <span className="grid gap-0.5">
                            <b className="text-[13px] font-semibold">{title}</b>
                            <span className="text-[12px] leading-snug text-muted-foreground">{text}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
                {/* Leva a sala a 4 segundos do zero, para ver o que acontece ao botão e ao cronómetro. */}
                {opensAt + countdown < d ? (
                  <Button variant="outline" size="sm" className="justify-self-start" onClick={() => onWatch(opensAt + countdown)}>
                    <Play className="fill-current" />
                    Ver o zero na sala
                  </Button>
                ) : (
                  <p className="text-[12.5px] leading-snug text-muted-foreground">O zero chega depois do fim do vídeo: na sala, o cronómetro continua.</p>
                )}
              </>
            ) : null}
            <Field
              label={countdown > 0 ? "3. Último dia da oferta" : "2. Último dia da oferta"}
              hint={
                form.offer_deadline
                  ? `Até ao fim de ${dayLabel(form.offer_deadline)}, quem vê a sala ou o replay ainda compra. Depois, o botão fecha.`
                  : "Opcional. Ex.: aula a 12 de outubro e último dia a 14: o replay vende até dia 14; a 15, o botão fecha."
              }
            >
              <DateInput value={form.offer_deadline} onChange={(offer_deadline) => set({ offer_deadline })} focus={focus("deadline")} />
            </Field>
          </Section>

          <Section icon={DoorOpen} title="Quando a aula acaba" help="depoisVideo">
            <p className="text-[12.5px] leading-snug text-muted-foreground">
              Quanto tempo a sala fica aberta para comprar depois de o vídeo acabar?
            </p>
            <Seg
              full
              small
              value={String(AFTER.includes(afterMinutes as (typeof AFTER)[number]) ? afterMinutes : 0)}
              onChange={(v) => setAfter(Number(v))}
              options={AFTER.map((m) => ({ value: String(m), label: m === 0 ? "Fecha já" : m < 60 ? `${m} min` : `${m / 60} h` }))}
            />
            <p className="text-[12.5px] leading-snug text-muted-foreground">
              {afterMinutes > 0
                ? `A aula acaba, mas a sala fica aberta mais ${afterMinutes < 60 ? `${afterMinutes} minutos` : `${afterMinutes / 60} h`} para quem quer comprar: a oferta, o cronómetro e o Suporte continuam. O Agente IA e a equipa respondem no Atendimento.`
                : "A sala fecha quando o vídeo acaba. Escolha um tempo para as inscrições continuarem abertas depois da aula."}
            </p>
            {afterMinutes > 0 ? (
              <Button variant="outline" size="sm" className="justify-self-start" onClick={onAfter}>
                <Play className="fill-current" />
                Ver a sala depois do vídeo
              </Button>
            ) : null}
          </Section>

          <Section icon={BarChart3} title="Origem das vendas" help="utm">
            <SwitchRow
              title="Levar a origem ao checkout"
              description="O anúncio de onde a pessoa veio e o minuto do clique (UTM)."
              checked={form.offer_utm}
              onChange={(offer_utm) => set({ offer_utm })}
            />
          </Section>
        </>
      ) : null}
    </>
  );
}

/** Um cartão de oferta: fechado mostra o resumo; aberto, os campos. */
function OfferCardEditor({
  index,
  label,
  offer,
  open,
  onToggle,
  onChange,
  duration: d,
  clock: c,
  suggested,
  onWatch,
  focus,
  required,
  deadline,
  onRemove,
  image,
}: {
  index: number;
  label: string;
  offer: OfferView;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<OfferView>) => void;
  duration: number;
  clock: EditorClock;
  suggested?: number | null | undefined;
  onWatch: (seconds: number) => void;
  focus?: FocusProps | undefined;
  required?: boolean | undefined;
  deadline?: { value: string; onChange: (value: string) => void } | undefined;
  onRemove?: (() => void) | undefined;
  /** A imagem do produto (só a oferta principal). */
  image?: { url: string; uploading: boolean; onFile: (file: File) => void; onRemove: () => void } | undefined;
}) {
  const imageRef = useRef<HTMLInputElement>(null);
  const [target, setTargetState] = useState<Target>(targetOf(offer.url));
  // Ao mudar o destino, o texto do botão acompanha (se ainda for um dos textos de origem).
  const setTarget = (next: Target) => {
    setTargetState(next);
    if (AUTO_BUTTONS.has(offer.button.trim())) onChange({ button: BUTTON_DEFAULT[next] });
  };
  const discount = discountPercent(offer.priceFrom, offer.priceNow);
  const start = offer.start ?? 0;
  const f = (key: string) => (focus ? focus(key) : {});
  const group = target === "group";
  const groupProblem = target === "group" && offer.url.trim() && !isGroupLink(offer.url);
  const endLabel =
    offer.end === null ? "Fim do vídeo" : offer.end > d ? `Depois do vídeo +${Math.round((offer.end - d) / 60)} min` : clock(offer.end);
  const tagLabel = targetOf(offer.url) === "group" ? "Grupo" : "Página de compra";

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-white", open && "shadow-[0_2px_8px_rgba(0,0,0,.06)]")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-semibold", open ? "bg-foreground text-background" : "bg-chip")}>
          {index}
        </span>
        <span className="min-w-0 flex-1">
          <b className="flex items-center gap-1.5 text-[14px] font-semibold">
            <span className="truncate">{offer.product.trim() || label}</span>
            {offer.url.trim() ? <Tag tone="gray">{tagLabel}</Tag> : null}
          </b>
          <span className="block truncate font-mono text-[12px] text-muted-foreground">
            {clock(start)} → {offer.end === null ? "fim" : offer.end > d ? "depois do vídeo" : clock(offer.end)}
            {offer.priceNow ? <span className="font-sans"> · por {offer.priceNow}</span> : null}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="grid gap-3.5 border-t bg-[#FAFAFA] px-3.5 pb-3.5 pt-3.5">
          <Field label="O botão leva a">
            <Seg
              full
              small
              label="O botão leva a"
              value={target}
              onChange={setTarget}
              options={[
                { value: "link", label: "Página de compra" },
                { value: "group", label: "Grupo" },
              ]}
            />
          </Field>
          <Field label={group ? "Nome do grupo" : "Nome do produto"} required={required}>
            <Input
              value={offer.product}
              onChange={(e) => onChange({ product: e.target.value })}
              placeholder={group ? "Ex.: Grupo VIP da Mentoria" : "Ex.: Mentoria Grupo Primo"}
              className={cn(required && !offer.product.trim() && "bg-[#FFFBF3] shadow-[inset_0_0_0_1px_#E3B566]")}
              {...f("product")}
            />
          </Field>
          {image ? (
            <Field label="Imagem do produto" hint="Opcional. Aparece no cartão da oferta.">
              <div className="flex items-center gap-2.5">
                <OfferThumb imageUrl={image.url || null} className="size-12 [--of:#A1A1A1]" />
                <input
                  ref={imageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) image.onFile(file);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => imageRef.current?.click()} disabled={image.uploading}>
                  {image.uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                  {image.url ? "Trocar" : "Carregar"}
                </Button>
                {image.url ? (
                  <button
                    type="button"
                    onClick={image.onRemove}
                    aria-label="Tirar a imagem"
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-chip hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço inicial">
              <Input value={offer.priceFrom} onChange={(e) => onChange({ priceFrom: e.target.value })} placeholder="100 000 Kz" {...f("price")} />
            </Field>
            <Field label="Com desconto">
              <Input value={offer.priceNow} onChange={(e) => onChange({ priceNow: e.target.value })} placeholder="15 000 Kz" {...f("price")} />
            </Field>
          </div>
          {discount !== null ? (
            <p className="-mt-1.5 text-[12.5px] text-muted-foreground">Desconto de {discount}%.</p>
          ) : (
            <p className="-mt-1.5 text-[12.5px] text-muted-foreground">Os preços são opcionais: sem preço, o cartão mostra só o nome e o botão.</p>
          )}
          <Field
            label={group ? "Link do grupo" : "Link da página de compra"}
            required={required}
            hint={group ? "WhatsApp (chat.whatsapp.com) ou Telegram (t.me)." : "O checkout (Kambafy, Hotmart…) ou a página de vendas. O checkout tira um passo e vende mais."}
          >
            <Input
              value={offer.url}
              onChange={(e) => onChange({ url: e.target.value })}
              placeholder={group ? "https://chat.whatsapp.com/…" : "https://pay.kambafy.com/checkout/…"}
              {...f("cta")}
            />
          </Field>
          {groupProblem ? <p className="-mt-1.5 text-[12.5px] text-warning">O link do grupo começa por https://chat.whatsapp.com/ ou https://t.me/</p> : null}
          {group ? (
            <Note icon={Users}>
              Na sala, o botão abre um pop-up: a pessoa confirma o nome, o e-mail e o WhatsApp e entra no grupo, onde está o link com o
              desconto. Fica registado quem entrou, para depois separar quem comprou de quem não comprou.
            </Note>
          ) : null}
          <Field label="Texto do botão">
            <Input
              value={offer.button}
              onChange={(e) => onChange({ button: e.target.value })}
              placeholder={BUTTON_DEFAULT[target]}
              {...f("cta")}
            />
          </Field>

          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <b className="flex items-center gap-1.5 text-[13px] font-medium">
                <Clock className="size-3.5 text-muted-foreground" />
                Quando aparece
              </b>
              <button
                type="button"
                onClick={() => onWatch(start)}
                className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium text-muted-foreground transition hover:bg-chip hover:text-foreground"
              >
                <Play className="size-3 fill-current" />
                Ver na sala
              </button>
            </div>
            {suggested != null && offer.start !== suggested ? (
              <button
                type="button"
                onClick={() => {
                  onChange({ start: suggested });
                  c.seek(Math.max(0, suggested - 2));
                }}
                className="flex items-center gap-2 rounded-lg bg-[#FDE4D9]/60 px-2.5 py-1.5 text-left text-[12.5px] transition hover:bg-[#FDE4D9]"
              >
                <Target className="size-3.5 shrink-0 text-[#A82F05]" />
                <span className="min-w-0 flex-1">
                  Pitch encontrado aos <b className="font-mono">{clock(suggested)}</b>
                </span>
                <b className="shrink-0 font-semibold text-[#A82F05]">Usar</b>
              </button>
            ) : null}
            <TimeWindow
              labels={["Abre aos", "Fecha aos"]}
              start={start}
              end={offer.end !== null && offer.end <= d ? offer.end : d}
              max={d}
              onStart={(s) => {
                onChange({ start: s });
                c.seek(Math.max(0, s - 2));
              }}
              onEnd={(s) => onChange({ end: s >= d - 1 ? null : Math.max(start + 5, s) })}
              endText={<span className={offer.end !== null && offer.end <= d ? "font-mono" : "text-[13.5px]"}>{endLabel}</span>}
              endExtra={
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => onChange({ end: null })}>
                  No fim do vídeo
                </Button>
              }
            />
            <OfferWindow
              duration={d}
              t={c.t}
              start={start}
              end={offer.end}
              onStart={(s) => onChange({ start: s })}
              onEnd={(s) => onChange({ end: s >= d - 1 ? null : s })}
              onSeek={c.seek}
            />
          </div>

          {deadline ? (
            <Field label="Prazo desta oferta" hint="Depois deste dia, o botão desta oferta fecha.">
              <DateInput value={deadline.value} onChange={deadline.onChange} />
            </Field>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 justify-self-start text-[12.5px] font-medium text-destructive hover:underline"
            >
              <Trash2 className="size-3.5" />
              Tirar esta oferta
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Uma cor da oferta à escolha; vazia, mostra a de omissão (`fallback`) e não grava nada. Escolhida,
 * aparece o link para voltar à de omissão.
 */
function OfferColorField({
  label,
  value,
  fallback,
  reset,
  hint,
  options = OFFER_COLOR_SUGGESTIONS,
  onChange,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  reset: string;
  /** Uma linha, enquanto vale a de omissão. */
  hint?: string | undefined;
  options?: readonly string[] | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="grid gap-1">
      <Swatches label={label} value={value ?? fallback} onChange={onChange} options={options} />
      {value ? (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="justify-self-start text-[12.5px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {reset}
        </button>
      ) : hint ? (
        <p className="text-[12.5px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * O cartão da oferta em miniatura, nas cores escolhidas: «Quadrada» (o produto num quadrado grande),
 * «Compacta» (uma linha) ou «Clássica» (a faixa na cor por cima e o fundo meio transparente).
 */
function OfferLookThumb({ look, color, card }: { look: OfferLook; color: string; card?: string | undefined }) {
  const bar = (width: string, tone = "bg-white/25") => <i className={cn("block h-1.5 rounded-full", tone)} style={{ width }} />;
  // Um vídeo por trás, para se notar o fundo meio transparente da «Clássica».
  const stage = "grid aspect-[16/10] content-center bg-[linear-gradient(135deg,#3a4150,#141414_70%)] px-[12%]";
  if (look === "classic") {
    return (
      <span className={stage}>
        <span className="grid overflow-hidden rounded-lg ring-1 ring-white/10" style={{ background: `color-mix(in srgb, ${card ?? "#212121"} 70%, transparent)` }}>
          <span className="grid gap-1 px-1.5 py-1.5" style={{ background: `linear-gradient(110deg, color-mix(in srgb, ${color} 20%, #000), ${color})` }}>
            {bar("80%", "bg-white/90")}
          </span>
          <span className="grid gap-1 p-1.5">
            {bar("55%")}
            <i className="block h-2.5 rounded-full" style={{ background: color }} />
          </span>
        </span>
      </span>
    );
  }
  const square = look === "square";
  return (
    <span className={stage}>
      <span className="grid gap-1.5 rounded-lg p-1.5 ring-1 ring-white/10" style={{ background: card ?? "#212121" }}>
        <span className="flex items-center gap-1.5">
          <span
            className={cn("shrink-0", square ? "size-6 rounded-[5px]" : "size-3.5 rounded-[3px]")}
            style={{ background: `linear-gradient(140deg, ${color}, color-mix(in srgb, ${color} 30%, #000))` }}
          />
          <span className="grid flex-1 gap-1">
            {bar("85%", "bg-white/70")}
            {bar("50%")}
          </span>
        </span>
        <i className="block h-2.5 rounded-[4px]" style={{ background: color }} />
      </span>
    </span>
  );
}

/** «14 de outubro», a partir de «2026-10-14». */
function dayLabel(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("pt-PT", { day: "numeric", month: "long" });
}

function DateInput({
  value,
  onChange,
  focus,
}: {
  value: string;
  onChange: (value: string) => void;
  focus?: { onFocus: () => void; onBlur: () => void } | undefined;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input type="date" className="w-44" value={value} onChange={(e) => onChange(e.target.value)} {...(focus ?? {})} />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Tirar o prazo"
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-[var(--ds-gray-alpha-200)]"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
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
  const closeAt = end === null ? duration : Math.min(duration, end);
  const after = end !== null && end > duration;
  return (
    <div className="grid gap-1.5">
      <div
        ref={track}
        className="relative h-7 cursor-pointer touch-none select-none rounded-md bg-gray-100"
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
          className="absolute inset-y-1 overflow-hidden rounded-[4px] border-l-[3px] border-[#E8440C] bg-[#FDE4D9]"
          style={{ left: pct(start), width: `calc(${pct(closeAt)} - ${pct(start)})` }}
        >
          {(closeAt - start) / duration > 0.25 ? (
            <span className="absolute left-2 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10.5px] font-semibold text-[#A82F05]">
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
        {end !== null && !after ? (
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
          {clock(start)} → {end === null ? "fim" : after ? "depois do vídeo" : clock(end)}
        </span>
        <span>{clock(duration)}</span>
      </div>
    </div>
  );
}
