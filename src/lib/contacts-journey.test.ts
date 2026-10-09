import { describe, expect, it } from "vitest";

import type { ContactSummary, JourneyStep } from "./contacts";
import {
  contactFile,
  filterContacts,
  journeyPath,
  launchCards,
  launchLabel,
  latestTheme,
  originText,
  sourceRowsOf,
  stageCountsOf,
  themeGroups,
} from "./contacts-journey";
import type { WebinarParticipation } from "./support/context";

function contact(over: Partial<ContactSummary>): ContactSummary {
  return {
    checkout_abandoned: false,
    checkout_started: false,
    clicked_offer: false,
    created_at: "2026-09-01T00:00:00Z",
    email: "ana@exemplo.pt",
    events_attended: 0,
    events_registered: 0,
    first_campaign: null,
    first_seen_at: null,
    first_source: "direto",
    id: "c1",
    last_seen_at: "2026-09-25T12:00:00Z",
    list_ids: [],
    messages: 0,
    name: "Ana Martins",
    organization_id: "o1",
    payment_failed: false,
    phone: null,
    purchases: 0,
    reached_offer: false,
    source: "registration",
    stage: "new",
    watched_seconds: 0,
    webinar_ids: [],
    ...over,
  };
}

function participation(over: Partial<WebinarParticipation>): WebinarParticipation {
  return {
    participantId: "p1",
    webinarId: "w1",
    title: "Fórmula Digital",
    at: "2026-09-20T20:00:00Z",
    attended: true,
    watchedPct: 60,
    watchedSeconds: 1800,
    reachedOffer: false,
    clicked: false,
    checkout: false,
    paymentFailed: false,
    checkoutAbandoned: false,
    purchased: false,
    refunded: false,
    messages: 0,
    ...over,
  };
}

const step = (over: Partial<Extract<JourneyStep, { kind: "event" }>>): JourneyStep => ({
  kind: "event",
  at: "2026-09-20T20:00:00Z",
  id: "p1",
  title: "Fórmula Digital",
  mode: "live",
  attended: true,
  watchedSeconds: 1800,
  watchMeasured: true,
  entrySeconds: 0,
  peakSeconds: 1800,
  durationSeconds: 3600,
  watchedPct: 50,
  offerAtPct: 75,
  reachedOffer: false,
  clicked: false,
  clickedAt: null,
  clickedAtSecond: null,
  messages: 0,
  ...over,
});

describe("originText", () => {
  it("diz a origem e a campanha, sem repetir o site", () => {
    expect(
      originText({ utm_source: "instagram", utm_campaign: "out-26", referrer: "https://l.instagram.com/x" }),
    ).toBe("Instagram · out-26");
  });
  it("sem UTM, usa o site de onde veio", () => {
    expect(originText({ utm_source: null, utm_campaign: null, referrer: "https://www.youtube.com/watch" })).toBe(
      "youtube.com",
    );
  });
  it("sem nada, é directo", () => {
    expect(originText({ utm_source: null, utm_campaign: null, referrer: null })).toBe("Directo");
  });
});

describe("launchCards", () => {
  it("junta a inscrição, a presença e a origem pelo id da inscrição", () => {
    const [card] = launchCards(
      [participation({ clicked: true })],
      [step({ entrySeconds: 600, peakSeconds: 2880, clickedAtSecond: 2900, mode: "replay" })],
      [
        {
          id: "p1",
          webinar_id: "w1",
          joined_at: "2026-09-20T19:55:00Z",
          registration_source: "embed",
          utm_source: "facebook",
          utm_campaign: null,
          referrer: null,
        },
      ],
    );
    expect(card).toMatchObject({
      mode: "replay",
      bar: { from: 17, to: 80, offerAt: 75 },
      outcome: { label: "Clicou na oferta" },
      origin: "Facebook",
      via: "Formulário noutro site",
      clickedAtSecond: 2900,
    });
  });

  it("sem presença não há barra, e o desfecho mais forte ganha", () => {
    const cards = launchCards(
      [
        participation({ participantId: "p1", attended: false, watchedSeconds: 0, at: "2026-09-01T00:00:00Z" }),
        participation({ participantId: "p2", clicked: true, paymentFailed: true, at: "2026-09-10T00:00:00Z" }),
      ],
      [step({ id: "p1" })],
      [],
    );
    expect(cards.map((c) => c.outcome.label)).toEqual(["Pagamento falhou", "Não apareceu"]);
    expect(cards[1]!.bar).toBeNull();
    expect(cards[0]!.origin).toBeNull();
  });
});

describe("journeyPath", () => {
  it("marca o que falhou: inscrito que não apareceu", () => {
    expect(journeyPath(contact({ events_registered: 1 })).map((s) => s.state)).toEqual([
      "done",
      "bad",
      "todo",
      "todo",
      "todo",
      "todo",
    ]);
  });
  it("pagamento falhado fica a vermelho no fim", () => {
    const path = journeyPath(
      contact({
        events_registered: 1,
        events_attended: 1,
        reached_offer: true,
        clicked_offer: true,
        checkout_started: true,
        payment_failed: true,
      }),
    );
    expect(path.at(-1)).toEqual({ key: "bought", state: "bad" });
    expect(path[4]!.state).toBe("done");
  });
});

describe("temas", () => {
  it("o tema é o do caso mais recente", () => {
    expect(
      latestTheme([
        { intent: "access", created_at: "2026-09-01T00:00:00Z" },
        { intent: "payment", created_at: "2026-09-05T00:00:00Z" },
        { intent: null, created_at: "2026-09-09T00:00:00Z" },
      ]),
    ).toBe("payment");
    expect(latestTheme([])).toBeNull();
  });

  it("agrupa pessoas distintas por tema, o maior primeiro", () => {
    const groups = themeGroups([
      { contact_id: "a", intent: "payment" },
      { contact_id: "a", intent: "payment" },
      { contact_id: "b", intent: "access" },
      { contact_id: "c", intent: "access" },
      { contact_id: null, intent: "access" },
      { contact_id: "d", intent: null },
    ]);
    expect(groups.map((g) => [g.id, g.contactIds.length])).toEqual([
      ["access", 2],
      ["payment", 1],
    ]);
    expect(groups[1]!.label).toBe("Pagamento");
  });
});

describe("filtros locais", () => {
  const rows = [
    contact({ id: "a", name: "Ana Martins", stage: "customer", purchases: 1, events_attended: 2, events_registered: 2 }),
    contact({ id: "b", name: "João Baptista", email: "joao@x.ao", stage: "checkout", events_attended: 1 }),
    contact({ id: "c", name: "Marta", stage: "no_show", events_registered: 1 }),
  ];

  it("conta cada pessoa numa só etapa, mais as que voltaram", () => {
    const counts = stageCountsOf(rows);
    expect(counts).toMatchObject({ all: 3, customer: 1, checkout: 1, no_show: 1, returning: 1, new: 0 });
  });

  it("soma as origens com as regras da base", () => {
    const sources = sourceRowsOf([
      ...rows,
      contact({ id: "d", first_source: "instagram", purchases: 1, checkout_started: true, stage: "customer" }),
    ]);
    expect(sources[0]).toMatchObject({ source: "direto", contacts: 3, customers: 1, checkout: 0 });
    expect(sources[1]).toMatchObject({ source: "instagram", contacts: 1, customers: 1, checkout: 1, reached_offer: 1 });
  });

  it("filtra por etapa e procura sem acentos", () => {
    expect(filterContacts(rows, { stage: null, search: "joao" }).map((c) => c.id)).toEqual(["b"]);
    expect(filterContacts(rows, { stage: "returning", search: "" }).map((c) => c.id)).toEqual(["a"]);
    expect(filterContacts(rows, { stage: "no_show", search: "" }).map((c) => c.id)).toEqual(["c"]);
  });
});

describe("launchLabel", () => {
  const titles: Record<string, string> = { w1: "Fórmula Digital", w2: "Tráfego Pago" };
  it("o último lançamento e quantos mais", () => {
    expect(launchLabel(["w1", "w2"], (id) => titles[id])).toBe("Tráfego Pago +1");
    expect(launchLabel(["w1"], (id) => titles[id])).toBe("Fórmula Digital");
    expect(launchLabel([], (id) => titles[id])).toBeNull();
  });
});

describe("contactFile", () => {
  it("monta a ficha com o que existe e esconde o e-mail da sala", () => {
    const file = contactFile({
      contact: contact({ email: "x@sala.local", stage: "customer", purchases: 1, first_source: "instagram", first_campaign: "out" }),
      context: {
        webinars: [participation({ purchased: true })],
        purchases: [{ id: "b1", title: "Fórmula", amount: "45 000 Kz", status: "approved", at: "2026-09-21T00:00:00Z" }],
        spent: [{ currency: "AOA", total: 45000 }],
        approvedPurchases: 1,
        cases: [{ id: "k1", number: 1, intent: "access", status: "open", created_at: "2026-09-22T00:00:00Z", resolved_at: null }],
      },
      steps: [step({})],
      origins: [],
      timeline: [
        { name: "purchase_approved", label: "Compra aprovada", at: "2026-09-21T00:00:00Z", webinarId: "w1", second: null, times: 1, detail: "Fórmula" },
        { name: "payment_failed", label: "O pagamento falhou", at: "2026-09-20T00:00:00Z", webinarId: "w1", second: null, times: 1, detail: "Fórmula Digital" },
      ],
      titles: new Map([["w1", "Fórmula Digital"]]),
      talks: [],
      place: "Luanda, Angola",
      device: "mobile",
    });
    expect(file.email).toBeNull();
    expect(file.customer).toBe("Cliente · 1 compra");
    expect(file.theme).toBe("Acesso");
    expect(file.firstOrigin).toBe("Instagram · out");
    expect(file.launches[0]!.outcome.label).toBe("Comprou");
    expect(file.totalPaid).toMatch(/45/);
    expect(file.activity[0]!.detail).toBe("Fórmula · Fórmula Digital");
    expect(file.activity[1]!.detail).toBe("Fórmula Digital");
  });

  it("sem contexto ainda, não inventa compras", () => {
    const file = contactFile({
      contact: contact({}),
      context: null,
      steps: [],
      origins: [],
      timeline: [],
      titles: new Map(),
      talks: [],
      place: "",
      device: "",
    });
    expect(file.launches).toEqual([]);
    expect(file.purchases).toEqual([]);
    expect(file.totalPaid).toBeNull();
    expect(file.place).toBeNull();
  });
});
