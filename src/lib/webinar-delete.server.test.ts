import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Só simulações: eliminar é destrutivo e estes testes nunca tocam numa base verdadeira. */
let deleted: string[];
let failOn: string | null;

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      delete: () => ({
        eq: async (column: string, id: string) => {
          if (table === failOn) return { error: { message: "timeout" } };
          deleted.push(`${table}.${column}=${id}`);
          return { error: null };
        },
      }),
    }),
  },
}));

const { DELETE_STEPS, deleteWebinarAsUser } = await import("./webinar-delete.server");

/** O cliente de quem pede: o que o RLS lhe deixa ver e o papel dele na organização. */
function userClient({ visible = true, support = false } = {}) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: visible ? { organization_id: "org-1" } : null,
            error: null,
          }),
        }),
      }),
    }),
    rpc: async () => ({ data: support, error: null }),
  } as unknown as SupabaseClient<Database>;
}

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  deleted = [];
  failOn = null;
});

describe("eliminar webinar", () => {
  it("apaga primeiro os dados volumosos e por fim o webinar", async () => {
    expect(await deleteWebinarAsUser(userClient(), ID)).toEqual({ ok: true });
    expect(deleted).toEqual([
      ...DELETE_STEPS.filter((s) => s.table !== "webinars").map(
        (s) => `${s.table}.webinar_id=${ID}`,
      ),
      `webinars.id=${ID}`,
    ]);
  });

  it("de outra organização: não apaga nada", async () => {
    await expect(deleteWebinarAsUser(userClient({ visible: false }), ID)).rejects.toThrow(
      "não encontrado",
    );
    expect(deleted).toEqual([]);
  });

  it("só de suporte: não apaga nada", async () => {
    await expect(deleteWebinarAsUser(userClient({ support: true }), ID)).rejects.toThrow("suporte");
    expect(deleted).toEqual([]);
  });

  it("pára no primeiro erro, não apaga o webinar e diz o que ficou", async () => {
    failOn = "participants";
    const result = await deleteWebinarAsUser(userClient(), ID);
    expect(result).toEqual({
      ok: false,
      error: "Não foi possível apagar inscritos.",
      remaining: ["inscritos", "comentários do chat", "o webinar e as configurações"],
    });
    expect(deleted.some((d) => d.startsWith("participants") || d.startsWith("webinars"))).toBe(
      false,
    );
  });

  it("tentar outra vez continua de onde parou", async () => {
    failOn = "participants";
    await deleteWebinarAsUser(userClient(), ID);
    failOn = null;
    expect(await deleteWebinarAsUser(userClient(), ID)).toEqual({ ok: true });
    expect(deleted.at(-1)).toBe(`webinars.id=${ID}`);
  });
});
