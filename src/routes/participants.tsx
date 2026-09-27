import { createFileRoute, redirect } from "@tanstack/react-router";

// "Participantes" passou a "Contactos": a pessoa com o histórico de todos os eventos.
export const Route = createFileRoute("/participants")({
  beforeLoad: () => {
    throw redirect({ to: "/contacts" });
  },
});
