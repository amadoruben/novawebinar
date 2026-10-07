import { isGroupLink, parseExtraOffers } from "@/lib/room-logic";

/**
 * O que o Agente sabe da oferta vem da etapa Oferta do editor (a mesma que a sala mostra), e não de
 * um campo escrito à mão: muda-se a oferta num só sítio e o Agente acompanha. Cada oferta só entra
 * depois de abrir na sala, para o Agente não dizer o preço antes do pitch.
 */

export type OfferColumns = {
  cta_text: string | null;
  cta_url: string | null;
  cta_price_original: string | null;
  cta_price_now: string | null;
  cta_start_seconds: number | null;
  offer_deadline: string | null;
  extra_offers: unknown;
};

const clock = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/** As linhas de conhecimento das ofertas já abertas no segundo `sessionMs` da sessão. */
export function offerKnowledge(webinar: OfferColumns, productName: string, sessionMs: number) {
  // Sem texto no botão, a oferta não aparece na sala.
  if (!webinar.cta_text?.trim()) return [];
  const main = {
    product: productName.trim(),
    priceFrom: webinar.cta_price_original ?? "",
    priceNow: webinar.cta_price_now ?? "",
    url: webinar.cta_url ?? "",
    start: webinar.cta_start_seconds ?? 0,
    deadline: webinar.offer_deadline,
    main: true,
  };
  const extras = parseExtraOffers(webinar.extra_offers).map((o) => ({ ...o, main: false }));
  // O número de cada oferta relâmpago é o do editor (1, 2, 3), abra ela antes ou depois da principal.
  return [main, ...extras]
    .map((o, i) => ({ ...o, i }))
    .filter((o) => sessionMs >= o.start * 1000)
    .map(({ i, ...o }) => {
      const group = isGroupLink(o.url);
      const name = o.product || (o.main ? "a oferta principal" : `a oferta relâmpago ${i}`);
      const price = o.priceNow ? `por ${o.priceNow}${o.priceFrom ? ` (em vez de ${o.priceFrom})` : ""}` : "sem preço indicado";
      const parts = [
        `${o.main ? "Oferta principal" : "Oferta relâmpago"}: ${name}, ${price}.`,
        group ? `O botão leva a um grupo (${o.url}).` : o.url ? `Link de compra: ${o.url}.` : "",
        `Abre na sala aos ${clock(o.start)}.`,
        o.deadline ? `Último dia para comprar: ${o.deadline}.` : "",
      ];
      return { label: o.main ? "Oferta principal" : `Oferta relâmpago ${i}`, text: parts.filter(Boolean).join(" ") };
    });
}
