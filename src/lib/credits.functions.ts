import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicPrices } from "@/lib/credits";

/**
 * Preços ao cliente, já com a margem (o que paga por imagem, por hora de vídeo, se o texto
 * tem preço). Os preços do fornecedor e o .env ficam no servidor.
 */
export const getAiPricing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { pricing } = await import("@/lib/ai/billing.server");
    return publicPrices(pricing());
  });
