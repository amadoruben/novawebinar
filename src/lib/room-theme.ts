/**
 * O tema da sala (Webinar e Live, sala pública e vista da equipa): o que o organizador programou no
 * editor, ou a escolha desta pessoa no ⚙ do vídeo; «Automático» segue o aparelho.
 */
import { useCallback, useEffect, useState } from "react";

export type Appearance = "system" | "dark" | "light";

const isAppearance = (v: unknown): v is Appearance => v === "system" || v === "dark" || v === "light";

/** O que o editor grava: `room_theme_system` = Automático; senão o claro ou o escuro de `room_theme`. */
export function programmedAppearance(w: { room_theme?: string | null; room_theme_system?: boolean | null }): Appearance {
  return w.room_theme_system ? "system" : w.room_theme === "light" ? "light" : "dark";
}

export function resolveTheme(appearance: Appearance, prefersDark: boolean): "dark" | "light" {
  if (appearance === "system") return prefersDark ? "dark" : "light";
  return appearance;
}

/**
 * A escolha da pessoa guarda-se com o que estava programado quando a fez («programado>escolha»):
 * se o organizador reprogramar, vale outra vez o que ele programou.
 */
export function roomAppearance(programmed: Appearance, saved: string | null): Appearance {
  const [org, choice] = (saved ?? "").split(">");
  return org === programmed && isAppearance(choice) ? choice : programmed;
}

export const savedAppearance = (programmed: Appearance, choice: Appearance) => `${programmed}>${choice}`;

/** O aparelho está em modo escuro? Segue as mudanças enquanto a sala está aberta. */
export function usePrefersDark() {
  const [prefersDark, setPrefersDark] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setPrefersDark(media.matches);
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return prefersDark;
}

/**
 * O tema da sala para esta pessoa. `key` = onde guardar a escolha dela (uma por sala); `null` = não
 * guardar (sala de teste e vista da equipa: experimentar o ⚙ nunca muda a sala a sério).
 */
export function useRoomAppearance(programmed: Appearance, key: string | null) {
  const prefersDark = usePrefersDark();
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    try {
      setSaved(window.localStorage.getItem(key));
    } catch {
      /* sem armazenamento: fica o programado */
    }
  }, [key]);
  const appearance = roomAppearance(programmed, saved);
  const choose = useCallback(
    (next: Appearance) => {
      const value = savedAppearance(programmed, next);
      setSaved(value);
      if (!key) return;
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* fica só nesta visita */
      }
    },
    [programmed, key],
  );
  return { appearance, theme: resolveTheme(appearance, prefersDark), choose };
}
