import { createFileRoute, redirect } from "@tanstack/react-router";
import { SETTINGS_HASH } from "@/lib/modal-route";

// As Definições são um pop-up por cima do painel (src/components/settings-modal.tsx);
// o endereço antigo continua a funcionar e abre-o.
export const Route = createFileRoute("/settings")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", hash: SETTINGS_HASH });
  },
});
