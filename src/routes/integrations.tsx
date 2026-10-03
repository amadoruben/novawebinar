import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Mail,
  MessageSquareText,
  RefreshCw,
  Send,
  Webhook,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import whatsappLogo from "@/assets/local/whatsapp-icon.webp";
import eduzzLogo from "@/assets/integrations/eduzz.png";
import googleLogo from "@/assets/integrations/google_ads.jpg";
import hotmartLogo from "@/assets/integrations/hotmart.png";
import kambafyLogo from "@/assets/integrations/kambafy.png";
import kiwifyLogo from "@/assets/integrations/kiwify.png";
import metaLogo from "@/assets/integrations/meta.jpg";
import stripeLogo from "@/assets/integrations/stripe.png";
import tiktokLogo from "@/assets/integrations/tiktok.svg";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHANNELS, channelStatus, type Channel } from "@/lib/workflow";
import { supabase } from "@/integrations/supabase/client";
import { relativeDays } from "@/lib/contacts";
import {
  connectIntegration,
  formatDateTime,
  publicOrigin,
  updateIntegration,
  useIntegrationEvents,
  useIntegrations,
  useInvalidate,
  useRecentPayments,
  useWorkspace,
  type IntegrationRow,
} from "@/lib/data";
import {
  DEFAULT_COUNTRY_CODE,
  generateSecret,
  PROVIDERS,
  providerInfo,
  whatsappReady,
  type IntegrationGroup,
  type ProviderId,
  type ProviderInfo,
} from "@/lib/integrations";
import { cn } from "@/lib/utils";
import { whatsappSession } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/integrations")({
  head: () => ({
    meta: [
      { title: "Integrações | Convertewebinar" },
      { name: "description", content: "Kambafy, plataformas de venda, pixels e webhooks." },
    ],
  }),
  component: IntegrationsPage,
});

type Events = NonNullable<ReturnType<typeof useIntegrationEvents>["data"]>;
type Payments = NonNullable<ReturnType<typeof useRecentPayments>["data"]>;

const LOGOS: Partial<Record<ProviderId, string>> = {
  kambafy: kambafyLogo,
  hotmart: hotmartLogo,
  kiwify: kiwifyLogo,
  eduzz: eduzzLogo,
  stripe: stripeLogo,
  meta_pixel: metaLogo,
  tiktok_pixel: tiktokLogo,
  google_tag: googleLogo,
};

const TABS: { id: IntegrationGroup; title: string; description: string }[] = [
  {
    id: "sales",
    title: "Plataformas de venda",
    description:
      "Cada venda aprovada entra sozinha, liga-se ao contacto pelo email e ao webinar que a gerou.",
  },
  {
    id: "ads",
    title: "Pixels e conversões",
    description:
      "Os anúncios recebem a visita, a inscrição e o clique na oferta, para aprenderem quem converte.",
  },
  {
    id: "send",
    title: "Enviar dados",
    description: "Inscrições, cliques e vendas levados em tempo real para o seu CRM ou automações.",
  },
];

const EVENT_STATUS: Record<
  string,
  { label: string; variant: "success" | "destructive" | "secondary" }
> = {
  accepted: { label: "Aceite", variant: "success" },
  rejected: { label: "Recusado", variant: "destructive" },
  ignored: { label: "Ignorado", variant: "secondary" },
};

function money(value: number | null, currency: string | null) {
  if (value === null) return "—";
  try {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: currency || "AOA",
    }).format(value);
  } catch {
    return `${value} ${currency ?? ""}`;
  }
}

function Logo({ id, className }: { id: ProviderId; className?: string }) {
  const src = LOGOS[id];
  const box = cn(
    "flex shrink-0 items-center justify-center rounded-lg border bg-white",
    className ?? "size-11",
  );
  if (src) {
    return (
      <span className={box}>
        <img src={src} alt="" className="size-[70%] object-contain" draggable={false} />
      </span>
    );
  }
  const Icon = id === "outgoing_webhook" ? Send : Webhook;
  return (
    <span className={cn(box, "text-foreground")}>
      <Icon className="size-1/2" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

/** Ícone de cada canal das automações: WhatsApp com a marca, email e SMS em mosaico de cor, webhook igual a Enviar dados. */
function ChannelLogo({ channel, className = "size-11" }: { channel: Channel; className?: string }) {
  if (channel === "webhook") return <Logo id="outgoing_webhook" className={className} />;
  if (channel === "whatsapp")
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border bg-white",
          className,
        )}
      >
        <img src={whatsappLogo} alt="" className="size-[70%] object-contain" draggable={false} />
      </span>
    );
  const Icon = channel === "email" ? Mail : MessageSquareText;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg text-white",
        channel === "email" ? "bg-info" : "bg-navy",
        className,
      )}
    >
      <Icon className="size-[55%]" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

const CHANNEL_EXPLAIN: Record<Channel, string> = {
  email: "Mensagens por email para o contacto (assunto e mensagem).",
  whatsapp: "WhatsApp individual (para o número do contacto) ou em grupo (para um grupo indicado).",
  sms: "SMS para o número do contacto.",
  webhook: "Envia a pessoa, o webinar e o passo para o seu Zapier, Make, n8n ou CRM, assinado.",
};

type WhatsappMode = "official" | "unofficial";

const WHATSAPP_MODE: Record<WhatsappMode, { title: string; detail: string }> = {
  official: {
    title: "Oficial",
    detail: "API do WhatsApp Business (Meta). Número verificado e modelos aprovados.",
  },
  unofficial: {
    title: "Não oficial",
    detail:
      "O seu número, ligado por código QR como no WhatsApp Web. Risco de bloqueio em envios em massa.",
  },
};

type Status = { label: string; tone: "on" | "warn" | "off" | "info" };

function statusOf(info: ProviderInfo, row: IntegrationRow | undefined): Status {
  if (!row) return { label: "Por ligar", tone: "off" };
  if (!row.enabled) return { label: "Desligada", tone: "off" };
  const missingSecret = info.secret?.required && !row.has_secret;
  const missingSetting = info.setting && !row.settings?.[info.setting.key];
  if (missingSecret || missingSetting) return { label: "Falta configurar", tone: "warn" };
  return { label: "Ligada", tone: "on" };
}

function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        status.tone === "on" && "border-success/30 bg-success-soft text-success",
        status.tone === "warn" && "border-warning/40 bg-warning-soft text-warning-foreground",
        status.tone === "info" && "border-info/30 bg-info-soft text-info",
        status.tone === "off" && "bg-white text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          status.tone === "on" && "bg-success",
          status.tone === "warn" && "bg-warning",
          status.tone === "info" && "bg-info",
          status.tone === "off" && "bg-gray-400",
        )}
        aria-hidden
      />
      {status.label}
    </span>
  );
}

/** Pagamentos de uma integração nos últimos 30 dias, cada um uma vez, pelo estado actual. */
function statsFor(provider: string, payments: Payments) {
  const mine = payments.filter((p) => p.provider === provider);
  return {
    sales: mine.filter((p) => p.status === "approved").length,
    failed: mine.filter((p) => p.status === "failed").length,
  };
}

/** Os canais que as automações usam: configurado, simulado (conta de teste) ou sem fornecedor. */
function channelPill(
  c: { simulated: boolean; ready: boolean; channel: Channel },
  whatsapp: IntegrationRow | undefined,
): Status {
  if (c.simulated) return { label: "Simulado", tone: "info" };
  if (c.ready) return { label: "Configurado", tone: "on" };
  // Escolha guardada, mas o envio por WhatsApp ainda não está activo na plataforma.
  const mode = whatsapp?.settings?.["mode"] as WhatsappMode | undefined;
  if (c.channel === "whatsapp" && mode) return { label: WHATSAPP_MODE[mode].title, tone: "warn" };
  return { label: "Não configurado", tone: "off" };
}

function AutomationChannels({
  isTest,
  webhookReady,
  whatsapp,
  onOpen,
}: {
  isTest: boolean;
  webhookReady: boolean;
  whatsapp: IntegrationRow | undefined;
  onOpen: (channel: Channel) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isTest
          ? "Conta de teste: todos os canais são simulados. As execuções mostram a mensagem que teria saído e nada sai da plataforma."
          : "Uma automação só pode ser activada quando todos os canais que usa têm fornecedor. Sem fornecedor, a configuração fica preparada e desligada."}
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {channelStatus(isTest, webhookReady, whatsappReady(whatsapp)).map((c) => (
          <button
            key={c.channel}
            type="button"
            onClick={() => onOpen(c.channel)}
            className="flex cursor-pointer items-center gap-4 rounded-card bg-card p-4 text-left transition-shadow hover:shadow-[var(--shadow-raised)] focus-visible:outline-none focus-visible:ring-focus"
          >
            <ChannelLogo channel={c.channel} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{CHANNELS[c.channel].label}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {CHANNEL_EXPLAIN[c.channel]}
              </span>
            </span>
            <StatusPill status={channelPill(c, whatsapp)} />
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Pop-up de configuração dos canais: separadores em cima, um canal de cada vez. */
function ChannelDialog({
  channel,
  isTest,
  webhookReady,
  whatsapp,
  organizationId,
  onChannel,
  onWebhook,
  onClose,
}: {
  channel: Channel;
  isTest: boolean;
  webhookReady: boolean;
  whatsapp: IntegrationRow | undefined;
  organizationId: string;
  onChannel: (channel: Channel) => void;
  onWebhook: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl gap-0 p-6">
        <div
          role="tablist"
          aria-label="Canais"
          className="mr-8 grid grid-cols-4 gap-1 rounded-pill bg-chip p-1"
        >
          {(Object.keys(CHANNELS) as Channel[]).map((ch) => (
            <button
              key={ch}
              type="button"
              role="tab"
              aria-selected={ch === channel}
              onClick={() => onChannel(ch)}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-1.5 rounded-pill px-2 py-1.5 text-[13px] transition-colors",
                ch === channel
                  ? "bg-white font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ChannelLogo channel={ch} className="size-5 rounded-md" />
              <span className="truncate">{CHANNELS[ch].label}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center text-center">
          <ChannelLogo channel={channel} className="size-16 rounded-2xl" />
          <DialogTitle className="mt-4 text-xl">Configurar {CHANNELS[channel].label}</DialogTitle>
          <DialogDescription className="mt-1 max-w-sm">
            {CHANNEL_EXPLAIN[channel]}
          </DialogDescription>
        </div>

        {isTest && (
          <p className="mt-5 rounded-lg bg-info-soft px-3 py-2 text-center text-sm text-info">
            Conta de teste: este canal é simulado e nada sai da plataforma.
          </p>
        )}

        <div className="mt-6">
          {channel === "whatsapp" ? (
            <WhatsappSetup
              key={whatsapp?.id ?? "novo"}
              row={whatsapp}
              organizationId={organizationId}
            />
          ) : channel === "webhook" ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                {webhookReady
                  ? "Ligado: cada passo de webhook usa o webhook de saída."
                  : "Ainda por ligar. Indique o endereço do Zapier, do Make, do n8n ou do seu CRM."}
              </p>
              <Button variant="dark" className="h-11 w-full" onClick={onWebhook}>
                {webhookReady ? "Gerir webhook" : "Ligar webhook"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Ainda sem fornecedor na plataforma. Até lá, pode enviar pelo webhook para a sua
                ferramenta.
              </p>
              <Button variant="dark" className="h-11 w-full" onClick={() => onChannel("webhook")}>
                Enviar pelo webhook
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** WhatsApp: escolha entre a API oficial da Meta e o número ligado por código QR. */
function WhatsappSetup({
  row,
  organizationId,
}: {
  row: IntegrationRow | undefined;
  organizationId: string;
}) {
  const invalidate = useInvalidate();
  const [mode, setMode] = useState<WhatsappMode>(
    (row?.settings?.["mode"] as WhatsappMode) ?? "official",
  );
  const [phoneId, setPhoneId] = useState(row?.settings?.["phone_number_id"] ?? "");
  const [wabaId, setWabaId] = useState(row?.settings?.["waba_id"] ?? "");
  const [token, setToken] = useState("");
  const [countryCode, setCountryCode] = useState(
    row?.settings?.["country_code"] ?? DEFAULT_COUNTRY_CODE,
  );
  const [busy, setBusy] = useState(false);
  // Só pede a sessão ao WAHA depois de a pessoa carregar em "Gerar código QR".
  const [linking, setLinking] = useState(false);
  const session = useQuery({
    queryKey: ["whatsapp-session", organizationId],
    queryFn: () => whatsappSession({ data: { organizationId } }),
    enabled: linking && mode === "unofficial",
    refetchInterval: (q) =>
      ["WORKING", "NO_SERVER"].includes(q.state.data?.status ?? "") ? false : 3000,
    retry: false,
  });
  const linkedPhone =
    session.data?.status === "WORKING"
      ? session.data.phone
      : row?.settings?.["mode"] === "unofficial"
        ? row.settings["phone"]
        : null;

  const tokenOk = token.trim().length >= 20 || (token === "" && Boolean(row?.has_secret));
  const countryOk = /^\d{1,4}$/.test(countryCode.trim());
  const officialOk =
    /^\d{6,20}$/.test(phoneId.trim()) && /^\d{6,20}$/.test(wabaId.trim()) && tokenOk;

  const save = async () => {
    setBusy(true);
    try {
      const country_code = countryCode.trim();
      const settings: Record<string, string> =
        mode === "official"
          ? { mode, phone_number_id: phoneId.trim(), waba_id: wabaId.trim(), country_code }
          : // A sessão e o número já ligados ficam; só muda o que a pessoa escolheu.
            {
              ...(row?.settings?.["mode"] === "unofficial" ? row.settings : {}),
              mode,
              country_code,
            };
      // Na não oficial o token da Meta deixa de servir: apaga-se.
      const secret = mode === "official" ? token.trim() || undefined : "";
      const id = row?.id ?? (await connectIntegration(organizationId, "whatsapp", secret ?? "")).id;
      await updateIntegration(id, {
        settings,
        ...(row && secret !== undefined ? { secret } : {}),
      });
      if (mode === "official") toast.success("Ligação oficial guardada.");
      else if (linkedPhone) toast.success("Guardado.");
      else setLinking(true);
      setToken("");
      invalidate(["integrations"]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Tipo de ligação" className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(WHATSAPP_MODE) as WhatsappMode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "cursor-pointer rounded-xl border bg-white p-3 text-left transition-shadow",
              mode === m
                ? "border-foreground shadow-[inset_0_0_0_1px_var(--navy)]"
                : "hover:border-gray-300",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border",
                  mode === m ? "border-foreground" : "border-gray-300",
                )}
                aria-hidden
              >
                {mode === m && <span className="size-2 rounded-full bg-foreground" />}
              </span>
              {WHATSAPP_MODE[m].title}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {WHATSAPP_MODE[m].detail}
            </span>
          </button>
        ))}
      </div>

      {mode === "official" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="wa-phone">ID do número de telefone</Label>
            <Input
              id="wa-phone"
              inputMode="numeric"
              value={phoneId}
              onChange={(e) => setPhoneId(e.target.value)}
              placeholder="Ex.: 109876543210987"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-waba">ID da conta do WhatsApp Business</Label>
            <Input
              id="wa-waba"
              inputMode="numeric"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="Ex.: 123456789012345"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-token">Token de acesso permanente</Label>
            <Input
              id="wa-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={row?.has_secret ? "Guardado. Escreva para substituir." : "EAAG…"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Estão no Meta for Developers › a sua app › WhatsApp › Configuração da API. O token
            permanente cria-se num utilizador de sistema do Gestor de Negócios.
          </p>
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
            Fica guardada para o passo seguinte: pela API oficial, as mensagens das automações só
            saem com modelos aprovados pela Meta. Até lá, as automações enviam pela ligação não
            oficial.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          <div className="flex size-44 items-center justify-center overflow-hidden rounded-xl border bg-white p-2 text-xs text-muted-foreground">
            {linkedPhone ? (
              <span className="flex flex-col items-center gap-2 text-success">
                <Check className="size-8" aria-hidden />
                Ligado ao +{linkedPhone}
              </span>
            ) : session.error ? (
              <span className="text-destructive">{session.error.message}</span>
            ) : session.data?.status === "NO_SERVER" ? (
              "O servidor de WhatsApp (WAHA) ainda não está ligado à plataforma."
            ) : session.data?.status === "SCAN_QR_CODE" && session.data.qr ? (
              <img
                src={session.data.qr}
                alt="Código QR para ligar o WhatsApp"
                className="size-full object-contain"
              />
            ) : linking ? (
              "A preparar o código…"
            ) : (
              "O código QR aparece aqui."
            )}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            No telemóvel: WhatsApp › Aparelhos ligados › Ligar um aparelho, e aponte a câmara ao
            código.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="wa-country">Indicativo dos números sem +</Label>
        <Input
          id="wa-country"
          inputMode="numeric"
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          placeholder="244"
          className="w-28"
        />
        <p className="text-xs text-muted-foreground">
          Um contacto inscrito com 923 456 789 recebe no +{countryCode.trim() || "…"} 923 456 789.
        </p>
      </div>

      {!(mode === "unofficial" && linking && !linkedPhone) && (
        <Button
          variant="dark"
          className="h-11 w-full"
          disabled={busy || !countryOk || (mode === "official" && !officialOk)}
          onClick={save}
        >
          {mode === "official"
            ? "Guardar ligação oficial"
            : linkedPhone
              ? "Guardar"
              : "Gerar código QR"}
        </Button>
      )}
    </div>
  );
}

function IntegrationsPage() {
  const { data: workspace } = useWorkspace();
  const orgId = workspace?.organizationId;
  const { data: rows = [], isLoading } = useIntegrations(orgId);
  const { data: events = [] } = useIntegrationEvents(orgId);
  const { data: payments = [] } = useRecentPayments(orgId);
  const [open, setOpen] = useState<ProviderInfo | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);

  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  const connected = PROVIDERS.filter((p) => statusOf(p, byProvider.get(p.id)).tone === "on").length;
  const since = Date.now() - 30 * 86_400_000;
  const salesMonth = payments.filter((p) => p.status === "approved").length;
  const rejectedMonth = events.filter(
    (e) => e.status === "rejected" && Date.parse(e.received_at) >= since,
  ).length;

  return (
    <AppShell
      title="Integrações"
      description="Ligue a Kambafy e as suas ferramentas. Cada venda e cada inscrição passa a alimentar os seus contactos."
      action={false}
    >
      <p className="-mt-4 mb-6 text-sm text-muted-foreground" role="status">
        {connected} de {PROVIDERS.length} ligadas · {salesMonth} vendas recebidas nos últimos 30
        dias
        {rejectedMonth > 0 ? ` · ${rejectedMonth} pedidos recusados (ver Actividade)` : ""}
      </p>

      <Tabs defaultValue="sales">
        <TabsList>
          {TABS.map((t) => {
            const inTab = PROVIDERS.filter((p) => p.group === t.id);
            const on = inTab.filter((p) => statusOf(p, byProvider.get(p.id)).tone === "on").length;
            return (
              <TabsTrigger key={t.id} value={t.id}>
                {t.title}
                {on > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{on}</span>}
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="channels">Canais das automações</TabsTrigger>
          <TabsTrigger value="activity">Actividade</TabsTrigger>
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-6 space-y-5">
            <p className="text-sm text-muted-foreground">{t.description}</p>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {PROVIDERS.filter((p) => p.group === t.id).map((p) => (
                    <ProviderCard
                      key={p.id}
                      info={p}
                      row={byProvider.get(p.id)}
                      payments={payments}
                      onOpen={() => setOpen(p)}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        ))}

        <TabsContent value="channels" className="mt-6">
          <AutomationChannels
            isTest={Boolean(workspace?.isTest)}
            webhookReady={Boolean(byProvider.get("outgoing_webhook")?.enabled)}
            whatsapp={byProvider.get("whatsapp")}
            onOpen={setChannel}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Activity events={events} />
        </TabsContent>
      </Tabs>

      {channel && orgId && (
        <ChannelDialog
          channel={channel}
          isTest={Boolean(workspace?.isTest)}
          webhookReady={Boolean(byProvider.get("outgoing_webhook")?.enabled)}
          whatsapp={byProvider.get("whatsapp")}
          organizationId={orgId}
          onChannel={setChannel}
          onWebhook={() => {
            setChannel(null);
            setOpen(providerInfo("outgoing_webhook") ?? null);
          }}
          onClose={() => setChannel(null)}
        />
      )}

      {open && orgId && (
        <SetupSheet
          info={open}
          row={byProvider.get(open.id)}
          events={events}
          organizationId={orgId}
          onClose={() => setOpen(null)}
        />
      )}
    </AppShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function ProviderCard({
  info,
  row,
  payments,
  onOpen,
}: {
  info: ProviderInfo;
  row: IntegrationRow | undefined;
  payments: Payments;
  onOpen: () => void;
}) {
  const status = statusOf(info, row);
  const stats = statsFor(info.id, payments);
  return (
    <article className="flex flex-col rounded-card bg-card p-5 transition-shadow hover:shadow-[var(--shadow-raised)]">
      <div className="flex items-start justify-between gap-3">
        <Logo id={info.id} />
        <StatusPill status={status} />
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <h3 className="font-semibold">{info.name}</h3>
        <span className="text-xs text-muted-foreground">{info.category}</span>
      </div>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{info.blurb}</p>
      {row && info.group === "sales" && (
        <p className="mt-3 text-xs text-muted-foreground">
          {stats.sales} vendas (30 dias)
          {stats.failed ? ` · ${stats.failed} pagamentos falhados` : ""} · último pedido{" "}
          {row.last_event_at ? relativeDays(row.last_event_at) : "ainda nenhum"}
        </p>
      )}
      <Button variant="outline" className="mt-4 w-full" onClick={onOpen}>
        {row ? "Gerir" : "Conectar"}
      </Button>
    </article>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input
        readOnly
        value={value}
        aria-label={label}
        className="font-mono text-xs"
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Copiar ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

function SetupSheet({
  info,
  row,
  events,
  organizationId,
  onClose,
}: {
  info: ProviderInfo;
  row: IntegrationRow | undefined;
  events: Events;
  organizationId: string;
  onClose: () => void;
}) {
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [secretInput, setSecretInput] = useState("");
  // Segredo gerado por nós: mostrado uma única vez; depois só se sabe que existe.
  const [shownSecret, setShownSecret] = useState<string | null>(null);
  const [setting, setSetting] = useState(
    info.setting ? (row?.settings?.[info.setting.key] ?? "") : "",
  );

  const run = async (task: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try {
      await task();
      if (ok) toast.success(ok);
      invalidate(["integrations"]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar.");
    } finally {
      setBusy(false);
    }
  };

  const connect = () =>
    run(async () => {
      const secret = info.secret?.generate ? generateSecret() : "";
      await connectIntegration(organizationId, info.id, secret);
      if (secret) setShownSecret(secret);
    }, `${info.name} ligada. Siga os passos abaixo.`);

  const regenerate = () =>
    run(async () => {
      const secret = generateSecret();
      await updateIntegration(row!.id, { secret });
      setShownSecret(secret);
    }, "Novo segredo gerado. Actualize-o também na plataforma.");

  const settingValid = !info.setting || info.setting.pattern.test(setting.trim());
  const hookUrl = row ? `${publicOrigin()}/api/public/hooks/${row.endpoint_key}` : "";
  const isLocal = /\/\/(localhost|127\.|192\.168\.)/.test(hookUrl);
  const recent = events.filter((e) => e.provider === info.id).slice(0, 5);

  const field = (show: "url" | "secret" | "setting") => {
    if (!row) return null;
    if (show === "url") {
      return (
        <div className="space-y-1.5">
          <CopyField label="Endereço de ligação" value={hookUrl} />
          {isLocal && (
            <p className="text-xs text-warning-foreground">
              Versão local: as plataformas só conseguem enviar vendas quando a aplicação estiver
              publicada num domínio.
            </p>
          )}
        </div>
      );
    }
    if (show === "setting" && info.setting) {
      return (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Input
              value={setting}
              placeholder={info.setting.placeholder}
              aria-label={info.setting.label}
              aria-invalid={!settingValid}
              onChange={(e) => setSetting(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={busy || !settingValid || !setting.trim()}
              onClick={() =>
                run(
                  () =>
                    updateIntegration(row.id, {
                      settings: { ...row.settings, [info.setting!.key]: setting.trim() },
                    }),
                  "Guardado.",
                )
              }
            >
              Guardar
            </Button>
          </div>
          {!settingValid && setting.trim() && (
            <p className="text-xs text-destructive" role="alert">
              Formato inválido. Exemplo: {info.setting.placeholder}
            </p>
          )}
        </div>
      );
    }
    if (show === "secret" && info.secret) {
      if (shownSecret) {
        return (
          <div className="space-y-1.5">
            <CopyField label={info.secret.label} value={shownSecret} />
            <p className="text-xs text-muted-foreground" role="status">
              Copie-o agora: por segurança não o voltamos a mostrar.
            </p>
          </div>
        );
      }
      if (info.secret.generate) {
        return (
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <span className="text-muted-foreground">
              {info.secret.label}:{" "}
              <strong className="text-foreground">
                {row.has_secret ? "definido" : "sem segredo"}
              </strong>
            </span>
            <Button variant="outline" size="sm" onClick={regenerate} disabled={busy}>
              <RefreshCw /> {row.has_secret ? "Gerar novo" : "Gerar"}
            </Button>
          </div>
        );
      }
      return (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Input
              type="password"
              autoComplete="off"
              value={secretInput}
              aria-label={info.secret.label}
              placeholder={
                row.has_secret
                  ? `${info.secret.label} guardado · colar para substituir`
                  : info.secret.label
              }
              onChange={(e) => setSecretInput(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={busy || !secretInput.trim()}
              onClick={() =>
                run(async () => {
                  await updateIntegration(row.id, { secret: secretInput.trim() });
                  setSecretInput("");
                }, "Guardado.")
              }
            >
              Guardar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {row.has_secret && <span className="mr-1 font-medium text-success">✓ Guardado.</span>}
            {info.secret.help}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <Logo id={info.id} className="size-12" />
            <div className="min-w-0">
              <SheetTitle>{info.name}</SheetTitle>
              <SheetDescription>{info.category}</SheetDescription>
            </div>
            <span className="ml-auto">
              <StatusPill status={statusOf(info, row)} />
            </span>
          </div>
          <p className="pt-2 text-sm text-muted-foreground">{info.blurb}</p>
        </SheetHeader>

        <div className="mt-6 space-y-7 text-sm">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Como ligar</h3>
              {info.dashboardUrl && (
                <a
                  href={info.dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Abrir {info.name} <ExternalLink className="size-3" aria-hidden />
                </a>
              )}
            </div>
            {!row && (
              <div className="mb-4 rounded-lg border border-dashed p-4">
                <p className="text-muted-foreground">
                  Ao ligar, criamos o seu endereço de ligação
                  {info.secret?.generate ? " e um segredo único" : ""}. Depois é só seguir os
                  passos.
                </p>
                <Button onClick={connect} disabled={busy} className="mt-3 w-full">
                  Ligar {info.name}
                </Button>
              </div>
            )}
            <ol className="space-y-4">
              {info.steps.map((step, i) => {
                const text = typeof step === "string" ? step : step.text;
                const show = typeof step === "string" ? null : step.show;
                return (
                  <li key={i} className="flex gap-3">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                        row ? "border-foreground/20" : "text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                      <p className={row ? "" : "text-muted-foreground"}>{text}</p>
                      {show && field(show)}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {info.group === "ads" && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Com visitantes da União Europeia, a lei exige pedir consentimento de cookies antes de
              activar pixels de anúncios.
            </p>
          )}

          {row && info.group === "sales" && (
            <section>
              <h3 className="mb-2 font-semibold">Últimos pedidos</h3>
              {recent.length === 0 ? (
                <p className="text-muted-foreground">
                  Ainda não chegou nada. Use o botão de teste da plataforma para confirmar a
                  ligação.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {recent.map((e) => {
                    const st = EVENT_STATUS[e.status] ?? {
                      label: e.status,
                      variant: "secondary" as const,
                    };
                    return (
                      <li key={e.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate">
                            {e.buyer_email ?? e.event_type ?? "Pedido"}
                            {e.amount_value !== null
                              ? ` · ${money(e.amount_value, e.currency)}`
                              : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {relativeDays(e.received_at)}
                            {e.reason ? ` · ${e.reason}` : ""}
                          </p>
                        </div>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {row && (
            <div className="flex items-center justify-between border-t pt-4">
              <label className="flex items-center gap-2">
                <Switch
                  checked={row.enabled}
                  onCheckedChange={(enabled) => run(() => updateIntegration(row.id, { enabled }))}
                  disabled={busy}
                />
                {row.enabled ? "Activa" : "Desligada"}
              </label>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Remover a ligação à ${info.name}? O histórico de vendas mantém-se.`,
                    )
                  )
                    return;
                  void run(async () => {
                    const { error } = await supabase.from("integrations").delete().eq("id", row.id);
                    if (error) throw error;
                    onClose();
                  }, "Ligação removida.");
                }}
              >
                Remover
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Activity({ events }: { events: Events }) {
  if (events.length === 0) {
    return (
      <div className="rounded-card bg-card px-6 py-14 text-center">
        <Webhook className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <h2 className="mt-3 font-semibold">Ainda não chegou nada</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Quando uma plataforma enviar uma venda ou um teste para o endereço de ligação, aparece
          aqui com o estado e, se for recusado, o motivo.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-card bg-card">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-muted">
          <tr>
            {["Quando", "Plataforma", "Estado", "Comprador", "Valor", "Detalhe"].map((h) => (
              <th key={h} className="p-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const st = EVENT_STATUS[e.status] ?? { label: e.status, variant: "secondary" as const };
            const info = providerInfo(e.provider);
            return (
              <tr key={e.id} className="border-t align-top">
                <td className="whitespace-nowrap p-4 text-muted-foreground">
                  {formatDateTime(e.received_at)}
                </td>
                <td className="p-4">
                  <span className="flex items-center gap-2">
                    {info && <Logo id={info.id} className="size-6" />}
                    {info?.name ?? e.provider}
                  </span>
                </td>
                <td className="p-4">
                  <Badge variant={st.variant}>{st.label}</Badge>
                </td>
                <td className="max-w-[220px] truncate p-4">{e.buyer_email ?? "—"}</td>
                <td className="whitespace-nowrap p-4 tabular-nums">
                  {money(e.amount_value, e.currency)}
                </td>
                <td className="p-4 text-muted-foreground">
                  {[e.event_type, e.product_name, e.reason].filter(Boolean).join(" · ") || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
