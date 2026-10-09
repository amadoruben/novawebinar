import { describe, expect, it } from "vitest";
import { agentRoutes, groupByTeam, summarizeAgents, type AgentRowLite } from "./model";

const row = (over: Partial<AgentRowLite>): AgentRowLite => ({
  webinar_id: "w1",
  webinar_name: "Fórmula Digital",
  agent_name: "Equipa Edna",
  enabled: true,
  mode: "hibrido",
  permissions: {},
  escalation: {},
  updated_at: "2026-10-01T10:00:00Z",
  ...over,
});

describe("resumo do agente", () => {
  it("sem linhas: por configurar, com o nome e a mensagem por omissão", () => {
    const s = summarizeAgents([]);
    expect(s).toMatchObject({ state: "none", name: "Agente IA", webinars: [], modes: [] });
    expect(s.handoffMessage).toContain("equipa");
  });

  it("ligado num webinar e desligado noutro: só conta o que está ligado", () => {
    const s = summarizeAgents([
      row({ permissions: { negociar: true } }),
      row({ webinar_id: "w2", webinar_name: "Mentoria", enabled: false, mode: "automatico", permissions: { descontos: true } }),
    ]);
    expect(s.state).toBe("on");
    expect(s.modes).toEqual(["Controlo"]);
    expect(s.webinars).toEqual([
      { id: "w1", name: "Fórmula Digital", on: true },
      { id: "w2", name: "Mentoria", on: false },
    ]);
    expect(s.risky).toEqual(["Negociar preço"]);
    expect(s.does).toContain("Enviar link da oferta");
  });

  it("modo «desativado» antigo conta como desligado", () => {
    expect(summarizeAgents([row({ mode: "desativado" })]).state).toBe("off");
  });

  it("o webinar que segue o agente da conta herda o estado dele", () => {
    const s = summarizeAgents([
      row({ webinar_id: null, agent_name: "Conta", updated_at: "2026-10-02T00:00:00Z", escalation: { message: "Já passo." } }),
      row({ enabled: false, scope: "account" }),
    ]);
    expect(s.webinars[0]).toEqual({ id: null, name: "Todos os webinars", on: true });
    expect(s.webinars[1]?.on).toBe(true);
    expect(s.name).toBe("Conta");
    expect(s.handoffMessage).toBe("Já passo.");
  });
});

describe("a quem passa", () => {
  const teams = [
    { id: "vendas", name: "Vendas", isFallback: false },
    { id: "suporte", name: "Suporte", isFallback: true },
  ];

  it("sem equipa na regra vai para a que recebe o resto; prazo é o menor", () => {
    const r = agentRoutes(teams, [
      { intent: "refund", teamId: null, slaMinutes: 30, alwaysHuman: true },
      { intent: "purchase", teamId: "vendas", slaMinutes: 10, alwaysHuman: false },
      { intent: "checkout", teamId: "vendas", slaMinutes: 15, alwaysHuman: false },
      { intent: "technical", teamId: "apagada", slaMinutes: 20, alwaysHuman: false },
    ]);
    expect(r.routes[0]).toMatchObject({ intents: ["Compra", "Checkout"], slaMinutes: 10 });
    expect(r.routes[1]).toMatchObject({ intents: ["Problema técnico", "Reembolso"], slaMinutes: 20 });
    expect(r.alwaysHuman).toEqual(["Reembolso"]);
    expect(r.queue).toEqual([]);
  });

  it("sem equipa de recurso, o que não tem equipa fica na fila", () => {
    const r = agentRoutes([{ id: "vendas", name: "Vendas", isFallback: false }], [
      { intent: "other", teamId: null, slaMinutes: 30, alwaysHuman: false },
    ]);
    expect(r.queue).toEqual(["Outro"]);
  });
});

describe("pessoas por equipa", () => {
  it("equipas pela ordem, depois sem equipa e inactivos", () => {
    const groups = groupByTeam(
      [
        { id: "a", teamId: "vendas", active: true },
        { id: "b", teamId: null, active: true },
        { id: "c", teamId: "apagada", active: true },
        { id: "d", teamId: "vendas", active: false },
      ],
      [
        { id: "vendas", name: "Vendas", isFallback: false },
        { id: "suporte", name: "Suporte", isFallback: true },
      ],
    );
    expect(groups.map((g) => [g.label, g.people.map((p) => p.id)])).toEqual([
      ["Vendas", ["a"]],
      ["Suporte", []],
      ["Sem equipa", ["b", "c"]],
      ["Inactivos", ["d"]],
    ]);
  });
});
