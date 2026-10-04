import { createFileRoute, redirect } from "@tanstack/react-router";
import { INTEGRATIONS_HASH } from "@/lib/modal-route";

// As Integrações são um pop-up por cima do painel (src/components/integrations-modal.tsx);
// o endereço antigo continua a funcionar e abre-o.
export const Route = createFileRoute("/integrations")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", hash: INTEGRATIONS_HASH });
  },
});
