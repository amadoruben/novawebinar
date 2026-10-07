import { describe, expect, it } from "vitest";
import { offerKnowledge } from "./offer-knowledge";

const webinar = {
  cta_text: "Quero minha vaga",
  cta_url: "https://pay.kambafy.com/checkout/abc",
  cta_price_original: "50 000 Kz",
  cta_price_now: "15 000 Kz",
  cta_start_seconds: 300,
  offer_deadline: "2026-10-14",
  extra_offers: [{ id: "x", start: 600, product: "Grupo VIP", url: "https://chat.whatsapp.com/AbC" }],
};

describe("conhecimento da oferta para o Agente", () => {
  it("só conta as ofertas que já abriram na sala", () => {
    expect(offerKnowledge(webinar, "Mentoria", 299_000)).toEqual([]);
    const open = offerKnowledge(webinar, "Mentoria", 400_000);
    expect(open).toHaveLength(1);
    expect(open[0]?.text).toContain("Mentoria, por 15 000 Kz (em vez de 50 000 Kz)");
    expect(open[0]?.text).toContain("Link de compra: https://pay.kambafy.com/checkout/abc");
    expect(open[0]?.text).toContain("Último dia para comprar: 2026-10-14");
  });

  it("junta as ofertas relâmpago com o número do editor e diz quando o botão leva a um grupo", () => {
    const all = offerKnowledge(webinar, "Mentoria", 700_000);
    expect(all.map((o) => o.label)).toEqual(["Oferta principal", "Oferta relâmpago 1"]);
    expect(all[1]?.text).toContain("Grupo VIP, sem preço indicado");
    expect(all[1]?.text).toContain("O botão leva a um grupo");
  });

  it("sem texto no botão a oferta não está na sala, por isso o Agente não fala dela", () => {
    expect(offerKnowledge({ ...webinar, cta_text: "" }, "Mentoria", 700_000)).toEqual([]);
  });
});
