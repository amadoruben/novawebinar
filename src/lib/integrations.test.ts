import { describe, expect, it } from "vitest";

import { normalizeEvent, parseAmount } from "./integrations";

describe("normalizeEvent", () => {
  it("Kambafy: pagamento em kwanzas, teste e reembolso", () => {
    expect(
      normalizeEvent("kambafy", {
        event: "payment.success",
        email: "Cliente@Email.com",
        name: "João Silva",
        phone: "+244923456789",
        data: {
          order_id: "L830BCVWC",
          product_id: "0b6c-uuid",
          total_price: 5000.0,
          currency: "KZ",
          product_name: "Curso",
        },
      }),
    ).toEqual({
      productId: "0b6c-uuid",
      kind: "purchase",
      eventType: "payment.success",
      status: "approved",
      email: "cliente@email.com",
      name: "João Silva",
      phone: "+244923456789",
      product: "Curso",
      amountValue: 5000,
      currency: "AOA",
      externalId: "L830BCVWC",
    });
    expect(normalizeEvent("kambafy", { event: "test.webhook" }).kind).toBe("ignore");
    const refund = normalizeEvent("kambafy", {
      event: "refund.approved",
      data: { customer_email: "a@b.ao", order_id: "X1", amount: "5.000,00" },
    });
    expect(refund.kind === "purchase" && [refund.status, refund.email, refund.amountValue]).toEqual([
      "refunded",
      "a@b.ao",
      5000,
    ]);
  });

  it("Hotmart v2", () => {
    const e = normalizeEvent("hotmart", {
      event: "PURCHASE_APPROVED",
      data: {
        product: { name: "Product Name" },
        buyer: { email: "buyer@email.com", name: "Buyer", checkout_phone: "999999999" },
        purchase: { price: { value: 150.6, currency_value: "BRL" }, transaction: "HP02316330308193" },
      },
    });
    expect(e.kind === "purchase" && [e.status, e.amountValue, e.currency, e.externalId]).toEqual([
      "approved",
      150.6,
      "BRL",
      "HP02316330308193",
    ]);
    expect(normalizeEvent("hotmart", { event: "PURCHASE_CANCELED" }).kind).toBe("ignore");
  });

  it("Kiwify: valor em cêntimos", () => {
    const e = normalizeEvent("kiwify", {
      order_id: "94e9",
      order_status: "paid",
      webhook_event_type: "order_approved",
      Product: { product_name: "Example" },
      Customer: { full_name: "John Doe", email: "john@example.com", mobile: "+62301303531" },
      Commissions: { charge_amount: 4492, currency: "BRL" },
    });
    expect(e.kind === "purchase" && [e.status, e.amountValue, e.name]).toEqual(["approved", 44.92, "John Doe"]);
  });

  it("Eduzz: estado vem do evento, não de data.status", () => {
    const e = normalizeEvent("eduzz", {
      event: "myeduzz.invoice_chargeback",
      data: {
        id: "12345678",
        status: "paid",
        buyer: { name: "Alice", email: "alice@example.com", cellphone: "555" },
        paid: { currency: "BRL", value: 301.5 },
        items: [{ name: "Widget X" }],
      },
    });
    expect(e.kind === "purchase" && [e.status, e.product, e.amountValue]).toEqual(["refunded", "Widget X", 301.5]);
    expect(normalizeEvent("eduzz", { event: "ping" }).kind).toBe("ignore");
  });

  it("Stripe: cêntimos, moeda sem casas decimais e reembolso ligado pelo payment_intent", () => {
    const paid = normalizeEvent("stripe", {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          payment_intent: "pi_1",
          payment_status: "paid",
          amount_total: 1099,
          currency: "usd",
          customer_details: { email: "x@y.com", name: "X" },
        },
      },
    });
    expect(paid.kind === "purchase" && [paid.amountValue, paid.currency, paid.externalId]).toEqual([
      10.99,
      "USD",
      "pi_1",
    ]);
    const yen = normalizeEvent("stripe", {
      type: "checkout.session.completed",
      data: { object: { payment_status: "paid", amount_total: 500, currency: "jpy", payment_intent: "pi_2" } },
    });
    expect(yen.kind === "purchase" && yen.amountValue).toBe(500);
    const refund = normalizeEvent("stripe", {
      type: "charge.refunded",
      data: { object: { id: "ch_1", payment_intent: "pi_1", amount: 1099, currency: "usd" } },
    });
    expect(refund.kind === "purchase" && [refund.status, refund.externalId]).toEqual(["refunded", "pi_1"]);
  });

  it("Outra plataforma: campos simples e estado em português", () => {
    const e = normalizeEvent("webhook", { email: "a@b.pt", amount: "97,00", status: "pago", id: "7" });
    expect(e.kind === "purchase" && [e.status, e.amountValue, e.externalId]).toEqual(["approved", 97, "7"]);
    expect(normalizeEvent("webhook", { email: "a@b.pt", status: "cancelado" }).kind).toBe("ignore");
  });
});

describe("parseAmount", () => {
  it("aceita formatos comuns", () => {
    expect([parseAmount("5.000,00"), parseAmount("5000.00"), parseAmount("Kz 1 500"), parseAmount("")]).toEqual([
      5000, 5000, 1500, null,
    ]);
  });
});
