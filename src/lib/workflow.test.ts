import { describe, expect, it } from "vitest";

import {
  activationBlockers,
  audiences,
  stepLayout,
  baseWorkflow,
  branchQuestion,
  channelStatus,
  conditionsAtSend,
  conditionsHold,
  connect,
  duplicateNode,
  guardsHold,
  insertAfter,
  journeySentence,
  executedNodes,
  lateReminder,
  mergeGuard,
  missingLinks,
  movedTarget,
  moveNode,
  negate,
  nextAction,
  quietUntil,
  removeNode,
  renderMessage,
  sendLabel,
  sendMissing,
  stageOf,
  unreachable,
  validateSteps,
  waitLabel,
  waitTarget,
  walk,
  type ActionNode,
  type Steps,
  type WaitNode,
} from "./workflow";
import type { Condition } from "./automations";

const now = new Date("2026-10-01T18:00:00Z");
const session = { startsAt: "2026-10-01T20:00:00Z", endsAt: "2026-10-01T21:00:00Z" };
const find = (key: string) => baseWorkflow().find((a) => a.key === key)!;

describe("automação base", () => {
  it("nasce com o esqueleto pré-evento, evento e pós-evento, sem erros", () => {
    const base = baseWorkflow();
    expect(base.map((a) => a.name)).toEqual([
      "Aquecimento",
      "Lembretes",
      "Sessão começou",
      "Clicou e não comprou",
      "Não acessou",
      "Saiu antes do pitch",
      "Assistiu o pitch",
      "Checkout abandonado",
      "Pagamento falhou",
      "Pós-compra",
      "Reembolso",
    ]);
    expect(new Set(base.map((a) => stageOf(a.trigger_event)))).toEqual(new Set(["pre", "event", "post"]));
    for (const a of base) {
      expect(validateSteps(a.steps), a.name).toEqual([]);
      expect(unreachable(a.steps), a.name).toEqual([]);
    }
  });

  it("as mensagens nascem escritas a partir dos modelos do utilizador; o upsell fica por escrever", () => {
    expect(activationBlockers(find("aquecimento").steps, channelStatus(true, true))).toEqual([]);
    expect(activationBlockers(find("lembretes").steps, channelStatus(true, true))).toEqual([]);
    const posCompra = activationBlockers(find("pos-compra").steps, channelStatus(true, true));
    expect(posCompra).toHaveLength(1);
    expect(posCompra[0]).toContain("Upsell");
    // Os textos usam só variáveis que o motor preenche; o resto fica entre parênteses rectos.
    const known = new Set(["nome", "primeiro_nome", "email", "webinar", "data", "hora", "link", "link_oferta", "preco", "link_grupo", "link_replay", "produto"]);
    for (const a of baseWorkflow())
      for (const n of a.steps.nodes)
        if (n.kind === "action")
          for (const s of n.sends)
            for (const m of `${s.subject ?? ""} ${s.message ?? ""}`.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) expect(known.has(m[1]!), m[1]).toBe(true);
  });
});

describe("canais e destinos", () => {
  it("distingue individual de grupo e pede o que falta a cada um", () => {
    expect(sendLabel({ channel: "whatsapp", target: "contact" })).toBe("WhatsApp · individual");
    expect(sendLabel({ channel: "whatsapp", target: "group", group: "Webinar IA" })).toBe("WhatsApp · grupo Webinar IA");
    expect(sendMissing({ channel: "email", target: "contact", message: "Olá" })).toEqual(["assunto"]);
    expect(sendMissing({ channel: "whatsapp", target: "group", message: "Olá" })).toEqual(["grupo"]);
    expect(sendMissing({ channel: "webhook", target: "webhook" })).toEqual([]);
  });

  it("fora da conta de teste só o webhook e o WhatsApp ligado têm fornecedor", () => {
    const steps: Steps = {
      start: "a",
      nodes: [{ id: "a", kind: "action", sends: [{ channel: "sms", target: "contact", message: "Olá" }], next: null }],
    };
    expect(activationBlockers(steps, channelStatus(false, true))).toEqual(["SMS: sem fornecedor configurado"]);
    expect(activationBlockers(steps, channelStatus(true, false))).toEqual([]);
    const whatsapp: Steps = {
      start: "a",
      nodes: [{ id: "a", kind: "action", sends: [{ channel: "whatsapp", target: "contact", message: "Olá" }], next: null }],
    };
    expect(activationBlockers(whatsapp, channelStatus(false, true))).toEqual(["WhatsApp: sem fornecedor configurado"]);
    expect(activationBlockers(whatsapp, channelStatus(false, true, true))).toEqual([]);
  });

  it("preenche as variáveis da mensagem e deixa as desconhecidas", () => {
    expect(renderMessage("Olá {{primeiro_nome}}, hoje às {{hora}} {{x}}", { primeiro_nome: "Ana", hora: "20:00" })).toBe(
      "Olá Ana, hoje às 20:00 {{x}}",
    );
  });
});

describe("percurso de uma execução", () => {
  it("espera: pára na espera e retoma no passo seguinte à hora certa", () => {
    const r = walk(find("aquecimento").steps, "p2", { now, facts: {}, session, guards: [] });
    expect(r.status).toBe("next");
    expect(r.cursor).toBe("p3");
    // O convite para o grupo sai 1 dia depois do obrigado.
    expect(r.scheduledFor.toISOString()).toBe("2026-10-02T18:00:00.000Z");
  });

  it("espera relativa à sessão: 1 hora antes do início", () => {
    const steps = find("lembretes").steps;
    const r = walk(steps, "p9", { now, facts: {}, session, guards: [] });
    expect([r.cursor, r.scheduledFor.toISOString()]).toEqual(["p10", "2026-10-01T19:00:00.000Z"]);
  });

  it("um lembrete cuja hora já passou não sai (inscreveu-se tarde)", () => {
    const late = new Date("2026-10-01T19:30:00Z");
    const r = walk(find("lembretes").steps, "p1", { now: late, facts: {}, session, guards: [] });
    // 7 dias, 4 dias, amanhã, hoje às 9 e 1 hora antes já passaram: ficam de fora; falta o de 15 min.
    expect(r.cursor).toBe("p12");
    expect(r.scheduledFor.toISOString()).toBe("2026-10-01T19:45:00.000Z");
    expect(r.log.filter((l) => l.outcome.includes("já tinha passado"))).toHaveLength(5);
  });

  it("ramo: começou a pagar e ainda não comprou → sai a ajuda, com a condição do caminho guardada", () => {
    const r = walk(find("abandono").steps, "p2", { now, facts: { purchased: false }, session, guards: [] });
    expect(r.cursor).toBe("p3");
    expect(r.scheduledFor.toISOString()).toBe(now.toISOString());
    expect(r.guards).toEqual([{ fact: "purchased", value: false }]);
  });

  it("ramo: comprou → a jornada termina", () => {
    const r = walk(find("abandono").steps, "p2", { now, facts: { purchased: true }, session, guards: [] });
    expect(r.status).toBe("done");
  });

  it("quem não acessou recebe a gravação uma hora depois de a sessão terminar", () => {
    const r = walk(find("nao-acessou").steps, "p1", { now, facts: { entered: false, purchased: false }, session, guards: [] });
    expect(r.cursor).toBe("p2");
    expect(r.scheduledFor.toISOString()).toBe("2026-10-01T22:00:00.000Z");
  });

  it("o fecho do carrinho é no 4.º dia: «encerra hoje» às 9 e «última chamada» às 20", () => {
    const steps = find("assistiu").steps;
    const at = (wait: string) => walk(steps, wait, { now, facts: { reached_offer: true, purchased: false }, session, guards: [] });
    expect(at("p13")).toMatchObject({ cursor: "p14", scheduledFor: new Date("2026-10-05T09:00:00.000Z") });
    expect(at("p15")).toMatchObject({ cursor: "p16", scheduledFor: new Date("2026-10-05T20:00:00.000Z") });
  });

  it("cancelamento depois da compra: as condições do caminho deixam de se verificar", () => {
    const guards = [
      { fact: "attended" as const, value: true },
      { fact: "purchased" as const, value: false },
    ];
    expect(conditionsHold(guards, { attended: true, purchased: false })).toBe(true);
    expect(conditionsHold(guards, { attended: true, purchased: true })).toBe(false);
  });

  it("sem sessão (pagamento sem webinar), a espera relativa não se aplica", () => {
    const r = walk(find("lembretes").steps, "p1", { now, facts: {}, session: null, guards: [] });
    expect(r.status).toBe("done");
  });

  it("negar e juntar condições dos ramos", () => {
    expect(negate({ fact: "purchased", value: true })).toEqual({ fact: "purchased", value: false });
    expect(negate({ fact: "actual_watch_seconds", op: "gte", value: 60 })).toEqual({
      fact: "actual_watch_seconds",
      op: "lt",
      value: 60,
    });
    expect(mergeGuard([{ fact: "purchased", value: false }], { fact: "purchased", value: true })).toEqual([
      { fact: "purchased", value: true },
    ]);
  });
});

describe("edição", () => {
  const base: Steps = {
    start: "a",
    nodes: [
      { id: "a", kind: "action", sends: [], next: "b" },
      { id: "b", kind: "wait", mode: "delay", minutes: 5, next: null },
    ],
  };

  it("insere entre dois passos e retira religando", () => {
    const withC = insertAfter(base, "a", { id: "c", kind: "wait", mode: "delay", minutes: 1, next: null });
    expect(withC.nodes.find((n) => n.id === "a")).toMatchObject({ next: "c" });
    expect(withC.nodes.find((n) => n.id === "c")).toMatchObject({ next: "b" });
    const back = removeNode(withC, "c");
    expect(back.nodes.find((n) => n.id === "a")).toMatchObject({ next: "b" });
  });

  it("move um passo para cima e para baixo sem perder ligações", () => {
    const three: Steps = {
      start: "a",
      nodes: [
        { id: "a", kind: "action", sends: [], next: "b" },
        { id: "b", kind: "wait", mode: "delay", minutes: 5, next: "c" },
        { id: "c", kind: "action", sends: [], next: null },
      ],
    };
    const up = moveNode(three, "b", "up");
    expect(up.start).toBe("b");
    expect(up.nodes.map((n) => [n.id, n.kind === "branch" ? null : n.next])).toEqual([
      ["a", "c"],
      ["b", "a"],
      ["c", null],
    ]);
    expect(moveNode(up, "b", "down")).toEqual({ ...three, nodes: three.nodes });
    expect(validateSteps(up)).toEqual([]);
  });

  it("passos já executados não se apagam", () => {
    const ids = executedNodes([
      { cursor: "p5", status: "waiting", steps_log: [{ node: "p1", kind: "branch", at: "", outcome: "" }] },
      { cursor: "p9", status: "done", steps_log: [] },
    ]);
    expect([...ids].sort()).toEqual(["p1", "p5"]);
  });

  it("recusa ciclos e ligações a passos que não existem", () => {
    expect(validateSteps(connect(base, "b", "a"))).toContain("Os passos não podem formar um ciclo.");
    expect(validateSteps(connect(base, "b", "x"))[0]).toContain("não existe");
  });

  it("próxima acção de uma execução em espera", () => {
    const next = nextAction({
      status: "waiting",
      cursor: "p4",
      scheduled_for: "2026-10-01T20:00:00Z",
      steps_log: [],
      automations: { name: "Não acessou", trigger_event: "webinar_session_ended", steps: find("nao-acessou").steps },
    });
    expect(next).toEqual({ label: "Gravação: o que você perdeu", channels: "WhatsApp · individual", at: "2026-10-01T20:00:00Z" });
  });
});

describe("contexto para o Atendimento", () => {
  it("diz o que a pessoa fez e onde está, com a próxima acção", () => {
    const text = journeySentence(
      { registered: true, attended: true, sawOffer: true, clicked: false, checkout: true, paymentFailed: false, purchased: false },
      [{ name: "Checkout abandonado", next: { label: "Recuperar checkout", channels: "WhatsApp · individual", at: "2999-01-01T20:00:00Z" } }],
      () => "20:00",
    );
    expect(text).toBe(
      "Este contacto assistiu ao webinar, viu a oferta, iniciou o checkout e não comprou. Está actualmente em checkout abandonado. Próxima acção prevista: Recuperar checkout (WhatsApp · individual) às 20:00.",
    );
  });

  it("abandono e reembolso nunca passam por compra activa", () => {
    const base = { registered: true, attended: true, sawOffer: true, clicked: true, checkout: true, paymentFailed: false };
    expect(journeySentence({ ...base, purchased: false, checkoutAbandoned: true }, [], () => "")).toBe(
      "Este contacto assistiu ao webinar, clicou na oferta, iniciou o checkout, abandonou o pagamento e não comprou. Não está em nenhuma automação neste momento.",
    );
    expect(journeySentence({ ...base, purchased: false, refunded: true }, [], () => "")).toBe(
      "Este contacto assistiu ao webinar, clicou na oferta, iniciou o checkout e teve a compra reembolsada. Não está em nenhuma automação neste momento.",
    );
  });
});

describe("estados de comportamento do webinar", () => {
  it("entrada tardia é um minuto escolhido por quem configura; o ramo nega e confirma com os factos de agora", () => {
    const late = { fact: "entry_seconds", op: "gte", value: 600 } as const;
    expect(branchQuestion(late)).toBe("Entrou depois do minuto 10?");
    expect(negate(late)).toEqual({ ...late, op: "lt" });
    expect(conditionsHold([late], { entry_seconds: 720 })).toBe(true);
    expect(conditionsHold([late], { entry_seconds: null })).toBe(false);
    expect(branchQuestion({ fact: "no_show", value: true })).toBe("Não compareceu?");
    expect(conditionsHold([{ fact: "no_show", value: true }, { fact: "replay", value: false }], { no_show: true, replay: false })).toBe(true);
  });
});

/* ---------- Cenários do /code-review (2026-10-01) ---------- */

describe("condições do caminho com factos em falta", () => {
  it("ausente, false e true são três casos: só um valor conhecido e contrário cancela", () => {
    const guards = [{ fact: "purchased" as const, value: false }];
    expect(guardsHold(guards, {})).toBe(true); // ausente: sem prova de mudança
    expect(guardsHold(guards, null)).toBe(true);
    expect(guardsHold(guards, { purchased: false })).toBe(true);
    expect(guardsHold(guards, { purchased: true })).toBe(false); // comprou entretanto
  });

  it("as condições de entrada continuam estritas, como na base de dados", () => {
    expect(conditionsHold([{ fact: "purchased", value: false }], {})).toBe(false);
  });

  it("'Pagamento falhou' com factos {}: o ramo leva ao 'Não' e a mensagem continua de pé", () => {
    const steps = find("falha").steps;
    const w = walk(steps, steps.start, { now, facts: {}, session: null, guards: [] });
    expect(w).toMatchObject({ status: "next", cursor: "p2", guards: [{ fact: "purchased", value: false }] });
    expect(guardsHold(w.guards, {})).toBe(true);
  });

  it("minutos vistos em falta também não cancelam; conhecidos e abaixo, sim", () => {
    const guards = [{ fact: "actual_watch_seconds" as const, op: "gte" as const, value: 600 }];
    expect(guardsHold(guards, {})).toBe(true);
    expect(guardsHold(guards, { actual_watch_seconds: 120 })).toBe(false);
  });
});

describe("duplicar um ramo", () => {
  // Checkout abandonado: espera (p1) → «Comprou?» (p2) → mensagens.
  const flow = find("abandono").steps;

  it("a cópia fica logo a seguir ao original (no 'Sim'), sem mudar o início nem as outras ligações", () => {
    const copy = duplicateNode(flow, "p2");
    expect(copy.start).toBe("p1");
    const original = copy.nodes.find((n) => n.id === "p2")!;
    const dup = copy.nodes.find((n) => n.id === "p8")!;
    expect(original).toMatchObject({ yes: "p8", no: "p3" });
    expect(dup).toMatchObject({ kind: "branch", condition: { fact: "purchased", value: true }, yes: null, no: null });
    expect(validateSteps(copy)).toEqual([]);
    expect(unreachable(copy)).toEqual([]);
  });

  it("o percurso de quem passa pelo ramo não muda: a cópia faz a mesma pergunta e segue igual", () => {
    const copy = duplicateNode(flow, "p2");
    for (const facts of [{ purchased: true }, { purchased: false }, {}]) {
      const before = walk(flow, flow.start, { now, facts, session, guards: [] });
      const after = walk(copy, copy.start, { now, facts, session, guards: [] });
      expect(after.cursor).toBe(before.cursor);
      expect(after.status).toBe(before.status);
    }
  });

  it("ramo no início do fluxo: a cópia entra depois dele, não antes", () => {
    const start = find("falha").steps;
    const copy = duplicateNode(start, "p1");
    expect(copy.start).toBe("p1");
    expect(copy.nodes.find((n) => n.id === "p1")).toMatchObject({ yes: "p3", no: "p2" });
  });
});

describe("lembretes fora de horas", () => {
  const steps = find("lembretes").steps;

  it("a mensagem de '1 hora antes' com o cursor já nela não sai depois da hora", () => {
    const at = (minutesBeforeStart: number) => new Date(Date.parse(session.startsAt) - minutesBeforeStart * 60_000);
    expect(lateReminder(steps, "p10", at(60), session)).toBe(false); // à hora
    expect(lateReminder(steps, "p10", at(58), session)).toBe(false); // 2 min de atraso
    expect(lateReminder(steps, "p10", at(-30), session)).toBe(true); // 90 min de atraso, sessão já começou
    expect(lateReminder(steps, "p10", at(-30), null)).toBe(false); // sem sessão: a espera não se aplica
  });

  it("uma mensagem que não vem de uma espera antes da sessão nunca é 'fora de horas'", () => {
    expect(lateReminder(find("nao-acessou").steps, "p4", new Date("2030-01-01T00:00:00Z"), session)).toBe(false);
  });
});

describe("depois do webinar: quem não comprou entra numa de três automações", () => {
  const followUps = ["nao-acessou", "saiu-antes", "assistiu"].map(find);
  // Os exemplos do mapa de automação (passo 9): Rui nunca entrou, Ana entrou e saiu antes da oferta, Maria estava presente no pitch.
  const rui = { entered: false, reached_offer: false, purchased: false };
  const ana = { entered: true, reached_offer: false, purchased: false };
  const maria = { entered: true, reached_offer: true, purchased: false };
  const entersIn = (facts: Record<string, boolean>) => followUps.filter((a) => conditionsHold(a.conditions, facts)).map((a) => a.name);

  it("cada pessoa entra numa só, pela que lhe corresponde", () => {
    expect(entersIn(rui)).toEqual(["Não acessou"]);
    expect(entersIn(ana)).toEqual(["Saiu antes do pitch"]);
    expect(entersIn(maria)).toEqual(["Assistiu o pitch"]);
  });

  it("quem comprou não entra em nenhuma, e a compra a meio faz deixar de cumprir a entrada", () => {
    for (const person of [rui, ana, maria]) expect(entersIn({ ...person, purchased: true })).toEqual([]);
  });

  it("com a oferta logo no início do vídeo, quem nunca entrou continua a ser só «não acessou»", () => {
    // Oferta ao segundo zero: o ponto da oferta conta como atingido mesmo sem ter entrado.
    expect(entersIn({ entered: false, reached_offer: true, purchased: false })).toEqual(["Não acessou"]);
  });

  it("quem não acessou e depois vê a gravação continua a receber as mensagens; se comprar, param", () => {
    const a = find("nao-acessou");
    // A gravação conta no mesmo registo da pessoa: os factos da sessão passam a dizer que entrou e chegou à oferta.
    const sawRecording = { entered: true, reached_offer: true, purchased: false };
    expect(conditionsAtSend(a.trigger_event, a.conditions)).toEqual([{ fact: "purchased", value: false }]);
    expect(conditionsHold(conditionsAtSend(a.trigger_event, a.conditions), sawRecording)).toBe(true);
    expect(conditionsHold(conditionsAtSend(a.trigger_event, a.conditions), { ...sawRecording, purchased: true })).toBe(false);
  });

  it("durante a sessão tudo se volta a confirmar: quem entrou entretanto já não recebe o aviso de que começou", () => {
    const entry: Condition[] = [{ fact: "entered", value: false }];
    expect(conditionsAtSend("webinar_session_started", entry)).toEqual(entry);
  });

  it("as três começam quando a sessão termina e levam oito mensagens até ao fecho", () => {
    for (const a of followUps) {
      expect(a.trigger_event, a.name).toBe("webinar_session_ended");
      const labels = a.steps.nodes.filter((n) => n.kind === "action").map((n) => (n as ActionNode).label);
      expect(labels, a.name).toHaveLength(8);
      expect(labels.slice(-2), a.name).toEqual(["Encerra hoje", "Última chamada"]);
    }
  });
});

describe("audiences", () => {
  const steps = (key: string) => baseWorkflow().find((a) => a.key === key)!.steps;

  it("checkout abandonado: só quem não comprou recebe as três mensagens de recuperação", () => {
    expect(audiences(steps("abandono"))).toEqual([
      { who: [{ fact: "purchased", value: false }], channels: expect.arrayContaining(["email", "whatsapp"]), messages: 3 },
    ]);
  });

  it("uma sequência de quem não comprou diz para quem é: o segmento e sem compra", () => {
    const a = find("saiu-antes");
    expect(audiences(a.steps, a.conditions)).toEqual([
      {
        who: [
          { fact: "entered", value: true },
          { fact: "reached_offer", value: false },
          { fact: "purchased", value: false },
        ],
        channels: expect.arrayContaining(["email", "whatsapp"]),
        messages: 8,
      },
    ]);
  });

  it("sem ramos é um caminho só, para todos", () => {
    expect(audiences(steps("aquecimento"))).toEqual([{ who: [], channels: ["email"], messages: 2 }]);
  });
});

describe("stepLayout", () => {
  const steps = (key: string) => baseWorkflow().find((a) => a.key === key)!.steps;

  it("põe cada ramo na sua linha e as esperas nas legendas", () => {
    const { items, edges, rows } = stepLayout(steps("abandono"));
    const at = (id: string) => items.find((i) => i.node.id === id);
    // «Comprou → nada» não ocupa linha: a ajuda fica na mesma linha do «Comprou?».
    expect(rows).toBe(1);
    expect(at("p2")).toMatchObject({ col: 0, row: 0 });
    expect(at("p3")).toMatchObject({ col: 1, row: 0 });
    expect(at("p5")).toMatchObject({ col: 2, row: 0 });
    expect(edges.find((e) => e.from === "p2" && e.to === "p3")).toMatchObject({ handle: "no", label: "Não comprou" });
    // A espera de 45 minutos vai na legenda da ligação, não num cartão.
    expect(edges.find((e) => e.to === "p5")?.wait).toContain("45");
    expect(items.some((i) => i.node.kind === ("wait" as string))).toBe(false);
  });

  it("um caminho que volta a um passo já desenhado liga-se a ele sem o repetir", () => {
    const { items, edges } = stepLayout({
      start: "a",
      nodes: [
        { id: "a", kind: "branch", condition: { fact: "purchased", value: true }, yes: "b", no: "b" },
        { id: "b", kind: "action", sends: [], next: null },
      ],
    });
    expect(items.map((i) => i.node.id)).toEqual(["a", "b"]);
    expect(edges.filter((e) => e.to === "b")).toHaveLength(2);
  });
});

describe("hora do dia nas esperas (fuso do webinar)", () => {
  const LX = "Europe/Lisbon";
  // Sessão às 21:00 de Lisboa (20:00 UTC, verão), fim às 22:00.
  const s = { startsAt: "2026-07-10T20:00:00Z", endsAt: "2026-07-10T21:00:00Z" };
  const wait = (mode: WaitNode["mode"], minutes: number, time?: string): WaitNode => ({ id: "w", kind: "wait", mode, minutes, ...(time ? { time } : {}), next: "m" });

  it("1 dia antes da sessão, às 09:00: na véspera, às 09:00 de Lisboa", () => {
    expect(waitTarget(wait("before_session", 1440, "09:00"), now, s, LX)?.toISOString()).toBe("2026-07-09T08:00:00.000Z");
    expect(waitLabel(wait("before_session", 1440, "09:00"))).toBe("1 dia antes da sessão, às 09:00");
  });

  it("2 dias depois do fim, às 20:00: no dia certo, mesmo que a sessão acabe mais tarde do que as 20:00", () => {
    expect(waitTarget(wait("after_session", 2880, "20:00"), now, s, LX)?.toISOString()).toBe("2026-07-12T19:00:00.000Z");
  });

  it("depois do fim, às 20:00, numa sessão que acaba às 22:00: no dia seguinte (nunca antes do fim)", () => {
    expect(waitTarget(wait("after_session", 0, "20:00"), now, s, LX)?.toISOString()).toBe("2026-07-11T19:00:00.000Z");
  });

  it("até às 09:00 pedido às 15:00: às 09:00 do dia seguinte", () => {
    const at = new Date("2026-07-10T14:00:00Z"); // 15:00 em Lisboa
    expect(waitTarget(wait("delay", 0, "09:00"), at, null, LX)?.toISOString()).toBe("2026-07-11T08:00:00.000Z");
    expect(waitLabel(wait("delay", 0, "09:00"))).toBe("Até às 09:00");
  });

  it("no dia da sessão, às 09:00, numa sessão às 08:00: a mensagem não sai", () => {
    const early = { startsAt: "2026-07-10T07:00:00Z", endsAt: null };
    const steps: Steps = {
      start: "w",
      nodes: [wait("before_session", 0, "09:00"), { id: "m", kind: "action", sends: [{ channel: "webhook", target: "webhook" }], next: null }],
    };
    const r = walk(steps, "w", { now: new Date("2026-07-09T12:00:00Z"), facts: {}, session: early, guards: [], timeZone: LX });
    expect(r.status).toBe("done");
    expect(r.log[0]!.outcome).toMatch(/depois do início da sessão/);
  });

  it("hora inválida não se grava", () => {
    expect(validateSteps({ start: "w", nodes: [{ ...wait("delay", 0, "25:00"), next: null }] })).toContain("A hora da espera tem de ser HH:MM.");
  });
});

describe("a sessão mudou de hora", () => {
  const steps: Steps = {
    start: "w",
    nodes: [
      { id: "w", kind: "wait", mode: "before_session", minutes: 60, next: "m" },
      { id: "m", kind: "action", sends: [{ channel: "webhook", target: "webhook" }], next: null },
    ],
  };

  it("passou para mais tarde: a mensagem acompanha a hora nova", () => {
    const moved = { startsAt: "2026-10-01T22:00:00Z", endsAt: null };
    expect(movedTarget(steps, "m", new Date("2026-10-01T19:00:00Z"), moved)?.toISOString()).toBe("2026-10-01T21:00:00.000Z");
  });

  it("à hora certa: nada muda", () => {
    expect(movedTarget(steps, "m", new Date("2026-10-01T19:00:00Z"), session)).toBeNull();
  });
});

describe("horas de silêncio", () => {
  const LX = "Europe/Lisbon";
  const wa: ActionNode = { id: "m", kind: "action", sends: [{ channel: "whatsapp", target: "contact", message: "x" }], next: null };
  const steps = (node: ActionNode, wait?: WaitNode): Steps => ({ start: wait ? wait.id : node.id, nodes: wait ? [wait, node] : [node] });
  const night = new Date("2026-07-10T22:30:00Z"); // 23:30 em Lisboa
  const ctx = (extra: Partial<Parameters<typeof quietUntil>[2]> = {}) => ({ trigger: "checkout_abandoned", now: night, session: null, timeZone: LX, ...extra });

  it("WhatsApp individual às 23:30: fica para as 08:00 do dia seguinte", () => {
    expect(quietUntil(steps(wa), wa, ctx())?.toISOString()).toBe("2026-07-11T07:00:00.000Z");
  });

  it("às 06:00: fica para as 08:00 do mesmo dia", () => {
    expect(quietUntil(steps(wa), wa, ctx({ now: new Date("2026-07-11T05:00:00Z") }))?.toISOString()).toBe("2026-07-11T07:00:00.000Z");
  });

  it("de dia, só email, grupo, compra aprovada ou sessão a começar: sai já", () => {
    const email: ActionNode = { ...wa, sends: [{ channel: "email", target: "contact", subject: "x", message: "x" }] };
    const group: ActionNode = { ...wa, sends: [{ channel: "whatsapp", target: "group", group: "g", message: "x" }] };
    expect(quietUntil(steps(wa), wa, ctx({ now: new Date("2026-07-10T12:00:00Z") }))).toBeNull();
    expect(quietUntil(steps(email), email, ctx())).toBeNull();
    expect(quietUntil(steps(group), group, ctx())).toBeNull();
    expect(quietUntil(steps(wa), wa, ctx({ trigger: "purchase_approved" }))).toBeNull();
    expect(quietUntil(steps(wa), wa, ctx({ trigger: "webinar_session_started" }))).toBeNull();
  });

  it("hora escolhida por quem configurou, ou à volta de uma sessão nocturna: sai já", () => {
    const before: WaitNode = { id: "w", kind: "wait", mode: "before_session", minutes: 60, next: "m" };
    expect(quietUntil(steps(wa, before), wa, ctx())).toBeNull();
    const lateSession = { startsAt: "2026-07-10T23:00:00Z", endsAt: "2026-07-11T00:00:00Z" };
    expect(quietUntil(steps(wa), wa, ctx({ session: lateSession }))).toBeNull();
  });
});

describe("links nas mensagens", () => {
  it("um link usado e vazio: diz o que falta configurar", () => {
    expect(missingLinks(["Compre aqui: {{link_oferta}}", "{{ link_grupo }}"], { link_oferta: "", link_grupo: "https://chat.whatsapp.com/x" })).toEqual([
      "{{link_oferta}} (falta o link da oferta no webinar)",
    ]);
  });

  it("links não usados ou preenchidos: nada falta", () => {
    expect(missingLinks(["Olá {{primeiro_nome}}", undefined], { link_oferta: "" })).toEqual([]);
    expect(renderMessage("{{link_oferta}} por {{preco}}", { link_oferta: "https://pay.x/1", preco: "97 €" })).toBe("https://pay.x/1 por 97 €");
  });
});
