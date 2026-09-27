import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A sala aberta só se mantém se uma leitura falhada chegar ao browser como
 * erro. Se chegasse como "sessão não existe", a sala era substituída.
 */
type Result = { data: unknown; error: { message: string } | null; count?: number | null };
let answers: Record<string, Result>;
let inserts: string[];

vi.mock("@/integrations/supabase/client.server", () => {
  const query = (table: string) => {
    let op = "select";
    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_, name: string) {
          if (name === "then") {
            const result = answers[`${table}.${op}`] ?? { data: null, error: null };
            return (ok: (value: Result) => unknown) => Promise.resolve(result).then(ok);
          }
          return () => {
            if (name === "insert" || name === "update") {
              op = name;
              inserts.push(`${table}.${name}`);
            }
            return chain;
          };
        },
      },
    );
    return chain;
  };
  return {
    supabaseAdmin: {
      from: (table: string) => query(table),
      rpc: async () => ({ data: null, error: null }),
      storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) },
    },
  };
});

const { loadPublicRoom, loadRoomMessages, recordCta } = await import("./public-room.server");

const down: Result = { data: null, error: { message: "fetch failed" } };
const WEBINAR = {
  id: "w-1",
  organization_id: "org-1",
  public_title: "Sessão",
  status: "scheduled",
};
const PARTICIPANT = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  answers = { "webinars.select": { data: WEBINAR, error: null } };
  inserts = [];
});

describe("sala pública com a base de dados em baixo", () => {
  it("webinar que não existe devolve null", async () => {
    answers["webinars.select"] = { data: null, error: null };
    expect(await loadPublicRoom("nao-existe")).toBeNull();
  });

  it("falha a ler o webinar é erro, não 'sessão não encontrada'", async () => {
    answers["webinars.select"] = down;
    await expect(loadPublicRoom("sessao")).rejects.toThrow("indisponível");
  });

  it("falha a ler os comentários é erro, não uma sala sem chat", async () => {
    answers["scheduled_comments.select"] = down;
    await expect(loadPublicRoom("sessao")).rejects.toThrow("indisponível");
  });

  it("com tudo lido, a sala abre", async () => {
    answers["scheduled_comments.select"] = { data: [{ id: "c-1" }], error: null, count: 1 };
    const loaded = await loadPublicRoom("sessao");
    expect(loaded?.webinar.id).toBe("w-1");
    expect(loaded?.comments).toHaveLength(1);
  });

  it("falha a ler as mensagens é erro, não uma conversa vazia", async () => {
    answers["private_messages.select"] = down;
    await expect(loadRoomMessages(PARTICIPANT)).rejects.toThrow();
  });
});

describe("clique na oferta", () => {
  const click = () =>
    recordCta({ participantId: PARTICIPANT, eventType: "click", videoSecond: 10 });

  beforeEach(() => {
    answers["participants.select"] = {
      data: {
        id: PARTICIPANT,
        name: "João",
        email: "convidado@sala.local",
        webinar_id: "w-1",
        organization_id: "org-1",
      },
      error: null,
    };
  });

  it("clique guardado responde ok", async () => {
    expect(await click()).toEqual({ ok: true });
    expect(inserts).toContain("cta_events.insert");
  });

  it("clique que não ficou guardado é erro, para a sala repetir o envio", async () => {
    answers["cta_events.insert"] = down;
    await expect(click()).rejects.toThrow("indisponível");
  });

  it("falha a ler o participante é erro, não um clique ignorado", async () => {
    answers["participants.select"] = down;
    await expect(click()).rejects.toThrow("indisponível");
  });
});
