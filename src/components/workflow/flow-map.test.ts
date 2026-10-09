import { describe, expect, it } from "vitest";
import { baseWorkflow, readCanvas, type Canvas } from "@/lib/workflow";
import { buildFlow } from "./flow-map";

const automations = baseWorkflow().map((a, i) => ({ id: `a${i}`, name: a.name, active: false, trigger_event: a.trigger_event, conditions: a.conditions, steps: a.steps })) as never;
const noop = () => {};
const build = (canvas: Canvas, list = automations, onOpenTools?: () => void) =>
  buildFlow({
    automations: list,
    onOpenTools,
    canvas,
    forms: [],
    webinar: null,
    counts: null,
    stats: () => ({ contacts: 0, runs: 0, done: 0, pending: 0, failed: 0, cancelled: 0, lastRunAt: null, nextRunAt: null }),
    onOpenAutomation: noop,
    onOpenStep: noop,
    onAddAutomation: noop,
    onEditCanvasNode: noop,
    onOpenCapture: noop,
  });
const nodes: Canvas["nodes"] = [
  { id: "o", kind: "origin", source: "Meta" },
  { id: "c", kind: "page", name: "Checkout", url: "", pageType: "checkout" },
];
const isSpine = (type: string | undefined) => type === "hub" || type === "page";

describe("buildFlow", () => {
  it("vertical: a espinha desce numa coluna e as automações ficam à direita, sem se sobreporem", () => {
    const { nodes: out, edges } = build({ nodes, positions: {}, orientation: "vertical" });
    const spine = out.filter((n) => isSpine(n.type));
    expect(spine.every((n) => n.position.x === 0)).toBe(true);
    const ys = spine.map((n) => n.position.y);
    expect(ys).toEqual([...new Set(ys)].sort((a, b) => a - b));

    const lanes = out.filter((n) => n.type === "lane").sort((a, b) => a.position.y - b.position.y);
    // Cada automação pronta tem o seu início no desenho.
    expect(lanes).toHaveLength(baseWorkflow().length);
    expect(lanes.every((n) => n.position.x === 300)).toBe(true);
    // Nenhum passo de uma automação desce até à automação seguinte.
    lanes.slice(0, -1).forEach((lane, i) => {
      const id = lane.id.split(":")[1];
      const lowest = Math.max(lane.position.y, ...out.filter((n) => n.id.startsWith(`step:${id}:`)).map((n) => n.position.y));
      expect(lowest).toBeLessThan(lanes[i + 1]!.position.y);
    });

    // A espinha liga de baixo para cima; a automação liga pela esquerda.
    expect(edges.find((e) => e.source === "page:inscricao")).toMatchObject({ sourceHandle: "b", targetHandle: "t" });
    expect(edges.find((e) => e.source === "hub:inscricao" && e.target.startsWith("hub:"))).toMatchObject({ sourceHandle: "down", targetHandle: "t" });
    expect(edges.find((e) => e.target === lanes[0]!.id)).toMatchObject({ targetHandle: "l" });
  });

  it("horizontal: a espinha numa linha e as automações penduradas por baixo", () => {
    const { nodes: out, edges } = build({ nodes, positions: {}, orientation: "horizontal" });
    const spine = out.filter((n) => isSpine(n.type));
    expect(spine.every((n) => n.position.y === 0)).toBe(true);
    const xs = spine.map((n) => n.position.x);
    expect(xs).toEqual([...new Set(xs)].sort((a, b) => a - b));
    expect(out.filter((n) => n.type === "lane").every((n) => n.position.y >= 230)).toBe(true);
    expect(edges.find((e) => e.source === "page:inscricao")?.targetHandle).toBeUndefined();
  });

  it("um fluxo de antes de haver sentido lê-se na vertical, com as posições antigas a recomeçar", () => {
    expect(readCanvas({ nodes, positions: { "hub:webinar": { x: 9, y: 9 } } })).toEqual({ nodes, positions: {}, orientation: "vertical" });
    const kept = { nodes, positions: { "hub:webinar": { x: 9, y: 9 } }, orientation: "horizontal" };
    expect(readCanvas(kept)).toEqual(kept);
  });

  it("a posição arrastada vale mais do que a automática, nos dois sentidos", () => {
    const at = { x: 777, y: 333 };
    for (const orientation of ["vertical", "horizontal"] as const)
      expect(build({ nodes, positions: { "hub:webinar": at }, orientation }).nodes.find((n) => n.id === "hub:webinar")?.position).toEqual(at);
  });

  it("um fluxo vazio só tem a espinha e o cartão para começar, ao lado da inscrição", () => {
    const { nodes: out, edges } = build({ nodes: [], positions: {}, orientation: "vertical" }, [] as never, noop);
    expect(out.some((n) => n.type === "lane")).toBe(false);
    const empty = out.find((n) => n.id === "empty")!;
    expect(empty.position.y).toBe(out.find((n) => n.id === "hub:inscricao")!.position.y);
    expect(edges.some((e) => e.source === "hub:inscricao" && e.target === "empty")).toBe(true);
    // Com automações, o cartão sai.
    expect(build({ nodes: [], positions: {}, orientation: "vertical" }, automations, noop).nodes.some((n) => n.id === "empty")).toBe(false);
  });

  it("as três partes do lançamento têm o seu rótulo antes do primeiro momento, e o «Quando» só aparece onde há vários gatilhos", () => {
    for (const orientation of ["vertical", "horizontal"] as const) {
      const out = build({ nodes, positions: {}, orientation }).nodes;
      const at = (id: string) => out.find((n) => n.id === id)!.position;
      expect(out.filter((n) => n.type === "phase").map((n) => n.id)).toEqual(["phase:Novas pessoas", "phase:No dia do evento", "phase:Depois do evento"]);
      const axis = orientation === "vertical" ? "y" : "x";
      expect(at("phase:Novas pessoas")[axis]).toBeLessThanOrEqual(at("page:inscricao")[axis]);
      expect(at("phase:No dia do evento")[axis]).toBeLessThanOrEqual(at("hub:webinar")[axis]);
      expect(at("phase:Depois do evento")[axis]).toBeLessThanOrEqual(at("hub:fim")[axis]);
    }
    const lanes = build({ nodes, positions: {}, orientation: "vertical" }).nodes.filter((n) => n.type === "lane");
    const shows = (name: string) => (lanes.find((n) => (n.data as { automation: { name: string } }).automation.name === name)!.data as { showTrigger: boolean }).showTrigger;
    expect(shows("Aquecimento")).toBe(false);
    expect(shows("Sessão começou")).toBe(true);
  });

  it("os grupos de WhatsApp ficam lado a lado, todos ligados ao que vem antes e depois", () => {
    const groups: Canvas["nodes"] = [
      { id: "g1", kind: "group", name: "Grupo 1", url: "" },
      { id: "g2", kind: "group", name: "Grupo 2", url: "" },
    ];
    const { nodes: out, edges } = build({ nodes: groups, positions: {}, orientation: "vertical" });
    const [a, b] = out.filter((n) => n.type === "waGroup");
    expect(a!.position.y).toBe(b!.position.y);
    expect(a!.position.x).toBeLessThan(b!.position.x);
    for (const g of [a!, b!]) {
      expect(edges.some((e) => e.source === "page:inscricao" && e.target === g.id)).toBe(true);
      expect(edges.some((e) => e.source === g.id && e.target === "hub:inscricao")).toBe(true);
    }
  });
});
