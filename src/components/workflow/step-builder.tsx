import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Clock,
  Copy,
  CornerDownRight,
  GitFork,
  Link2,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
  Unlink,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { TRIGGER_ICON } from "@/components/automation-flow";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { conditionLabel, type Condition, type TriggerEvent } from "@/lib/automations";
import { cn } from "@/lib/utils";
import {
  nodeMap,
  nodeTitle,
  sendLabel,
  sendMissing,
  triggerTitle,
  waitLabel,
  type StepNode,
  type Steps,
} from "@/lib/workflow";
import { BranchLabel, ChannelChip, FLOW_KIND, FlowTile, type FlowChannel } from "@/components/ds/flow";

export type InsertPoint = { after: string | null; branch?: "yes" | "no" };
export type Selection = { kind: "trigger" } | { kind: "node"; id: string } | { kind: "insert"; point: InsertPoint };

/** Tipos de passo com a linguagem do Workflow (ds/flow): esperar = relevo, condição = cinza, mensagem = laranja suave. */
export const KIND_STYLE: Record<StepNode["kind"], { icon: LucideIcon; tile: string; name: string }> = {
  wait: { icon: Clock, tile: FLOW_KIND.wait.tile, name: "Esperar" },
  branch: { icon: GitFork, tile: FLOW_KIND.condition.tile, name: "Condição" },
  action: { icon: Send, tile: FLOW_KIND.action.tile, name: "Mensagem" },
};

/** Canal visual de um envio (o WhatsApp para grupo é um canal à parte). */
const sendChannel = (s: { channel: string; target?: string }): FlowChannel =>
  s.channel === "whatsapp" && s.target === "group" ? "whatsapp_group" : (s.channel as FlowChannel);

export type NodeActivity = { passed: number; waiting: number };

type Props = {
  trigger: string;
  conditions: Condition[];
  steps: Steps;
  selection: Selection | null;
  activity: Map<string, NodeActivity>;
  executed: Set<string>;
  onSelect: (selection: Selection) => void;
  onMove: (id: string, dir: "up" | "down") => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onDisconnect: (id: string, handle: "next" | "yes" | "no") => void;
  onConnectStart: (id: string, handle: "next" | "yes" | "no") => void;
};

/** A automação de cima para baixo: gatilho, passos, ramos lado a lado, fim. */
export function StepBuilder(props: Props) {
  const map = nodeMap(props.steps);
  const visited = new Set<string>();

  const chain = (from: string | null, point: InsertPoint): ReactNode[] => {
    const items: ReactNode[] = [<AddButton key={`add-${point.after}-${point.branch ?? ""}`} point={point} {...props} />];
    let id = from;
    while (id) {
      if (visited.has(id) || !map.has(id)) {
        const target = map.get(id);
        items.push(
          <Pill key={`goto-${id}-${point.after}`} icon={CornerDownRight}>
            Continua em «{target ? nodeTitle(target) : "passo em falta"}»
          </Pill>,
        );
        return items;
      }
      visited.add(id);
      const node = map.get(id)!;
      items.push(<StepCard key={node.id} node={node} {...props} />);
      if (node.kind === "branch") {
        items.push(<Connector key={`${node.id}-split`} />);
        items.push(
          <div key={`${node.id}-branches`} className="relative flex w-full justify-center gap-6 pt-4">
            {/* A barra que abre os dois caminhos. */}
            <span className="absolute left-1/4 right-1/4 top-0 h-px bg-gray-300" aria-hidden />
            {(["yes", "no"] as const).map((branch) => (
              <div key={branch} className="relative flex min-w-[17rem] flex-1 flex-col items-center">
                <span className="absolute -top-4 left-1/2 h-4 w-px bg-gray-300" aria-hidden />
                <BranchLabel branch={branch} />
                <Connector />
                {chain(branch === "yes" ? node.yes : node.no, { after: node.id, branch })}
              </div>
            ))}
          </div>,
        );
        return items;
      }
      items.push(<Connector key={`${node.id}-line`} />);
      items.push(<AddButton key={`add-${node.id}`} point={{ after: node.id }} {...props} />);
      id = node.next;
    }
    items.push(<Pill key={`end-${point.after}-${point.branch ?? ""}`}>FIM</Pill>);
    return items;
  };

  const loose = props.steps.nodes.filter((n) => !isReachable(props.steps, n.id));
  return (
    <div className="flex flex-col items-center pb-10">
      <TriggerCard {...props} />
      <Connector />
      {chain(props.steps.start, { after: null })}
      {loose.length > 0 && (
        <div className="mt-8 w-full max-w-md rounded-lg border border-dashed border-gray-300 p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Passos desligados (guardados, não correm) · ligue-os a partir do menu de outro passo
          </p>
          <div className="flex flex-col items-center gap-2">
            {loose.map((n) => (
              <StepCard key={n.id} node={n} {...props} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function isReachable(steps: Steps, id: string) {
  const map = nodeMap(steps);
  const seen = new Set<string>();
  const stack = [steps.start];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || seen.has(cur)) continue;
    if (cur === id) return true;
    seen.add(cur);
    const n = map.get(cur);
    if (n) stack.push(...(n.kind === "branch" ? [n.yes, n.no] : [n.next]));
  }
  return false;
}

const Connector = () => <span className="h-4 w-px bg-gray-300" aria-hidden />;

function Pill({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-chip px-4 text-[11px] tracking-[0.04em] text-gray-700">
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  );
}

function AddButton({ point, selection, onSelect }: { point: InsertPoint } & Pick<Props, "selection" | "onSelect">) {
  const active =
    selection?.kind === "insert" && selection.point.after === point.after && selection.point.branch === point.branch;
  return (
    <>
      <button
        type="button"
        onClick={() => onSelect({ kind: "insert", point })}
        aria-label="Adicionar passo aqui"
        className={cn(
          "flex size-7 items-center justify-center rounded-full bg-white text-gray-600 ring-1 ring-gray-250 transition-[background-color,color,transform] duration-[var(--duration-fast)] hover:bg-navy hover:text-white hover:ring-navy active:scale-[.94]",
          active && "bg-primary text-white ring-primary hover:bg-primary",
        )}
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
      <Connector />
    </>
  );
}

function TriggerCard({ trigger, conditions, selection, onSelect }: Props) {
  const Icon = TRIGGER_ICON[trigger as TriggerEvent] ?? Zap;
  return (
    <button
      type="button"
      onClick={() => onSelect({ kind: "trigger" })}
      className={cn(
        "w-[19rem] rounded-md bg-white p-3.5 text-left ring-1 ring-[var(--border-subtle)] transition-shadow duration-[var(--duration-fast)] hover:shadow-pop",
        selection?.kind === "trigger" && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-center gap-3">
        <FlowTile kind="event" icon={Icon} />
        <span className="min-w-0">
          <span className="block text-[11px] text-muted-foreground">Quando</span>
          <span className="block truncate text-[15px] tracking-[-0.01em]">{triggerTitle(trigger)}</span>
        </span>
      </div>
      {conditions.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {conditions.map((c, i) => (
            <span key={i} className="rounded-pill bg-chip px-2 py-0.5 text-[11px]">
              Se {conditionLabel(c).toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function StepCard({
  node,
  selection,
  activity,
  executed,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onDisconnect,
  onConnectStart,
}: { node: StepNode } & Props) {
  const style = KIND_STYLE[node.kind];
  const Icon = node.kind === "wait" && node.mode !== "delay" ? CalendarClock : style.icon;
  const selected = selection?.kind === "node" && selection.id === node.id;
  const incomplete = node.kind === "action" && (node.sends.length === 0 || node.sends.some((s) => sendMissing(s).length > 0));
  const stats = activity.get(node.id);
  const handles: ("next" | "yes" | "no")[] = node.kind === "branch" ? ["yes", "no"] : ["next"];
  return (
    <div
      className={cn(
        "group relative w-[19rem] rounded-md bg-white ring-1 ring-[var(--border-subtle)] transition-shadow duration-[var(--duration-fast)] hover:shadow-pop",
        selected && "ring-2 ring-primary",
      )}
    >
      <button type="button" onClick={() => onSelect({ kind: "node", id: node.id })} className="flex w-full items-start gap-3 p-3.5 pr-10 text-left">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-sm", style.tile)}>
          <Icon className="size-4" strokeWidth={1.5} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-muted-foreground">{style.name}</span>
          <span className="block truncate text-[15px] tracking-[-0.01em]">{nodeTitle(node)}</span>
          {node.kind === "wait" && node.label && <span className="block text-xs text-muted-foreground">{waitLabel(node)}</span>}
          {node.kind === "action" && (
            <span className="mt-1 flex flex-wrap gap-1">
              {node.sends.length === 0 && <span className="text-xs text-muted-foreground">Sem envios</span>}
              {node.sends.map((s, i) => {
                const missing = sendMissing(s);
                return (
                  <ChannelChip
                    key={i}
                    channel={sendChannel(s)}
                    label={sendLabel(s)}
                    missing={missing.length > 0}
                    title={missing.length ? `Falta ${missing.join(", ")}` : undefined}
                  />
                );
              })}
            </span>
          )}
        </span>
      </button>
      {(stats?.passed || stats?.waiting || incomplete) && (
        <div className="mx-3.5 flex items-center gap-3 border-t border-[var(--border-subtle)] py-2 text-[11px] tabular-nums text-muted-foreground">
          {stats?.passed ? <span>✓ {stats.passed} passaram</span> : null}
          {stats?.waiting ? (
            <span className="inline-flex items-center gap-1.5 text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
              {stats.waiting} aqui agora
            </span>
          ) : null}
          {incomplete && <span className="ml-auto rounded-pill bg-warning-soft px-2 py-0.5 text-warning">Por configurar</span>}
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Opções do passo"
            className="absolute right-2.5 top-3 flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-gray-100"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onSelect({ kind: "node", id: node.id })}>Editar</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDuplicate(node.id)}>
            <Copy /> Duplicar
          </DropdownMenuItem>
          {node.kind !== "branch" && (
            <>
              <DropdownMenuItem onSelect={() => onMove(node.id, "up")}>
                <ArrowUp /> Mover para cima
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMove(node.id, "down")}>
                <ArrowDown /> Mover para baixo
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          {handles.map((h) => (
            <DropdownMenuItem key={`c-${h}`} onSelect={() => onConnectStart(node.id, h)}>
              <Link2 /> Ligar {h === "yes" ? "o «Sim»" : h === "no" ? "o «Não»" : "a saída"} a outro passo
            </DropdownMenuItem>
          ))}
          {handles.map((h) => (
            <DropdownMenuItem key={`d-${h}`} onSelect={() => onDisconnect(node.id, h)}>
              <Unlink /> Desligar {h === "yes" ? "o «Sim»" : h === "no" ? "o «Não»" : "a saída"} (termina aqui)
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={executed.has(node.id)}
            onSelect={() => onRemove(node.id)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 /> {executed.has(node.id) ? "Já correu: desligue em vez de eliminar" : "Eliminar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
