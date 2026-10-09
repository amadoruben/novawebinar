import { useEffect } from "react";

/** Subdomínio de administração opcional (VITE_ADMIN_HOST). Vazio = desligado. */
const ADMIN_HOST = (import.meta.env["VITE_ADMIN_HOST"] as string | undefined)?.trim() ?? "";
/** Domínios públicos que devem redirecionar para o admin (VITE_PUBLIC_HOSTS, separados por vírgula). */
const PUBLIC_HOSTS = ((import.meta.env["VITE_PUBLIC_HOSTS"] as string | undefined) ?? "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

/**
 * Redireciona o painel/login para o subdomínio admin quando aberto num domínio
 * público. As salas (`/w/...`) continuam sempre no domínio das salas.
 * Só está ativo quando VITE_ADMIN_HOST e VITE_PUBLIC_HOSTS estão definidos.
 */
export function useAdminHostRedirect() {
  useEffect(() => {
    if (!ADMIN_HOST || PUBLIC_HOSTS.length === 0) return;
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname;
    const isRoomPath = path.startsWith("/w/");
    const isLanding = path === "/";
    if (isLanding) return;
    if (host === ADMIN_HOST.toLowerCase()) return;
    const onPublicHost =
      PUBLIC_HOSTS.includes(host) || PUBLIC_HOSTS.includes(host.replace(/^www\./, ""));
    if (onPublicHost && !isRoomPath) {
      window.location.replace(
        `https://${ADMIN_HOST}${path}${window.location.search}${window.location.hash}`,
      );
    }
  }, []);
}
