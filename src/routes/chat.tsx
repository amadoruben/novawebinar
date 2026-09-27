import { createFileRoute, redirect } from "@tanstack/react-router";

// O chat com participantes passou a fazer parte do Atendimento.
export const Route = createFileRoute("/chat")({
  beforeLoad: () => {
    throw redirect({ to: "/support", search: { c: undefined } });
  },
});
