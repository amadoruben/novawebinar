import { createFileRoute } from "@tanstack/react-router";

// A Kambafy envia o webhook a partir do browser (botão "testar" e pagamentos
// Express/cartão), por isso as suas origens têm de passar a verificação CORS.
const BROWSER_SENDERS = /^https:\/\/([a-z0-9-]+\.)?kambafy\.com$/;

function withCors(request: Request, response: Response) {
  const origin = request.headers.get("origin") ?? "";
  if (!BROWSER_SENDERS.test(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type, x-webhook-secret, authorization");
  headers.set("access-control-max-age", "86400");
  headers.set("vary", "origin");
  return new Response(response.body, { status: response.status, headers });
}

/** Endereço único de ligação de cada integração de vendas (Kambafy, Hotmart, …). */
export const Route = createFileRoute("/api/public/hooks/$key")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => withCors(request, new Response(null, { status: 204 })),
      POST: async ({ request, params }) => {
        const { receiveIntegrationWebhook } = await import("@/lib/integrations.server");
        return withCors(request, await receiveIntegrationWebhook(params.key, request));
      },
    },
  },
});
