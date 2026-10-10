import { useEffect, useState } from "react";
import { liveSettings, roomFormat } from "@/lib/room-logic";

/*
 * Sala de teste (o 👁 do editor): mostra o que o organizador está a mudar, mesmo sem guardar. O editor
 * escreve o rascunho no armazenamento deste browser e a sala de teste junta-o por cima do que veio da
 * base. A sala pública nunca o lê, e nada disto chega à base.
 */

// ponytail: o armazenamento é de cada origem — o editor e a sala têm de estar no mesmo domínio. Com o admin
// noutro domínio (VITE_ADMIN_HOST, VITE_PUBLIC_APP_URL), o rascunho não chega e a sala de teste mostra o que está
// guardado; aí, passar o rascunho por postMessage (abrir o 👁 sem noopener).
export const roomDraftKey =(webinarId: string) => `cw:rascunho-sala:${webinarId}`;

/** Os campos do webinar que o editor muda e a sala mostra, com os nomes da sala. */
const DRAFT_FIELDS = [
  "public_title",
  "description",
  "host_name",
  "host_role",
  "host_avatar_url",
  "host_verified",
  "chat_pin_title",
  "room_theme",
  "room_theme_system",
  "cta_text",
  "cta_url",
  "cta_price_original",
  "cta_price_now",
  "cta_image_url",
  "cta_countdown_seconds",
  "cta_start_seconds",
  "cta_end_seconds",
  "extra_offers",
  "offer_deadline",
  "offer_countdown_end",
  "offer_utm",
  "sales_show_real",
  "sales_where",
  "registration_button_text",
  "registration_progress_enabled",
  "registration_progress_value",
  "registration_badge_text",
  "entry_fields",
  "registration_collect_phone",
  "registration_require_phone",
  "entry_card_color",
  "entry_button_color",
  "video_url",
  "video_provider",
  "duration_seconds",
] as const;

/** O webinar carregado com o rascunho por cima. Um rascunho estragado ou de outra versão não estraga a sala. */
export function applyRoomDraft<W extends object>(webinar: W, draft: unknown): W {
  if (typeof draft !== "object" || draft === null || Array.isArray(draft)) return webinar;
  const base = webinar as Record<string, unknown>;
  const d = draft as Record<string, unknown>;
  const next: Record<string, unknown> = { ...base };
  for (const key of DRAFT_FIELDS) {
    if (!(key in d) || !(key in base)) continue;
    const value = d[key];
    // Só entra o que tem o tipo do campo (ou vem vazio): um número onde a sala espera texto ficava de fora.
    if (value != null && base[key] != null && typeof value !== typeof base[key]) continue;
    next[key] = value;
  }
  if ("room_format" in base && "room_format" in d) next["room_format"] = roomFormat(d);
  if ("live" in base && typeof d["live"] === "object" && d["live"] !== null)
    next["live"] = liveSettings(d);
  return next as W;
}

export function writeRoomDraft(webinarId: string, draft: Record<string, unknown> | null) {
  try {
    if (draft) window.localStorage.setItem(roomDraftKey(webinarId), JSON.stringify(draft));
    else window.localStorage.removeItem(roomDraftKey(webinarId));
  } catch {
    // Armazenamento bloqueado: a sala de teste mostra o que está guardado, como antes.
  }
}

/** O rascunho deste webinar, sempre actual (o editor noutro separador muda-o ao vivo). `null` = não ler. */
export function useRoomDraft(webinarId: string | null | undefined): unknown {
  // O id vai junto: se o webinar mudar no mesmo componente, nenhuma renderização mostra o rascunho do anterior.
  const [draft, setDraft] = useState<{ id: string; value: unknown } | null>(null);
  useEffect(() => {
    if (!webinarId) return;
    const key = roomDraftKey(webinarId);
    const read = () => {
      try {
        setDraft({ id: webinarId, value: JSON.parse(window.localStorage.getItem(key) ?? "null") });
      } catch {
        setDraft({ id: webinarId, value: null });
      }
    };
    read();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === key) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [webinarId]);
  return webinarId && draft?.id === webinarId ? draft.value : null;
}
