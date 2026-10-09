/**
 * A caixa do Atendimento, só desenho: a lista de conversas, a faixa dos
 * webinars, o estado do agente e a moldura das três colunas. Os dados chegam
 * por props, reais ou do exemplo; nada aqui lê a base de dados.
 */
import { Link } from "@tanstack/react-router";
import { Bot, CalendarClock, MonitorPlay, Radio, Search, Users } from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/ds/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INBOX_TABS, type InboxItem, type InboxTab, type StripState } from "@/lib/support/inbox";
import { intentLabel } from "@/lib/support/model";
import { cn } from "@/lib/utils";
import { hourLabel, initials } from "./badges";

/* ---------- Pessoa e canal ---------- */

const CHANNELS: Record<string, { label: string; brand?: string }> = {
  webinar_chat: { label: "Sala" },
  whatsapp: { label: "WhatsApp", brand: "WhatsApp" },
  instagram: { label: "Instagram", brand: "Instagram" },
  email: { label: "E-mail", brand: "Email" },
};

export const channelName = (channel: string) => CHANNELS[channel]?.label ?? "Sala";

export function ChannelLogo({ channel, className }: { channel: string; className?: string }) {
  const brand = CHANNELS[channel]?.brand;
  if (brand) return <BrandLogo name={brand} className={cn(className)} />;
  return (
    <MonitorPlay className={cn("size-4 shrink-0 text-foreground", className)} aria-label="Sala" />
  );
}

// Iniciais sobre uma cor suave, sempre a mesma para o mesmo nome.
const TONES = [
  "bg-[#E8F1FF] text-[#0B5CD5]",
  "bg-[#E9F8EE] text-[#177A3C]",
  "bg-[#FFF1E5] text-[#A74A00]",
  "bg-[#F4ECFF] text-[#6B2BD6]",
  "bg-[#FFEAF1] text-[#B21E55]",
  "bg-[#E6F7F7] text-[#0D7171]",
];
const toneOf = (name: string) =>
  TONES[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TONES.length];

/** Fotografia (ou iniciais) com o canal da conversa no canto, como no Meta Business Suite. */
export function PersonPhoto({
  name,
  photo,
  channel,
  size = 44,
}: {
  name: string;
  photo?: string | null | undefined;
  channel?: string | undefined;
  size?: number;
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className={cn(
          "flex size-full items-center justify-center overflow-hidden rounded-full font-semibold",
          !photo && toneOf(name),
        )}
        style={{ fontSize: Math.round(size * 0.34) }}
        aria-hidden
      >
        {photo ? <img src={photo} alt="" className="size-full object-cover" /> : initials(name)}
      </span>
      {channel && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-white shadow-[0_0_0_2px_var(--color-card)]"
          style={{ width: Math.round(size * 0.42), height: Math.round(size * 0.42) }}
          title={channelName(channel)}
        >
          <ChannelLogo channel={channel} className="size-[68%]" />
        </span>
      )}
    </span>
  );
}

/* ---------- Etiquetas ---------- */

const INTENT_VARIANT: Record<string, "success" | "warning" | "info" | "destructive" | "secondary"> =
  {
    purchase: "success",
    checkout: "success",
    negotiation: "success",
    payment: "warning",
    refund: "warning",
    post_purchase: "info",
    access: "info",
    technical: "info",
    complaint: "destructive",
    human_request: "destructive",
  };

/** A intenção da conversa, com cor: verde é venda, laranja é dinheiro, azul é ajuda, vermelho é urgente. */
export function IntentChip({ intent }: { intent: string | null }) {
  if (!intent) return null;
  return (
    <Badge variant={INTENT_VARIANT[intent] ?? "secondary"} className="shrink-0">
      {intentLabel(intent)}
    </Badge>
  );
}

/** Onde está a conversa agora: com o agente, à espera ou com alguém. */
export function StateChip({
  item,
}: {
  item: Pick<InboxItem, "state" | "sla" | "teamName" | "ownerName">;
}) {
  if (item.sla === "breached")
    return (
      <Badge variant="destructive" className="shrink-0">
        Prazo ultrapassado
      </Badge>
    );
  if (item.state === "ai")
    return (
      <Badge variant="secondary" className="shrink-0">
        <Bot aria-hidden /> Agente
      </Badge>
    );
  if (item.state === "new")
    return (
      <Badge variant="warning" className="shrink-0">
        À espera{item.teamName ? ` · ${item.teamName}` : ""}
      </Badge>
    );
  if (item.state === "paused")
    return (
      <Badge variant="outline" className="shrink-0">
        <Bot aria-hidden /> Agente em pausa
      </Badge>
    );
  return (
    <Badge variant="secondary" className="shrink-0">
      Com {item.ownerName?.split(" ")[0] ?? "a equipa"}
    </Badge>
  );
}

export function ExampleTag() {
  return (
    <span className="shrink-0 rounded-xs bg-warning-soft px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-warning">
      Exemplo
    </span>
  );
}

/* ---------- Lista de conversas ---------- */

const PREFIX: Record<string, string> = { ai: "Agente: ", team: "Equipa: " };

export function InboxList({
  items,
  activeId,
  tab,
  counts,
  onTab,
  search,
  onSearch,
  webinars,
  webinarId,
  onWebinar,
  onSelect,
}: {
  items: InboxItem[];
  activeId: string | null;
  tab: InboxTab;
  counts: Record<InboxTab, number>;
  onTab: (tab: InboxTab) => void;
  search: string;
  onSearch: (value: string) => void;
  webinars: { id: string; title: string; count: number }[];
  webinarId: string | null;
  onWebinar: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2.5 border-b px-3 pb-3 pt-2">
        <div
          role="tablist"
          aria-label="Conversas"
          className="-mx-1 flex justify-between overflow-x-auto [scrollbar-width:none]"
        >
          {INBOX_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => onTab(t.id)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1 border-b-2 px-1 text-[13px] font-medium transition-colors",
                tab === t.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "min-w-[1.125rem] rounded-pill px-1 text-center text-[11px] tabular-nums",
                  tab === t.id ? "bg-foreground text-background" : "bg-gray-150 text-foreground",
                )}
              >
                {counts[t.id]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Procurar nome ou mensagem"
            aria-label="Procurar conversas"
            className="h-10 pl-9"
          />
        </div>
        {webinars.length > 1 && (
          <div
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]"
            aria-label="Filtrar por webinar"
          >
            <FilterChip active={webinarId === null} onClick={() => onWebinar(null)}>
              Todos
            </FilterChip>
            {webinars.map((w) => (
              <FilterChip key={w.id} active={webinarId === w.id} onClick={() => onWebinar(w.id)}>
                <span className="max-w-[9rem] truncate">{w.title}</span>
                <span className="tabular-nums opacity-70">{w.count}</span>
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {items.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhuma conversa aqui.
          </li>
        )}
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={activeId === item.id ? "true" : undefined}
              className={cn(
                "flex w-full gap-3 rounded-lg px-2.5 py-3 text-left transition-colors",
                activeId === item.id ? "bg-gray-150" : "hover:bg-gray-100",
              )}
            >
              <PersonPhoto name={item.name} photo={item.photo} channel={item.channel} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "truncate text-[14px]",
                      item.lastFrom === "contact" ? "font-semibold" : "font-medium",
                    )}
                  >
                    {item.name}
                  </span>
                  {item.example && <ExampleTag />}
                  <span
                    className={cn(
                      "ml-auto shrink-0 text-[12px] tabular-nums",
                      item.lastFrom === "contact"
                        ? "font-medium text-success"
                        : "text-muted-foreground",
                    )}
                  >
                    {hourLabel(item.at)}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13px]",
                      item.lastFrom === "contact" ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {PREFIX[item.lastFrom ?? ""] ?? ""}
                    {item.preview || "Sem mensagens"}
                  </span>
                  {item.lastFrom === "contact" && (
                    <span
                      className="size-2.5 shrink-0 rounded-full bg-success"
                      aria-label="Por responder"
                    />
                  )}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1">
                  <IntentChip intent={item.intent} />
                  <StateChip item={item} />
                  {item.webinarTitle && (
                    <span className="max-w-full truncate px-1 text-[11px] text-muted-foreground">
                      {item.webinarTitle}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-pill px-3 text-[12px] font-medium transition-colors",
        active ? "bg-foreground text-background" : "bg-gray-100 text-foreground hover:bg-gray-150",
      )}
    >
      {children}
    </button>
  );
}

/* ---------- Webinars activos ---------- */

export type WebinarCard = {
  id: string;
  title: string;
  cover: string | null;
  state: StripState;
  startMs: number | null;
  registered: number | null;
  online: number;
  waiting: number;
};

const STATE_LABEL: Record<StripState, string> = {
  live: "Ao vivo",
  started: "Iniciado",
  soon: "Em breve",
  running: "Em andamento",
};

const STATE_VARIANT = {
  live: "destructive",
  started: "info",
  soon: "warning",
  running: "secondary",
} as const;

/** Os webinars a decorrer ou para breve, em cartões baixos: a conversa precisa do espaço. */
export function WebinarStrip({
  cards,
  selected,
  onSelect,
}: {
  cards: WebinarCard[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <section aria-label="Webinars activos">
      <h2 className="mb-1.5 text-[13px] font-medium text-muted-foreground">
        Webinars activos <span className="tabular-nums">({cards.length})</span>
      </h2>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 [scrollbar-width:thin]">
        {cards.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => onSelect(selected === w.id ? null : w.id)}
            aria-pressed={selected === w.id}
            className={cn(
              "flex w-[20rem] shrink-0 items-center gap-2.5 rounded-xl border bg-card p-2 text-left transition-colors",
              selected === w.id
                ? "border-foreground ring-1 ring-foreground"
                : "hover:border-gray-400",
            )}
          >
            {w.cover ? (
              <img src={w.cover} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gray-200 to-gray-100 text-muted-foreground">
                <Radio className="size-5" aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                  {w.title}
                </span>
                <Badge variant={STATE_VARIANT[w.state]} className="shrink-0">
                  {w.state === "live" && (
                    <span
                      className="size-1.5 animate-pulse rounded-full bg-destructive"
                      aria-hidden
                    />
                  )}
                  {STATE_LABEL[w.state]}
                </Badge>
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <span className="flex min-w-0 flex-1 items-center gap-1 truncate whitespace-nowrap">
                  {w.startMs && w.state === "soon" ? (
                    <>
                      <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                      {new Date(w.startMs).toLocaleString("pt-PT", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                    </>
                  ) : (
                    <Users className="size-3.5 shrink-0" aria-hidden />
                  )}
                  <strong className="font-medium text-foreground tabular-nums">
                    {w.registered === null ? "…" : w.registered.toLocaleString("pt-PT")}
                  </strong>
                  inscritos
                  {w.state !== "soon" && (
                    <>
                      {" · "}
                      <strong className="font-medium text-foreground tabular-nums">
                        {w.online}
                      </strong>
                      online
                    </>
                  )}
                </span>
                {w.waiting > 0 && (
                  <Badge variant="destructive" className="shrink-0">
                    {w.waiting} à espera
                  </Badge>
                )}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------- Agente ---------- */

/** O agente da conta em poucas palavras: se está a trabalhar e o que fez hoje. */
export function AgentStatus({
  active,
  resolved,
  escalated,
}: {
  active: boolean | null;
  resolved: number | null;
  escalated: number | null;
}) {
  return (
    <div className="flex h-10 items-center gap-2.5 rounded-pill border bg-card pl-2 pr-3 text-[13px]">
      <span className="flex size-7 items-center justify-center rounded-full bg-gray-150">
        <Bot className="size-4" aria-hidden />
      </span>
      <span className="font-medium">Agente IA</span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span
          className={cn("size-2 rounded-full", active ? "bg-success" : "bg-gray-400")}
          aria-hidden
        />
        {active === null ? "…" : active ? "Activo" : "Desligado"}
      </span>
      <span className="hidden h-4 w-px bg-gray-300 sm:block" aria-hidden />
      <span className="hidden text-muted-foreground sm:inline">
        Hoje <strong className="font-medium text-foreground tabular-nums">{resolved ?? 0}</strong>{" "}
        resolvidas ·{" "}
        <strong className="font-medium text-foreground tabular-nums">{escalated ?? 0}</strong>{" "}
        passadas
      </span>
      <Link
        to="/cases"
        search={{ id: undefined }}
        className="hidden font-medium underline-offset-4 hover:underline md:inline"
      >
        Ver actividade
      </Link>
    </div>
  );
}

/* ---------- Moldura ---------- */

export type InboxStep = "list" | "chat" | "contact";

/**
 * No telemóvel, a conversa e o contacto ocupam o ecrã por baixo da barra do
 * topo e tapam o menu de baixo, como no WhatsApp: a caixa de escrever fica
 * sempre à vista e volta-se à lista pela seta.
 */
const PHONE_SCREEN =
  "max-md:@max-2xl:fixed max-md:@max-2xl:inset-x-0 max-md:@max-2xl:top-14 max-md:@max-2xl:bottom-0 max-md:@max-2xl:z-40 max-md:@max-2xl:h-auto max-md:@max-2xl:min-h-0 max-md:@max-2xl:bg-card";

/**
 * Pela largura que sobra (não pela do ecrã, porque o menu da plataforma pode
 * estar aberto ou recolhido): com espaço, lista, conversa e contacto lado a lado;
 * a meio, lista e conversa (o contacto abre no lugar da conversa); estreito,
 * um passo de cada vez.
 */
export function InboxFrame({
  step,
  banner,
  top,
  list,
  conversation,
  contact,
}: {
  step: InboxStep;
  /** Por cima de tudo (o aviso do modo exemplo). */
  banner?: ReactNode;
  /** A faixa dos webinars: no telemóvel só aparece na lista. */
  top?: ReactNode;
  list: ReactNode;
  conversation: ReactNode;
  contact: ReactNode;
}) {
  return (
    <div className="@container">
      {/* Com espaço, a caixa ocupa a altura do ecrã e só as colunas rolam. */}
      <div className="flex flex-col gap-4 @2xl:h-[calc(100dvh-8rem)] @2xl:min-h-[38rem]">
        {banner}
        {top && <div className={step === "list" ? undefined : "hidden @2xl:block"}>{top}</div>}
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden rounded-card border bg-card @2xl:grid-cols-[20rem_minmax(0,1fr)] @5xl:grid-cols-[21rem_minmax(0,1fr)_21rem]">
          <aside
            className={cn(
              "min-w-0 @2xl:min-h-0 @2xl:border-r",
              step === "list" ? "flex flex-col" : "hidden @2xl:flex @2xl:flex-col",
            )}
          >
            {list}
          </aside>
          <section
            className={cn(
              "h-[calc(100dvh-11rem)] min-h-[28rem] min-w-0 @2xl:h-auto @2xl:min-h-0",
              step === "chat"
                ? cn("flex flex-col", PHONE_SCREEN)
                : step === "contact"
                  ? "hidden @5xl:flex @5xl:flex-col"
                  : "hidden @2xl:flex @2xl:flex-col",
            )}
          >
            {conversation}
          </section>
          <aside
            className={cn(
              "h-[calc(100dvh-11rem)] min-h-[28rem] min-w-0 @2xl:h-auto @2xl:min-h-0 @5xl:border-l",
              step === "contact"
                ? cn(
                    "flex flex-col @2xl:col-start-2 @2xl:row-start-1 @5xl:col-start-auto",
                    PHONE_SCREEN,
                  )
                : "hidden @5xl:flex @5xl:flex-col",
            )}
          >
            {contact}
          </aside>
        </div>
      </div>
    </div>
  );
}

/** Faixa do modo exemplo: diz claramente que nada é real. */
export function ExampleBanner({ onExit }: { onExit: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-[13px] @2xl:px-4 @2xl:text-sm">
      <ExampleTag />
      <span className="min-w-0 flex-1 text-foreground">
        Contactos fictícios<span className="hidden @2xl:inline"> para ver como fica</span>. Nada é
        guardado nem enviado.
      </span>
      <Button size="sm" variant="outline" onClick={onExit} className="shrink-0">
        <span className="@2xl:hidden">Sair</span>
        <span className="hidden @2xl:inline">Sair do exemplo</span>
      </Button>
    </div>
  );
}
