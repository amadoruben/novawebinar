import { describe, expect, it } from "vitest";
import { programmedAppearance, resolveTheme, roomAppearance, savedAppearance } from "./room-theme";

describe("tema da sala", () => {
  it("lê o que o editor grava", () => {
    expect(programmedAppearance({ room_theme: "light", room_theme_system: true })).toBe("system");
    expect(programmedAppearance({ room_theme: "light", room_theme_system: false })).toBe("light");
    expect(programmedAppearance({ room_theme: "dark", room_theme_system: false })).toBe("dark");
    expect(programmedAppearance({ room_theme: null, room_theme_system: null })).toBe("dark");
  });

  it("Automático segue o aparelho", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("sem escolha da pessoa vale o programado", () => {
    expect(roomAppearance("light", null)).toBe("light");
    // A chave antiga (só a escolha, para todas as salas) deixa de mandar.
    expect(roomAppearance("light", "dark")).toBe("light");
  });

  it("a escolha da pessoa vale enquanto o programado não muda", () => {
    const saved = savedAppearance("dark", "light");
    expect(roomAppearance("dark", saved)).toBe("light");
    // O organizador reprogramou: volta a valer o que ele escolheu.
    expect(roomAppearance("system", saved)).toBe("system");
    expect(roomAppearance("dark", "dark>lixo")).toBe("dark");
  });
});
