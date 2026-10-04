import { useLocation, useNavigate } from "@tanstack/react-router";

/**
 * O pop-up das Integrações vive no endereço, por cima de qualquer página:
 * #integracoes[/secção[/integração]]. O botão voltar do browser recua um passo dentro dele.
 */
export const INTEGRATIONS_HASH = "integracoes";

export function useIntegrationsRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const [root, section, item] = location.hash.replace(/^#/, "").split("/");
  return {
    open: root === INTEGRATIONS_HASH,
    section,
    item,
    /** null fecha o pop-up; [] abre-o na primeira secção. */
    go: (path: string[] | null) =>
      void navigate({
        to: location.pathname,
        search: true,
        hash: path ? [INTEGRATIONS_HASH, ...path].join("/") : "",
      } as never),
  };
}
