/**
 * Pixels de anúncios na sala pública: Meta, TikTok e Google. Três momentos:
 * visita (ao abrir), inscrição (Lead) e clique na oferta (InitiateCheckout).
 */
type Pixels = Partial<Record<"meta_pixel" | "tiktok_pixel" | "google_tag", string>>;
type Moment = "lead" | "checkout";

/* eslint-disable @typescript-eslint/no-explicit-any */
const w = () => window as any;

function script(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

let loaded: Pixels | null = null;

/** Carrega os pixels configurados uma única vez e regista a visita. */
export function loadPixels(pixels: Pixels) {
  if (loaded || typeof window === "undefined") return;
  loaded = pixels;

  if (pixels.meta_pixel) {
    const fbq: any = function (...args: unknown[]) {
      fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    w().fbq ??= fbq;
    w()._fbq ??= fbq;
    script("https://connect.facebook.net/en_US/fbevents.js");
    w().fbq("init", pixels.meta_pixel);
    w().fbq("track", "PageView");
  }

  if (pixels.tiktok_pixel) {
    // Fila oficial do TikTok: os métodos ficam guardados até o script carregar.
    const ttq: any = (w().ttq ??= []);
    w().TiktokAnalyticsObject = "ttq";
    ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    ttq.setAndDefer = (target: any, method: string) => {
      target[method] = (...args: unknown[]) => target.push([method, ...args]);
    };
    for (const method of ttq.methods) ttq.setAndDefer(ttq, method);
    const id = encodeURIComponent(pixels.tiktok_pixel);
    ttq._i = { [pixels.tiktok_pixel]: Object.assign([], { _u: "https://analytics.tiktok.com/i18n/pixel/events.js" }) };
    ttq._t = { [pixels.tiktok_pixel]: Date.now() };
    ttq._o = { [pixels.tiktok_pixel]: {} };
    script(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${id}&lib=ttq`);
    ttq.page();
  }

  if (pixels.google_tag) {
    w().dataLayer ??= [];
    w().gtag ??= function () {
      // eslint-disable-next-line prefer-rest-params
      w().dataLayer.push(arguments);
    };
    script(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(pixels.google_tag)}`);
    w().gtag("js", new Date());
    w().gtag("config", pixels.google_tag);
  }
}

export function trackPixels(moment: Moment) {
  if (!loaded) return;
  if (loaded.meta_pixel) w().fbq?.("track", moment === "lead" ? "Lead" : "InitiateCheckout");
  if (loaded.tiktok_pixel) w().ttq?.track?.(moment === "lead" ? "CompleteRegistration" : "InitiateCheckout");
  if (loaded.google_tag) w().gtag?.("event", moment === "lead" ? "generate_lead" : "begin_checkout");
}
/* eslint-enable @typescript-eslint/no-explicit-any */
