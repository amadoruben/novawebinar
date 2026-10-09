import { useLocation, useNavigate } from "@tanstack/react-router";

/**
 * Os pop-ups do painel (Integrações, Definições, Créditos) vivem no endereço, por cima de qualquer
 * página: #nome[/secção[/item]]. O botão voltar do browser recua um passo dentro deles.
 */
export const INTEGRATIONS_HASH = "integracoes";
export const SETTINGS_HASH = "definicoes";
export const CREDITS_HASH = "creditos";

function useModalRoute(name: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const [root, section, item] = location.hash.replace(/^#/, "").split("/");
  return {
    open: root === name,
    section,
    item,
    /** null fecha o pop-up; [] abre-o na primeira secção. */
    go: (path: string[] | null) =>
      void navigate({
        to: location.pathname,
        search: true,
        hash: path ? [name, ...path].join("/") : "",
      } as never),
  };
}

export const useIntegrationsRoute = () => useModalRoute(INTEGRATIONS_HASH);
export const useSettingsRoute = () => useModalRoute(SETTINGS_HASH);
export const useCreditsRoute = () => useModalRoute(CREDITS_HASH);
