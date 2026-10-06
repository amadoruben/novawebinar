import { useState } from "react";
import { toast } from "sonner";
import { Code2, Contact, Copy, FileText, Link2, Lock, Mail, Pencil, Plus, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import whatsappIcon from "@/assets/local/whatsapp-icon.webp";
import { Field, RadioCard, Section, Seg } from "../ui";
import type { EditorForm, FocusProps, SetForm } from "../form";

export type EntryMoment = 1 | 2 | 3;

/** Entrada: o ecrã antes da sala em três momentos e os dados que a pessoa deixa. */
export function StepEntrada({
  form,
  set,
  focus,
  moment,
  onMoment,
  mode,
  onMode,
  roomLink,
  embed,
}: {
  form: EditorForm;
  set: SetForm;
  focus: FocusProps;
  moment: EntryMoment;
  onMoment: (moment: EntryMoment) => void;
  mode: "page" | "own";
  onMode: (mode: "page" | "own") => void;
  roomLink: string;
  /** O formulário para colar numa página própria (criado quando falta). */
  embed: { code: string | null; creating: boolean; onCreate: () => void };
}) {
  const [editing, setEditing] = useState(false);
  // Os campos do cartão mostram-se no momento 2: ao escrever neles, a pré-visualização vai lá.
  const cardFocus = (key: string) => {
    const props = focus(key);
    return {
      onFocus: () => {
        if (moment !== 2) onMoment(2);
        props.onFocus();
      },
      onBlur: props.onBlur,
    };
  };
  const copy = (text: string, what: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${what} copiado.`);
  };

  return (
    <>
      <section className="grid gap-2 pb-[18px]" role="radiogroup" aria-label="Página de entrada">
        <RadioCard
          icon={FileText}
          title="Página do Convertewebinar"
          description="Feita aqui: textos e campos."
          selected={mode === "page"}
          onSelect={() => onMode("page")}
        />
        <RadioCard
          icon={Link2}
          title="A minha página"
          description="Usa a sua página e liga o formulário."
          selected={mode === "own"}
          onSelect={() => onMode("own")}
        />
      </section>

      {mode === "own" ? (
        <Section icon={Link2} title="Ligar a sua página">
          <div className="divide-y overflow-hidden rounded-xl border bg-white">
            <CopyRow icon={Link2} title="Link da sala" value={roomLink} onCopy={() => copy(roomLink, "Link")} />
            {embed.code ? (
              <CopyRow
                icon={Code2}
                title="Código para colar na sua página"
                value={embed.code}
                onCopy={() => copy(embed.code!, "Código")}
              />
            ) : (
              <div className="flex items-center gap-3 px-3.5 py-3">
                <Code2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 text-sm">Código para colar na sua página</span>
                <Button size="sm" variant="dark" onClick={embed.onCreate} disabled={embed.creating}>
                  Criar o formulário
                </Button>
              </div>
            )}
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Quem se inscreve na sua página entra na lista de contactos e nas automações, como quem entra pela sala.
          </p>
        </Section>
      ) : (
        <Section icon={FileText} title="Página" help="pagina">
          <Field
            label="O que a pessoa vê"
            hint="Ao chegar, vê a aula a decorrer por trás e o botão a piscar. Ao clicar, deixa os dados. Só depois entra na sala e vê o chat e quantas pessoas estão."
          >
            <Seg
              full
              label="O que a pessoa vê"
              value={String(moment) as "1" | "2" | "3"}
              onChange={(v) => onMoment(Number(v) as EntryMoment)}
              options={[
                { value: "1", label: "1. Ao chegar" },
                { value: "2", label: "2. Ao clicar" },
                { value: "3", label: "3. Na sala" },
              ]}
            />
          </Field>
          <Field label="Título">
            <Input
              value={form.registration_headline}
              placeholder={form.public_title}
              onChange={(e) => set({ registration_headline: e.target.value })}
              {...cardFocus("headline")}
            />
          </Field>
          <Field label="Descrição">
            <Input
              value={form.registration_subtitle}
              placeholder="Preencha os seus dados para entrar na sala."
              onChange={(e) => set({ registration_subtitle: e.target.value })}
              {...cardFocus("sub")}
            />
          </Field>
          <Field label="Botão">
            <Input
              value={form.registration_button_text}
              onChange={(e) => set({ registration_button_text: e.target.value })}
              {...focus("button")}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Etiqueta">
              <Input
                value={form.registration_badge_text}
                placeholder="Aula gratuita"
                onChange={(e) => set({ registration_badge_text: e.target.value })}
                {...cardFocus("badge")}
              />
            </Field>
            <Field label="Barra de vagas">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.registration_progress_enabled}
                  onCheckedChange={(v) => {
                    set({ registration_progress_enabled: v });
                    if (moment !== 2) onMoment(2);
                  }}
                  aria-label="Barra de vagas"
                />
                <div className="flex h-9 min-w-0 flex-1 items-center rounded-sm bg-white pr-3 shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)]">
                  <input
                    inputMode="numeric"
                    value={form.registration_progress_value}
                    disabled={!form.registration_progress_enabled}
                    onChange={(e) => set({ registration_progress_value: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                    {...cardFocus("progress")}
                    className="h-full w-full min-w-0 bg-transparent pl-3 text-sm outline-none disabled:opacity-50"
                    aria-label="Percentagem de vagas preenchidas"
                  />
                  <span className="text-[13px] text-muted-foreground">%</span>
                </div>
              </div>
            </Field>
          </div>
        </Section>
      )}

      <Section icon={Contact} title="Captar contactos" help="contactos">
        {editing ? (
          <div className="grid gap-2">
            <EditRow icon={<UserRound className="size-4" />} label="Nome completo" locked />
            <EditRow icon={<Mail className="size-4" />} label="E-mail" locked />
            {form.registration_collect_phone ? (
              <EditRow
                icon={<img src={whatsappIcon} alt="" className="size-4" />}
                label="WhatsApp"
                required={form.registration_require_phone}
                onRequired={(v) => set({ registration_require_phone: v })}
                onRemove={() => set({ registration_collect_phone: false, registration_require_phone: false })}
              />
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {!form.registration_collect_phone ? (
                <Button variant="ghost" size="sm" onClick={() => set({ registration_collect_phone: true })}>
                  <Plus />
                  WhatsApp
                </Button>
              ) : null}
              <span className="flex-1" />
              <Button variant="dark" size="sm" onClick={() => setEditing(false)}>
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="divide-y overflow-hidden rounded-xl border bg-white">
              <FieldRow icon={<UserRound className="size-3.5" />} label="Nome completo" />
              <FieldRow icon={<Mail className="size-3.5" />} label="E-mail" />
              {form.registration_collect_phone ? (
                <FieldRow
                  icon={<img src={whatsappIcon} alt="" className="size-3.5" />}
                  green
                  label="WhatsApp"
                  sub="O país vem da localização de quem entra"
                />
              ) : null}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => {
                setEditing(true);
                if (moment !== 2) onMoment(2);
              }}
            >
              <Pencil />
              Personalizar campos
            </Button>
          </>
        )}
      </Section>
    </>
  );
}

function CopyRow({
  icon: Icon,
  title,
  value,
  onCopy,
}: {
  icon: typeof Link2;
  title: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <b className="block text-sm font-medium">{title}</b>
        <span className="block truncate font-mono text-[11.5px] text-muted-foreground">{value}</span>
      </span>
      <Button variant="ghost" size="icon" className="size-8" onClick={onCopy} aria-label={`Copiar: ${title}`}>
        <Copy />
      </Button>
    </div>
  );
}

function FieldRow({ icon, label, sub, green }: { icon: React.ReactNode; label: string; sub?: string; green?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <span className={green ? "grid size-7 place-items-center rounded-full bg-[#25D366]/15" : "grid size-7 place-items-center rounded-full bg-chip"}>
        {icon}
      </span>
      <span className="min-w-0">
        <b className="block text-sm font-medium">{label}</b>
        {sub ? <span className="block text-xs text-muted-foreground">{sub}</span> : null}
      </span>
    </div>
  );
}

function EditRow({
  icon,
  label,
  locked,
  required,
  onRequired,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  locked?: boolean;
  required?: boolean;
  onRequired?: (value: boolean) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-chip">{icon}</span>
      <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
      {locked ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          Obrigatório
        </span>
      ) : (
        <>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Obrigatório
            <Switch checked={Boolean(required)} onCheckedChange={(v) => onRequired?.(v)} />
          </label>
          <button
            type="button"
            onClick={onRemove}
            title="Tirar o campo"
            aria-label="Tirar o campo"
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-[var(--ds-gray-alpha-200)] hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}
