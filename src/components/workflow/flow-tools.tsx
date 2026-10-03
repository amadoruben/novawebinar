/**
 * As ferramentas do fluxo e as definições de um elemento (a versão A do protótipo, escolhida a 3/10/2026):
 * um carril com as 5 categorias à esquerda, uma categoria aberta de cada vez, e as definições num painel
 * encaixado à direita, sem tapar o mapa. Fora do mapa, as definições abrem numa janela.
 */
import { FileText, GitFork, Megaphone, Plus, Send, X, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { BrandLogo } from "@/components/ds/brand-icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { baseWorkflow, ORIGIN_LABEL, ORIGIN_PLACEMENTS, ORIGINS, triggerTitle, type OriginPlatform, type PageType } from "@/lib/workflow";
import type { FlowComponent, OriginStyle } from "./flow-map";
import { Glyph, LOOK, type Look } from "./flow-look";
import { PALETTE } from "./step-panel";

export const DND = "application/x-convertewebinar-flow";

const SURFACE = "bg-white shadow-[0_8px_24px_rgba(16,24,40,0.12)] ring-1 ring-gray-200";

/* ---------- Catálogo: o que se pode pôr no fluxo, em 5 categorias ---------- */

type Item = { key: string; component: FlowComponent; label: string; hint?: string | undefined; tile: ReactNode };
/** `groups`: secções dentro da categoria (grelha ou pílulas), em vez da lista única. */
type Group = { title: string; logo?: string | undefined; items: Item[]; grid?: boolean; chips?: boolean };
type Category = { key: string; label: string; short: string; icon: LucideIcon; hint: string; items: Item[]; grid?: boolean; groups?: Group[] };

const tile = (cls: string, icon: ReactNode) => <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", cls)}>{icon}</span>;
const SEND_KEYS: [string, Look][] = [
  ["wa", "whatsapp"],
  ["wa-group", "whatsapp_group"],
  ["email", "email"],
  ["sms", "sms"],
  ["webhook", "webhook"],
];

const originItem = (source: OriginPlatform, placement?: string, label?: string, logo?: string): Item => ({
  key: `origin-${source}-${placement ?? ""}`,
  component: { kind: "origin", source, ...(placement ? { placement } : {}) },
  label: label ?? ORIGIN_LABEL[source],
  hint: placement ? undefined : ORIGIN_PLACEMENTS[source].slice(0, 2).join(" · ") || undefined,
  tile: (
    <span className="flex size-9 items-center justify-center rounded-xl bg-white ring-1 ring-gray-200">
      <BrandLogo name={logo ?? source} className="size-5" />
    </span>
  ),
});

/** As três versões da categoria «Tráfego» em avaliação (3/10). */
function trafficCategory(variant: OriginStyle): Category {
  const base = { key: "trafego", label: "Tráfego", short: "Tráfego", icon: Megaphone };
  if (variant === 2)
    return {
      ...base,
      hint: "Pago pede o sítio ao clicar no nó; orgânico já entra completo.",
      items: [],
      groups: [
        { title: "Pago", grid: true, items: (["Meta", "Google", "TikTok"] as OriginPlatform[]).map((p) => originItem(p)) },
        { title: "Orgânico", grid: true, items: ["Instagram", "YouTube", "TikTok", "Facebook", "LinkedIn", "Indicação"].map((n) => originItem("Orgânico", n, n, n)) },
        { title: "Outros", grid: true, items: [originItem("Email"), originItem("Outro")] },
      ],
    };
  if (variant === 3)
    return {
      ...base,
      hint: "Escolhe já o sítio: o nó entra completo.",
      items: [],
      groups: ORIGINS.map((p) => ({
        title: ORIGIN_LABEL[p],
        logo: p,
        chips: true,
        items: ORIGIN_PLACEMENTS[p].length ? ORIGIN_PLACEMENTS[p].map((pl) => originItem(p, pl, pl, p === "Orgânico" ? pl : p)) : [originItem(p)],
      })),
    };
  return { ...base, hint: "Pago (Meta, Google, TikTok) ou orgânico. Onde anuncia escolhe-se ao clicar no nó.", grid: true, items: ORIGINS.map((o) => originItem(o)) };
}

function buildCatalog(variant: OriginStyle): Category[] {
  const pal = (key: string) => PALETTE.find((p) => p.key === key)!;
  const page = (type: PageType, label: string, hint?: string): Item => ({
    key: `page-${type}`,
    component: { kind: "page", pageType: type },
    label,
    hint,
    tile: tile("bg-gray-100 text-gray-700", <FileText className="size-4" strokeWidth={1.75} aria-hidden />),
  });
  return [
    trafficCategory(variant),
    {
      key: "paginas",
      label: "Páginas e grupos",
      short: "Páginas",
      icon: FileText,
      hint: "Por onde as pessoas passam",
      // Uma só «Página»: o tipo (obrigado, vendas, checkout, replay…) escolhe-se ao clicar nela no fluxo.
      items: [
        page("outro", "Página", "Obrigado, vendas, checkout, replay… escolhe ao clicar"),
        {
          key: "group",
          component: { kind: "group" },
          label: "Grupo de WhatsApp",
          hint: "O link de convite vai na página de obrigado",
          tile: tile(LOOK.whatsapp_group.tile, <Glyph look="whatsapp_group" />),
        },
      ],
    },
    {
      key: "disparos",
      label: "Disparos",
      short: "Disparos",
      icon: Send,
      hint: "Largue em cima de uma automação, ou clique numa mensagem dela e depois aqui",
      items: SEND_KEYS.map(([key, look]) => ({
        key,
        component: { kind: "step", key },
        label: pal(key).label,
        hint: pal(key).hint,
        tile: tile(LOOK[look].tile, <Glyph look={look} />),
      })),
    },
    {
      key: "logica",
      label: "Esperas e condições",
      short: "Lógica",
      icon: GitFork,
      hint: "Largue em cima de uma automação, ou clique numa mensagem dela e depois aqui",
      items: PALETTE.filter((p) => p.group !== "Mensagens").map((p) => {
        const Icon = p.icon;
        return {
          key: p.key,
          component: { kind: "step", key: p.key },
          label: p.label,
          hint: p.hint,
          tile: tile(p.group === "Tempo" ? "bg-gray-100 text-gray-700" : "bg-amber-50 text-amber-700", <Icon className="size-4" strokeWidth={1.75} aria-hidden />),
        };
      }),
    },
    {
      key: "automacoes",
      label: "Automações prontas",
      short: "Prontas",
      icon: Zap,
      hint: "Já com as mensagens e as condições montadas",
      items: [
        ...baseWorkflow().map((t) => ({
          key: `auto-${t.key}`,
          component: { kind: "automation" as const, key: t.key },
          label: t.name,
          hint: `Quando: ${triggerTitle(t.trigger_event)}`,
          tile: tile("bg-accent text-accent-700", <Zap className="size-4" strokeWidth={1.75} aria-hidden />),
        })),
        {
          key: "blank",
          component: { kind: "automation", key: "blank" },
          label: "Automação em branco",
          tile: tile("bg-gray-100 text-gray-700", <Plus className="size-4" aria-hidden />),
        },
      ],
    },
  ];
}

/** Arrastar para o mapa (fica onde se larga) ou clicar (fica no sítio automático). */
const drag = (component: FlowComponent, onAdd: (c: FlowComponent) => void) => ({
  draggable: true,
  onDragStart: (e: DragEvent) => {
    e.dataTransfer.setData(DND, JSON.stringify(component));
    e.dataTransfer.effectAllowed = "move";
  },
  onClick: () => onAdd(component),
});

function Grid({ items, onAdd }: { items: Item[]; onAdd: (c: FlowComponent) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          {...drag(it.component, onAdd)}
          className="flex cursor-grab flex-col items-center gap-1 rounded-xl py-2 hover:bg-gray-50 active:cursor-grabbing"
        >
          {it.tile}
          <span className="w-full truncate text-center text-[10px]">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function Items({ category, onAdd }: { category: Category; onAdd: (c: FlowComponent) => void }) {
  if (category.groups)
    return (
      <div className="space-y-3">
        {category.groups.map((g) => (
          <div key={g.title}>
            <p className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-medium text-muted-foreground">
              {g.logo && <BrandLogo name={g.logo} className="size-3.5" />}
              {g.title}
            </p>
            {g.chips ? (
              <div className="flex flex-wrap gap-1 px-2">
                {g.items.map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    {...drag(it.component, onAdd)}
                    className="h-7 cursor-grab rounded-pill bg-white px-2.5 text-[12px] ring-1 ring-gray-200 hover:bg-gray-50 active:cursor-grabbing"
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            ) : (
              <Grid items={g.items} onAdd={onAdd} />
            )}
          </div>
        ))}
      </div>
    );
  if (category.grid) return <Grid items={category.items} onAdd={onAdd} />;
  return (
    <div>
      {category.items.map((it) => (
        <button
          key={it.key}
          type="button"
          {...drag(it.component, onAdd)}
          className="flex w-full cursor-grab items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-gray-50 active:cursor-grabbing"
        >
          {it.tile}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px]">{it.label}</span>
            {it.hint && <span className="block truncate text-[11px] text-muted-foreground">{it.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

/** O carril das categorias e uma categoria aberta de cada vez; clicar na categoria aberta recolhe o painel. */
export function ToolsPanel({ onAdd, variant = 1 }: { onAdd: (c: FlowComponent) => void; variant?: OriginStyle }) {
  const catalog = useMemo(() => buildCatalog(variant), [variant]);
  const [open, setOpen] = useState<string | null>(catalog[0]!.key);
  const current = catalog.find((c) => c.key === open);
  return (
    <div className={cn(SURFACE, "absolute top-3 left-3 z-10 flex max-h-[calc(100%-1.5rem)] overflow-hidden rounded-2xl")}>
      <nav aria-label="Componentes" className="flex w-16 shrink-0 flex-col items-center gap-1 py-2">
        {catalog.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={open === c.key}
            onClick={() => setOpen(open === c.key ? null : c.key)}
            className={cn("flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-[10px]", open === c.key ? "bg-gray-100 text-foreground" : "text-muted-foreground hover:bg-gray-50")}
          >
            <c.icon className="size-5" strokeWidth={1.75} aria-hidden />
            {c.short}
          </button>
        ))}
      </nav>
      {current && (
        <div className="w-64 overflow-auto border-l border-gray-100 p-2">
          <div className="px-2 pb-2">
            <p className="text-sm font-medium">{current.label}</p>
            <p className="text-[11px] text-muted-foreground">{current.hint}</p>
          </div>
          <Items category={current} onAdd={onAdd} />
        </div>
      )}
    </div>
  );
}

/**
 * As definições de um elemento. `docked`: painel encaixado à direita do mapa (o mapa continua a mexer);
 * sem mapa por trás (ex.: separador Definições), uma janela.
 */
export function SettingsPanel({
  docked,
  title,
  kicker,
  onClose,
  children,
}: {
  docked: boolean;
  title: string;
  kicker?: string | undefined;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!docked) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [docked, onClose]);

  if (!docked)
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {kicker && <DialogDescription>{kicker}</DialogDescription>}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );

  return (
    <div role="dialog" aria-label={title} className={cn(SURFACE, "absolute top-3 right-3 bottom-3 z-30 flex w-[380px] max-w-[calc(100%-1.5rem)] flex-col rounded-2xl")}>
      <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{title}</p>
          {kicker && <p className="truncate text-xs text-muted-foreground">{kicker}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-gray-100">
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
    </div>
  );
}
