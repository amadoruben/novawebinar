import { createFileRoute } from "@tanstack/react-router";

/**
 * Geração de imagens para capas, oferta e produto.
 * Devolve os acontecimentos da geração em streaming para o editor mostrar a
 * imagem a formar-se; com `stream: false` devolve apenas o resultado final.
 */
export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { prompt, stream = true } = (await request.json()) as {
          prompt: string;
          stream?: boolean;
        };
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("A ligação à IA não está configurada.", { status: 500 });
        if (!prompt || prompt.trim().length < 3)
          return new Response("Descrição em falta.", { status: 400 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
            ...(stream ? { stream: true } : {}),
          }),
        });

        if (!upstream.ok || !upstream.body) {
          return new Response(await upstream.text(), { status: upstream.status });
        }

        if (!stream) {
          return new Response(upstream.body, { headers: { "Content-Type": "application/json" } });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
