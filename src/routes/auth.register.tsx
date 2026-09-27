import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth-screen";
export const Route = createFileRoute("/auth/register")({
  head: () => ({
    meta: [
      { title: "Criar conta | Convertewebinar" },
      { name: "description", content: "Crie a sua conta Convertewebinar." },
      { property: "og:title", content: "Criar conta | Convertewebinar" },
      { property: "og:description", content: "Comece a criar webinars profissionais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthScreen mode="register" />,
});
