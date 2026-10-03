import { describe, expect, it } from "vitest";
import { baseWorkflow, readCanvas, type Canvas } from "@/lib/workflow";
import { buildFlow } from "./flow-map";

const automations = baseWorkflow().map((a, i) => ({ id: `a${i}`, name: a.name, active: false, trigger_event: a.trigger_event, conditions: a.conditions, steps: a.steps })) as never;
const noop = () => {};
const build = (canvas: Canvas) =>
  buildFlow({
    automations,
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
    expect(lanes).toHaveLength(9);
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
});
