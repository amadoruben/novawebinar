/**
 * Converte qualquer falha técnica numa frase em português simples.
 * Nada de JSON, códigos, stacks ou nomes de campos no ecrã do utilizador.
 */

const FALLBACK = "Algo não correu bem. Tente novamente daqui a pouco.";

/** Uma mensagem só é mostrada se for texto humano, sem código nem JSON. */
function looksTechnical(text: string): boolean {
  if (!text) return true;
  return (
    /[{}[\]]/.test(text) ||
    /".+":/.test(text) ||
    /\b(ZodError|TypeError|ReferenceError|SyntaxError|undefined|null|NaN|stack|at\s+\w+\.\w+)\b/.test(
      text,
    ) ||
    /https?:\/\//.test(text) ||
    /\b[A-Z_]{4,}\b/.test(text) ||
    text.length > 240
  );
}

export function friendlyError(error: unknown, fallback: string = FALLBACK): string {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const text = raw.trim();
  const low = text.toLowerCase();

  if (low.includes("too_big") || low.includes("at most") || low.includes("máximo"))
    return "Este webinar já tem comentários a mais para processar de uma vez. Apague alguns ou gere apenas um trecho.";
  if (low.includes("too_small") || low.includes("at least"))
    return "Faltam dados para avançar. Reveja as opções escolhidas e tente outra vez.";
  if (low.includes("uuid") || low.includes("invalid_type") || low.includes("expected"))
    return "Alguns dados do webinar não estão completos. Volte a abrir a edição e tente novamente.";
  if (low.includes("fetch") || low.includes("network") || low.includes("timeout") || low.includes("abort"))
    return "A ligação falhou a meio. Verifique a Internet e tente novamente.";
  if (low.includes("429") || low.includes("rate limit"))
    return "Há demasiados pedidos neste momento. Aguarde um pouco e tente outra vez.";
  if (low.includes("402") || low.includes("credit"))
    return "Os créditos de IA do seu espaço de trabalho acabaram.";
  if (low.includes("401") || low.includes("unauthorized") || low.includes("jwt"))
    return "A sua sessão expirou. Entre novamente para continuar.";
  if (low.includes("403") || low.includes("permission") || low.includes("row-level"))
    return "Não tem permissão para esta ação.";
  if (low.includes("500") || low.includes("internal server"))
    return "O serviço não respondeu como esperado. Tente novamente daqui a pouco.";

  return looksTechnical(text) ? fallback : text;
}
