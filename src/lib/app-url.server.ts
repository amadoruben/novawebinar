/**
 * O endereço público da aplicação, para links que saem do servidor (sala, inscrição, gravação).
 * Sem PUBLIC_APP_URL, usa o domínio de produção que a Vercel define sozinha. Vazio em local.
 */
export function publicAppUrl() {
  const vercel = process.env["VERCEL_PROJECT_PRODUCTION_URL"];
  const url = process.env["PUBLIC_APP_URL"] ?? process.env["VITE_PUBLIC_APP_URL"] ?? (vercel ? `https://${vercel}` : "");
  return url.replace(/\/+$/, "");
}
