import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  GitFork,
  Maximize2,
  Minimize2,
  PlayCircle,
  Plus,
  Send as SendIcon,
  ShoppingCart,
  UserPlus,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import platformIcon from "@/assets/brand/convertewebinar-icon.svg";
import { BrandLogo } from "@/components/ds/brand-icons";
import { FLOW_CHANNEL, RunState } from "@/components/ds/flow";
import { conditionLabel, conditionsSentence, type Condition } from "@/lib/automations";
import { formatDateTime, type Automation, type AutomationStats, type RegistrationForm, type Workflow } from "@/lib/data";
import { cn } from "@/lib/utils";
import {
  audiences,
  negate,
  nodeTitle,
  ORIGIN_LABEL,
  originParts,
  originTitle,
  PAGE_TYPE_LABEL,
  PAID_ORIGINS,
  readSteps,
  stageOf,
  stepLayout,
  triggerTitle,
  type Audience,
  type Canvas,
  type CanvasNode,
  type Channel,
  type LaidStep,
  type OriginPlatform,
  type PageType,
  type Send,
  type Stage,
} from "@/lib/workflow";
import { DND, ToolsPanel } from "./flow-tools";
import { Glyph, LOOK, lookOf } from "./flow-look";

/* ---------- Eixos: os eventos canónicos por onde a jornada passa ---------- */

export type HubKey = "inscricao" | "webinar" | "fim" | "checkout" | "compra";

export const HUBS: { key: HubKey; label: string; icon: LucideIcon; triggers: string[]; addTrigger: string; tone: string }[] = [
  { key: "inscricao", label: "Inscrição", icon: UserPlus, triggers: ["webinar_registered"], addTrigger: "webinar_registered", tone: "bg-navy" },
  {
    key: "webinar",
    label: "Webinar ao vivo",
    icon: PlayCircle,
    triggers: ["webinar_session_started", "webinar_attended", "offer_viewed", "offer_clicked"],
    addTrigger: "webinar_session_started",
    tone: "bg-navy",
  },
  { key: "fim", label: "Fim da sessão", icon: CalendarCheck, triggers: ["webinar_session_ended"], addTrigger: "webinar_session_ended", tone: "bg-navy" },
  {
    key: "checkout",
    label: "Checkout",
    icon: CreditCard,
    triggers: ["checkout_started", "checkout_abandoned", "payment_failed"],
    addTrigger: "checkout_abandoned",
    tone: "bg-navy",
  },
  { key: "compra", label: "Compra", icon: ShoppingCart, triggers: ["purchase_approved", "purchase_refunded"], addTrigger: "purchase_approved", tone: "bg-navy" },
];

export const CHANNEL_ICON: Record<Channel, LucideIcon> = {
  email: FLOW_CHANNEL.email.icon,
  whatsapp: FLOW_CHANNEL.whatsapp.icon,
  sms: FLOW_CHANNEL.sms.icon,
  webhook: FLOW_CHANNEL.webhook.icon,
};

/** Etapas da jornada nas três famílias da referência: antes (cinza), evento (azul-noite), depois (laranja). */
export const STAGE_TONE: Record<Stage, { bar: string; soft: string; text: string }> = {
  pre: { bar: "bg-gray-400", soft: "bg-gray-100", text: "text-gray-700" },
  event: { bar: "bg-navy", soft: "bg-chip", text: "text-foreground" },
  post: { bar: "bg-primary", soft: "bg-accent", text: "text-accent-700" },
};

export type JourneyCounts = {
  registered: number;
  entered: number;
  attended: number;
  checkout: number;
  purchased: number;
  failed: number;
  abandoned: number;
};

/* ---------- Linguagem visual do mapa (estilo ManyChat) ---------- */

const handleClass = "!size-2.5 !border-2 !border-gray-300 !bg-white";
const Side = ({ type, position, top }: { type: "source" | "target"; position: Position; top?: number }) => (
  <Handle type={type} position={position} className={handleClass} isConnectable={false} style={top === undefined ? undefined : { top }} />
);

// Medidas fixas dos cartões: a disposição precisa de saber a altura antes de desenhar.
const CARD_W = 260;
const HEADER_H = 56;
const WAIT_H = 28;
const SEND_H = 52;
const SEND_GAP = 6;
const PAD_B = 12;
const BRANCH_ROW_H = 36;
const BRANCH_GAP = 4;
const LANE_H = 84;

function stepHeight(n: LaidStep["node"], wait: boolean) {
  const top = (wait ? WAIT_H : 0) + HEADER_H + PAD_B;
  if (n.kind === "branch") return top + 2 * BRANCH_ROW_H + BRANCH_GAP;
  const k = Math.max(1, n.sends.length);
  return top + k * SEND_H + (k - 1) * SEND_GAP;
}

function Card({ children, className, onClick, dim }: { children: ReactNode; className?: string; onClick: () => void; dim?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative block rounded-2xl bg-white text-left shadow-[0_1px_2px_rgba(16,24,40,0.06),0_1px_3px_rgba(16,24,40,0.1)] ring-1 ring-gray-200 transition-shadow hover:ring-2 hover:ring-[#3B82F6]/50",
        dim && "opacity-70",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Header({ tile, icon, kicker, title, right }: { tile: string; icon: ReactNode; kicker: string; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5" style={{ height: HEADER_H }}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tile)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] leading-tight text-muted-foreground">{kicker}</span>
        <span className="block truncate text-[14px] leading-tight font-medium">{title}</span>
      </span>
      {right}
    </div>
  );
}

function WaitStrip({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-t-2xl border-b border-gray-100 bg-gray-50 px-3.5 text-[11px] text-muted-foreground" style={{ height: WAIT_H }}>
      <Clock className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{text}</span>
    </div>
  );
}

/* ---------- Nós da jornada ---------- */

/** Versões em avaliação (3/10): 1 plataforma primeiro · 2 pago e orgânico · 3 sítio escolhido na paleta. */
export type OriginStyle = 1 | 2 | 3;
type OriginData = { source: string; placement?: string | undefined; style?: OriginStyle | undefined; onClick: () => void };
const NETWORK_LOGOS = new Set(["Facebook", "Instagram", "YouTube", "TikTok"]);
type PageData = { name: string; url: string; pageType: PageType; image?: string | null; stat?: string | undefined; onClick: () => void };
type GroupData = { name: string; onClick: () => void };
type HubData = {
  label: string;
  icon: LucideIcon;
  logo?: string | undefined;
  detail?: string | undefined;
  count: string;
  highlighted: boolean;
  /** Sem webinar escolhido: o momento convida a escolhê-lo. */
  pick?: (() => void) | undefined;
};

function OriginNode({ data }: NodeProps<Node<OriginData>>) {
  const parts = originParts(data);
  const paid = PAID_ORIGINS.has(parts.platform);
  const platform = ORIGIN_LABEL[parts.platform as OriginPlatform] ?? parts.platform;
  const style = data.style ?? 1;
  let icon = <BrandLogo name={parts.platform} className="size-[18px]" />;
  let kicker = `${paid ? "Tráfego pago" : "Tráfego"}${parts.placement ? "" : " · clique para dizer onde"}`;
  let title = originTitle(data);
  if (style === 2) {
    // A plataforma manda; o sítio é um selo pequeno no canto.
    icon = (
      <span className="relative flex">
        <BrandLogo name={parts.platform} className="size-[18px]" />
        {parts.placement && NETWORK_LOGOS.has(parts.placement) && (
          <span className="absolute -right-2.5 -bottom-2.5 flex size-4 items-center justify-center rounded-full bg-white ring-1 ring-gray-200">
            <BrandLogo name={parts.placement} className="size-2.5" />
          </span>
        )}
      </span>
    );
  } else if (style === 3) {
    // O sítio é a cara do nó; a plataforma fica na legenda.
    icon = <BrandLogo name={parts.placement && NETWORK_LOGOS.has(parts.placement) ? parts.placement : parts.platform} className="size-[18px]" />;
    kicker = `${platform}${paid ? " · pago" : ""}`;
    title = parts.placement ?? platform;
  }
  return (
    <Card onClick={data.onClick} className="w-[220px]">
      <Header tile="bg-white ring-1 ring-gray-200" icon={icon} kicker={kicker} title={title} />
      <Side type="source" position={Position.Right} />
    </Card>
  );
}

function AddOriginNode({ data }: NodeProps<Node<{ onClick: () => void }>>) {
  return (
    <button
      type="button"
      onClick={data.onClick}
      className="flex w-[220px] items-center gap-2.5 rounded-2xl border border-dashed border-gray-300 px-3.5 text-[13px] text-muted-foreground transition-colors hover:border-[#3B82F6] hover:text-foreground"
      style={{ height: HEADER_H }}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200">
        <Plus className="size-4" aria-hidden />
      </span>
      Origem do tráfego
    </button>
  );
}

/** Miniatura da página: a capa do webinar quando existe; senão, o esboço do tipo de página. */
function PagePreview({ type, image }: { type: PageType; image?: string | null | undefined }) {
  if (image) return <img src={image} alt="" className="size-full object-cover" />;
  return (
    <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-gray-50 px-6">
      {type === "obrigado" || type === "confirmacao" ? (
        <CheckCircle2 className="size-6 text-success" strokeWidth={1.5} aria-hidden />
      ) : type === "replay" ? (
        <PlayCircle className="size-6 text-gray-500" strokeWidth={1.5} aria-hidden />
      ) : (
        <span className="h-2 w-3/4 rounded-full bg-gray-300" />
      )}
      <span className="h-1.5 w-full rounded-full bg-gray-200" />
      <span className="h-1.5 w-2/3 rounded-full bg-gray-200" />
      {["inscricao", "vendas", "checkout", "upsell", "downsell"].includes(type) && <span className="mt-1 h-3 w-1/2 rounded-sm bg-primary" />}
    </div>
  );
}

function PageNode({ data }: NodeProps<Node<PageData>>) {
  return (
    <Card onClick={data.onClick} className="w-[220px]">
      <Side type="target" position={Position.Left} top={HEADER_H / 2} />
      <Header
        tile="bg-gray-100 text-gray-700"
        icon={<FileText className="size-4" strokeWidth={1.75} aria-hidden />}
        kicker={data.pageType === "outro" ? "Página · clique para dizer qual" : `Página · ${PAGE_TYPE_LABEL[data.pageType]}`}
        title={data.name}
      />
      <div className="mx-3 mb-3 h-28 overflow-hidden rounded-xl ring-1 ring-gray-200">
        <PagePreview type={data.pageType} image={data.image} />
      </div>
      {data.stat && <p className="-mt-1 px-3.5 pb-3 text-[11px] tabular-nums text-muted-foreground">{data.stat}</p>}
      <Side type="source" position={Position.Right} top={HEADER_H / 2} />
    </Card>
  );
}

function GroupNode({ data }: NodeProps<Node<GroupData>>) {
  return (
    <Card onClick={data.onClick} className="w-[220px]">
      <Side type="target" position={Position.Left} />
      <Header tile={LOOK.whatsapp_group.tile} icon={<Glyph look="whatsapp_group" />} kicker="Grupo de WhatsApp" title={data.name} />
      <Side type="source" position={Position.Right} />
    </Card>
  );
}

/** Um momento da jornada (inscrição, webinar, fim, checkout, compra): as automações penduram-se por baixo. */
function HubNode({ data }: NodeProps<Node<HubData>>) {
  const Icon = data.icon;
  return (
    <div
      className={cn(
        "w-[220px] rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06),0_1px_3px_rgba(16,24,40,0.1)] ring-1 ring-gray-200",
        data.highlighted && "ring-2 ring-primary/50",
      )}
    >
      <Side type="target" position={Position.Left} top={HEADER_H / 2} />
      <Header
        tile="overflow-hidden bg-navy text-white"
        icon={data.logo ? <img src={data.logo} alt="" className="size-full" /> : <Icon className="size-4" strokeWidth={1.75} aria-hidden />}
        kicker="Momento"
        title={data.label}
      />
      {(data.detail || data.count || data.pick) && (
        <div className="space-y-0.5 px-3.5 pb-3 text-[11px] leading-tight">
          {data.detail && <p className="truncate">{data.detail}</p>}
          {data.count && <p className="truncate tabular-nums text-muted-foreground">{data.count}</p>}
          {data.pick && (
            <button type="button" onClick={data.pick} className="font-medium text-primary hover:underline">
              Escolher webinar
            </button>
          )}
        </div>
      )}
      <Side type="source" position={Position.Right} top={HEADER_H / 2} />
      <Handle id="down" type="source" position={Position.Bottom} className={handleClass} isConnectable={false} />
    </div>
  );
}

/* ---------- A automação no mapa: início, mensagens por canal, condições ---------- */

type LaneData = { automation: Automation; stats: AutomationStats; onOpen: () => void };
type StepData = { node: LaidStep["node"]; wait?: string | undefined; onOpen: () => void };

/** O início de cada automação (como o «Starting step» do ManyChat): quando entra e em que estado está. */
function LaneNode({ data }: NodeProps<Node<LaneData>>) {
  const a = data.automation;
  const s = data.stats;
  return (
    <Card onClick={data.onOpen} dim={!a.active} className="w-[260px]">
      <div style={{ height: LANE_H }}>
        <Handle type="target" position={Position.Top} className={handleClass} isConnectable={false} />
        <Header
          tile="bg-accent text-accent-700"
          icon={<Zap className="size-4" strokeWidth={1.75} aria-hidden />}
          kicker={`Quando: ${triggerTitle(a.trigger_event)}`}
          title={a.name}
          right={<RunState active={a.active} />}
        />
        <p className="truncate px-3.5 text-[11px] tabular-nums text-muted-foreground">
          {s.pending > 0 && <span className="text-primary">{s.pending} em curso · </span>}
          {s.done} {s.done === 1 ? "feita" : "feitas"}
          {s.failed > 0 && <span className="text-destructive"> · {s.failed} {s.failed === 1 ? "falha" : "falhas"}</span>}
        </p>
        <Side type="source" position={Position.Right} top={HEADER_H / 2} />
      </div>
    </Card>
  );
}

/** Um envio dentro da mensagem: o canal (cor e ícone) e o início do que vai sair. */
function SendRow({ send }: { send: Send }) {
  const look = lookOf(send);
  const preview = (send.channel === "email" ? send.subject || send.message : send.message)?.trim();
  const title = look === "whatsapp_group" && send.group?.trim() ? `Grupo «${send.group.trim()}»` : LOOK[look].label;
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 px-2.5" style={{ height: SEND_H }}>
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", LOOK[look].tile)}>
        <Glyph look={look} className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] leading-4 font-medium">{title}</span>
        <span className={cn("block truncate text-[11px] leading-4", preview || look === "webhook" ? "text-muted-foreground" : "text-warning")}>
          {preview || (look === "webhook" ? "Para o seu Zapier, Make ou CRM" : "Mensagem por escrever")}
        </span>
      </span>
    </div>
  );
}

function MessageNode({ data }: NodeProps<Node<StepData>>) {
  const n = data.node;
  if (n.kind !== "action") return null;
  const top = (data.wait ? WAIT_H : 0) + HEADER_H / 2;
  return (
    <Card onClick={data.onOpen} className="w-[260px]">
      <Side type="target" position={Position.Left} top={top} />
      {data.wait && <WaitStrip text={data.wait} />}
      <Header tile="bg-gray-100 text-gray-700" icon={<SendIcon className="size-4" strokeWidth={1.75} aria-hidden />} kicker="Mensagem" title={nodeTitle(n)} />
      <div className="px-3" style={{ paddingBottom: PAD_B, display: "grid", gap: SEND_GAP }}>
        {n.sends.length === 0 && (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 text-[11px] text-muted-foreground" style={{ height: SEND_H }}>
            Escolha o canal
          </div>
        )}
        {n.sends.map((s, i) => (
          <SendRow key={i} send={s} />
        ))}
      </div>
      <Side type="source" position={Position.Right} top={top} />
    </Card>
  );
}

/** Condição com uma saída por resposta, como no ManyChat: cada caminho sai da sua linha. */
function ConditionNode({ data }: NodeProps<Node<StepData>>) {
  const n = data.node;
  if (n.kind !== "branch") return null;
  const purchase = n.condition.fact === "purchased";
  const base = (data.wait ? WAIT_H : 0) + HEADER_H;
  const rows = [
    { id: "yes", label: conditionLabel(n.condition), answer: "Sim" },
    { id: "no", label: conditionLabel(negate(n.condition)), answer: "Não" },
  ];
  return (
    <Card onClick={data.onOpen} className="w-[260px]">
      <Side type="target" position={Position.Left} top={base - HEADER_H / 2} />
      {data.wait && <WaitStrip text={data.wait} />}
      <Header
        tile={purchase ? "bg-success-soft text-success" : "bg-amber-50 text-amber-700"}
        icon={purchase ? <DollarSign className="size-4" strokeWidth={2} aria-hidden /> : <GitFork className="size-4" strokeWidth={1.75} aria-hidden />}
        kicker="Condição"
        title={nodeTitle(n)}
      />
      <div className="px-3" style={{ paddingBottom: PAD_B, display: "grid", gap: BRANCH_GAP }}>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 text-[12px]" style={{ height: BRANCH_ROW_H }}>
            <span className="truncate">{r.label}</span>
            <span className="text-[11px] text-muted-foreground">{r.answer}</span>
          </div>
        ))}
      </div>
      {rows.map((r, i) => (
        <Handle
          key={r.id}
          id={r.id}
          type="source"
          position={Position.Right}
          className={handleClass}
          isConnectable={false}
          style={{ top: base + i * (BRANCH_ROW_H + BRANCH_GAP) + BRANCH_ROW_H / 2 }}
        />
      ))}
    </Card>
  );
}

const nodeTypes = {
  origin: OriginNode,
  addOrigin: AddOriginNode,
  page: PageNode,
  group: GroupNode,
  hub: HubNode,
  lane: LaneNode,
  message: MessageNode,
  condition: ConditionNode,
};

/* ---------- Disposição ---------- */

const COL = 300;
/** Cada automação: o início (260px) e, à direita, os passos em colunas; cada ramo numa linha. */
const STEP_COL = CARD_W + 90;
const LANE_GAP = 40;
const ROW_GAP = 28;
const LANE_TOP = 230;

/** O que se mostra no momento: as pessoas que lá chegaram. */
function hubCount(key: HubKey, c: JourneyCounts | null) {
  if (!c) return "";
  if (key === "inscricao") return `${c.registered} pessoas`;
  if (key === "webinar") return `${c.entered} entraram · ${c.attended} assistiram`;
  if (key === "fim") return `${c.registered - c.entered} não entraram`;
  if (key === "checkout") return `${c.checkout} iniciaram · ${c.failed} falharam`;
  return `${c.purchased} compraram`;
}

const pathsOf = (a: Automation) => audiences(readSteps(a.steps), (a.conditions ?? []) as Condition[]);
const line = (active: boolean) =>
  active ? { strokeWidth: 1.5, stroke: "#64748B" } : { strokeWidth: 1.5, stroke: "#CBD5E1", strokeDasharray: "5 5" };

export function buildFlow(input: {
  automations: Automation[];
  canvas: Canvas;
  forms: RegistrationForm[];
  webinar: Workflow["webinars"];
  counts: JourneyCounts | null;
  stats: (id: string) => AutomationStats;
  onOpenAutomation: (id: string) => void;
  onOpenStep: (automationId: string, nodeId: string) => void;
  onAddAutomation: (trigger: string) => void;
  onEditCanvasNode: (node: CanvasNode) => void;
  onOpenCapture: () => void;
  /** Sem webinar: o momento «Webinar ao vivo» leva à configuração. */
  onPickWebinar?: (() => void) | undefined;
  /** Versão em avaliação da organização do tráfego (paleta e nó). */
  originStyle?: OriginStyle | undefined;
}) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const pages = input.canvas.nodes.filter((n): n is Extract<CanvasNode, { kind: "page" }> => n.kind === "page");
  const origins = input.canvas.nodes.filter((n): n is Extract<CanvasNode, { kind: "origin" }> => n.kind === "origin");
  const groups = input.canvas.nodes.filter((n): n is Extract<CanvasNode, { kind: "group" }> => n.kind === "group");
  const c = input.counts;
  const w = input.webinar;
  const cover = w?.registration_cover_url || w?.cover_url || null;
  const edge = (source: string, target: string, extra: Partial<Edge> = {}) =>
    edges.push({ id: `${source}->${target}${extra.sourceHandle ?? ""}`, source, target, type: "default", style: line(true), ...extra });

  // A posição que a pessoa escolheu (arrastando) vale mais do que a disposição automática.
  const pos = (id: string, x: number, y: number) => input.canvas.positions[id] ?? { x, y };

  // As automações não se sobrepõem: cada uma desce até haver espaço livre na sua faixa horizontal.
  const lanes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const fitLane = (x0: number, x1: number, height: number) => {
    let y = LANE_TOP;
    for (let moved = true; moved; ) {
      moved = false;
      for (const r of lanes)
        if (x0 < r.x1 && r.x0 < x1 && y < r.y1 && r.y0 < y + height) {
          y = r.y1 + LANE_GAP;
          moved = true;
        }
    }
    lanes.push({ x0, x1, y0: y, y1: y + height });
    return y;
  };

  // A espinha, pela ordem de um lançamento: tráfego → inscrição → obrigado → grupo → momentos do webinar → venda.
  const spine: string[] = [];
  let x = 0;
  const place = (node: Node) => {
    nodes.push({ ...node, position: pos(node.id, x, 0) });
    spine.push(node.id);
    x += COL;
  };

  // Origens: empilhadas à esquerda, todas a convergir na página de inscrição; o "+" no fim da coluna.
  const column = origins.length + 1;
  const originY = (i: number) => (i - (column - 1) / 2) * 72 + 30;
  origins.forEach((o, i) =>
    nodes.push({
      id: `origin:${o.id}`,
      type: "origin",
      position: pos(`origin:${o.id}`, 0, originY(i)),
      data: { source: o.source, placement: o.placement, style: input.originStyle, onClick: () => input.onEditCanvasNode(o) } satisfies OriginData,
    }),
  );
  nodes.push({
    id: "origin:add",
    type: "addOrigin",
    position: pos("origin:add", 0, originY(origins.length)),
    data: { onClick: () => input.onEditCanvasNode({ id: `origem-${Date.now().toString(36)}`, kind: "origin", source: "Meta" }) },
  });
  x += COL;

  // A página de inscrição: a do formulário ou, sem página própria, a do webinar na plataforma.
  const inscription = input.forms[0];
  place({
    id: "page:inscricao",
    type: "page",
    position: { x: 0, y: 0 },
    data: {
      name: inscription?.page_name || "Página de inscrição",
      url: inscription?.page_url || (w ? `/w/${w.slug}` : ""),
      pageType: "inscricao",
      image: cover,
      stat: c ? `${c.registered} inscritos` : undefined,
      onClick: input.onOpenCapture,
    } satisfies PageData,
  });
  for (const o of origins) edge(`origin:${o.id}`, "page:inscricao");

  const pageNode = (p: Extract<CanvasNode, { kind: "page" }>) =>
    place({ id: `page:${p.id}`, type: "page", position: { x: 0, y: 0 }, data: { name: p.name, url: p.url, pageType: p.pageType, onClick: () => input.onEditCanvasNode(p) } satisfies PageData });
  const pagesOf = (type: PageType) => pages.filter((p) => p.pageType === type);

  pagesOf("confirmacao").forEach(pageNode);
  for (const g of groups) place({ id: `group:${g.id}`, type: "group", position: { x: 0, y: 0 }, data: { name: g.name, onClick: () => input.onEditCanvasNode(g) } satisfies GroupData });

  for (const hub of HUBS) {
    if (hub.key === "checkout") [...pagesOf("vendas"), ...pagesOf("checkout")].forEach(pageNode);
    const hubX = x;
    // O webinar configurado vê-se no momento: o ícone da plataforma, o título e a data.
    const live = hub.key === "webinar" && w;
    place({
      id: `hub:${hub.key}`,
      type: "hub",
      position: { x: 0, y: 0 },
      data: {
        label: hub.label,
        icon: hub.icon,
        logo: live ? platformIcon : undefined,
        detail: live
          ? [w.public_title || w.internal_name, w.scheduled_at && formatDateTime(w.scheduled_at)].filter(Boolean).join(" · ")
          : hub.key === "webinar" && !w
            ? "Por escolher: as horas contam a partir dele"
            : undefined,
        count: hubCount(hub.key, c),
        highlighted: hub.key === "webinar",
        pick: hub.key === "webinar" && !w ? input.onPickWebinar : undefined,
      } satisfies HubData,
    });

    // As automações deste momento, penduradas por baixo e desenhadas para a direita.
    for (const a of input.automations.filter((a) => hub.triggers.includes(a.trigger_event))) {
      const layout = stepLayout(readSteps(a.steps));
      const waits = new Map(layout.edges.filter((e) => e.wait).map((e) => [e.to, e.wait!]));
      // Cada linha (ramo) tem a altura do cartão mais alto que leva.
      const rowH = Array.from({ length: layout.rows }, (_, r): number => (r === 0 ? LANE_H : 0));
      for (const it of layout.items) rowH[it.row] = Math.max(rowH[it.row]!, stepHeight(it.node, waits.has(it.node.id)));
      const rowY = rowH.map((_, r) => rowH.slice(0, r).reduce((sum, h) => sum + h + ROW_GAP, 0));
      const cols = layout.items.length ? Math.max(...layout.items.map((i) => i.col)) + 1 : 0;
      const x0 = hubX - (CARD_W - 220) / 2;
      const height = rowY.at(-1)! + rowH.at(-1)!;
      const lane = pos(`auto:${a.id}`, x0, fitLane(x0, x0 + STEP_COL * (cols + 1), height));
      const onOpen = () => input.onOpenAutomation(a.id);

      nodes.push({ id: `auto:${a.id}`, type: "lane", position: lane, data: { automation: a, stats: input.stats(a.id), onOpen } satisfies LaneData });
      edge(`hub:${hub.key}`, `auto:${a.id}`, { sourceHandle: "down", type: "smoothstep", animated: a.active, style: line(a.active) });
      for (const it of layout.items)
        nodes.push({
          id: `step:${a.id}:${it.node.id}`,
          type: it.node.kind === "branch" ? "condition" : "message",
          // Os passos seguem o início da automação, salvo se a pessoa os arrastou.
          position: pos(`step:${a.id}:${it.node.id}`, lane.x + STEP_COL * (it.col + 1), lane.y + rowY[it.row]!),
          data: { node: it.node, wait: waits.get(it.node.id), onOpen: () => input.onOpenStep(a.id, it.node.id) } satisfies StepData,
        });
      for (const e of layout.edges)
        edges.push({
          id: `${a.id}:${e.from ?? "in"}->${e.to}:${e.handle ?? ""}`,
          source: e.from ? `step:${a.id}:${e.from}` : `auto:${a.id}`,
          target: `step:${a.id}:${e.to}`,
          ...(e.handle ? { sourceHandle: e.handle } : {}),
          type: "default",
          style: line(a.active),
        });
    }

    if (hub.key === "fim") {
      pagesOf("replay").forEach(pageNode);
      // Replay ligado no webinar e sem página própria no fluxo: a da plataforma.
      if (w?.replay_enabled && !pagesOf("replay").length)
        place({
          id: "page:replay-plataforma",
          type: "page",
          position: { x: 0, y: 0 },
          data: {
            name: "Replay",
            url: `/replay/${w.id}`,
            pageType: "replay",
            image: w.cover_url,
            onClick: () => window.open(`/replay/${w.id}`, "_blank", "noopener"),
          } satisfies PageData,
        });
    }
    if (hub.key === "compra") [...pagesOf("upsell"), ...pagesOf("downsell"), ...pagesOf("obrigado")].forEach(pageNode);
  }
  pagesOf("outro").forEach(pageNode);
  for (let i = 0; i < spine.length - 1; i += 1) edge(spine[i]!, spine[i + 1]!);
  return { nodes, edges };
}

/* ---------- Telemóvel: o mapa não cabe; as etapas de cima para baixo ---------- */

/** Ícone de um canal; o WhatsApp leva o logótipo da marca. */
function ChannelIcon({ channel }: { channel: Channel }) {
  if (channel === "whatsapp") return <BrandLogo name="WhatsApp" className="size-3.5" />;
  const Icon = CHANNEL_ICON[channel];
  return <Icon className="size-3.5" strokeWidth={1.5} aria-label={FLOW_CHANNEL[channel].label} />;
}

const MAX_PATHS = 3;

/** A automação em cartão: quando entra, quem recebe o quê (um caminho por linha) e o estado das execuções. */
function AutomationCard({ automation: a, paths, stats, onOpen }: { automation: Automation; paths: Audience[]; stats: AutomationStats; onOpen: () => void }) {
  return (
    <Card onClick={onOpen} dim={!a.active} className="w-full">
      <Header tile="bg-accent text-accent-700" icon={<Zap className="size-4" strokeWidth={1.75} aria-hidden />} kicker={`Quando: ${triggerTitle(a.trigger_event)}`} title={a.name} right={<RunState active={a.active} />} />
      <div className="space-y-1 px-3 pb-3">
        {paths.length === 0 && <p className="text-[11px] text-muted-foreground">Sem mensagens</p>}
        {paths.slice(0, MAX_PATHS).map((p, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl bg-gray-50 px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[11px]">{p.who.length ? conditionsSentence(p.who) : "Todos"}</span>
            <span className="flex items-center gap-1">
              {p.channels.map((ch) => (
                <ChannelIcon key={ch} channel={ch} />
              ))}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{p.messages} msg</span>
          </div>
        ))}
        {paths.length > MAX_PATHS && <p className="text-[11px] text-muted-foreground">+{paths.length - MAX_PATHS} caminhos</p>}
        <p className="pt-1 text-right text-[11px] tabular-nums text-muted-foreground">
          {stats.pending > 0 && <span className="text-primary">{stats.pending} em curso · </span>}
          {stats.done} {stats.done === 1 ? "feita" : "feitas"}
        </p>
      </div>
    </Card>
  );
}

function JourneyList(props: Parameters<typeof buildFlow>[0]) {
  return (
    <div className="h-full space-y-5 overflow-auto p-3 lg:hidden">
      {HUBS.map((hub) => {
        const Icon = hub.icon;
        return (
          <section key={hub.key} className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy text-white">
                <Icon className="size-4" strokeWidth={1.5} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{hub.label}</span>
                <span className="block truncate text-[11px] tabular-nums text-muted-foreground">{hubCount(hub.key, props.counts)}</span>
              </span>
              <button
                type="button"
                onClick={() => props.onAddAutomation(hub.addTrigger)}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-pill bg-white px-3 text-xs ring-1 ring-gray-200"
              >
                <Plus className="size-3" aria-hidden /> Automação
              </button>
            </div>
            {props.automations
              .filter((a) => hub.triggers.includes(a.trigger_event))
              .map((a) => (
                <AutomationCard key={a.id} automation={a} paths={pathsOf(a)} stats={props.stats(a.id)} onOpen={() => props.onOpenAutomation(a.id)} />
              ))}
          </section>
        );
      })}
    </div>
  );
}

/* ---------- Menu de componentes, pela ordem do lançamento ---------- */

export type XY = { x: number; y: number };
export type FlowComponent =
  | { kind: "automation"; key: string }
  | { kind: "page"; pageType: PageType }
  | { kind: "group" }
  | { kind: "origin"; source: string; placement?: string | undefined }
  /** Um disparo, espera ou condição (chave da paleta): entra no fim de uma automação. */
  | { kind: "step"; key: string };

/* ---------- O mapa ---------- */

export function FlowMap(
  props: Parameters<typeof buildFlow>[0] & {
    /** `automationId`: a automação onde o componente foi largado (ou a última onde se clicou). */
    onAddComponent: (component: FlowComponent, at?: XY, automationId?: string) => void;
    onMoveNodes: (moves: Record<string, XY>) => void;
    onResetLayout: () => void;
    /** Ecrã inteiro: o mapa ocupa a janela toda para se trabalhar à vontade. */
    full?: boolean | undefined;
    onToggleFull?: (() => void) | undefined;
  },
) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const built = useMemo(() => buildFlow(props), [props]);
  // Os nós movem-se com o rato; ao largar, a posição grava-se e volta pelo canvas.
  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) setNodes(built.nodes);
  }, [built, setNodes]);
  const flow = useRef<ReactFlowInstance | null>(null);
  // A última automação onde se clicou: um disparo clicado no menu entra nela.
  const lastAutomation = useRef<string | undefined>(undefined);
  const automationOf = (nodeId: string | undefined) => (nodeId && /^(auto|step):/.test(nodeId) ? nodeId.split(":")[1] : undefined);
  // Abre legível no início da jornada (tráfego → webinar ao vivo); o resto vê-se a deslizar.
  const start = useMemo(() => built.nodes.filter((n) => n.position.x < 5.5 * COL && n.position.y < 700).map((n) => ({ id: n.id })), [built]);
  if (!mounted) return <div className="h-full w-full animate-pulse rounded-card bg-chip/60" />;
  return (
    <>
      <div className="relative hidden h-full lg:block">
        <ReactFlow
          nodes={nodes}
          edges={built.edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onInit={(instance) => {
            flow.current = instance;
          }}
          onNodeClick={(_, node) => {
            lastAutomation.current = automationOf(node.id) ?? lastAutomation.current;
          }}
          onNodeDragStart={() => {
            dragging.current = true;
          }}
          onNodeDragStop={(_, __, moved) => {
            dragging.current = false;
            props.onMoveNodes(Object.fromEntries(moved.map((n) => [n.id, n.position])));
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(DND)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            const raw = e.dataTransfer.getData(DND);
            if (!raw || !flow.current) return;
            e.preventDefault();
            const at = flow.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
            // Largado em cima de uma automação (início ou passo): é nela que entra.
            const hit = flow.current.getIntersectingNodes({ ...at, width: 1, height: 1 }).find((n) => automationOf(n.id));
            props.onAddComponent(JSON.parse(raw) as FlowComponent, at, automationOf(hit?.id));
          }}
          fitView
          fitViewOptions={{ nodes: start, padding: 0.1, maxZoom: 1 }}
          minZoom={0.15}
          maxZoom={1.5}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
          className="rounded-card bg-[#F7F8FA]"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#D5D9E0" />
          <Controls showInteractive={false} position="bottom-right" className="!overflow-hidden !rounded-xl !border-0 !shadow-pop" />
        </ReactFlow>
        <ToolsPanel variant={props.originStyle ?? 1} onAdd={(c) => props.onAddComponent(c, undefined, lastAutomation.current)} />
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          {props.onToggleFull && (
            <button
              type="button"
              onClick={props.onToggleFull}
              title={props.full ? "Sair do ecrã inteiro (Esc)" : "Trabalhar em ecrã inteiro"}
              className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-white px-4 text-sm shadow-pop ring-1 ring-gray-200 hover:bg-gray-50"
            >
              {props.full ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
              {props.full ? "Sair" : "Ecrã inteiro"}
            </button>
          )}
          <button
            type="button"
            onClick={props.onResetLayout}
            title="Volta a pôr tudo no sítio automático"
            className="inline-flex h-9 items-center rounded-pill bg-white px-4 text-sm shadow-pop ring-1 ring-gray-200 hover:bg-gray-50"
          >
            Organizar
          </button>
        </div>
      </div>
      <JourneyList {...props} />
    </>
  );
}
