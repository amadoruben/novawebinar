import { describe, expect, it } from "vitest";
import { LIVE_DEFAULTS } from "./room-logic";
import { applyRoomDraft } from "./room-draft";

const saved = {
  id: "w1",
  public_title: "Guardado",
  room_theme: "dark",
  room_theme_system: false,
  room_format: "webinar",
  live: { ...LIVE_DEFAULTS, links: {}, moments: [], offerColors: {} },
  cta_text: null as string | null,
  cta_start_seconds: 600 as number | null,
  video_url: "https://x/v.mp4" as string | null,
};

describe("rascunho da sala de teste", () => {
  it("sem rascunho fica o que está guardado", () => {
    expect(applyRoomDraft(saved, null)).toBe(saved);
    expect(applyRoomDraft(saved, "lixo")).toBe(saved);
    expect(applyRoomDraft(saved, [1, 2])).toBe(saved);
  });

  it("o que o editor mudou passa por cima", () => {
    const room = applyRoomDraft(saved, {
      public_title: "Por guardar",
      room_theme: "light",
      room_format: "live",
      cta_text: "Quero a vaga",
      cta_start_seconds: 90,
      live: { header: false, offerColor: "#16a34a" },
    });
    expect(room.public_title).toBe("Por guardar");
    expect(room.room_theme).toBe("light");
    expect(room.room_format).toBe("live");
    expect(room.cta_text).toBe("Quero a vaga");
    expect(room.cta_start_seconds).toBe(90);
    expect(room.live.header).toBe(false);
    expect(room.live.offerColor).toBe("#16A34A");
    expect(saved.public_title).toBe("Guardado");
  });

  it("nunca muda o id nem campos fora da lista, e ignora tipos errados", () => {
    const room = applyRoomDraft(saved, {
      id: "outro",
      slug: "x",
      public_title: 3,
      room_format: "zoom",
      cta_start_seconds: null,
    });
    expect(room.id).toBe("w1");
    expect("slug" in room).toBe(false);
    expect(room.public_title).toBe("Guardado");
    expect(room.room_format).toBe("webinar");
    expect(room.cta_start_seconds).toBe(null);
  });
});
