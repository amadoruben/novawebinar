import { describe, expect, it } from "vitest";
import {
  EDITOR_STEPS,
  editorLoading,
  isoFromLocalInput,
  localInputFromIso,
  offerTiming,
  reviewToAnnounce,
  statusOnSave,
  stepFromSearch,
  webinarIssues,
  type DraftFields,
} from "./webinar-draft";

const base: DraftFields = {
  cta_url: "https://pagamento.exemplo/checkout",
  cta_text: "Quero entrar",
  cta_start_seconds: "1800",
  cta_end_seconds: "",
  schedule_mode: "single",
  recurrence_enabled: false,
  recurrence_start_time: "",
  scheduled_at: "2026-10-20T20:00",
};
const blocking = (draft: DraftFields, duration = 3600) =>
  webinarIssues(draft, { durationSeconds: duration }).filter((i) => i.blocking);

describe("minuto do pitch", () => {
  it("o minuto do pitch é quando a oferta aparece", () => {
    expect(offerTiming(base)).toEqual({ start: 1800, end: null });
  });

  it("com oferta e sem minuto, a oferta abre no início e conta como 0", () => {
    expect(offerTiming({ ...base, cta_start_seconds: "" }).start).toBe(0);
  });

  it("sem oferta não há minuto do pitch", () => {
    expect(
      offerTiming({ ...base, cta_url: "", cta_text: "", cta_start_seconds: "" }).start,
    ).toBeNull();
  });
});

describe("erros que impedem gravar", () => {
  it("uma oferta que desaparece antes de aparecer não grava e aponta para a Oferta", () => {
    expect(blocking({ ...base, cta_end_seconds: "1200" })).toEqual([
      expect.objectContaining({ step: "oferta", field: "cta_end_seconds" }),
    ]);
  });

  it("a oferta não abre depois do fim do vídeo", () => {
    expect(blocking({ ...base, cta_start_seconds: "4000" })).toEqual([
      expect.objectContaining({ step: "oferta", field: "cta_start_seconds" }),
    ]);
  });

  it("a oferta pode fechar depois do vídeo (a sala fica aberta), até um dia", () => {
    expect(blocking({ ...base, cta_end_seconds: "4000" })).toEqual([]);
    expect(blocking({ ...base, cta_end_seconds: String(3600 + 25 * 3600) })).toEqual([
      expect.objectContaining({ step: "oferta", field: "cta_end_seconds" }),
    ]);
  });

  it("sem duração do vídeo conhecida, só se verifica a ordem", () => {
    expect(blocking({ ...base, cta_start_seconds: "4000" }, 0)).toEqual([]);
  });

  it("um link da oferta inválido aponta para a Oferta, não para o Webinar", () => {
    expect(blocking({ ...base, cta_url: "nada que preste" })).toEqual([
      expect.objectContaining({ step: "oferta", field: "cta_url" }),
    ]);
  });

  it("uma oferta certa não tem erros", () => {
    expect(blocking(base)).toEqual([]);
  });
});

describe("avisos que deixam gravar", () => {
  it("data única sem data avisa na etapa Agenda", () => {
    const issues = webinarIssues({ ...base, scheduled_at: "" }, { durationSeconds: 3600 });
    expect(issues).toEqual([expect.objectContaining({ step: "agenda", blocking: false })]);
  });

  it("repetição sem hora de início avisa na etapa Agenda", () => {
    const issues = webinarIssues({ ...base, recurrence_enabled: true }, { durationSeconds: 3600 });
    expect(issues).toEqual([
      expect.objectContaining({ step: "agenda", field: "recurrence_start_time" }),
    ]);
  });
});

describe("estado ao gravar", () => {
  const scheduled = {
    status: "draft",
    scheduled_at: "2026-10-20T19:00:00Z",
    recurrence_enabled: false,
    schedule_mode: "single",
  };

  it("um webinar desligado com sessão marcada continua desligado", () => {
    expect(statusOnSave(scheduled, "scheduled")).toBe("draft");
    expect(statusOnSave({ ...scheduled, scheduled_at: null, schedule_mode: "jit" }, "live")).toBe(
      "draft",
    );
    expect(
      statusOnSave({ ...scheduled, scheduled_at: null, recurrence_enabled: true }, "scheduled"),
    ).toBe("draft");
  });

  it("um webinar novo, ainda sem sessão, liga-se ao receber a primeira data", () => {
    expect(statusOnSave({ ...scheduled, scheduled_at: null }, "scheduled")).toBe("scheduled");
  });

  it("um webinar ligado segue o agendamento", () => {
    expect(statusOnSave({ ...scheduled, status: "scheduled" }, "live")).toBe("live");
  });
});

describe("data única no fuso do webinar", () => {
  it("20h em Luanda é 19h UTC, seja qual for o fuso do browser", () => {
    expect(isoFromLocalInput("2026-10-20T20:00", "Africa/Luanda")).toBe("2026-10-20T19:00:00.000Z");
  });

  it("20h em Lisboa no inverno é 20h UTC", () => {
    expect(isoFromLocalInput("2026-12-01T20:00", "Europe/Lisbon")).toBe("2026-12-01T20:00:00.000Z");
  });

  it("mostra a hora gravada no fuso do webinar", () => {
    expect(localInputFromIso("2026-10-20T19:00:00Z", "Africa/Luanda")).toBe("2026-10-20T20:00");
  });

  it("vazio continua vazio", () => {
    expect(isoFromLocalInput("", "Africa/Luanda")).toBeNull();
    expect(localInputFromIso(null, "Africa/Luanda")).toBe("");
  });
});

describe("etapas do editor", () => {
  it("seguem a ordem nova: antes da sala, na sala, depois e lançar", () => {
    expect(EDITOR_STEPS.map((s) => s.id)).toEqual([
      "inicio",
      "entrada",
      "video",
      "audiencia",
      "chat",
      "oferta",
      "vendas",
      "automacoes",
      "agente",
      "agenda",
      "revisao",
    ]);
  });

  it("um endereço antigo abre a etapa onde o conteúdo ficou", () => {
    expect(stepFromSearch("login")).toBe("entrada");
    expect(stepFromSearch("design")).toBe("entrada");
    expect(stepFromSearch("webinar")).toBe("agenda");
    expect(stepFromSearch("integracoes")).toBe("inicio");
    expect(stepFromSearch("timeline")).toBe("video");
  });

  it("sem etapa ou com uma desconhecida abre o Início", () => {
    expect(stepFromSearch(undefined)).toBe("inicio");
    expect(stepFromSearch("nada")).toBe("inicio");
    expect(stepFromSearch("chat")).toBe("chat");
  });
});

describe("abrir um webinar já feito", () => {
  const loaded = { webinar: false, hydrated: true, workspace: false, organization: true, videos: false, comments: false };

  it("espera pelos vídeos da conta e pelos comentários antes de desenhar a etapa", () => {
    // O webinar chega primeiro; os vídeos vêm depois da conta. Desenhar já mostrava o Chat sem vídeo nem comentários.
    expect(editorLoading({ ...loaded, videos: true })).toBe(true);
    expect(editorLoading({ ...loaded, comments: true })).toBe(true);
    expect(editorLoading({ ...loaded, workspace: true, organization: false, videos: true })).toBe(true);
    expect(editorLoading({ ...loaded, hydrated: false })).toBe(true);
    expect(editorLoading(loaded)).toBe(false);
  });

  it("sem conta (leitura falhada) não espera para sempre pelos vídeos", () => {
    expect(editorLoading({ ...loaded, organization: false, videos: true })).toBe(false);
  });

  it("um chat gerado leva ao Chat uma só vez, não a cada abertura", () => {
    const ready = { status: "ready", drafts: [{}], seen: false };
    expect(reviewToAnnounce(ready)).toBe(true);
    expect(reviewToAnnounce({ ...ready, seen: true })).toBe(false);
    expect(reviewToAnnounce({ ...ready, seen: undefined })).toBe(true);
    expect(reviewToAnnounce({ ...ready, drafts: [] })).toBe(false);
    expect(reviewToAnnounce({ ...ready, status: "running" })).toBe(false);
    expect(reviewToAnnounce(undefined)).toBe(false);
    // Sem nada por mostrar, abre o Início.
    expect(stepFromSearch(undefined)).toBe("inicio");
  });
});
