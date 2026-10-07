import { describe, expect, it } from "vitest";
import {
  activeOffer,
  offerDeadlinePassed,
  isGroupLink,
  roomFormat,
  liveSettings,
  followMomentAt,
  profileHandle,
  followWebLink,
  followAppLink,
  suggestFollowMoments,
  parseExtraOffers,
  buildFormatCurve,
  checkoutLink,
  clock,
  curveValueAt,
  discountPercent,
  entryPalette,
  inferAudienceFormat,
  offerCountdownLeft,
} from "@/lib/room-logic";

const ctx = { durationSeconds: 329, pitchSeconds: 311 };

describe("relógio", () => {
  it("minutos e segundos, e horas só a partir de uma hora", () => {
    expect(clock(65)).toBe("01:05");
    expect(clock(3665)).toBe("1:01:05");
    expect(clock(-3)).toBe("00:00");
  });
});

describe("audiência por formato", () => {
  it("toca no mínimo e no máximo escolhidos", () => {
    for (const format of ["dynamic", "cresce", "fala"] as const) {
      const curve = buildFormatCurve(format, 203, 600, ctx);
      expect(Math.min(...curve)).toBe(203);
      expect(Math.max(...curve)).toBe(600);
    }
  });

  it("cresce até à oferta e desce depois", () => {
    const curve = buildFormatCurve("cresce", 100, 500, ctx);
    expect(curveValueAt(curve, 311, 329)).toBeGreaterThan(curveValueAt(curve, 100, 329));
    expect(curveValueAt(curve, 329, 329)).toBeLessThan(curveValueAt(curve, 311, 329));
  });

  it("volta a reconhecer o formato a partir da curva gravada", () => {
    const engagementAt = (t: number) => (t < 120 ? 40 : 75);
    const withSpeech = { ...ctx, engagementAt };
    for (const format of ["dynamic", "cresce", "fala"] as const) {
      const curve = buildFormatCurve(format, 203, 600, withSpeech);
      expect(inferAudienceFormat("simulated", curve, withSpeech)).toBe(format);
    }
    expect(inferAudienceFormat("hybrid", [], ctx)).toBe("mista");
    expect(inferAudienceFormat("real", [], ctx)).toBe("real");
  });

  it("a curva antiga de 28 pontos lê-se como Dinâmica", () => {
    const old = [10, 40, 80, 90, 92, 95, 94, 93, 90, 85, 70, 60, 55, 52, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37];
    expect(inferAudienceFormat("simulated", old, ctx)).toBe("dynamic");
  });
});

describe("várias ofertas no tempo do vídeo", () => {
  const offer = (id: string, start: number, end: number | null) => ({
    id,
    start,
    end,
    product: id,
    priceFrom: "",
    priceNow: "",
    url: "https://x.pt",
    button: "Comprar",
    countdown: 0,
  });

  it("a especial até ao minuto 10 e depois a geral", () => {
    const offers = [offer("geral", 600, null), offer("especial", 311, 600)];
    expect(activeOffer(offers, 100)).toBeNull();
    expect(activeOffer(offers, 400)?.id).toBe("especial");
    expect(activeOffer(offers, 600)?.id).toBe("geral");
    expect(activeOffer(offers, 2000)?.id).toBe("geral");
  });

  it("uma oferta com fim fecha e, sem outra, não há oferta", () => {
    expect(activeOffer([offer("a", 10, 20)], 25)).toBeNull();
  });

  it("lê as ofertas gravadas e ignora as que não têm minuto", () => {
    const parsed = parseExtraOffers([{ start: 600, product: "Geral", url: "https://k.ao/x" }, { product: "sem minuto" }]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ start: 600, end: null, product: "Geral", button: "Quero entrar" });
  });

  it("o prazo fecha no dia seguinte ao escolhido, no fuso do webinar", () => {
    const at = Date.parse("2026-10-12T23:30:00Z"); // 13/10 00:30 em Luanda
    expect(offerDeadlinePassed("2026-10-12", "Africa/Luanda", at)).toBe(true);
    expect(offerDeadlinePassed("2026-10-12", "UTC", at)).toBe(false);
    expect(offerDeadlinePassed(null, "UTC", at)).toBe(false);
  });
});

describe("cores da entrada", () => {
  it("o texto ajusta-se ao fundo e ao botão", () => {
    expect(entryPalette("#FFFFFF", "#FFFFFF")).toMatchObject({ text: "#171717", buttonText: "#171717" });
    expect(entryPalette("#141414", "#E8440C")).toMatchObject({ text: "#FFFFFF", buttonText: "#FFFFFF" });
  });

  it("um código inválido volta às cores de origem", () => {
    expect(entryPalette("azul", "#12")).toMatchObject({ card: "#141414", button: "#E8440C" });
  });
});

describe("oferta", () => {
  it("desconto só com os dois preços e o segundo menor", () => {
    expect(discountPercent("50 000 Kz", "6 997 Kz")).toBe(86);
    expect(discountPercent("", "6 997 Kz")).toBeNull();
    expect(discountPercent("100", "120")).toBeNull();
  });

  it("o cronómetro começa quando a oferta abre", () => {
    expect(offerCountdownLeft(300, 100, 50)).toBe(300);
    expect(offerCountdownLeft(300, 100, 160)).toBe(240);
    expect(offerCountdownLeft(300, 100, 500)).toBe(0);
    expect(offerCountdownLeft(0, 100, 160)).toBe(0);
  });

  it("o link leva a origem, onde clicou, o minuto e quem é", () => {
    const link = new URL(
      checkoutLink("https://pay.kambafy.com/checkout/abc?x=1", {
        source: "facebook",
        medium: "cpc",
        campaign: "lancamento",
        place: "sala",
        seconds: 311,
        participant: "p1",
      }),
    );
    expect(link.searchParams.get("x")).toBe("1");
    expect(link.searchParams.get("utm_source")).toBe("facebook");
    expect(link.searchParams.get("utm_content")).toBe("sala-05m11s");
    expect(link.searchParams.get("cw")).toBe("p1");
  });

  it("sem anúncio a origem é convertewebinar, e não mexe no que o link já traz", () => {
    const link = new URL(
      checkoutLink("https://loja.pt/p?utm_source=newsletter", { place: "chat", seconds: 5 }),
    );
    expect(link.searchParams.get("utm_source")).toBe("newsletter");
    expect(link.searchParams.get("utm_medium")).toBe("webinar");
    expect(checkoutLink("javascript:alert(1)", { place: "sala", seconds: 0 })).toBe(
      "javascript:alert(1)",
    );
  });
});

describe("ofertas por grupo e prazo de cada oferta", () => {
  it("reconhece os links de grupo do WhatsApp e do Telegram", () => {
    expect(isGroupLink("https://chat.whatsapp.com/AbC123")).toBe(true);
    expect(isGroupLink("https://t.me/+grupo")).toBe(true);
    expect(isGroupLink("https://pay.kambafy.com/checkout/x")).toBe(false);
    expect(isGroupLink("")).toBe(false);
  });

  it("guarda o prazo de uma oferta seguinte só com uma data válida", () => {
    const [a, b] = parseExtraOffers([
      { start: 600, url: "https://chat.whatsapp.com/x", deadline: "2026-10-20" },
      { start: 900, url: "https://k.ao/y", deadline: "amanhã" },
    ]);
    expect(a!.deadline).toBe("2026-10-20");
    expect(b!.deadline).toBeNull();
  });
});

describe("formato da sala", () => {
  it("só é Live quando foi escolhido; o resto (e o que já existia) fica Webinar", () => {
    expect(roomFormat({ tone: "natural", room_format: "live" })).toBe("live");
    expect(roomFormat({ room_format: "outra" })).toBe("webinar");
    expect(roomFormat({})).toBe("webinar");
    expect(roomFormat(null)).toBe("webinar");
  });
});

describe("opções da sala", () => {
  it("lê o que foi gravado e completa o resto com o valor por omissão", () => {
    const live = liveSettings({
      room_format: "live",
      live: {
        desk: "vertical",
        badge: "blue",
        links: { instagram: " https://www.instagram.com/amadorubenn/ ", youtube: "", x: "y" },
        moments: [{ start: 130, end: 160 }, { start: 50, end: 40 }, { start: 10, end: 40 }],
        notify: false,
        hideFollowed: false,
        offerColor: "azul",
      },
    });
    expect(live.desk).toBe("vertical");
    expect(live.links).toEqual({ instagram: "https://www.instagram.com/amadorubenn/" });
    expect(live.moments).toEqual([{ start: 10, end: 40 }, { start: 130, end: 160 }]);
    expect(live.notify).toBe(false);
    expect(live.hideFollowed).toBe(false);
    // As cores gravadas por nome passam ao código hex; um código escreve-se em maiúsculas.
    expect(live.offerColor).toBe("#2563EB");
    expect(liveSettings(null)).toMatchObject({ desk: "horizontal", notify: true, hideFollowed: true, offerColor: "#E8440C" });
    expect(liveSettings({ live: { offerColor: "rosa" } }).offerColor).toBe("#E8440C");
    expect(liveSettings({ live: { offerColor: "#ff00aa" } }).offerColor).toBe("#FF00AA");
    expect(liveSettings({ live: { offerColor: "#ff00a" } }).offerColor).toBe("#E8440C");
  });

  it("o + Seguir só aparece dentro dos momentos", () => {
    const m = [{ start: 120, end: 150 }];
    expect(followMomentAt(m, 119)).toBe(false);
    expect(followMomentAt(m, 120)).toBe(true);
    expect(followMomentAt(m, 150)).toBe(false);
    expect(followMomentAt([], 10)).toBe(false);
  });

  it("tira o @ do link e no YouTube pede para subscrever", () => {
    expect(profileHandle("https://www.instagram.com/amadorubenn/")).toBe("@amadorubenn");
    expect(profileHandle("https://www.tiktok.com/@amadoruben?lang=pt")).toBe("@amadoruben");
    expect(followWebLink("youtube", "https://www.youtube.com/@amadorubenn")).toBe("https://www.youtube.com/@amadorubenn?sub_confirmation=1");
    expect(followWebLink("youtube", "https://www.youtube.com/@x?sub_confirmation=1")).toBe("https://www.youtube.com/@x?sub_confirmation=1");
    expect(followWebLink("instagram", "https://www.instagram.com/x/")).toBe("https://www.instagram.com/x/");
  });

  it("no Android abre a app no perfil, com o site como plano B; no resto fica o link", () => {
    const ig = followAppLink("instagram", "https://www.instagram.com/amadorubenn/", "android");
    expect(ig).toBe(
      "intent://www.instagram.com/_u/amadorubenn/#Intent;scheme=https;package=com.instagram.android;S.browser_fallback_url=https%3A%2F%2Fwww.instagram.com%2Famadorubenn%2F;end",
    );
    expect(followAppLink("tiktok", "https://www.tiktok.com/@x", "android")).toContain("package=com.zhiliaoapp.musically");
    expect(followAppLink("instagram", "https://www.instagram.com/x/", "ios")).toBe("https://www.instagram.com/x/");
    expect(followAppLink("instagram", "não é link", "android")).toBe("não é link");
  });

  it("sugere os minutos em que se pede para seguir e junta os que estão colados", () => {
    const lines = [
      { at: 12, text: "Boa noite a todos" },
      { at: 95, text: "Sigam-me no Instagram para não perderem nada" },
      { at: 110, text: "e inscrevam-se no canal" },
      { at: 400, text: "Me segue lá no TikTok" },
      { at: 500, text: "Vamos continuar a aula" },
    ];
    expect(suggestFollowMoments(lines)).toEqual([
      { start: 95, end: 140 },
      { start: 400, end: 430 },
    ]);
  });
});
