import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** A margem é pública (mostra-se ao cliente); os preços do fornecedor ficam no servidor. */
export const getAiPricing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { pricing } = await import("@/lib/ai/billing.server");
    const p = pricing();
    return { margin: p.margin, configured: p.configured };
  });
