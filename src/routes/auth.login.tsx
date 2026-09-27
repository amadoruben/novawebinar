import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth-screen";
export const Route = createFileRoute("/auth/login")({
  head: () => ({
    meta: [
      { title: "Entrar | Convertewebinar" },
      { name: "description", content: "Entre na sua conta Convertewebinar." },
      { property: "og:title", content: "Entrar | Convertewebinar" },
      { property: "og:description", content: "Aceda à sua conta Convertewebinar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthScreen mode="login" />,
});
