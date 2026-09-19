import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth-screen";
export const Route = createFileRoute("/auth/login")({
  head: () => ({
    meta: [
      { title: "Entrar | NovaWebinar" },
      { name: "description", content: "Entre na sua conta NovaWebinar." },
      { property: "og:title", content: "Entrar | NovaWebinar" },
      { property: "og:description", content: "Aceda à sua conta NovaWebinar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthScreen mode="login" />,
});
