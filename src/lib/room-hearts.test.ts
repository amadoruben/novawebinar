import { describe, expect, it } from "vitest";
import { heartsBetween } from "./room-hearts";

describe("corações simulados", () => {
  it("são iguais para quem vê o mesmo segundo", () => {
    expect(heartsBetween("w1", 0, 600, false)).toEqual(heartsBetween("w1", 0, 600, false));
    expect(heartsBetween("w1", 0, 600, false)).not.toEqual(heartsBetween("w2", 0, 600, false));
  });

  it("partir o tempo em bocados dá os mesmos corações", () => {
    const whole = heartsBetween("w1", 0, 300, true).map((h) => h.id);
    const parts = [0, 1.3, 2.8, 50, 120.5, 300].slice(1).flatMap((to, i, all) => heartsBetween("w1", i === 0 ? 0 : all[i - 1]!, to, true));
    expect(parts.map((h) => h.id)).toEqual(whole);
  });

  it("em rajadas, sem exagero, e mais com a oferta aberta", () => {
    const calm = heartsBetween("w1", 0, 3600, false).length;
    const strong = heartsBetween("w1", 0, 3600, true).length;
    expect(calm).toBeGreaterThan(60); // ~1 rajada a cada 30 s
    expect(calm).toBeLessThan(700);
    expect(strong).toBeGreaterThan(calm * 2);
  });
});
