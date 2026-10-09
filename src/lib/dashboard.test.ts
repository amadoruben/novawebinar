import { describe, expect, it } from "vitest";
import {
  countryMix,
  deviceMix,
  entriesBetween,
  fromNow,
  funnelSteps,
  heroIssues,
  periodStart,
  pickHero,
  shortMoney,
  todaySummary,
  whenLabel,
  type TodayFact,
} from "./dashboard";
import { funnelSummary, type FunnelFact } from "./participant-facts";
import type { WebinarLifecycle } from "./schedule";

const fact = (over: Partial<FunnelFact> & { device?: string | null; country?: string | null }) => ({
  person_id: "p",
  webinar_id: "w",
  viewing_mode: "live",
  attended: true,
  actual_watch_seconds: 600,
  entry_seconds: 0,
  peak_seconds: 600,
  reached_pitch: false,
  duration_seconds: 3600,
  saw_offer: false,
  clicked: false,
  checkout_started: false,
  purchased: false,
  payment_failed: false,
  checkout_abandoned: false,
  refunded: false,
  ...over,
});

describe("periodStart", () => {
  it("conta os dias para trás e «Tudo» não tem início", () => {
    const now = Date.UTC(2026, 9, 9, 12);
    expect(periodStart("7d", now)).toBe(new Date(Date.UTC(2026, 9, 2, 12)).toISOString());
    expect(periodStart("all", now)).toBeNull();
  });
});

describe("pickHero", () => {
  const session = (state: "live" | "scheduled" | "finished", startMs: number): WebinarLifecycle => ({
    kind: "session",
    state,
    startMs,
    endMs: null,
    lastEndedMs: null,
  });

  it("a decorrer ganha a tudo; depois a próxima marcada; depois o sempre aberto", () => {
    const items = [
      { webinar: "fim", lifecycle: session("finished", 1) },
      { webinar: "depois", lifecycle: session("scheduled", 300) },
      { webinar: "antes", lifecycle: session("scheduled", 200) },
      { webinar: "jit", lifecycle: { kind: "jit", intervalMinutes: 15 } as WebinarLifecycle },
    ];
    expect(pickHero(items)).toMatchObject({ webinar: "antes", kind: "next" });
    expect(pickHero([...items, { webinar: "agora", lifecycle: session("live", 0) }])).toMatchObject({
      webinar: "agora",
      kind: "live",
    });
    expect(pickHero([items[0]!, items[3]!])).toMatchObject({ webinar: "jit", kind: "open" });
    expect(pickHero([items[0]!])).toMatchObject({ webinar: "fim", kind: "latest" });
    expect(pickHero([])).toBeNull();
  });

  it("sem nada activo, o último que não é rascunho; o rascunho só quando não há outro", () => {
    const draft = { webinar: "rascunho", lifecycle: { kind: "draft" } as WebinarLifecycle };
    const ended = { webinar: "fim", lifecycle: session("finished", 1) };
    expect(pickHero([draft, ended])).toMatchObject({ webinar: "fim", kind: "latest" });
    expect(pickHero([draft])).toMatchObject({ webinar: "rascunho", kind: "draft" });
  });
});

describe("heroIssues", () => {
  const onDemand = { kind: "on_demand" } as WebinarLifecycle;
  it("vídeo, automações e horário, como no editor; sem avisar enquanto carrega", () => {
    expect(heroIssues({ hasVideo: false, workflows: 0, lifecycle: onDemand }).map((i) => i.step)).toEqual([
      "video",
      "automacoes",
    ]);
    expect(heroIssues({ hasVideo: true, workflows: 2, lifecycle: onDemand }).map((i) => i.step)).toEqual(["agenda"]);
    expect(heroIssues({ hasVideo: true, workflows: null, lifecycle: onDemand })).toEqual([]);
  });
});

describe("whenLabel e fromNow", () => {
  const now = Date.UTC(2026, 9, 9, 10, 0);
  it("hoje, amanhã e outro dia, no fuso do webinar", () => {
    expect(whenLabel(Date.UTC(2026, 9, 9, 19), "Africa/Luanda", now)).toBe("Hoje às 20:00");
    expect(whenLabel(Date.UTC(2026, 9, 10, 13, 30), "Africa/Luanda", now)).toBe("Amanhã às 14:30");
    expect(whenLabel(Date.UTC(2026, 9, 16, 19), "Africa/Luanda", now)).toBe("Sex, 16 out às 20:00");
  });
  it("minutos, horas e dias", () => {
    expect(fromNow(now + 25 * 60_000, now)).toBe("daqui a 25 min");
    expect(fromNow(now + 3 * 3_600_000, now)).toBe("daqui a 3 h");
    expect(fromNow(now + 2 * 86_400_000, now)).toBe("daqui a 2 dias");
    expect(fromNow(now - 10 * 60_000, now)).toBe("há 10 min");
  });
});

describe("funnelSteps", () => {
  it("cada passo em relação aos inscritos e ao passo anterior", () => {
    const steps = funnelSteps(
      funnelSummary([
        fact({ person_id: "a", reached_pitch: true, clicked: true, checkout_started: true, purchased: true }),
        fact({ person_id: "b", reached_pitch: true, clicked: true }),
        fact({ person_id: "c", reached_pitch: true }),
        fact({ person_id: "d" }),
        fact({ person_id: "e", attended: false }),
      ]),
    );
    expect(steps.map((s) => [s.label, s.value, s.share, s.fromPrevious])).toEqual([
      ["Inscritos", 5, 1, null],
      ["Assistiram", 4, 0.8, 0.8],
      ["Chegaram ao pitch", 3, 0.6, 0.75],
      ["Clicaram na oferta", 2, 0.4, 2 / 3],
      ["Iniciaram o pagamento", 1, 0.2, 0.5],
      ["Compraram", 1, 0.2, 1],
    ]);
  });

  it("sem inscritos, tudo a zero sem dividir por zero", () => {
    expect(funnelSteps(funnelSummary([])).every((s) => s.share === 0 && s.fromPrevious === null)).toBe(true);
  });
});

describe("deviceMix e countryMix", () => {
  const facts = [
    fact({ person_id: "a", device: "desktop", country: "Angola" }),
    fact({ person_id: "a", device: "mobile", country: "Angola" }), // o mesmo, noutro aparelho
    fact({ person_id: "b", device: "mobile", country: "Portugal" }),
    fact({ person_id: "c", device: "mobile", country: " Angola " }),
    fact({ person_id: "d", device: null, country: null }),
    fact({ person_id: "e", device: "desktop", country: "Brasil", attended: false }), // não assistiu
  ];

  it("conta quem assistiu, uma vez por pessoa, e põe à parte quem não tem registo", () => {
    const d = deviceMix(facts);
    expect(d.rows.map((r) => [r.label, r.value])).toEqual([
      ["Computador", 1],
      ["Telemóvel", 2],
    ]);
    expect(d.unknown).toBe(1);
    expect(d.total).toBe(4);
  });

  it("países do maior para o menor, com a bandeira quando se conhece", () => {
    const c = countryMix(facts, 1);
    expect(c.rows.map((r) => [r.label, r.value, r.flag ?? null])).toEqual([
      ["Angola", 2, "🇦🇴"],
      ["Outros", 1, null],
    ]);
    expect(c.rows[0]!.share).toBeCloseTo(2 / 3);
    expect(c.unknown).toBe(1);
  });

  it("o mesmo país em inglês e em português conta numa linha, com bandeira e região", () => {
    const c = countryMix([
      fact({ person_id: "a", country: "Brazil" }),
      fact({ person_id: "b", country: "Brasil" }),
      fact({ person_id: "c", country: "United States" }),
      fact({ person_id: "d", country: "Portugal" }),
    ]);
    expect(c.rows.map((r) => [r.key, r.label, r.value, r.flag])).toEqual([
      ["BR", "Brasil", 2, "🇧🇷"],
      ["US", "Estados Unidos", 1, "🇺🇸"],
      ["PT", "Portugal", 1, "🇵🇹"],
    ]);
    expect(c.regions.map((r) => [r.label, r.value])).toEqual([
      ["América do Sul", 2],
      ["América do Norte e Central", 1],
      ["Europa", 1],
    ]);
  });
});

describe("todaySummary", () => {
  const start = Date.UTC(2026, 9, 9);
  const row = (over: Partial<TodayFact>): TodayFact => ({
    person_id: "p",
    contact_id: null,
    webinar_id: "w",
    webinar_title: "Aula",
    name: "Ana",
    device: "mobile",
    country: "Angola",
    city: "Luanda",
    joined_at: "2026-10-08T10:00:00Z",
    first_progress_at: null,
    last_progress_at: null,
    ...over,
  });

  it("quem esteve na sala hoje, uma vez, do mais recente para o mais antigo", () => {
    const t = todaySummary(
      [
        row({ person_id: "a", name: "Ana", last_progress_at: "2026-10-09T10:00:00Z" }),
        row({ person_id: "a", name: "Ana", webinar_title: "Outra", last_progress_at: "2026-10-09T12:00:00Z" }),
        row({ person_id: "b", name: "Bruno", joined_at: "2026-10-09T08:00:00Z", first_progress_at: "2026-10-09T11:00:00Z" }),
        row({ person_id: "c", name: "Carla", joined_at: "2026-10-09T09:00:00Z" }), // só se inscreveu
        row({ person_id: "e", name: "Eva", city: "Recife", country: "Brazil", last_progress_at: "2026-10-09T09:30:00Z" }),
        row({ person_id: "d", name: "Dino", last_progress_at: "2026-10-08T23:00:00Z" }), // foi ontem
      ],
      start,
    );
    expect(t.inRoom).toBe(3);
    expect(t.registered).toBe(2);
    expect(t.people.map((p) => [p.name, p.webinar, p.place])).toEqual([
      ["Ana", "Outra", "Luanda, Angola"],
      ["Bruno", "Aula", "Luanda, Angola"],
      ["Eva", "Aula", "Recife, Brasil"],
    ]);
  });
});

describe("entriesBetween", () => {
  it("junta os meses, tira repetidos e corta pela janela", () => {
    const e = (webinarId: string, startMs: number) => ({ webinarId, title: webinarId, startMs, timezone: "UTC" });
    const october = new Map([[9, [e("a", 100), e("b", 50)]]]);
    const november = new Map([[1, [e("c", 300), e("a", 100)]]]);
    expect(entriesBetween([october, november], 60, 300).map((x) => x.webinarId)).toEqual(["a"]);
    expect(entriesBetween([october, november], 0, 301).map((x) => x.webinarId)).toEqual(["b", "a", "c"]);
  });
});

describe("shortMoney", () => {
  it("curto a partir de 100 mil, inteiro abaixo, e moedas que não são ISO", () => {
    expect(shortMoney(1_250_000, "AOA").replace(/\s/g, " ")).toMatch(/^1,3 M/);
    expect(shortMoney(97, "EUR").replace(/\s/g, " ")).toBe("97 €");
    expect(shortMoney(10, "EURO")).toBe("10 EURO");
  });
});
