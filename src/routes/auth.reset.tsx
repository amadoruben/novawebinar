import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth-screen";
export const Route = createFileRoute("/auth/reset")({
  head: () => ({
    meta: [
      { title: "Recuperar acesso | Convertewebinar" },
      { name: "description", content: "Recupere o acesso à Convertewebinar." },
      { property: "og:title", content: "Recuperar acesso | Convertewebinar" },
      { property: "og:description", content: "Recupere a sua palavra-passe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthScreen mode="reset" />,
});
