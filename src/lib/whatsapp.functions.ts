/**
 * WhatsApp não oficial pelo WAHA (github.com/devlikeapro/waha): um servidor da
 * plataforma, uma sessão por organização, ligada pelo código QR do telemóvel.
 * A chave do WAHA fica no servidor; o browser só vê o estado e o código.
 */
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type WhatsappSession =
  | { status: "NO_SERVER" }
  | { status: "STARTING" }
  | { status: "SCAN_QR_CODE"; qr: string | null }
  | { status: "WORKING"; phone: string | null };

/** Garante a sessão da organização e devolve o estado; enquanto espera, o código QR (renova-se sozinho). */
export const whatsappSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ organizationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<WhatsappSession> => {
    // RLS: só um membro da organização vê a linha; sem a escolha guardada não há sessão.
    const { data: row, error } = await context.supabase
      .from("integrations")
      .select("id, settings")
      .eq("organization_id", data.organizationId)
      .eq("provider", "whatsapp")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Guarde primeiro a escolha do WhatsApp não oficial.");
    if (!process.env["WAHA_URL"]) return { status: "NO_SERVER" };
    const { waha } = await import("@/lib/whatsapp.server");

    const name = `org_${data.organizationId.replace(/-/g, "")}`;
    let res = await waha(`/api/sessions/${name}`);
    if (res.status === 404) {
      res = await waha("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ name, start: true }),
      });
    }
    if (!res.ok) throw new Error(`O servidor de WhatsApp respondeu ${res.status}.`);
    const session = (await res.json()) as { status: string; me?: { id?: string } | null };

    if (session.status === "SCAN_QR_CODE") {
      const qr = await waha(`/api/${name}/auth/qr`);
      const image = qr.ok ? ((await qr.json()) as { mimetype?: string; data?: string }) : {};
      return {
        status: "SCAN_QR_CODE",
        qr: image.data ? `data:${image.mimetype ?? "image/png"};base64,${image.data}` : null,
      };
    }
    if (session.status === "WORKING") {
      const phone = session.me?.id?.split("@")[0] ?? null;
      const settings = (row.settings ?? {}) as Record<string, string>;
      if (settings["session"] !== name || (phone && settings["phone"] !== phone)) {
        const { error: saveError } = await context.supabase
          .from("integrations")
          .update({
            settings: { ...settings, session: name, ...(phone ? { phone } : {}) },
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (saveError) throw new Error(saveError.message);
      }
      return { status: "WORKING", phone };
    }
    if (session.status === "STOPPED" || session.status === "FAILED") {
      await waha(`/api/sessions/${name}/start`, { method: "POST" });
    }
    return { status: "STARTING" };
  });
