import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveSegment, useInvalidate } from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import {
  cleanRules,
  MAX_SEGMENT_CONDITIONS,
  SEGMENT_BOOLEAN_FACTS,
  SEGMENT_PRESETS,
  segmentSentence,
  UTM_LABEL,
  type SegmentCondition,
  type SegmentRules,
  type UtmFact,
} from "@/lib/segments";

type Webinar = { id: string; public_title: string | null; internal_name?: string | null };

const UTM_FACTS = Object.keys(UTM_LABEL) as UtmFact[];

function defaultCondition(fact: string, webinars: Webinar[]): SegmentCondition {
  if (fact === "actual_watch_seconds") return { fact, op: "gte", value: 600 };
  if (fact === "webinar") return { fact, value: webinars[0]?.id ?? "" };
  if (UTM_FACTS.includes(fact as UtmFact)) return { fact: fact as UtmFact, op: "in", value: [] };
  return { fact: fact as "attended", value: true };
}

/** Criar ou editar um segmento: regras sobre os factos do Core e a origem, com E / OU. */
export function SegmentDialog({
  organizationId,
  webinars,
  segment,
  onClose,
  onSaved,
}: {
  organizationId: string;
  webinars: Webinar[];
  segment: { id: string; name: string; rules: SegmentRules } | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const invalidate = useInvalidate();
  const [name, setName] = useState(segment?.name ?? "");
  const [rules, setRules] = useState<SegmentRules>(
    segment?.rules ?? { match: "all", conditions: [{ fact: "attended", value: true }] },
  );
  const [saving, setSaving] = useState(false);
  const title = (id: string) => {
    const w = webinars.find((x) => x.id === id);
    return w ? w.public_title || w.internal_name || undefined : undefined;
  };
  const clean = cleanRules(rules);

  const setCondition = (i: number, c: SegmentCondition) =>
    setRules({ ...rules, conditions: rules.conditions.map((x, j) => (j === i ? c : x)) });

  const save = async () => {
    if (!clean || !name.trim()) return;
    setSaving(true);
    try {
      const id = await saveSegment(organizationId, { id: segment?.id, name: name.trim(), rules: clean });
      invalidate(["contacts"]);
      toast.success(segment ? "Segmento actualizado" : "Segmento criado");
      onSaved(id);
    } catch (error) {
      const duplicate = (error as { code?: string }).code === "23505";
      toast.error(duplicate ? "Já existe uma lista com esse nome." : friendlyError(error, "Não foi possível guardar o segmento."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{segment ? "Editar segmento" : "Novo segmento"}</DialogTitle>
          <DialogDescription>
            Um segmento não copia contactos: quem cumpre as regras entra sozinho, e sai quando deixa de as cumprir. As
            regras avaliam cada inscrição (pessoa × webinar).
          </DialogDescription>
        </DialogHeader>

        {!segment && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5" aria-hidden /> Começar de um modelo
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SEGMENT_PRESETS.map((p) => (
                <Button
                  key={p.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setName(p.name);
                    setRules(structuredClone(p.rules));
                  }}
                >
                  {p.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="segment-name">Nome</Label>
          <Input
            id="segment-name"
            value={name}
            maxLength={120}
            placeholder="Assistiram e não compraram"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Entram os contactos que cumprem</span>
            <Select value={rules.match} onValueChange={(match) => setRules({ ...rules, match: match as "all" | "any" })}>
              <SelectTrigger className="w-auto" aria-label="Lógica das regras">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">todas as condições (E)</SelectItem>
                <SelectItem value="any">qualquer condição (OU)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ol className="space-y-2">
            {rules.conditions.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
                <span className="w-7 text-center text-xs font-medium text-muted-foreground">
                  {i === 0 ? "" : rules.match === "any" ? "OU" : "E"}
                </span>
                <Select value={c.fact} onValueChange={(fact) => setCondition(i, defaultCondition(fact, webinars))}>
                  <SelectTrigger className="w-52" aria-label="Facto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Comportamento</SelectLabel>
                      {SEGMENT_BOOLEAN_FACTS.map((f) => (
                        <SelectItem key={f.fact} value={f.fact}>
                          {f.question}
                        </SelectItem>
                      ))}
                      <SelectItem value="actual_watch_seconds">Tempo assistido</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Origem da inscrição</SelectLabel>
                      {UTM_FACTS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {UTM_LABEL[f]} ({f})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Webinar</SelectLabel>
                      <SelectItem value="webinar" disabled={webinars.length === 0}>
                        Inscrição num webinar
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <ConditionValue condition={c} webinars={webinars} onChange={(next) => setCondition(i, next)} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-8"
                  disabled={rules.conditions.length === 1}
                  aria-label="Remover condição"
                  onClick={() => setRules({ ...rules, conditions: rules.conditions.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={rules.conditions.length >= MAX_SEGMENT_CONDITIONS}
            onClick={() => setRules({ ...rules, conditions: [...rules.conditions, { fact: "purchased", value: false }] })}
          >
            <Plus /> Acrescentar condição
          </Button>
          <p className="rounded-md bg-muted px-3 py-2 text-sm" role="status">
            {clean ? segmentSentence(clean, title) : "Complete as condições (valores em falta)."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={!clean || !name.trim() || saving}>
            {saving ? "A guardar…" : "Guardar segmento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConditionValue({
  condition: c,
  webinars,
  onChange,
}: {
  condition: SegmentCondition;
  webinars: Webinar[];
  onChange: (c: SegmentCondition) => void;
}) {
  if (c.fact === "actual_watch_seconds") {
    return (
      <>
        <Select value={c.op} onValueChange={(op) => onChange({ ...c, op: op as "gte" | "lt" })}>
          <SelectTrigger className="w-36" aria-label="Comparação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gte">pelo menos</SelectItem>
            <SelectItem value="lt">menos de</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={0}
          max={1440}
          className="w-20"
          aria-label="Minutos"
          value={Math.round(c.value / 60)}
          onChange={(e) => onChange({ ...c, value: Math.max(0, Number(e.target.value) || 0) * 60 })}
        />
        <span className="text-sm text-muted-foreground">min</span>
      </>
    );
  }
  if (c.fact === "webinar") {
    return (
      <Select value={c.value} onValueChange={(value) => onChange({ ...c, value })}>
        <SelectTrigger className="w-56" aria-label="Webinar">
          <SelectValue placeholder="Escolher webinar" />
        </SelectTrigger>
        <SelectContent>
          {webinars.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.public_title || w.internal_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (c.fact === "utm_source" || c.fact === "utm_medium" || c.fact === "utm_campaign") {
    return (
      <>
        <Select
          value={c.op}
          onValueChange={(op) =>
            onChange(
              op === "empty"
                ? { fact: c.fact, op: "empty" }
                : op === "contains"
                  ? { fact: c.fact, op: "contains", value: c.op === "in" ? c.value.join(",") : "" }
                  : { fact: c.fact, op: "in", value: c.op === "contains" ? c.value.split(",") : [] },
            )
          }
        >
          <SelectTrigger className="w-36" aria-label="Comparação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in">é</SelectItem>
            <SelectItem value="contains">contém</SelectItem>
            <SelectItem value="empty">está vazia</SelectItem>
          </SelectContent>
        </Select>
        {c.op !== "empty" && (
          <Input
            className="min-w-40 flex-1"
            aria-label="Valor"
            placeholder={c.op === "in" ? "facebook, fb" : "black-friday"}
            value={c.op === "in" ? c.value.join(",") : c.value}
            onChange={(e) =>
              onChange(c.op === "in" ? { ...c, value: e.target.value.split(",") } : { ...c, value: e.target.value })
            }
          />
        )}
      </>
    );
  }
  const b = c as Extract<SegmentCondition, { value: boolean }>;
  return (
    <Select value={b.value ? "yes" : "no"} onValueChange={(v) => onChange({ ...b, value: v === "yes" })}>
      <SelectTrigger className="w-56" aria-label="Valor">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(() => {
          const info = SEGMENT_BOOLEAN_FACTS.find((f) => f.fact === b.fact)!;
          return (
            <>
              <SelectItem value="yes">{info.yes}</SelectItem>
              <SelectItem value="no">{info.no}</SelectItem>
            </>
          );
        })()}
      </SelectContent>
    </Select>
  );
}
