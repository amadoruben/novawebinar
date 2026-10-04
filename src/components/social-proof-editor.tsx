import { friendlyError } from "@/lib/friendly-error";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Loader2, Pencil, Plus, ShoppingBag, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import {
  generateSaleNotifications,
  type SaleNotificationSuggestion,
} from "@/lib/sales/notifications.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate } from "@/lib/data";
import { HmsInput } from "@/components/hms-input";
import { useQuery } from "@tanstack/react-query";

export type SocialProofSettings = {
  webinar_id: string;
  organization_id: string;
  enabled: boolean;
  product_name: string;
  start_mode: string;
  start_delay_seconds: number;
  start_seconds: number | null;
  end_seconds: number | null;
  min_interval_seconds: number;
  max_interval_seconds: number;
  position: string;
  display_seconds: number;
  animation: string;
  sound_enabled: boolean;
  notification_color: string;
  webhook_secret: string;
};

export function useSocialProof(webinarId: string) {
  return useQuery({
    queryKey: ["social-proof", webinarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_proof_settings")
        .select("*")
        .eq("webinar_id", webinarId)
        .maybeSingle();
      if (error) throw error;
      return data as SocialProofSettings | null;
    },
  });
}

export function useSimulatedPurchases(webinarId: string) {
  return useQuery({
    queryKey: ["simulated-purchases", webinarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("simulated_purchase_events")
        .select("*")
        .eq("webinar_id", webinarId)
        .order("offset_seconds", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

const POSITIONS = [
  { value: "bottom-left", label: "Canto inferior esquerdo" },
  { value: "bottom-right", label: "Canto inferior direito" },
  { value: "top-left", label: "Canto superior esquerdo" },
  { value: "top-right", label: "Canto superior direito" },
];

const ANIMATIONS = [
  { value: "slide", label: "Deslizar" },
  { value: "fade", label: "Aparecer suavemente" },
  { value: "pop", label: "Saltar" },
];

const NOTIFICATION_COLORS: {
  value: string;
  label: string;
  panel: string;
  ring: string;
  dot: string;
}[] = [
  {
    value: "emerald",
    label: "Verde",
    panel: "bg-emerald-500/90",
    ring: "ring-emerald-400/60",
    dot: "bg-emerald-500",
  },
  {
    value: "amber",
    label: "Amarelo",
    panel: "bg-amber-500/90",
    ring: "ring-amber-400/60",
    dot: "bg-amber-500",
  },
  {
    value: "blue",
    label: "Azul",
    panel: "bg-blue-500/90",
    ring: "ring-blue-400/60",
    dot: "bg-blue-500",
  },
  {
    value: "rose",
    label: "Vermelho",
    panel: "bg-rose-500/90",
    ring: "ring-rose-400/60",
    dot: "bg-rose-500",
  },
  {
    value: "violet",
    label: "Roxo",
    panel: "bg-violet-500/90",
    ring: "ring-violet-400/60",
    dot: "bg-violet-500",
  },
  {
    value: "slate",
    label: "Cinza",
    panel: "bg-slate-500/90",
    ring: "ring-slate-400/60",
    dot: "bg-slate-500",
  },
];

function notificationColorClasses(value?: string | null) {
  return NOTIFICATION_COLORS.find((c) => c.value === value) ?? NOTIFICATION_COLORS[0];
}

function clock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function SocialProofEditor({
  webinarId,
  organizationId,
  productFallback,
  webhookUrl,
  offerStartSeconds = 0,
  saveRef,
}: {
  webinarId: string;
  organizationId: string | undefined;
  productFallback: string;
  webhookUrl: string;
  offerStartSeconds?: number;
  saveRef?: { current: (() => Promise<boolean>) | null };
}) {
  const invalidate = useInvalidate();
  const { data: saved } = useSocialProof(webinarId);
  const { data: simulated = [] } = useSimulatedPurchases(webinarId);

  const [form, setForm] = useState({
    enabled: false,
    product_name: "",
    start_mode: "with_offer",
    start_delay_seconds: "0",
    start_seconds: "",
    end_seconds: "",
    min_interval_seconds: "25",
    max_interval_seconds: "90",
    position: "bottom-left",
    display_seconds: "6",
    animation: "slide",
    sound_enabled: false,
    notification_color: "emerald",
  });
  const [draft, setDraft] = useState({ buyer_name: "", message: "", at: "300" });
  const generateFn = useServerFn(generateSaleNotifications);
  const [aiCount, setAiCount] = useState("8");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUsedTranscript, setAiUsedTranscript] = useState(false);
  const [aiItems, setAiItems] = useState<SaleNotificationSuggestion[]>([]);
  const [aiPace, setAiPace] = useState("10-30");
  const [aiMin, setAiMin] = useState("10");
  const [aiMax, setAiMax] = useState("30");
  const [editing, setEditing] = useState<{
    id: string;
    buyer_name: string;
    message: string;
    at: string;
  } | null>(null);

  const aiInterval = () => {
    if (aiPace === "custom") {
      const min = Math.min(3600, Math.max(3, Number(aiMin) || 10));
      const max = Math.min(7200, Math.max(min, Number(aiMax) || min));
      return { min, max };
    }
    const [a, b] = aiPace.split("-");
    const min = Math.max(3, Number(a) || 10);
    const max = Math.max(min, Number(b) || 30);
    return { min, max };
  };

  const hydratedRef = useRef<string | null>(null);

  const resolveOrganizationId = async () => {
    if (organizationId) return organizationId;
    const { data } = await supabase
      .from("webinars")
      .select("organization_id")
      .eq("id", webinarId)
      .maybeSingle();
    return data?.organization_id ?? null;
  };

  useEffect(() => {
    if (!saved) return;
    if (hydratedRef.current === webinarId) return;
    hydratedRef.current = webinarId;
    setForm({
      enabled: saved.enabled,
      product_name: saved.product_name,
      start_mode: saved.start_mode,
      start_delay_seconds: String(saved.start_delay_seconds),
      start_seconds: saved.start_seconds != null ? String(saved.start_seconds) : "",
      end_seconds: saved.end_seconds != null ? String(saved.end_seconds) : "",
      min_interval_seconds: String(saved.min_interval_seconds),
      max_interval_seconds: String(saved.max_interval_seconds),
      position: saved.position,
      display_seconds: String(saved.display_seconds),
      animation: saved.animation,
      sound_enabled: saved.sound_enabled,
      notification_color: saved.notification_color || "emerald",
    });
  }, [saved]);

  const product = form.product_name || productFallback;

  const save = async (): Promise<boolean> => {
    const orgId = await resolveOrganizationId();
    if (!orgId) {
      toast.error("Não foi possível identificar o seu espaço de trabalho. Recarregue a página.");
      return false;
    }
    const min = Math.max(3, Number(form.min_interval_seconds) || 25);
    const max = Math.max(min, Number(form.max_interval_seconds) || 90);
    const { data: savedRow, error } = await supabase
      .from("social_proof_settings")
      .upsert(
      {
        webinar_id: webinarId,
        organization_id: orgId,
        enabled: form.enabled,
        product_name: form.product_name.trim(),
        start_mode: form.start_mode,
        start_delay_seconds: Math.max(0, Number(form.start_delay_seconds) || 0),
        start_seconds: form.start_seconds ? Number(form.start_seconds) : null,
        end_seconds: form.end_seconds ? Number(form.end_seconds) : null,
        min_interval_seconds: min,
        max_interval_seconds: max,
        position: form.position,
        display_seconds: Math.max(2, Number(form.display_seconds) || 6),
        animation: form.animation,
        sound_enabled: form.sound_enabled,
        notification_color: form.notification_color,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "webinar_id" },
      )
      .select()
      .maybeSingle();
    if (error) {
      toast.error(friendlyError(error));
      return false;
    }
    if (!savedRow) {
      toast.error("Não foi possível guardar. Verifique as permissões e tente novamente.");
      return false;
    }
    invalidate(["social-proof"]);
    return true;
  };

  useEffect(() => {
    if (!saveRef) return;
    saveRef.current = save;
    return () => {
      saveRef.current = null;
    };
  });

  const addSimulated = async () => {
    const organizationId = await resolveOrganizationId();
    if (!organizationId) {
      toast.error("Não foi possível identificar o seu espaço de trabalho.");
      return;
    }
    const at = Math.max(0, Number(draft.at) || 0);
    const name = draft.buyer_name.trim();
    if (!name) {
      toast.error("Indique o nome de quem compra.");
      return;
    }
    const { error } = await supabase.from("simulated_purchase_events").insert({
      webinar_id: webinarId,
      organization_id: organizationId,
      buyer_name: name,
      product_name: product,
      message: draft.message.trim(),
      offset_seconds: at,
    });
    if (error) toast.error(friendlyError(error));
    else {
      setDraft({ buyer_name: "", message: "", at: draft.at });
      invalidate(["simulated-purchases"]);
    }
  };

  const removeSimulated = async (id: string) => {
    const { error } = await supabase.from("simulated_purchase_events").delete().eq("id", id);
    if (error) toast.error(friendlyError(error));
    else invalidate(["simulated-purchases"]);
  };

  const saveEditing = async () => {
    if (!editing) return;
    const name = editing.buyer_name.trim();
    if (!name) {
      toast.error("Indique o nome de quem compra.");
      return;
    }
    const { error } = await supabase
      .from("simulated_purchase_events")
      .update({
        buyer_name: name,
        message: editing.message.trim(),
        offset_seconds: Math.max(0, Number(editing.at) || 0),
      })
      .eq("id", editing.id);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    setEditing(null);
    invalidate(["simulated-purchases"]);
    toast.success("Notificação atualizada.");
  };

  const exampleNames = useMemo(
    () => ["João", "Mariana", "Carlos", "Ana", "Ricardo", "Sofia", "Bruno", "Inês"],
    [],
  );

  const fillExamples = async () => {
    const organizationId = await resolveOrganizationId();
    if (!organizationId) {
      toast.error("Não foi possível identificar o seu espaço de trabalho.");
      return;
    }
    // Os exemplos começam depois de a oferta aparecer: antes dela uma compra parece falsa.
    const base = offerStartSeconds;
    const rows = exampleNames.map((name, index) => ({
      webinar_id: webinarId,
      organization_id: organizationId,
      buyer_name: name,
      product_name: product,
      message:
        index % 3 === 0 ? `acabou de garantir a vaga 🔥` : `comprou ${product || "o programa"}`,
      offset_seconds: base + 60 + index * 75,
    }));
    const { error } = await supabase.from("simulated_purchase_events").insert(rows);
    if (error) toast.error(friendlyError(error));
    else {
      invalidate(["simulated-purchases"]);
      toast.success("Notificações de demonstração criadas.");
    }
  };

  const generateWithAi = async () => {
    setAiLoading(true);
    setAiItems([]);
    try {
      const result = await generateFn({
        data: {
          webinarId,
          count: Math.min(40, Math.max(1, Number(aiCount) || 8)),
          offerStartSeconds: Math.max(0, Math.round(offerStartSeconds)),
          minIntervalSeconds: aiInterval().min,
          maxIntervalSeconds: aiInterval().max,
          productName: product,
        },
      });
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível gerar agora.");
        return;
      }
      setAiUsedTranscript(result.usedTranscript);
      setAiItems(result.items);
    } catch {
      toast.error("Não foi possível gerar agora. Tente novamente.");
    } finally {
      setAiLoading(false);
    }
  };

  const approveAiItems = async () => {
    if (aiItems.length === 0) return;
    const organizationId = await resolveOrganizationId();
    if (!organizationId) {
      toast.error("Não foi possível identificar o seu espaço de trabalho.");
      return;
    }
    const { error } = await supabase.from("simulated_purchase_events").insert(
      aiItems.map((item) => ({
        webinar_id: webinarId,
        organization_id: organizationId,
        buyer_name: item.buyerName,
        product_name: product,
        message: item.message,
        offset_seconds: item.offsetSeconds,
      })),
    );
    if (error) toast.error(friendlyError(error));
    else {
      setAiItems([]);
      invalidate(["simulated-purchases"]);
      toast.success("Notificações adicionadas.");
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-4 rounded-2xl border bg-background p-4">
        <span>
          <strong className="flex items-center gap-2 text-sm">
            <ShoppingBag className="size-4 text-primary" />
            Mostrar notificações de compra
          </strong>
          <span className="text-xs text-muted-foreground">
            Aparecem durante a sessão, por cima do vídeo, com o nome de quem comprou.
          </span>
        </span>
        <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nome do produto</Label>
          <Input
            value={form.product_name}
            onChange={(e) => setForm({ ...form, product_name: e.target.value })}
            placeholder={productFallback || "Ex.: Marca Milionária"}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Posição no ecrã</Label>
          <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POSITIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tempo no ecrã</Label>
          <HmsInput
            value={form.display_seconds}
            onChange={(v) => setForm({ ...form, display_seconds: v })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Animação</Label>
          <Select value={form.animation} onValueChange={(v) => setForm({ ...form, animation: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANIMATIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Cor da notificação</Label>
          <div className="flex flex-wrap gap-2">
            {NOTIFICATION_COLORS.map((c) => {
              const active = form.notification_color === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, notification_color: c.value })}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  <span className={`size-4 rounded-full ${c.dot}`} />
                  {c.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid gap-3 rounded-2xl border bg-background p-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Pré-visualização no vídeo
              </p>
              {(() => {
                const color = notificationColorClasses(form.notification_color);
                return (
                  <div
                    className={`pointer-events-none inline-flex max-w-[min(20rem,90%)] items-center gap-2.5 rounded-2xl p-3 shadow-sm ring-1 ${color?.panel ?? "bg-emerald-500/90"} ${color?.ring ?? "ring-emerald-400/60"}`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/25 text-white">
                      <ShoppingBag className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        Ana{" "}
                        <span className="font-normal text-white/85">
                          comprou {product || "o programa"}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Pré-visualização no chat
              </p>
              <div className="rounded-xl bg-neutral-900 p-3">
                <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/10 px-3 py-2 ring-1 ring-emerald-500/30">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-500">
                    <ShoppingBag className="size-3.5" />
                  </span>
                  <p className="min-w-0 break-words text-[14px] leading-snug text-white">
                    <span className="mr-1.5 font-semibold text-emerald-500">Ana</span>
                    comprou {product || "o programa"}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Estas definições são guardadas com o botão “Guardar alterações” no fim da página — e
        automaticamente quando avança para o passo seguinte.
      </p>

      <div className="space-y-3 rounded-2xl border bg-background p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold">Notificações de demonstração</h3>
            <p className="text-xs text-muted-foreground">
              Vão marcadas como “Simulação” e nunca entram nos relatórios de vendas reais.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fillExamples}>
            Criar exemplos
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-28 space-y-1.5">
              <Label className="text-xs">Quantas</Label>
              <Input
                inputMode="numeric"
                value={aiCount}
                onChange={(e) => setAiCount(e.target.value.replace(/\D/g, "").slice(0, 2))}
              />
            </div>
            <div className="w-48 space-y-1.5">
              <Label className="text-xs">Intervalo entre vendas</Label>
              <Select value={aiPace} onValueChange={setAiPace}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5-15">5 a 15 segundos</SelectItem>
                  <SelectItem value="10-30">10 a 30 segundos</SelectItem>
                  <SelectItem value="30-60">30 a 60 segundos</SelectItem>
                  <SelectItem value="60-120">1 a 2 minutos</SelectItem>
                  <SelectItem value="custom">Outro (escolher)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {aiPace === "custom" && (
              <>
                <div className="w-24 space-y-1.5">
                  <Label className="text-xs">Mínimo (s)</Label>
                  <Input
                    inputMode="numeric"
                    value={aiMin}
                    onChange={(e) => setAiMin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </div>
                <div className="w-24 space-y-1.5">
                  <Label className="text-xs">Máximo (s)</Label>
                  <Input
                    inputMode="numeric"
                    value={aiMax}
                    onChange={(e) => setAiMax(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </div>
              </>
            )}
            <Button size="sm" onClick={generateWithAi} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Gerar com IA
            </Button>
            <p className="min-w-40 flex-1 text-xs text-muted-foreground">
              Começam 2 minutos depois do início da oferta ({clock(offerStartSeconds + 120)}) e
              seguem-se umas às outras de {aiInterval().min} a {aiInterval().max} segundos.
            </p>
          </div>

          {aiItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {aiUsedTranscript
                  ? "Sugestões criadas com base na transcrição do webinar. Aprove para adicionar."
                  : "Sugestões criadas com base no título e descrição do webinar. Aprove para adicionar."}
              </p>
              <ul className="max-h-60 space-y-1.5 overflow-y-auto">
                {aiItems.map((item, index) => (
                  <li
                    key={`${item.buyerName}-${item.offsetSeconds}`}
                    className="flex items-center gap-3 rounded-xl border bg-background p-2 text-sm"
                  >
                    <span className="w-14 shrink-0 text-center font-bold tabular-nums">
                      {clock(item.offsetSeconds)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <strong>{item.buyerName}</strong> {item.message}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Descartar sugestão"
                      onClick={() => setAiItems(aiItems.filter((_, i) => i !== index))}
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button size="sm" variant="dark" onClick={approveAiItems}>
                  Aprovar e adicionar ({aiItems.length})
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAiItems([])}>
                  Descartar
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Momento</Label>
            <HmsInput value={draft.at} onChange={(v) => setDraft({ ...draft, at: v })} />
          </div>
          <div className="min-w-32 flex-1 space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input
              value={draft.buyer_name}
              onChange={(e) => setDraft({ ...draft, buyer_name: e.target.value })}
            />
          </div>
          <div className="min-w-40 flex-1 space-y-1.5">
            <Label className="text-xs">Mensagem</Label>
            <Input
              value={draft.message}
              onChange={(e) => setDraft({ ...draft, message: e.target.value })}
              placeholder={`comprou ${product || "o programa"}`}
            />
          </div>
          <Button size="sm" onClick={addSimulated}>
            <Plus />
            Adicionar
          </Button>
        </div>
        {simulated.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há notificações de demonstração.
          </p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {simulated.map((row) =>
              editing?.id === row.id ? (
                <li key={row.id} className="rounded-xl border bg-background p-2.5">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Momento</Label>
                      <HmsInput
                        value={editing.at}
                        onChange={(v) => setEditing({ ...editing, at: v })}
                      />
                    </div>
                    <div className="min-w-32 flex-1 space-y-1.5">
                      <Label className="text-xs">Nome</Label>
                      <Input
                        value={editing.buyer_name}
                        onChange={(e) => setEditing({ ...editing, buyer_name: e.target.value })}
                      />
                    </div>
                    <div className="min-w-40 flex-1 space-y-1.5">
                      <Label className="text-xs">Mensagem</Label>
                      <Input
                        value={editing.message}
                        onChange={(e) => setEditing({ ...editing, message: e.target.value })}
                        placeholder={`comprou ${product || "o programa"}`}
                      />
                    </div>
                    <Button size="sm" variant="dark" onClick={saveEditing}>
                      Guardar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancelar
                    </Button>
                  </div>
                </li>
              ) : (
                <li
                  key={row.id}
                  className="flex items-center gap-3 rounded-xl border bg-muted/30 p-2.5 text-sm"
                >
                  <span className="w-14 shrink-0 text-center font-bold tabular-nums">
                    {clock(row.offset_seconds)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <strong>{row.buyer_name}</strong> {row.message || `comprou ${row.product_name}`}
                  </span>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                    Simulação
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Editar"
                    onClick={() =>
                      setEditing({
                        id: row.id,
                        buyer_name: row.buyer_name,
                        message: row.message ?? "",
                        at: String(row.offset_seconds),
                      })
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    aria-label="Remover"
                    onClick={() => removeSimulated(row.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      <div className="space-y-2 rounded-2xl border bg-muted/30 p-4">
        <h3 className="text-sm font-bold">Compras reais</h3>
        <p className="text-xs text-muted-foreground">
          Ligue a sua plataforma de pagamento a este endereço para as compras reais aparecerem nas
          métricas e nos relatórios.
        </p>
        <div className="flex items-center gap-2">
          <Input readOnly value={webhookUrl} className="bg-background text-xs" />
          <Button
            variant="outline"
            size="icon"
            aria-label="Copiar endereço"
            onClick={() => {
              void navigator.clipboard.writeText(webhookUrl);
              toast.success("Endereço copiado.");
            }}
          >
            <Copy className="size-4" />
          </Button>
        </div>
        {saved?.webhook_secret && (
          <div className="flex items-center gap-2">
            <Input readOnly value={saved.webhook_secret} className="bg-background text-xs" />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copiar chave"
              onClick={() => {
                void navigator.clipboard.writeText(saved.webhook_secret);
                toast.success("Chave copiada.");
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        )}
        {!saved && (
          <p className="text-xs text-muted-foreground">
            Guarde a prova social para gerar a chave de ligação.
          </p>
        )}
      </div>
    </div>
  );
}
