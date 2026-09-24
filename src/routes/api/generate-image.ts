import { createFileRoute } from "@tanstack/react-router";

/**
 * Geração de imagens para capas, oferta e produto, pela camada própria de IA.
 * Devolve os acontecimentos da geração em streaming para o editor mostrar a
 * imagem a formar-se; com `stream: false` devolve apenas o resultado final.
 * Só para utilizadores autenticados: a chave do fornecedor nunca sai do servidor.
 */
export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireRouteUser } = await import("@/integrations/supabase/route-auth");
        const auth = await requireRouteUser(request);
        if (!auth.ok) return auth.response;

        let body: { prompt?: unknown; stream?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response("Pedido inválido.", { status: 400 });
        }
        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        const stream = body.stream !== false;
        if (prompt.length < 3) return new Response("Descrição em falta.", { status: 400 });

        const { generateImage } = await import("@/lib/ai/provider");
        const result = await generateImage({ prompt, stream });
        if (!result.ok) {
          console.error(`[generate-image] ${result.code} ${result.status ?? ""} ${result.detail ?? ""}`);
          return new Response(result.reason, { status: result.status ?? 500 });
        }

        return new Response(result.body, {
          headers:
            result.contentType === "text/event-stream"
              ? { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
              : { "Content-Type": "application/json" },
        });
      },
    },
  },
});
