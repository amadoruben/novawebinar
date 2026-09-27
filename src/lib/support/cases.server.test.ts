import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Base de dados em baixo: não saber se há um caso aberto nunca pode ser lido
 * como "não há caso", senão a IA responde por cima de uma pessoa da equipa.
 */
type Result = { data: unknown; error: { message: string } | null };
let answers: Record<string, Result>;
let inserts: string[];

vi.mock("@/integrations/supabase/client.server", () => {
  const query = (table: string) => {
    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_, name: string) {
          if (name === "then") {
            const result = answers[table] ?? { data: null, error: null };
            return (ok: (value: Result) => unknown) => Promise.resolve(result).then(ok);
          }
          return () => {
            if (name === "insert") inserts.push(table);
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
      rpc: async (name: string) => answers[`rpc.${name}`] ?? { data: null, error: null },
    },
  };
});

const { loadTeam, noteInbound } = await import("./cases.server");
const { handleParticipantMessage } = await import("@/lib/ai-agent/respond.server");

const down: Result = { data: null, error: { message: "fetch failed" } };
const message = {
  webinarId: "w-1",
  organizationId: "org-1",
  conversationId: "c-1",
  participantId: "p-1",
  participantName: "João Silva",
  text: "Quero o meu dinheiro de volta",
  sessionMs: 0,
};

beforeEach(() => {
  answers = {};
  inserts = [];
});

describe("atendimento com a base de dados em baixo", () => {
  it("caso aberto devolve o caso", async () => {
    answers["rpc.support_case_inbound"] = { data: "case-1", error: null };
    expect(await noteInbound("c-1")).toBe("case-1");
  });

  it("sem caso aberto devolve null", async () => {
    expect(await noteInbound("c-1")).toBeNull();
  });

  it("erro a verificar o caso aberto falha, não devolve 'sem caso'", async () => {
    answers["rpc.support_case_inbound"] = down;
    await expect(noteInbound("c-1")).rejects.toThrow("Caso aberto por verificar");
  });

  it("com a verificação falhada a IA não escreve nada ao participante", async () => {
    answers["rpc.support_case_inbound"] = down;
    await expect(handleParticipantMessage(message)).rejects.toThrow();
    expect(inserts).not.toContain("private_messages");
  });

  it("sem saber se a IA está em pausa na conversa, a IA não responde", async () => {
    answers["private_conversations"] = down;
    answers["support_routing_rules"] = { data: [{ intent: "other" }], error: null };
    await expect(handleParticipantMessage(message)).rejects.toThrow("Conversa por ler");
    expect(inserts).not.toContain("private_messages");
  });

  it("regras de encaminhamento por ler falham em vez de deixar passar um reembolso", async () => {
    answers["support_routing_rules"] = down;
    await expect(loadTeam("org-1")).rejects.toThrow("Equipa por ler");
  });
});
