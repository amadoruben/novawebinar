import { useEffect, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { PreliveCountdown } from "@/components/prelive-countdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  PRELIVE_TEMPLATES,
  normalizeAppearance,
  templateById,
  type PreliveAppearance,
  type PreliveTemplateId,
} from "@/lib/prelive-templates";

/** Relógio partilhado: o preview usa a contagem a sério, a descer segundo a segundo. */
function usePreviewSeconds(total: number) {
  const [remaining, setRemaining] = useState(total);
  useEffect(() => {
    setRemaining(total);
    const timer = window.setInterval(() => {
      setRemaining((value) => (value <= 1 ? total : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [total]);
  return remaining;
}

export function PreliveTemplateGallery({
  template,
  appearance,
  message,
  totalSeconds,
  onTemplateChange,
  onAppearanceChange,
}: {
  template: string | null | undefined;
  appearance: unknown;
  message: string;
  totalSeconds: number;
  onTemplateChange: (id: PreliveTemplateId, preset: PreliveAppearance) => void;
  onAppearanceChange: (value: PreliveAppearance) => void;
}) {
  const current = templateById(template);
  const look = normalizeAppearance(current.id, appearance);
  const total = Math.max(30, totalSeconds || 300);
  const remaining = usePreviewSeconds(Math.min(total, 600));

  const set = (patch: Partial<PreliveAppearance>) => onAppearanceChange({ ...look, ...patch });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-medium">Modelo</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Escolha o visual da contagem. O tempo, a data e o fim continuam iguais.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PRELIVE_TEMPLATES.map((item) => {
          const active = item.id === current.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTemplateChange(item.id, item.preset)}
              className={cn(
                "group overflow-hidden rounded-xl border bg-background text-left transition",
                active ? "border-primary ring-2 ring-primary/25" : "hover:border-primary/40",
              )}
            >
              <div className="pointer-events-none overflow-hidden bg-room-bg">
                <div className="origin-top-left scale-[0.42] [width:238%]">
                  <PreliveCountdown
                    remaining={remaining}
                    total={Math.min(total, 600)}
                    message={message}
                    soundOn={false}
                    soundEnabled={false}
                    template={item.id}
                    appearance={active ? look : item.preset}
                  />
                </div>
              </div>
              <div className="flex items-start justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{item.description}</p>
                </div>
                {active ? <Check className="mt-0.5 size-4 shrink-0 text-primary" /> : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pré-visualização
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAppearanceChange(current.preset)}
          >
            <RotateCcw className="size-3.5" />
            Restaurar padrão
          </Button>
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border bg-room-bg">
          <PreliveCountdown
            remaining={remaining}
            total={Math.min(total, 600)}
            message={message}
            soundOn={false}
            soundEnabled={false}
            template={current.id}
            appearance={look}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs font-medium">Título</Label>
          <Input
            value={look.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder={message}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs font-medium">Subtítulo</Label>
          <Input
            value={look.subtitle}
            onChange={(e) => set({ subtitle: e.target.value })}
            placeholder="Já pode falar no chat"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs font-medium">Alinhamento</Label>
          <div className="flex gap-2">
            {(["center", "left"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={look.align === value ? "default" : "outline"}
                onClick={() => set({ align: value })}
              >
                {value === "center" ? "Centrado" : "À esquerda"}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs font-medium">Tamanho</Label>
          <div className="flex gap-2">
            {(["sm", "md", "lg"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={look.size === value ? "default" : "outline"}
                onClick={() => set({ size: value })}
              >
                {value === "sm" ? "Pequeno" : value === "md" ? "Médio" : "Grande"}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
          {(
            [
              ["showDays", "Dias"],
              ["showHours", "Horas"],
              ["showMinutes", "Minutos"],
              ["showSeconds", "Segundos"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <Switch
                id={`prelive-${key}`}
                checked={look[key]}
                onCheckedChange={(v) => set({ [key]: v } as Partial<PreliveAppearance>)}
              />
              <Label htmlFor={`prelive-${key}`} className="text-xs font-medium">
                {label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
