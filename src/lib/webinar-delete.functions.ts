import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Eliminar um webinar e os dados dele (ver webinar-delete.server). */
export const deleteWebinar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ webinarId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deleteWebinarAsUser } = await import("@/lib/webinar-delete.server");
    return deleteWebinarAsUser(context.supabase, data.webinarId);
  });
