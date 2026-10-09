import { describe, expect, it } from "vitest";
import {
  agentToday,
  countTabs,
  inboxState,
  sortInbox,
  stripState,
  toInboxItem,
  webinarFilters,
  type InboxItem,
} from "./inbox";
import { handoffMessage, HANDOFF_DEFAULT } from "./routing";

const item = (id: string, over: Partial<InboxItem> = {}): InboxItem => ({
  id,
  name: id,
  channel: "webinar_chat",
  preview: "",
  lastFrom: "contact",
  at: "2026-10-08T10:00:00Z",
  webinarId: "w1",
  webinarTitle: "Fórmula Digital",
  state: "ai",
  intent: null,
  priority: null,
  sla: "none",
  hot: false,
  teamName: null,
  ownerName: null,
  ownerId: null,
  ...over,
});

describe("caixa do atendimento", () => {
  it("separa novas, com o agente e em atendimento", () => {
    expect(inboxState({ needs_human: false, ai_paused: false }, null)).toBe("ai");
    expect(inboxState({ needs_human: true, ai_paused: false }, null)).toBe("new");
    expect(inboxState({ needs_human: false, ai_paused: false }, { assigned_staff_id: null })).toBe(
      "new",
    );
    expect(inboxState({ needs_human: false, ai_paused: false }, { assigned_staff_id: "rui" })).toBe(
      "attending",
    );
  });

  it("resolvida sem devolver ao agente fica em pausa, fora de Novas e depois de quem espera", () => {
    // Ao resolver: needs_human = false, ai_paused = NOT give_back, e o caso fecha.
    expect(inboxState({ needs_human: false, ai_paused: true }, null)).toBe("paused");
    const items = [
      item("pausa", { state: "paused", lastFrom: "team", at: "2026-10-08T12:00:00Z" }),
      item("espera", { state: "new", lastFrom: "team", at: "2026-10-08T09:00:00Z" }),
      item("agente", { state: "ai", lastFrom: "ai", at: "2026-10-08T11:00:00Z" }),
    ];
    expect(countTabs(items)).toEqual({ all: 3, new: 1, ai: 1, attending: 0 });
    expect(sortInbox(items).map((i) => i.id)).toEqual(["espera", "pausa", "agente"]);
  });

  it("ordena por prioridade: prazo, urgência, vendas, por responder", () => {
    const sorted = sortInbox([
      item("agente-recente", { at: "2026-10-08T11:00:00Z" }),
      item("agente-venda", { hot: true, at: "2026-10-08T09:00:00Z" }),
      item("normal", { state: "new", priority: "normal", sla: "ok" }),
      item("atrasado", { state: "attending", priority: "low", sla: "breached" }),
      item("alta", { state: "new", priority: "high", sla: "ok" }),
      item("respondido", { state: "new", priority: "high", sla: "ok", lastFrom: "team" }),
    ]).map((i) => i.id);
    expect(sorted).toEqual([
      "atrasado",
      "alta",
      "respondido",
      "normal",
      "agente-venda",
      "agente-recente",
    ]);
  });

  it("entre iguais à espera, quem espera há mais tempo primeiro; sem ninguém antes de quem já tem pessoa", () => {
    const sorted = sortInbox([
      item("depois", { state: "new", at: "2026-10-08T10:05:00Z" }),
      item("antes", { state: "new", at: "2026-10-08T10:00:00Z" }),
      item("com-pessoa", { state: "attending", at: "2026-10-08T09:00:00Z" }),
    ]).map((i) => i.id);
    expect(sorted).toEqual(["antes", "depois", "com-pessoa"]);
  });

  it("sem caso, lê a intenção na última mensagem do contacto", () => {
    const base = {
      id: "c1",
      channel: "webinar_chat",
      last_sender_kind: "participant",
      last_message_at: "2026-10-08T10:00:00Z",
      needs_human: false,
      ai_paused: false,
      webinar_id: "w1",
      participants: { name: "Ana" },
      webinars: { public_title: "Fórmula Digital" },
    };
    const buy = toInboxItem(
      { ...base, last_message_preview: "Quero comprar, ainda tem vagas?" },
      null,
    );
    expect(buy).toMatchObject({ intent: "purchase", hot: true, state: "ai", sla: "none" });
    const ai = toInboxItem(
      { ...base, last_sender_kind: "ai_agent", last_message_preview: "Quero comprar" },
      null,
    );
    expect(ai.intent).toBeNull();
  });

  it("conta os separadores e os webinars", () => {
    const items = [
      item("a", { state: "new" }),
      item("b"),
      item("c", { state: "attending", webinarId: "w2", webinarTitle: "Tráfego" }),
    ];
    expect(countTabs(items)).toEqual({ all: 3, new: 1, ai: 1, attending: 1 });
    expect(webinarFilters(items)).toEqual([
      { id: "w1", title: "Fórmula Digital", count: 2 },
      { id: "w2", title: "Tráfego", count: 1 },
    ]);
  });
});

describe("faixa dos webinars", () => {
  const session = (state: "scheduled" | "live" | "finished", endMs: number | null = 2) =>
    ({ kind: "session", state, startMs: 1, endMs, lastEndedMs: null }) as const;
  it("usa o ciclo de vida: terminado sai, sem fim é «Iniciado»", () => {
    expect(stripState(session("finished"))).toBeNull();
    expect(stripState({ kind: "draft" })).toBeNull();
    expect(stripState(session("live"))).toBe("live");
    expect(stripState(session("live", null))).toBe("started");
    expect(stripState(session("scheduled"))).toBe("soon");
    expect(stripState({ kind: "jit", intervalMinutes: 15 })).toBe("running");
    expect(stripState({ kind: "on_demand" })).toBe("running");
  });
});

describe("o agente hoje", () => {
  const e = (name: string, conversation_id: string, minute: number) => ({
    name,
    conversation_id,
    occurred_at: `2026-10-09T10:${String(minute).padStart(2, "0")}:00Z`,
  });
  it("conta conversas, não respostas; passada depois da resposta não conta como resolvida", () => {
    expect(
      agentToday([
        e("ai_resolution", "a", 1),
        e("ai_resolution", "a", 2),
        e("ai_resolution", "a", 3),
        e("ai_resolution", "b", 1),
        e("ai_escalation", "b", 5),
        e("ai_escalation", "c", 1),
        e("ai_resolution", "c", 9),
      ]),
    ).toEqual({ resolved: 2, escalated: 2 });
  });
});

describe("passagem do agente", () => {
  it("diz quem continua: a pessoa e a equipa", () => {
    expect(handoffMessage(HANDOFF_DEFAULT, { team: "Financeiro", person: "Sara Lopes" })).toBe(
      `${HANDOFF_DEFAULT} Quem continua: Sara, da equipa Financeiro.`,
    );
    expect(handoffMessage("Já lhe respondem.", { team: "Formação" })).toBe(
      "Já lhe respondem. Quem continua: a equipa Formação.",
    );
    expect(handoffMessage("Já lhe respondem.", {})).toBe("Já lhe respondem.");
  });
});
