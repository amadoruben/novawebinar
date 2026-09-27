import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Base de dados simulada: cada tabela e operação responde o que o teste
 * definir, e fica o registo do que o receptor mandou gravar.
 */
type Result = { data: unknown; error: { message: string } | null };
type Write = { table: string; op: string; row: Record<string, unknown> };

let answers: Record<string, Result>;
let writes: Write[];

const OPS = ["insert", "update", "upsert", "delete"];

function query(table: string) {
  let op = "select";
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_, name: string) {
        if (name === "then") {
          const result = answers[`${table}.${op}`] ?? { data: null, error: null };
          return (ok: (value: Result) => unknown) => Promise.resolve(result).then(ok);
        }
        return (...args: unknown[]) => {
          if (OPS.includes(name)) {
            op = name;
            writes.push({ table, op, row: (args[0] ?? {}) as Record<string, unknown> });
          }
          return chain;
        };
      },
    },
  );
  return chain;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => query(table),
    rpc: async (name: string) => answers[`rpc.${name}`] ?? { data: null, error: null },
  },
}));

const { receiveIntegrationWebhook } = await import("./integrations.server");

const INTEGRATION = {
  id: "int-1",
  organization_id: "org-1",
  provider: "webhook",
  enabled: true,
  secret: "segredo",
};
const SALE = {
  id: "T-100",
  status: "approved",
  email: "joao@exemplo.com",
  name: "João",
  amount: 100,
};
const down = (message = "fetch failed"): Result => ({ data: null, error: { message } });

const send = (body: unknown = SALE, secret = "segredo") =>
  receiveIntegrationWebhook(
    "chave",
    new Request("https://app.test/api/public/hooks/chave", {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-secret": secret },
      body: JSON.stringify(body),
    }),
  );

const written = (table: string, op = "insert") =>
  writes.filter((w) => w.table === table && w.op === op);
const logged = () => written("integration_events").map((w) => w.row);

beforeEach(() => {
  writes = [];
  answers = {
    "integrations.select": { data: INTEGRATION, error: null },
    "rpc.upsert_contact": { data: "contact-1", error: null },
    "participants.select": { data: [], error: null },
    "real_purchase_events.insert": { data: { id: "purchase-1" }, error: null },
  };
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("webhook de venda: resposta à plataforma", () => {
  it("falha a ler a integração responde 503, nunca 404", async () => {
    answers["integrations.select"] = down();
    const response = await send();
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(written("real_purchase_events")).toHaveLength(0);
  });

  it("chave que não existe responde 404", async () => {
    answers["integrations.select"] = { data: null, error: null };
    expect((await send()).status).toBe(404);
  });

  it("segredo errado responde 401 e não guarda o pedido em bruto", async () => {
    const response = await send(SALE, "outro");
    expect(response.status).toBe(401);
    expect(logged()).toMatchObject([{ status: "rejected", payload: null }]);
    expect(written("real_purchase_events")).toHaveLength(0);
  });

  it("venda nova fica guardada, com o pedido em bruto no registo", async () => {
    const response = await send();
    expect(response.status).toBe(200);
    expect(written("real_purchase_events")).toMatchObject([
      {
        row: {
          external_id: "T-100",
          status: "approved",
          contact_id: "contact-1",
          organization_id: "org-1",
        },
      },
    ]);
    expect(logged()).toMatchObject([
      { status: "accepted", purchase_id: "purchase-1", payload: JSON.stringify(SALE) },
    ]);
  });
});

describe("webhook de venda: o mesmo evento duas vezes", () => {
  it("a repetição não cria segunda venda", async () => {
    answers["real_purchase_events.select"] = {
      data: {
        id: "purchase-1",
        status: "approved",
        amount_value: 100,
        currency: null,
        product_name: "",
        webinar_id: null,
      },
      error: null,
    };
    const response = await send();
    expect(response.status).toBe(200);
    expect(written("real_purchase_events")).toHaveLength(0);
    expect(written("real_purchase_events", "update")).toHaveLength(0);
    expect(logged()).toMatchObject([{ status: "ignored", purchase_id: "purchase-1" }]);
  });

  it("um reembolso avança o estado da venda que já existe", async () => {
    answers["real_purchase_events.select"] = {
      data: {
        id: "purchase-1",
        status: "approved",
        amount_value: 100,
        currency: null,
        product_name: "",
        webinar_id: null,
      },
      error: null,
    };
    const response = await send({ ...SALE, status: "refunded" });
    expect(response.status).toBe(200);
    expect(written("real_purchase_events")).toHaveLength(0);
    expect(written("real_purchase_events", "update")).toMatchObject([
      { row: { status: "refunded" } },
    ]);
  });
});

describe("webhook de venda: falhas nossas devolvem o evento à plataforma", () => {
  it.each([
    ["ler se a venda já existe", "real_purchase_events.select"],
    ["guardar o contacto", "rpc.upsert_contact"],
    ["ler as participações", "participants.select"],
    ["guardar a venda", "real_purchase_events.insert"],
  ])("falha a %s responde 503", async (_what, key) => {
    answers[key] = down();
    const response = await send();
    expect(response.status).toBe(503);
    expect(logged().at(-1)).toMatchObject({ status: "rejected", payload: JSON.stringify(SALE) });
  });

  it("sem contacto guardado, a venda não fica solta", async () => {
    answers["rpc.upsert_contact"] = down();
    await send();
    expect(written("real_purchase_events")).toHaveLength(0);
  });
});
