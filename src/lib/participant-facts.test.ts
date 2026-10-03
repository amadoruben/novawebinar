import { describe, expect, it } from "vitest";
import { buildDropOff, buildRetention, watchedStep, funnelSummary, type FunnelFact } from "./participant-facts";

const fact = (over: Partial<FunnelFact>): FunnelFact => ({
  person_id: "ana",
  webinar_id: "w1",
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

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe("medição na sala", () => {
  it("só conta o avanço natural com a pessoa presente", () => {
    expect(watchedStep(null, 10, true)).toBe(0);
    expect(watchedStep(10, 11, true)).toBe(1);
    expect(watchedStep(10, 13, true)).toBe(3);
    // Reposicionamento, regresso à sala ou recuo não são tempo visto.
    expect(watchedStep(10, 1800, true)).toBe(0);
    expect(watchedStep(10, 9, true)).toBe(0);
    // Sala escondida e sem som.
    expect(watchedStep(10, 11, false)).toBe(0);
  });

  it("vê 1 min, salta para os 30 min e vê mais 1 min: 120 s vistos, não 1860", () => {
    let previous: number | null = null;
    let played = 0;
    for (const clock of [...range(0, 60), ...range(1800, 1860)]) {
      played += watchedStep(previous, clock, true);
      previous = clock;
    }
    expect(played).toBe(120);
  });
});

describe("contas sobre os factos", () => {
  it("cada pessoa conta uma vez por webinar e só quem assistiu entra no tempo médio", () => {
    const summary = funnelSummary([
      // A Ana entrou no telemóvel (40 s) e depois no computador (15 min).
      fact({ attended: false, actual_watch_seconds: 40, peak_seconds: 40 }),
      fact({ actual_watch_seconds: 900, peak_seconds: 900 }),
      // O Rui viu 30 s: inscrito, mas não assistiu.
      fact({ person_id: "rui", attended: false, actual_watch_seconds: 30, peak_seconds: 30, reached_pitch: true }),
      // A Eva viu o replay.
      fact({ person_id: "eva", viewing_mode: "replay", actual_watch_seconds: 300, peak_seconds: 300 }),
    ]);
    expect(summary.registered).toBe(3);
    expect(summary.attended).toBe(2);
    expect(summary.attendedLive).toBe(1);
    expect(summary.attendedReplay).toBe(1);
    expect(summary.averageWatchSeconds).toBe(600);
    // O Rui passou a posição do pitch mas não assistiu: não conta.
    expect(summary.reachedPitch).toBe(0);
  });

  it("chegar ao minuto N é posição; o tempo médio é tempo visto", () => {
    // Entrou aos 25 min numa sala sincronizada e viu 5 min.
    const summary = funnelSummary([fact({ entry_seconds: 1500, peak_seconds: 1800, actual_watch_seconds: 300 })]);
    expect(summary.milestones).toEqual([
      { minutes: 15, value: 1 },
      { minutes: 30, value: 1 },
      { minutes: 45, value: 0 },
      { minutes: 60, value: 0 },
    ]);
    expect(summary.averageWatchSeconds).toBe(300);
  });

  it("a curva conta cada pessoa só entre a entrada e o pico", () => {
    const people = [{ entrySeconds: 1200, peakSeconds: 3000 }];
    const at = (second: number) => buildRetention(people, 3600).find((p) => p.second === second)?.viewers;
    // Pontos de 90 em 90 s num vídeo de uma hora.
    expect([at(0), at(1170), at(1260), at(2970), at(3060)]).toEqual([0, 0, 1, 1, 0]);
    const exits = buildDropOff(people, 3600).filter((p) => p.exits > 0);
    expect(exits.map((p) => [p.second, p.exits, p.watching])).toEqual([[2970, 1, 1]]);
  });
});

describe("funil da oferta e da compra", () => {
  // Uma pessoa por cenário; os factos já vêm da base de dados por contacto e webinar.
  const summary = funnelSummary([
    fact({ person_id: "viu", saw_offer: true }),
    fact({ person_id: "clicou", saw_offer: true, clicked: true }),
    fact({ person_id: "checkout", saw_offer: true, clicked: true, checkout_started: true, checkout_abandoned: true }),
    fact({ person_id: "falhou", saw_offer: true, clicked: true, checkout_started: true, payment_failed: true }),
    // Duas participações do mesmo contacto no mesmo webinar: conta uma pessoa, uma compra.
    fact({ person_id: "comprou", saw_offer: true, clicked: true, checkout_started: true, purchased: true }),
    fact({ person_id: "comprou", attended: false, actual_watch_seconds: 20, purchased: true, checkout_started: true }),
    // Não assistiu: fica fora de todos os passos, mesmo tendo clicado.
    fact({ person_id: "ausente", attended: false, actual_watch_seconds: 10, clicked: true }),
  ]);

  it("cada passo conta pessoas que assistiram, uma vez cada", () => {
    expect(summary.registered).toBe(6);
    expect(summary.attended).toBe(5);
    expect([summary.sawOffer, summary.clicked, summary.checkout, summary.buyers]).toEqual([5, 4, 3, 1]);
    expect([summary.paymentFailed, summary.abandoned]).toEqual([1, 1]);
  });

  it("clicar não é comprar: a conversão é compradores ÷ quem assistiu", () => {
    expect(summary.conversion).toBe(20);
  });
});
