import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Só endereços http(s): barra `javascript:`, `data:` e afins vindos da base de dados. */
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Link da oferta escrito no editor: sem esquema assume-se https://; qualquer
 * outro esquema é recusado. A migration 0042 aplica a mesma regra na base de dados.
 */
export function offerUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  return isHttpUrl(withScheme) ? withScheme : null;
}

/** Repete uma chamada que falhou por motivo passageiro, com espera crescente (0,8 s, 2,4 s…). */
export async function retry<T>(run: () => Promise<T>, attempts = 3, waitMs = 800): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, waitMs * 3 ** (attempt - 1)));
    }
  }
}
