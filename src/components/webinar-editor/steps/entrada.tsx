import { useState } from "react";
import { toast } from "sonner";
import { Code2, Contact, Copy, FileText, Link2, Palette, Plus, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  BASE_KINDS,
  FIELD_ICON_KEYS,
  FIELD_KINDS,
  MAX_FIELDS,
  entryFieldsProblem,
  fieldIcon,
  newFieldId,
  type EntryField,
  type EntryFieldKind,
  type FieldIconKey,
} from "@/lib/entry-fields";
import { ENTRY_BUTTON_DEFAULT, ENTRY_CARD_DEFAULT } from "@/lib/room-logic";
import { FieldIcon } from "@/components/room/entry-screen";
import { Field, RadioCard, Section, Swatches } from "../ui";
import type { EditorForm, FocusProps, SetForm } from "../form";

/** Página: onde as pessoas se inscrevem, os campos que preenchem, o botão e as cores. */
export function StepEntrada({
  form,
  set,
  focus,
  fields,
  onFields,
  colors,
  onColors,
  mode,
  onMode,
  roomLink,
  embed,
}: {
  form: EditorForm;
  set: SetForm;
  focus: FocusProps;
  fields: readonly EntryField[];
  onFields: (fields: EntryField[]) => void;
  colors: { card: string; button: string };
  onColors: (colors: { card: string; button: string }) => void;
  mode: "page" | "own";
  onMode: (mode: "page" | "own") => void;
  roomLink: string;
  /** O formulário para colar numa página própria (criado quando falta). */
  embed: { code: string | null; creating: boolean; onCreate: () => void };
}) {
  const problem = entryFieldsProblem(fields);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const copy = (text: string, what: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${what} copiado.`);
  };
  const update = (id: string, patch: Partial<EntryField>) =>
    onFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = (id: string) => {
    const next = fields.filter((f) => f.id !== id);
    const issue = entryFieldsProblem(next);
    if (issue) {
      toast.error(issue);
      return;
    }
    onFields(next);
  };
  /** Um campo novo: escreve-se o nome e escolhe-se o ícone. */
  const addCustom = () => {
    if (fields.length >= MAX_FIELDS) {
      toast.error(`No máximo ${MAX_FIELDS} campos.`);
      return;
    }
    const id = newFieldId();
    onFields([...fields, { id, kind: "text", label: "", required: false, icon: "help" }]);
    setJustAdded(id);
  };
  /** Voltar a pôr o nome, o e-mail ou o WhatsApp. */
  const restore = (kind: EntryFieldKind) => {
    if (fields.length >= MAX_FIELDS) {
      toast.error(`No máximo ${MAX_FIELDS} campos.`);
      return;
    }
    onFields([...fields, { id: kind, kind, label: FIELD_KINDS[kind].label, required: kind !== "whatsapp" }]);
  };
  const missingBase = BASE_KINDS.filter((kind) => !fields.some((f) => f.kind === kind));

  return (
    <>
      <section className="grid gap-2 pb-[18px]" role="radiogroup" aria-label="Onde as pessoas se inscrevem">
        <RadioCard
          icon={FileText}
          title="Página do Convertewebinar"
          description="Feita aqui: título, campos e botão."
          selected={mode === "page"}
          onSelect={() => onMode("page")}
        />
        <RadioCard
          icon={Link2}
          title="A minha página"
          description="Usa a sua página e cola lá o formulário."
          selected={mode === "own"}
          onSelect={() => onMode("own")}
        />
      </section>

      {mode === "own" ? (
        <Section icon={Link2} title="Ligar a sua página">
          <div className="divide-y overflow-hidden rounded-xl border bg-white">
            <CopyRow icon={Link2} title="Link da sala" value={roomLink} onCopy={() => copy(roomLink, "Link")} />
            {embed.code ? (
              <CopyRow icon={Code2} title="Código para colar na sua página" value={embed.code} onCopy={() => copy(embed.code!, "Código")} />
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
      ) : null}

      <Section icon={Contact} title="Captar contactos" help="contactos">
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_28px] items-center gap-2 border-b bg-gray-50 px-3 py-2 text-[11.5px] font-medium text-muted-foreground">
            <span>Campo</span>
            <span>Obrigatório</span>
            <span />
          </div>
          {fields.map((field) => (
            <div
              key={field.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_28px] items-center gap-2 border-b px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <IconPicker field={field} onIcon={(icon) => update(field.id, { icon })} />
                <input
                  value={field.label}
                  autoFocus={justAdded === field.id}
                  onChange={(e) => update(field.id, { label: e.target.value.slice(0, 60) })}
                  onBlur={(e) => {
                    if (!e.target.value.trim())
                      update(field.id, { label: field.kind === "text" ? "Nova pergunta" : FIELD_KINDS[field.kind].label });
                    if (justAdded === field.id) setJustAdded(null);
                  }}
                  placeholder="Escreva o nome do campo"
                  aria-label="Nome do campo"
                  className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-sm font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground hover:bg-gray-50 focus:bg-white focus:shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)]"
                />
              </span>
              <Switch
                checked={field.required}
                onCheckedChange={(required) => update(field.id, { required })}
                aria-label={`${field.label || "Campo"} obrigatório`}
              />
              <button
                type="button"
                onClick={() => remove(field.id)}
                aria-label={`Tirar ${field.label || "o campo"}`}
                title="Tirar o campo"
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-[var(--ds-gray-alpha-200)] hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addCustom}
            disabled={fields.length >= MAX_FIELDS}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-foreground hover:bg-gray-50 disabled:opacity-40"
          >
            <span className="grid size-7 place-items-center rounded-full bg-foreground text-background">
              <Plus className="size-3.5" />
            </span>
            Adicionar campo
            <span className="ml-auto text-[12px] font-normal text-muted-foreground">
              {fields.length}/{MAX_FIELDS}
            </span>
          </button>
        </div>
        {missingBase.length ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
            Repor:
            {missingBase.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => restore(kind)}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-white px-2.5 font-medium text-foreground hover:bg-gray-50"
              >
                <FieldIcon kind={kind} className="size-3.5" />
                {FIELD_KINDS[kind].label}
              </button>
            ))}
          </div>
        ) : null}
        {problem ? <p className="text-[12.5px] text-warning">{problem}</p> : null}
        <p className="text-[12.5px] text-muted-foreground">
          Clique no ícone para o trocar e no nome para escrever o que quiser. Na página, os obrigatórios levam *.
        </p>
      </Section>

      <Section icon={ShoppingCart} title="Botão e vagas">
        <Field label="Texto do botão">
          <Input
            value={form.registration_button_text}
            onChange={(e) => set({ registration_button_text: e.target.value })}
            {...focus("button")}
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <span>
            <b className="block text-sm font-medium">Barra de vagas</b>
            <span className="text-[12.5px] text-muted-foreground">«92% das vagas preenchidas», por cima do título.</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-[76px] items-center rounded-sm bg-white pr-2.5 shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)]">
              <input
                inputMode="numeric"
                value={form.registration_progress_value}
                disabled={!form.registration_progress_enabled}
                onChange={(e) => set({ registration_progress_value: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                {...focus("progress")}
                className="h-full w-full min-w-0 bg-transparent pl-3 text-sm outline-none disabled:opacity-40"
                aria-label="Percentagem de vagas preenchidas"
              />
              <span className="text-[13px] text-muted-foreground">%</span>
            </div>
            <Switch
              checked={form.registration_progress_enabled}
              onCheckedChange={(v) => set({ registration_progress_enabled: v })}
              aria-label="Barra de vagas"
            />
          </div>
        </div>
      </Section>

      <Section icon={Palette} title="Cores">
        <Swatches
          label="Cartão"
          value={colors.card}
          onChange={(card) => onColors({ ...colors, card })}
          options={[ENTRY_CARD_DEFAULT, "#FFFFFF", "#0B1322", "#0D2119", "#F6F1EA"]}
        />
        <Swatches
          label="Botão"
          value={colors.button}
          onChange={(button) => onColors({ ...colors, button })}
          options={[ENTRY_BUTTON_DEFAULT, "#171717", "#2563EB", "#16A34A", "#E5484D"]}
        />
        <p className="text-[12.5px] text-muted-foreground">O texto ajusta-se sozinho à cor. No tema claro, o cartão escuro passa a branco.</p>
      </Section>
    </>
  );
}

/** O ícone do campo: abre um pop-up com os ícones para escolher. */
function IconPicker({ field, onIcon }: { field: EntryField; onIcon: (icon: FieldIconKey) => void }) {
  const [open, setOpen] = useState(false);
  const current = fieldIcon(field);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Escolher o ícone do campo"
          title="Escolher o ícone"
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full transition hover:ring-1 hover:ring-foreground/30",
            current === "whatsapp" ? "bg-[#25D366]/15" : "bg-chip",
          )}
        >
          <FieldIcon kind={field.kind} icon={field.icon} className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-2.5">
        <p className="px-0.5 pb-2 text-[12.5px] font-semibold">Ícone do campo</p>
        <div className="grid grid-cols-6 gap-1">
          {FIELD_ICON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onIcon(key);
                setOpen(false);
              }}
              aria-label={key}
              className={cn(
                "grid size-9 place-items-center rounded-lg transition hover:bg-accent",
                key === current && "bg-foreground text-background hover:bg-foreground",
              )}
            >
              <FieldIcon kind="text" icon={key} className="size-[18px]" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
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
