import { describe, expect, it } from "vitest";
import {
  conditionLabel,
  factsLabel,
  runOutcome,
  triggerOfOccurrence,
  waitLabel,
} from "./automations";

describe("condições da automação", () => {
  it("cada condição tem o nome que a interface mostra", () => {
    expect(conditionLabel({ fact: "attended", value: true })).toBe("Assistiu");
    expect(conditionLabel({ fact: "attended", value: false })).toBe("Não assistiu");
    expect(conditionLabel({ fact: "purchased", value: false })).toBe("Não comprou");
    expect(conditionLabel({ fact: "payment_failed", value: true })).toBe("Teve um pagamento falhado");
    expect(conditionLabel({ fact: "checkout_abandoned", value: true })).toBe("Abandonou o checkout");
    expect(conditionLabel({ fact: "actual_watch_seconds", op: "lt", value: 300 })).toBe("Viu menos de 5 min");
  });
});

describe("espera", () => {
  it("as opções têm nome, e um valor fora delas também", () => {
    expect(waitLabel(0)).toBe("Imediatamente");
    expect(waitLabel(120)).toBe("2 horas");
    expect(waitLabel(1440)).toBe("1 dia");
    expect(waitLabel(2880)).toBe("2 dias");
    expect(waitLabel(45)).toBe("45 minutos");
  });
});

describe("execuções em palavras", () => {
  const date = (iso: string) => iso.slice(11, 16);
  const run = { attempts: 0, error: null, result: null, scheduled_for: "2026-09-28T21:00:00Z" };

  it("a prova de porque entrou", () => {
    expect(
      factsLabel({
        attended: true,
        actual_watch_seconds: 720,
        purchased: false,
        payment_failed: false,
        checkout_abandoned: false,
        participations: 2,
      }),
    ).toBe("Assistiu · 12 min vistos · Não comprou · Sem pagamento falhado · Não abandonou o checkout · 2 entradas na sessão");
  });

  it("a aguardar, com a hora; depois de uma falha, a próxima tentativa", () => {
    expect(runOutcome({ ...run, status: "waiting" }, date)).toContain("a partir de 21:00");
    expect(runOutcome({ ...run, status: "waiting", attempts: 1, error: "HTTP 503" }, date)).toContain(
      "A tentativa 1 falhou (HTTP 503). Nova tentativa a partir de 21:00.",
    );
  });

  it("executada, falhada e cancelada dizem porquê", () => {
    expect(runOutcome({ ...run, status: "done", result: { http_status: 200 } }, date)).toBe(
      "Entregue ao webhook de saída (HTTP 200).",
    );
    expect(runOutcome({ ...run, status: "failed", attempts: 3, error: "O destino respondeu HTTP 500." }, date)).toBe(
      "O destino respondeu HTTP 500. Tentativas: 3.",
    );
    expect(runOutcome({ ...run, status: "cancelled", result: { cancelled: "inactive" } }, date)).toContain(
      "desligada",
    );
    expect(
      runOutcome(
        { ...run, status: "cancelled", result: { cancelled: "conditions", facts: { attended: true, purchased: true } } },
        date,
      ),
    ).toContain("Comprou");
  });
});

describe("gatilhos", () => {
  it("a ocorrência diz de que gatilho veio a execução", () => {
    expect(triggerOfOccurrence("webinar_session_ended:3f2a")).toBe("webinar_session_ended");
    expect(triggerOfOccurrence("purchase_approved:9c1d")).toBe("purchase_approved");
    expect(triggerOfOccurrence("checkout_abandoned:77aa")).toBe("checkout_abandoned");
    expect(triggerOfOccurrence("outra_coisa:1")).toBeNull();
  });

  it("uma execução numa conta de teste diz que foi simulada", () => {
    const run = { status: "done", attempts: 2, error: null, result: { http_status: 200, sandbox: true }, scheduled_for: "2026-09-28T21:00:00Z" };
    expect(runOutcome(run, (iso) => iso)).toContain("nada saiu da plataforma");
  });
});
