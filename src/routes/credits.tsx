import { createFileRoute, redirect } from "@tanstack/react-router";
import { CREDITS_HASH } from "@/lib/modal-route";

// Os Créditos são um pop-up por cima do painel (src/components/credits-modal.tsx);
// o endereço antigo continua a funcionar e abre-o.
export const Route = createFileRoute("/credits")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", hash: CREDITS_HASH });
  },
});
