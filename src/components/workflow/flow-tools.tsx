/**
 * As ferramentas do fluxo (versão A, escolhida a 3/10/2026) e as definições de um elemento: um carril com as
 * categorias à esquerda, uma aberta de cada vez, e as definições num painel encaixado à direita, sem tapar o mapa.
 * Organização pedida pelo utilizador: tudo à mão «como numa cozinha», genérico na paleta (uma «Página», um «Grupo»)
 * e o detalhe ao clicar no nó; o tráfego por plataforma de anúncio com os sítios à vista; cada elemento com a
 * informação que ajuda a programar. Fora do mapa, as definições abrem numa janela.
 */
import { FileText, GitFork, Megaphone, Plus, Send, Users, X, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { BrandLogo } from "@/components/ds/brand-icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { baseWorkflow, ORIGIN_LABEL, ORIGIN_PLACEMENTS, ORIGINS, PAID_ORIGINS, triggerTitle, type OriginPlatform } from "@/lib/workflow";
import type { FlowComponent } from "./flow-map";
import { Glyph, LOOK, type Look } from "./flow-look";
import { PALETTE } from "./step-panel";

export const DND = "application/x-convertewebinar-flow";

const SURFACE = "bg-white shadow-[0_8px_24px_rgba(16,24,40,0.12)] ring-1 ring-gray-200";

/* ---------- Catálogo: o que se pode pôr no fluxo ---------- */

type Item = { key: string; component: FlowComponent; label: string; hint?: string | undefined; tile: ReactNode };
/** Uma secção dentro da categoria: em grelha (ícones) ou em lista (com explicação). */
type Group = { title: string; logo?: string | undefined; tag?: string | undefined; items: Item[]; grid?: boolean };
type Category = {
  key: string;
  label: string;
  short: string;
  icon: LucideIcon;
  hint: string;
  /** Um parágrafo curto com o que a pessoa precisa de saber para programar bem. */
  intro?: string | undefined;
  items: Item[];
  grid?: boolean;
  groups?: Group[];
};

const tile = (cls: string, icon: ReactNode) => <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", cls)}>{icon}</span>;
const logoTile = (name: string) => (
  <span className="flex size-9 items-center justify-center rounded-xl bg-white ring-1 ring-gray-200">
    <BrandLogo name={name} className="size-5" />
  </span>
);
const SEND_KEYS: [string, Look][] = [
  ["wa", "whatsapp"],
  ["wa-group", "whatsapp_group"],
  ["email", "email"],
  ["sms", "sms"],
  ["webhook", "webhook"],
];

/** O logótipo que identifica um sítio de anúncio: a rede quando a tem; senão a plataforma. */
export const SITE_LOGO: Record<string, string> = {
  Facebook: "Facebook",
  Instagram: "Instagram",
  "Facebook e Instagram": "Meta",
  YouTube: "YouTube",
  TikTok: "TikTok",
  LinkedIn: "LinkedIn",
  Pesquisa: "Google",
  Display: "Google",
  "Lista própria": "Email",
  Parceiro: "Email",
  Indicação: "Orgânico",
};

const originItem = (source: OriginPlatform, placement?: string): Item => ({
  key: `origin-${source}-${placement ?? ""}`,
  component: { kind: "origin", source, ...(placement ? { placement } : {}) },
  label: placement ?? ORIGIN_LABEL[source],
  tile: logoTile(placement ? (SITE_LOGO[placement] ?? source) : source),
});

const SEND_HINT: Record<string, string> = {
  wa: "Uma mensagem só para a pessoa. Não sai entre as 22h e as 8h.",
  "wa-group": "Para o grupo do lançamento, uma vez por sessão. Não separa quem já comprou.",
  email: "Assunto e texto. Precisa de um fornecedor ligado em Integrações.",
  sms: "Texto curto, para o telemóvel. Não sai entre as 22h e as 8h.",
  webhook: "Leva a pessoa e os seus factos ao Zapier, Make, n8n ou CRM.",
};
const LOGIC_HINT: Record<string, string> = {
  delay: "Depois do passo anterior. Ex.: 2 horas, ou «1 dia, às 09:00».",
  before: "Conta a partir da sessão de cada pessoa. Ex.: 1 dia antes, às 09:00. Quem se inscreve depois dessa hora não a recebe.",
  after: "Conta a partir do fim da sessão. Ex.: 1 dia depois, às 09:00.",
  until: "Dia e hora certos, iguais para toda a gente. Ex.: o fecho do carrinho.",
};

function buildCatalog(): Category[] {
  const pal = (key: string) => PALETTE.find((p) => p.key === key)!;
  const logicItem = (p: (typeof PALETTE)[number]): Item => {
    const Icon = p.icon;
    return {
      key: p.key,
      component: { kind: "step", key: p.key },
      label: p.label,
      hint: LOGIC_HINT[p.key] ?? (p.group === "Condições" ? "Divide em Sim e Não com o que o webinar registou desta pessoa." : p.hint),
      tile: tile(p.group === "Tempo" ? "bg-gray-100 text-gray-700" : "bg-amber-50 text-amber-700", <Icon className="size-4" strokeWidth={1.75} aria-hidden />),
    };
  };
  return [
    {
      key: "trafego",
      label: "Tráfego",
      short: "Tráfego",
      icon: Megaphone,
      hint: "De onde vêm as pessoas: a plataforma e o sítio onde anuncia.",
      intro: "Só representa a origem no fluxo. A origem real de cada inscrição vem das UTM da página.",
      items: [],
      groups: ORIGINS.map((p) => ({
        title: ORIGIN_LABEL[p],
        logo: p,
        tag: PAID_ORIGINS.has(p) ? "pago" : p === "Orgânico" ? "orgânico" : undefined,
        grid: true,
        items: ORIGIN_PLACEMENTS[p].length ? ORIGIN_PLACEMENTS[p].map((pl) => originItem(p, pl)) : [originItem(p)],
      })),
    },
    {
      key: "paginas",
      label: "Páginas",
      short: "Páginas",
      icon: FileText,
      hint: "Por onde as pessoas passam, fora da plataforma.",
      intro: "Põe «Página» no fluxo e, ao clicar nela, diz qual é: obrigado, vendas, checkout, upsell, downsell, replay. O endereço entra nas mensagens e diz-nos quem lá chegou. A página de inscrição já está no fluxo: é a do formulário.",
      items: [
        {
          key: "page-outro",
          component: { kind: "page", pageType: "outro" },
          label: "Página",
          hint: "O tipo e o endereço escolhem-se ao clicar no nó",
          tile: tile("bg-gray-100 text-gray-700", <FileText className="size-4" strokeWidth={1.75} aria-hidden />),
        },
      ],
    },
    {
      key: "grupos",
      label: "Grupos",
      short: "Grupos",
      icon: Users,
      hint: "A comunidade do lançamento.",
      intro: "O link de convite vai na página de obrigado e nas mensagens como {{link_grupo}}. As mensagens para o grupo escrevem-se nos Disparos e saem uma vez por sessão. O grupo não separa quem já comprou: use-o para lembretes e replay.",
      items: [
        {
          key: "group",
          component: { kind: "group" },
          label: "Grupo de WhatsApp",
          hint: "Nome e link de convite ao clicar no nó",
          tile: tile(LOOK.whatsapp_group.tile, <Glyph look="whatsapp_group" />),
        },
      ],
    },
    {
      key: "disparos",
      label: "Disparos",
      short: "Disparos",
      icon: Send,
      hint: "Largue em cima de uma automação, ou clique numa mensagem dela e depois aqui.",
      intro: "Cada mensagem pode sair por vários canais. Antes de sair, o sistema confirma outra vez quem recebe: quem comprou entretanto não recebe.",
      items: SEND_KEYS.map(([key, look]) => ({
        key,
        component: { kind: "step", key },
        label: pal(key).label,
        hint: SEND_HINT[key] ?? pal(key).hint,
        tile: tile(LOOK[look].tile, <Glyph look={look} />),
      })),
    },
    {
      key: "logica",
      label: "Lógica",
      short: "Lógica",
      icon: GitFork,
      hint: "Esperas e condições. Largue em cima de uma automação.",
      intro: "As condições são verificadas no momento do envio, não quando a pessoa entrou. Quem compra sai de tudo o que é venda no mesmo instante.",
      items: [],
      groups: [
        { title: "Esperar", items: PALETTE.filter((p) => p.group === "Tempo").map(logicItem) },
        { title: "Se… (divide em Sim e Não)", items: PALETTE.filter((p) => p.group === "Condições").map(logicItem) },
      ],
    },
    {
      key: "automacoes",
      label: "Automações prontas",
      short: "Prontas",
      icon: Zap,
      hint: "Com as mensagens dos seus modelos e as esperas no sítio. Nascem desligadas.",
      items: [
        ...baseWorkflow().map((t) => {
          const n = t.steps.nodes.filter((s) => s.kind === "action").length;
          return {
            key: `auto-${t.key}`,
            component: { kind: "automation" as const, key: t.key },
            label: t.name,
            hint: `Quando: ${triggerTitle(t.trigger_event)} · ${n} ${n === 1 ? "mensagem" : "mensagens"}`,
            tile: tile("bg-accent text-accent-700", <Zap className="size-4" strokeWidth={1.75} aria-hidden />),
          };
        }),
        {
          key: "blank",
          component: { kind: "automation", key: "blank" },
          label: "Automação em branco",
          hint: "Escolhe o gatilho e desenha os passos",
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
          title={it.label}
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

function List({ items, onAdd }: { items: Item[]; onAdd: (c: FlowComponent) => void }) {
  return (
    <div>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          {...drag(it.component, onAdd)}
          className="flex w-full cursor-grab items-start gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-gray-50 active:cursor-grabbing"
        >
          {it.tile}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] leading-5">{it.label}</span>
            {it.hint && <span className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">{it.hint}</span>}
          </span>
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
            <p className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-medium">
              {g.logo && <BrandLogo name={g.logo} className="size-3.5" />}
              {g.title}
              {g.tag && <span className="rounded-pill bg-gray-100 px-1.5 py-px text-[10px] font-normal text-muted-foreground">{g.tag}</span>}
            </p>
            {g.grid ? <Grid items={g.items} onAdd={onAdd} /> : <List items={g.items} onAdd={onAdd} />}
          </div>
        ))}
      </div>
    );
  if (category.grid) return <Grid items={category.items} onAdd={onAdd} />;
  return <List items={category.items} onAdd={onAdd} />;
}

/** O carril das categorias e uma categoria aberta de cada vez; clicar na categoria aberta recolhe o painel. */
export function ToolsPanel({ onAdd }: { onAdd: (c: FlowComponent) => void }) {
  const catalog = useMemo(buildCatalog, []);
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
        <div className="w-72 overflow-auto border-l border-gray-100 p-2">
          <div className="px-2 pb-2">
            <p className="text-sm font-medium">{current.label}</p>
            <p className="text-[11px] text-muted-foreground">{current.hint}</p>
          </div>
          <Items category={current} onAdd={onAdd} />
          {current.intro && <p className="mx-2 mt-3 rounded-lg bg-gray-50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">{current.intro}</p>}
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
