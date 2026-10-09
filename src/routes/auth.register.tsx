import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/auth-screen";
export const Route = createFileRoute("/auth/register")({
  // O email da página inicial («O seu email → Começar») chega preenchido.
  validateSearch: (search: Record<string, unknown>): { email?: string | undefined } => ({
    email: typeof search["email"] === "string" ? search["email"].slice(0, 255) : undefined,
  }),
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
  component: RegisterRoute,
});

function RegisterRoute() {
  return <AuthScreen mode="register" email={Route.useSearch().email} />;
}
