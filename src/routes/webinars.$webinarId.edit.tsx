import { friendlyError } from "@/lib/friendly-error";
import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  Eye,
  Flag,
  Gift,
  Loader2,
  LogIn,
  MessagesSquare,
  Radio,
  ShoppingBag,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app-shell";
import { PageSkeleton } from "@/components/page-skeleton";
import { AiCommentsDialog } from "@/components/ai-comments-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  defaultAiSettings,
  startAiJob,
  useAiJob,
  type AiSettings,
  type DraftComment,
  type TranscriptSegment,
} from "@/lib/ai-comment-jobs";
import { getWebinarAnalysis, getWebinarTranscript, saveWebinarTranscript } from "@/lib/ai-comments.functions";
import { curveBounds } from "@/lib/audience-curve";
import {
  applyChatRealism,
  DEFAULT_CHAT_RULES,
  hostQuestions,
  namePool,
  parseCommentSheet,
  type ChatDraft,
  type ChatRules,
} from "@/lib/chat-realism";
import {
  providerLabels,
  publicOrigin,
  slugify,
  statusFromLifecycle,
  useAudienceConfiguration,
  useInvalidate,
  useScheduledComments,
  useVideoSources,
  useWebinar,
  useWebinarAutomations,
  useWorkspace,
  type WebinarStatus,
} from "@/lib/data";
import {
  audienceModeFor,
  buildFormatCurve,
  clock,
  curveValueAt,
  inferAudienceFormat,
  type AudienceContext,
  type AudienceFormat,
} from "@/lib/room-logic";
import { formatSessionStart, lifecycleLabel, sessionWindow, webinarLifecycle } from "@/lib/schedule";
import { toStorageOffsets } from "@/lib/temporal/placement";
import { cn, offerUrl } from "@/lib/utils";
import {
  MAX_VIDEO_BYTES,
  VIDEO_BUCKET,
  createVideoUpload,
  formatBytes,
  safeObjectName,
  type VideoUploadHandle,
  type VideoUploadProgress,
} from "@/lib/video-upload";
import {
  EDITOR_STEPS,
  isoFromLocalInput,
  localInputFromIso,
  offerTiming,
  statusOnSave,
  stepFromSearch,
  webinarIssues,
  type EditorStep,
} from "@/lib/webinar-draft";
import { useSimulatedPurchases, useSocialProof } from "@/components/social-proof-editor";
import { EntryScreen, entryLiveLabel, isDirectVideo } from "@/components/room/entry-screen";
import type { Reaction } from "@/components/room/room-parts";
import { emptyEditorForm, type EditorForm, type FocusProps } from "@/components/webinar-editor/form";
import { HelpButton } from "@/components/webinar-editor/ui";
import type { HelpTopic } from "@/components/webinar-editor/help";
import {
  DeviceStage,
  DeviceToggle,
  ExpandButton,
  FullScreen,
  WaitingPreview,
  WhatsAppPreview,
  type Device,
} from "@/components/webinar-editor/preview";
import {
  RoomPreview,
  type PreviewMine,
  type RoomTab,
} from "@/components/webinar-editor/room-preview";
import {
  DEFAULT_LANE,
  TimelineDock,
  type LaneKey,
  type RiskZone,
} from "@/components/webinar-editor/timeline-dock";
import { PublishPage, type LaunchIssue } from "@/components/webinar-editor/publish-page";
import { StepInicio } from "@/components/webinar-editor/steps/inicio";
import { StepEntrada, type EntryMoment } from "@/components/webinar-editor/steps/entrada";
import { StepVideo, type EditorClock } from "@/components/webinar-editor/steps/video";
import { StepChat, type ChatWay } from "@/components/webinar-editor/steps/chat";
import { StepAudiencia } from "@/components/webinar-editor/steps/audiencia";
import { StepOferta } from "@/components/webinar-editor/steps/oferta";
import { demoSales, SALES_QTY, StepVendas, type SalesQty } from "@/components/webinar-editor/steps/vendas";
import { StepAutomacoes } from "@/components/webinar-editor/steps/automacoes";
import { StepAgente } from "@/components/webinar-editor/steps/agente";
import { StepAgenda, type ScheduleKind } from "@/components/webinar-editor/steps/agenda";
import type { Database } from "@/integrations/supabase/types";

type Provider = Database["public"]["Enums"]["video_provider"];

export const Route = createFileRoute("/webinars/$webinarId/edit")({
  // A sessão do organizador só existe no browser: sem isto o pedido corre no
  // servidor sem autorização e a página fica em branco.
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { step?: string | undefined } =>
    typeof search["step"] === "string" ? { step: search["step"] } : {},
  head: () => ({
    meta: [
      { title: "Editar webinar | Convertewebinar" },
      { name: "description", content: "Edite a entrada, o vídeo, o chat, a oferta e a agenda do webinar." },
      { property: "og:title", content: "Editar webinar | Convertewebinar" },
      { property: "og:description", content: "Configuração completa do webinar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditWebinar,
});

/** Ícone, título e ajuda de cada etapa (versão 13 do protótipo). A ordem e os grupos vêm do rascunho. */
const STEP_UI: Record<EditorStep, { icon: LucideIcon; title: string; help: HelpTopic }> = {
  inicio: { icon: Flag, title: "Webinar e apresentador", help: "inicio" },
  entrada: { icon: LogIn, title: "Dados de quem entra", help: "entrada" },
  video: { icon: Video, title: "Vídeo", help: "video" },
  chat: { icon: MessagesSquare, title: "Comentários simulados", help: "chat" },
  audiencia: { icon: Users, title: "Audiência", help: "audiencia" },
  oferta: { icon: Gift, title: "Oferta", help: "oferta" },
  vendas: { icon: ShoppingBag, title: "Vendas", help: "vendas" },
  automacoes: { icon: Zap, title: "Automações", help: "automacoes" },
  agente: { icon: Bot, title: "Agente IA", help: "agente" },
  agenda: { icon: CalendarDays, title: "Agenda", help: "agenda" },
};
const STEPS = EDITOR_STEPS.map((s) => ({ ...s, ...STEP_UI[s.id] }));
const GROUP_NAME = { antes: "Antes da sala", sala: "Na sala", depois: "Depois da sala", lancar: "Lançar" } as const;

/** Etapas da sala: mostram a linha do vídeo em baixo. */
const DOCK_STEPS: readonly EditorStep[] = ["video", "chat", "audiencia", "oferta", "vendas"];
/** Os ecrãs da sala por baixo do aparelho, e a etapa que cada um abre. */
const SCREENS: [EditorStep, string][] = [
  ["video", "Webinar"],
  ["audiencia", "Audiência"],
  ["vendas", "Vendas"],
  ["chat", "Chat"],
  ["agente", "Suporte"],
];

const CHAT_KEY = (id: string) => `cw:chat-rules:${id}`;

/** As regras do chat são o pedido ao gerador: ficam no browser, como as definições da geração. */
function loadChatRules(webinarId: string): ChatRules {
  try {
    const raw = window.localStorage.getItem(CHAT_KEY(webinarId));
    return raw ? { ...DEFAULT_CHAT_RULES, ...(JSON.parse(raw) as Partial<ChatRules>) } : DEFAULT_CHAT_RULES;
  } catch {
    return DEFAULT_CHAT_RULES;
  }
}

/** As regras do chat no pedido ao gerador de comentários. */
function generatorSettings(rules: ChatRules): AiSettings {
  return {
    ...defaultAiSettings,
    variant: rules.country === "br" ? "pt-BR" : rules.country === "mix" ? "mixed" : "pt-PT",
    level: rules.level === "baixa" ? "low" : rules.level === "alta" ? "high" : "medium",
    emojis: rules.emoji && rules.tone !== "formal" ? "normal" : "low",
    tone: rules.tone === "vendas" ? "excited" : rules.tone === "formal" ? "professional" : "natural",
  };
}

function EditWebinar() {
  const { webinarId } = Route.useParams();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: workspace } = useWorkspace();
  const organizationId = workspace?.organizationId ?? null;
  const { data: webinar, isLoading } = useWebinar(webinarId);
  const { data: videoSources = [] } = useVideoSources(workspace?.organizationId);
  const { data: comments = [] } = useScheduledComments(webinarId);
  const { data: audience } = useAudienceConfiguration(webinarId);
  const { data: simulatedPurchases = [] } = useSimulatedPurchases(webinarId);
  const { data: socialProof } = useSocialProof(webinarId);
  const { data: automations } = useWebinarAutomations(webinarId);

  const initialStep = Route.useSearch().step;
  const [step, setStepState] = useState<EditorStep>(() => stepFromSearch(initialStep));
  const [form, setForm] = useState<EditorForm>(emptyEditorForm);
  const set = useCallback((patch: Partial<EditorForm>) => setForm((prev) => ({ ...prev, ...patch })), []);

  /* ---------- Gravação ---------- */

  const [saving, setSaving] = useState(false);
  // O formulário como está gravado: o que difere dele são alterações por gravar.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [product, setProduct] = useState("");
  const [savedProduct, setSavedProduct] = useState("");
  const [format, setFormat] = useState<AudienceFormat>("dynamic");
  const [range, setRange] = useState({ min: 200, max: 600 });
  const [savedAudience, setSavedAudience] = useState<string | null>(null);
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>("single");
  // Carrega o formulário uma única vez por webinar: assim uma atualização em
  // segundo plano não apaga o que o organizador está a escrever.
  const hydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!webinar || hydratedRef.current === webinar.id) return;
    hydratedRef.current = webinar.id;
    const base = emptyEditorForm();
    const loaded: EditorForm = {
      ...base,
      internal_name: webinar.internal_name,
      public_title: webinar.public_title,
      description: webinar.description,
      host_name: webinar.host_name ?? "",
      host_role: webinar.host_role ?? "",
      host_avatar_url: webinar.host_avatar_url ?? "",
      chat_pin_title: webinar.chat_pin_title ?? base.chat_pin_title,
      chat_pin_message: webinar.chat_pin_message ?? "",
      offer_pin_title: webinar.offer_pin_title ?? base.offer_pin_title,
      offer_pin_message: webinar.offer_pin_message ?? "",
      slug: webinar.slug,
      scheduled_at: localInputFromIso(webinar.scheduled_at, webinar.timezone ?? "Europe/Lisbon"),
      session_end_time: webinar.session_end_time ?? "",
      status: webinar.status,
      video_source_id: webinar.video_source_id ?? "none",
      replay_enabled: webinar.replay_enabled,
      waiting_room_enabled: webinar.waiting_room_enabled,
      prelive_enabled: webinar.prelive_enabled ?? false,
      prelive_seconds: webinar.prelive_seconds ?? 300,
      prelive_sound: webinar.prelive_sound ?? true,
      prelive_message: webinar.prelive_message ?? base.prelive_message,
      prelive_template: webinar.prelive_template ?? base.prelive_template,
      prelive_appearance: base.prelive_appearance,
      schedule_mode: webinar.schedule_mode === "jit" ? "jit" : "single",
      recurrence_enabled: webinar.recurrence_enabled ?? false,
      recurrence_pattern: webinar.recurrence_pattern === "weekly" ? "weekly" : "daily",
      recurrence_weekday: String(webinar.recurrence_weekday ?? 1),
      recurrence_start_time: webinar.recurrence_start_time ?? "",
      recurrence_end_time: webinar.recurrence_end_time ?? "",
      jit_interval_minutes: String(webinar.jit_interval_minutes ?? 15),
      timezone: webinar.timezone ?? "Europe/Lisbon",
      easy_access: webinar.easy_access ?? false,
      sync_video_with_start: webinar.sync_video_with_start ?? false,
      cta_text: webinar.cta_text ?? "",
      cta_url: webinar.cta_url ?? "",
      cta_color: webinar.cta_color ?? "green",
      cta_price_original: webinar.cta_price_original ?? "",
      cta_price_now: webinar.cta_price_now ?? "",
      cta_image_url: webinar.cta_image_url ?? "",
      cta_countdown_seconds: String(webinar.cta_countdown_seconds ?? 300),
      cta_start_seconds: String(webinar.cta_start_seconds ?? webinar.pitch_seconds ?? ""),
      cta_end_seconds: webinar.cta_end_seconds != null ? String(webinar.cta_end_seconds) : "",
      registration_headline: webinar.registration_headline,
      registration_subtitle: webinar.registration_subtitle,
      registration_button_text: webinar.registration_button_text,
      registration_collect_phone: webinar.registration_collect_phone,
      registration_require_phone: webinar.registration_require_phone,
      registration_cover_url: webinar.registration_cover_url ?? "",
      registration_badge_text: webinar.registration_badge_text ?? "",
      registration_progress_enabled: webinar.registration_progress_enabled ?? false,
      registration_progress_value: String(webinar.registration_progress_value ?? 92),
      registration_scarcity_note: webinar.registration_scarcity_note ?? "",
      room_theme: webinar.room_theme === "light" ? "light" : "dark",
      share_title: webinar.share_title ?? "",
      share_description: webinar.share_description ?? "",
      share_image_url: webinar.share_image_url ?? "",
      webhook_url: webinar.webhook_url ?? "",
      webhook_enabled: webinar.webhook_enabled ?? false,
    };
    // A aparência da contagem guardada continua igual: o editor não a mostra, mas não a apaga.
    loaded.prelive_appearance = (webinar.prelive_appearance ?? base.prelive_appearance) as EditorForm["prelive_appearance"];
    setForm(loaded);
    setSavedSnapshot(JSON.stringify(loaded));
    setScheduleKind(
      loaded.schedule_mode === "jit"
        ? "jit"
        : loaded.recurrence_enabled
          ? "repeat"
          : loaded.scheduled_at || loaded.status === "draft"
            ? "single"
            : "ondemand",
    );
  }, [webinar]);

  const productLoadedRef = useRef(false);
  useEffect(() => {
    if (socialProof === undefined || productLoadedRef.current) return;
    productLoadedRef.current = true;
    setProduct(socialProof?.product_name ?? "");
    setSavedProduct(socialProof?.product_name ?? "");
  }, [socialProof]);

  /* ---------- Vídeo, transcrição e análise ---------- */

  const selectedVideo = videoSources.find((v) => v.id === form.video_source_id) ?? null;
  const duration = selectedVideo?.duration_seconds || webinar?.duration_seconds || 0;
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const { data: savedTranscript } = useQuery({
    queryKey: ["webinar-transcript", webinarId],
    queryFn: async () => (await getWebinarTranscript({ data: { webinarId } })).transcript,
  });
  useEffect(() => {
    if (savedTranscript?.length) setTranscript((current) => (current.length ? current : savedTranscript));
  }, [savedTranscript]);
  const keepTranscript = (segments: TranscriptSegment[]) => {
    setTranscript(segments);
    void saveWebinarTranscript({ data: { webinarId, transcript: segments } }).catch(() => {});
  };
  const speech = useMemo(() => [...transcript].sort((a, b) => a.at - b.at), [transcript]);
  const speechAt = useCallback(
    (seconds: number) => {
      let found: string | null = null;
      for (const s of speech) {
        if (s.at > seconds) break;
        found = s.text;
      }
      return found;
    },
    [speech],
  );
  const questions = useMemo(() => hostQuestions(speech), [speech]);

  const aiJob = useAiJob(webinarId);
  const { data: savedAnalysis, isPending: analysisPending } = useQuery({
    queryKey: ["webinar-analysis", webinarId],
    queryFn: async () => (await getWebinarAnalysis({ data: { webinarId } })).analysis,
  });
  const analysis = aiJob?.analysis ?? savedAnalysis ?? null;
  // Os momentos da análise: risco de perder audiência, interesse e o minuto sugerido para o pitch.
  const moments = useMemo(
    () =>
      (analysis?.segments ?? []).map((segment) => {
        const risk = String(segment.dropRisk);
        return {
          from: segment.from,
          to: segment.to,
          kind: segment.kind,
          risk: (/alt|high/i.test(risk) ? "alto" : /mod|med/i.test(risk) ? "moderado" : "baixo") as RiskZone["risk"],
          engagement: segment.engagement,
        };
      }),
    [analysis],
  );
  const suggestedPitch = useMemo(() => {
    const transition = moments.find((m) => /oferta|pitch|cta/i.test(m.kind));
    return transition ? Math.round(transition.from) : null;
  }, [moments]);
  const engagementAt = useMemo(
    () =>
      moments.length
        ? (seconds: number) => moments.find((m) => seconds >= m.from && seconds < m.to)?.engagement ?? null
        : undefined,
    [moments],
  );

  /* ---------- Relógio do editor: o vídeo dá o tempo à sala ---------- */

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      setT((prev) => {
        const next = prev + dt;
        if (duration > 0 && next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
    }, 220);
    return () => window.clearInterval(timer);
  }, [playing, duration]);
  const seek = useCallback((seconds: number) => setT(Math.max(0, Math.min(duration || seconds, seconds))), [duration]);
  const editorClock: EditorClock = {
    t,
    duration: Math.max(1, duration),
    playing,
    toggle: () => setPlaying((p) => !p),
    seek,
  };

  /* ---------- Estado da pré-visualização ---------- */

  const [device, setDevice] = useState<Device>("desktop");
  const [full, setFull] = useState(false);
  const [roomTab, setRoomTab] = useState<RoomTab | null>(null);
  const [entryMoment, setEntryMoment] = useState<EntryMoment>(1);
  const [entryMode, setEntryMode] = useState<"page" | "own">("page");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [mine, setMine] = useState<PreviewMine[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [dockOpen, setDockOpen] = useState(false);
  const [lane, setLane] = useState<LaneKey>("fala");
  const [published, setPublished] = useState(false);
  const [agentState, setAgentState] = useState({ on: false, name: "Equipa" });
  const focus: FocusProps = (key) => ({
    onFocus: () => setFocusKey(key),
    onBlur: () => setFocusKey((k) => (k === key ? null : k)),
  });
  const heart = () => {
    const now = Date.now();
    const add = Array.from({ length: 3 }, (_, i) => ({
      id: `${now}-${i}`,
      offset: Math.round((Math.random() - 0.5) * 60),
      size: 20 + Math.round(Math.random() * 8),
    }));
    add.forEach((r, i) => window.setTimeout(() => setReactions((list) => [...list.slice(-20), r]), i * 110));
    window.setTimeout(() => setReactions((list) => list.filter((r) => !add.some((a) => a.id === r.id))), 3200);
  };

  const setStep = (next: EditorStep) => {
    setStepState(next);
    setPublished(false);
    setPlaying(false);
    setRoomTab(null);
    setFocusKey(null);
    setLane(DEFAULT_LANE[next] ?? "fala");
    // Cada etapa leva o vídeo ao momento que lhe interessa.
    const start = form.cta_start_seconds.trim() === "" ? null : Number(form.cta_start_seconds);
    if (next === "oferta") seek((start ?? suggestedPitch ?? t) + 3);
    if (next === "vendas" && simulatedPurchases[0]) seek(simulatedPurchases[0].offset_seconds + 1);
    if (next === "audiencia") seek(moments.find((m) => m.risk === "alto" && m.from > 30)?.from ?? t);
  };

  /* ---------- Audiência ---------- */

  const pitchSeconds = form.cta_start_seconds.trim() === "" ? null : Number(form.cta_start_seconds) || 0;
  const audienceCtx: AudienceContext = useMemo(
    () => ({ durationSeconds: duration, pitchSeconds: pitchSeconds ?? suggestedPitch, engagementAt }),
    [duration, pitchSeconds, suggestedPitch, engagementAt],
  );
  // O que está gravado: o formato, o intervalo e, em «Cresce até à oferta», o minuto que dá a forma.
  const audienceKey = (f: AudienceFormat, r: { min: number; max: number }) =>
    JSON.stringify({ f, ...r, pitch: f === "cresce" ? (pitchSeconds ?? suggestedPitch) : null });
  const audienceLoadedRef = useRef(false);
  useEffect(() => {
    // Espera pela análise: o formato «Acompanha a fala» só se reconhece com ela.
    if (audience === undefined || audienceLoadedRef.current || !webinar || analysisPending) return;
    audienceLoadedRef.current = true;
    const bounds = curveBounds(audience?.curve);
    const nextRange = bounds && bounds.max > 0 ? { min: bounds.min, max: bounds.max } : { min: 200, max: 600 };
    const nextFormat = audience ? inferAudienceFormat(audience.mode, audience.curve, audienceCtx) : "dynamic";
    setRange(nextRange);
    setFormat(nextFormat);
    setSavedAudience(audience ? audienceKey(nextFormat, nextRange) : null);
  }, [audience, webinar, audienceCtx, analysisPending]);
  const curve = useMemo(
    () => (format === "real" ? [] : buildFormatCurve(format === "mista" ? "dynamic" : format, range.min, range.max, audienceCtx)),
    [format, range.min, range.max, audienceCtx],
  );

  const saveAudience = async (): Promise<boolean> => {
    if (!organizationId) return false;
    if (savedAudience === audienceKey(format, range)) return true;
    const { error } = await supabase.from("audience_configuration").upsert(
      {
        webinar_id: webinarId,
        organization_id: organizationId,
        mode: audienceModeFor(format),
        curve,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "webinar_id" },
    );
    if (error) {
      toast.error(friendlyError(error));
      return false;
    }
    setSavedAudience(audienceKey(format, range));
    invalidate(["audience-configuration"]);
    return true;
  };

  const dirty =
    (savedSnapshot !== null && JSON.stringify(form) !== savedSnapshot) ||
    product !== savedProduct ||
    (savedAudience !== null && audienceKey(format, range) !== savedAudience);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useBlocker({
    shouldBlockFn: ({ current, next }) =>
      dirtyRef.current &&
      current.pathname !== next.pathname &&
      !window.confirm("Há alterações por gravar. Sair mesmo assim?"),
    enableBeforeUnload: () => dirtyRef.current,
  });


  /* ---------- Produto e compras de demonstração ---------- */

  const saveProduct = async (changes: { enabled?: boolean } = {}): Promise<boolean> => {
    if (!organizationId) return false;
    if (product === savedProduct && changes.enabled === undefined) return true;
    const { error } = await supabase.from("social_proof_settings").upsert(
      {
        webinar_id: webinarId,
        organization_id: organizationId,
        product_name: product.trim(),
        ...changes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "webinar_id" },
    );
    if (error) {
      toast.error(friendlyError(error));
      return false;
    }
    setSavedProduct(product);
    invalidate(["social-proof"]);
    return true;
  };

  const [salesBusy, setSalesBusy] = useState(false);
  const salesEnabled = Boolean(socialProof?.enabled);
  const salesQty: SalesQty =
    simulatedPurchases.length >= 10 ? "muitas" : simulatedPurchases.length > 0 && simulatedPurchases.length <= 3 ? "poucas" : "moderadas";
  const regenerateSales = async (qty: SalesQty) => {
    if (!organizationId) return;
    const name = product.trim() || "a vaga";
    const { error: deleteError } = await supabase.from("simulated_purchase_events").delete().eq("webinar_id", webinarId);
    if (deleteError) throw deleteError;
    const rows = demoSales(SALES_QTY[qty], pitchSeconds, duration).map((s) => ({
      webinar_id: webinarId,
      organization_id: organizationId,
      buyer_name: s.buyer,
      product_name: name,
      message: "",
      offset_seconds: s.at,
    }));
    const { error } = await supabase.from("simulated_purchase_events").insert(rows);
    if (error) throw error;
    invalidate(["simulated-purchases"]);
  };
  const setSales = async (enabled: boolean, qty: SalesQty) => {
    setSalesBusy(true);
    try {
      if (enabled && (simulatedPurchases.length === 0 || qty !== salesQty)) await regenerateSales(qty);
      if (enabled !== salesEnabled) await saveProduct({ enabled });
      if (enabled) {
        const first = demoSales(SALES_QTY[qty], pitchSeconds, duration)[0];
        if (first) seek(first.at + 1);
      }
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível mudar as compras de demonstração."));
    } finally {
      setSalesBusy(false);
    }
  };

  /* ---------- Gravar ---------- */

  const lifecycle = webinarLifecycle(
    {
      schedule_mode: form.schedule_mode,
      scheduled_at: isoFromLocalInput(form.scheduled_at, form.timezone),
      session_end_time: form.session_end_time || null,
      recurrence_enabled: form.recurrence_enabled,
      recurrence_pattern: form.recurrence_pattern,
      recurrence_weekday: Number(form.recurrence_weekday) || 0,
      recurrence_start_time: form.recurrence_start_time,
      recurrence_end_time: form.recurrence_end_time,
      jit_interval_minutes: Number(form.jit_interval_minutes) || 15,
      timezone: form.timezone,
      duration_seconds: duration,
    },
    Date.now(),
  );
  const derivedStatus: WebinarStatus =
    lifecycle.kind === "on_demand" && form.status === "draft" ? "draft" : statusFromLifecycle(lifecycle, form.replay_enabled);

  const lastDateRef = useRef("");
  const chooseScheduleKind = (kind: ScheduleKind) => {
    if (form.scheduled_at) lastDateRef.current = form.scheduled_at;
    setScheduleKind(kind);
    if (kind === "jit") set({ schedule_mode: "jit", recurrence_enabled: false });
    if (kind === "repeat")
      set({
        schedule_mode: "single",
        recurrence_enabled: true,
        recurrence_start_time: form.recurrence_start_time || form.scheduled_at.split("T")[1] || "20:00",
      });
    if (kind === "single")
      set({ schedule_mode: "single", recurrence_enabled: false, scheduled_at: form.scheduled_at || lastDateRef.current });
    // Sem data, cada pessoa vê desde o início quando entra.
    if (kind === "ondemand") set({ schedule_mode: "single", recurrence_enabled: false, scheduled_at: "" });
  };

  const draftIssues = webinarIssues(form, { durationSeconds: duration }).filter(
    (issue) => !(scheduleKind === "ondemand" && issue.field === "scheduled_at"),
  );
  const sessionEnded = (() => {
    if (scheduleKind !== "single" || lifecycle.kind !== "session" || lifecycle.state !== "finished") return null;
    return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", timeZone: form.timezone }).format(
      new Date(lifecycle.startMs),
    );
  })();
  const offerVisible = Boolean(form.cta_text.trim());
  const launchIssues: LaunchIssue[] = [
    ...draftIssues.map((issue) => ({ step: issue.step, title: issue.message, detail: issue.blocking ? "Impede gravar." : "" })),
    ...(offerVisible && !product.trim()
      ? [{ step: "oferta" as const, title: "Falta o nome do produto", detail: "Aparece na oferta e nas compras." }]
      : []),
    ...(offerVisible && pitchSeconds === null
      ? [
          {
            step: "oferta" as const,
            title: "Falta o minuto do pitch",
            detail: suggestedPitch !== null ? `A análise sugere ${clock(suggestedPitch)}.` : "Sem minuto, a oferta abre no início.",
          },
        ]
      : []),
    ...(automations && automations.workflows.length === 0
      ? [{ step: "automacoes" as const, title: "As automações não foram criadas", detail: "Ninguém recebe lembretes nem seguimento." }]
      : []),
    ...(sessionEnded ? [{ step: "agenda" as const, title: `A sessão de ${sessionEnded} já terminou`, detail: "Escolha uma nova data." }] : []),
  ];
  const stepsWithIssues = new Set<EditorStep>(launchIssues.map((issue) => issue.step));

  const save = async (options?: { silent?: boolean }): Promise<boolean> => {
    if (!webinar) return false;
    // Um erro que bloqueia não grava nada e leva ao passo do campo, também ao «Continuar».
    const blocking = draftIssues.find((issue) => issue.blocking);
    if (blocking) {
      toast.error(blocking.message);
      setStep(blocking.step);
      return false;
    }
    const offer = offerTiming(form);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("webinars")
        .update({
          internal_name: form.internal_name.trim(),
          public_title: form.public_title.trim(),
          description: form.description.trim(),
          host_name: form.host_name.trim(),
          host_role: form.host_role.trim(),
          host_avatar_url: form.host_avatar_url.trim(),
          chat_pin_title: form.chat_pin_title.trim() || "Participe no chat!",
          chat_pin_message: form.chat_pin_message.trim(),
          slug: slugify(form.slug || form.public_title || form.internal_name),
          scheduled_at: scheduleKind === "ondemand" ? null : isoFromLocalInput(form.scheduled_at, form.timezone),
          status: statusOnSave(webinar, derivedStatus),
          video_source_id: form.video_source_id === "none" ? null : form.video_source_id,
          replay_enabled: form.replay_enabled,
          waiting_room_enabled: form.waiting_room_enabled,
          schedule_mode: form.schedule_mode,
          recurrence_enabled: form.recurrence_enabled,
          recurrence_pattern: form.recurrence_pattern,
          recurrence_weekday: Number(form.recurrence_weekday) || 0,
          recurrence_start_time: form.recurrence_start_time,
          jit_interval_minutes: Math.max(5, Number(form.jit_interval_minutes) || 15),
          timezone: form.timezone,
          sync_video_with_start: form.sync_video_with_start,
          cta_text: form.cta_text.trim() || null,
          cta_url: offerUrl(form.cta_url),
          cta_price_original: form.cta_price_original.trim(),
          cta_price_now: form.cta_price_now.trim(),
          cta_countdown_seconds: Math.max(0, Number(form.cta_countdown_seconds) || 0),
          // Um só minuto do pitch: a oferta aparece nele e os segmentos e as métricas comparam com ele.
          cta_start_seconds: offer.start,
          pitch_seconds: offer.start,
          cta_end_seconds: offer.end,
          registration_headline: form.registration_headline.trim(),
          registration_subtitle: form.registration_subtitle.trim(),
          registration_button_text: form.registration_button_text.trim() || "Entrar na sala",
          registration_collect_phone: form.registration_collect_phone,
          registration_require_phone: form.registration_collect_phone && form.registration_require_phone,
          registration_badge_text: form.registration_badge_text.trim(),
          registration_progress_enabled: form.registration_progress_enabled,
          registration_progress_value: Math.min(100, Math.max(0, Number(form.registration_progress_value) || 0)),
          share_title: form.share_title.trim(),
          share_description: form.share_description.trim(),
          share_image_url: form.share_image_url.trim() || null,
          webhook_url: form.webhook_url.trim(),
          webhook_enabled: form.webhook_enabled && Boolean(form.webhook_url.trim()),
          updated_at: new Date().toISOString(),
        })
        .eq("id", webinarId);
      if (error) throw error;
      const productOk = await saveProduct();
      const audienceOk = await saveAudience();
      invalidate(["webinar", "webinars"]);
      if (!options?.silent) {
        if (!productOk) toast.error("Webinar guardado, mas o nome do produto não foi guardado.");
        else if (!audienceOk) toast.error("Webinar guardado, mas a audiência não foi guardada.");
        else toast.success("Alterações guardadas.");
      }
      setSavedSnapshot(JSON.stringify(form));
      return productOk && audienceOk;
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível guardar."));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const nextStep = STEPS[stepIndex + 1];
  const prevStep = STEPS[stepIndex - 1];
  const saveAndGo = () => {
    void save({ silent: true }).then((ok) => {
      if (!ok) return;
      if (nextStep) setStep(nextStep.id);
      else setPublished(true);
    });
  };
  const publish = () => {
    void save({ silent: true }).then((ok) => ok && setPublished(true));
  };

  /* ---------- Imagens ---------- */

  const [uploadingImage, setUploadingImage] = useState(false);
  const uploadImage = async (file: File, field: "host_avatar_url" | "share_image_url") => {
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${webinarId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("webinar-covers").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data, error: signError } = await supabase.storage
        .from("webinar-covers")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signError || !data) throw signError ?? new Error("Não foi possível preparar a imagem.");
      set({ [field]: data.signedUrl });
      toast.success("Imagem carregada. Guarde para aplicar.");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível carregar a imagem."));
    } finally {
      setUploadingImage(false);
    }
  };

  /* ---------- Vídeo: biblioteca, envio e link ---------- */

  const readDurationFromSrc = (src: string, timeoutMs = 10000) =>
    new Promise<number>((resolve) => {
      const el = document.createElement("video");
      el.preload = "metadata";
      let done = false;
      const finish = (seconds: number) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        el.removeAttribute("src");
        el.load();
        resolve(seconds);
      };
      const timer = window.setTimeout(() => finish(0), timeoutMs);
      el.onloadedmetadata = () => finish(Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration) : 0);
      el.onerror = () => finish(0);
      el.src = src;
    });

  const addVideoLink = async (input: { name: string; provider: Provider; url: string }) => {
    if (!organizationId) return false;
    if (!/^https?:\/\/.+/i.test(input.url)) {
      toast.error("Indique o link do vídeo, começado por https://");
      return false;
    }
    const detected = await readDurationFromSrc(input.url);
    const { data, error } = await supabase
      .from("video_sources")
      .insert({
        organization_id: organizationId,
        name: input.name,
        provider: input.provider,
        source_url: input.url,
        duration_seconds: detected,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(friendlyError(error));
      return false;
    }
    set({ video_source_id: data.id });
    invalidate(["video-sources"]);
    toast.success("Vídeo escolhido. Guarde as alterações.");
    return true;
  };

  const [videoUpload, setVideoUpload] = useState<{ file: File; progress: VideoUploadProgress } | null>(null);
  const videoUploadRef = useRef<VideoUploadHandle | null>(null);
  const uploading = videoUpload?.progress.status === "uploading" || videoUpload?.progress.status === "paused";

  const registerUploadedVideo = async (file: File, path: string, seconds: number) => {
    if (!organizationId) return;
    // O link assinado serve a pré-visualização e a transcrição; a sala pública assina a partir
    // de `storage_path` na altura da reprodução.
    const signed = await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (signed.error || !signed.data?.signedUrl) {
      toast.error(friendlyError(signed.error ?? "Não foi possível preparar o link do vídeo."));
      return;
    }
    const { data, error } = await supabase
      .from("video_sources")
      .insert({
        organization_id: organizationId,
        name: file.name.replace(/\.[^.]+$/, ""),
        provider: "upload",
        source_url: signed.data.signedUrl,
        storage_path: path,
        duration_seconds: seconds,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    set({ video_source_id: data.id });
    setVideoUpload(null);
    videoUploadRef.current = null;
    invalidate(["video-sources"]);
    toast.success(`Vídeo enviado (${formatBytes(file.size)}) e escolhido. Guarde as alterações.`);
  };

  const uploadVideoFile = async (file: File) => {
    if (!organizationId) return;
    if (videoUploadRef.current && uploading) {
      toast.error("Já há um envio em curso. Espere que termine ou cancele-o primeiro.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(`O ficheiro tem ${formatBytes(file.size)} e ultrapassa o limite de 5 GB por vídeo.`);
      return;
    }
    if (file.size === 0) {
      toast.error("O ficheiro está vazio.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const seconds = await readDurationFromSrc(objectUrl).finally(() => URL.revokeObjectURL(objectUrl));
    const path = `${organizationId}/${crypto.randomUUID()}-${safeObjectName(file.name)}`;
    const handle = createVideoUpload({
      file,
      path,
      onProgress: (progress) => {
        setVideoUpload({ file, progress });
        if (progress.status === "error" && progress.error) toast.error(progress.error);
      },
      onSuccess: (finalPath) => void registerUploadedVideo(file, finalPath, seconds),
    });
    videoUploadRef.current = handle;
    setVideoUpload({
      file,
      progress: {
        status: "uploading",
        bytesSent: 0,
        bytesTotal: file.size,
        percent: 0,
        error: null,
        recoverable: false,
        resumedFromBytes: null,
      },
    });
    await handle.start();
  };

  /* ---------- Chat ---------- */

  const [chatRules, setChatRules] = useState<ChatRules>(() => loadChatRules(webinarId));
  const updateRules = (patch: Partial<ChatRules>) =>
    setChatRules((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(CHAT_KEY(webinarId), JSON.stringify(next));
      } catch {
        /* sem armazenamento: ficam só nesta página */
      }
      return next;
    });
  const [chatWay, setChatWay] = useState<ChatWay>("ai");
  const [aiOpen, setAiOpen] = useState(false);

  // Quando a geração termina, abre a revisão no Chat.
  const announcedJobRef = useRef<number | null>(null);
  useEffect(() => {
    if (aiJob?.status !== "ready" || !aiJob.drafts?.length) return;
    if (announcedJobRef.current === aiJob.startedAt) return;
    announcedJobRef.current = aiJob.startedAt;
    setStep("chat");
    setAiOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiJob?.status, aiJob?.startedAt, aiJob?.drafts?.length]);

  const generate = () => {
    if (!selectedVideo) {
      toast.error("Escolha o vídeo primeiro, na etapa Vídeo.");
      return;
    }
    startAiJob({
      webinarId,
      webinarTitle: form.public_title || form.internal_name || "Webinar",
      settings: generatorSettings(chatRules),
      transcript,
      existing: comments.map((c) => ({ at: c.offset_seconds, author: c.author_name, message: c.message })),
      replaceAll: true,
      onTranscript: keepTranscript,
    });
  };

  const audienceNorm = useMemo(() => {
    if (format === "real" || range.max <= range.min || curve.length < 2) return undefined;
    return (seconds: number) => (curveValueAt(curve, seconds, duration) - range.min) / (range.max - range.min);
  }, [format, range.min, range.max, curve, duration]);

  /** Grava os comentários com as regras para não parecer falso; os escritos à mão ficam. */
  const insertComments = async (drafts: (ChatDraft & Partial<DraftComment>)[], replaceGenerated: boolean) => {
    if (!organizationId) throw new Error("Não foi possível identificar o seu espaço de trabalho.");
    if (replaceGenerated) {
      const { error } = await supabase
        .from("scheduled_comments")
        .delete()
        .eq("webinar_id", webinarId)
        .neq("comment_type", "manual");
      if (error) throw error;
    }
    const valid = drafts
      .map((d) => ({ d, ...toStorageOffsets({ at: d.at, atMs: d.at * 1000 }) }))
      .filter(({ offset_seconds }) => duration <= 0 || offset_seconds <= duration);
    if (valid.length === 0) throw new Error("Nenhum comentário cabe dentro da duração do vídeo.");
    const { error } = await supabase.from("scheduled_comments").insert(
      valid.map(({ d, offset_seconds, offset_ms }) => ({
        webinar_id: webinarId,
        organization_id: organizationId,
        author_name: d.author,
        message: d.message,
        offset_seconds,
        offset_ms,
        comment_type: d.tag ?? d.moment ?? "geral",
        ai_intent: d.kind ?? null,
        ai_persona: d.persona ?? null,
        trigger_type: d.causality?.triggerType ?? null,
        trigger_id: d.causality?.triggerId ?? null,
        trigger_start_ms: d.causality?.triggerStartMs ?? null,
        trigger_end_ms: d.causality?.triggerEndMs ?? null,
        temporal_relation: d.causality?.temporalRelation ?? null,
        reaction_latency_ms: d.causality?.reactionLatencyMs ?? null,
        generation_reason: d.causality?.generationReason ?? d.reason ?? null,
        causality_confidence: d.causality?.confidence ?? null,
        validation_action: d.validationAction ?? null,
        validation_rule: d.validationRule ?? null,
        transcript_version_id: d.transcriptVersionId ?? null,
      })),
    );
    if (error) throw error;
    invalidate(["scheduled-comments"]);
    return valid.length;
  };

  const realism = (drafts: (ChatDraft & Partial<DraftComment>)[]) =>
    applyChatRealism(drafts, chatRules, {
      durationSeconds: duration,
      pitchSeconds: pitchSeconds ?? suggestedPitch,
      questions: questions.map((q) => q.at),
      audienceAt: audienceNorm,
    }) as (ChatDraft & Partial<DraftComment>)[];

  const insertGenerated = async (drafts: DraftComment[]) => {
    const n = await insertComments(realism(drafts), true);
    const people = new Set(realism(drafts).map((d) => d.author)).size;
    toast.success(`${n} comentários de ${people} pessoas, no tom ${{ natural: "Natural", vendas: "Vendas", formal: "Formal" }[chatRules.tone]}.`);
  };

  const importSheet = async (file: File) => {
    try {
      const rows = parseCommentSheet(await file.text());
      if (rows.length === 0) {
        toast.error("A folha não tem linhas com minuto, nome e mensagem.");
        return;
      }
      const pool = namePool(chatRules.country);
      const named = rows.map((r, i) => ({ ...r, author: r.author || pool[i % pool.length]! }));
      const n = await insertComments(named, false);
      toast.success(`${n} comentários importados.`);
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível importar a folha."));
    }
  };

  const writeComment = async (at: number, message: string) => {
    const recent = new Set(comments.filter((c) => Math.abs(c.offset_seconds - at) < 120).map((c) => c.author_name));
    const pool = namePool(chatRules.country);
    const author = pool.find((name) => !recent.has(name)) ?? pool[comments.length % pool.length]!;
    try {
      await insertComments([{ at, author, message, tag: "manual" }], false);
      return true;
    } catch (error) {
      toast.error(friendlyError(error));
      return false;
    }
  };

  const removeComment = async (id: string) => {
    const { error } = await supabase.from("scheduled_comments").delete().eq("id", id);
    if (error) toast.error(friendlyError(error));
    else invalidate(["scheduled-comments"]);
  };

  /* ---------- Formulário para página própria ---------- */

  const { data: forms = [], refetch: refetchForms } = useQuery({
    queryKey: ["registration-forms", webinarId],
    queryFn: async () => {
      const { data, error } = await supabase.from("registration_forms").select("id").eq("webinar_id", webinarId).limit(1);
      if (error) throw error;
      return data ?? [];
    },
  });
  const [creatingForm, setCreatingForm] = useState(false);
  const createForm = async () => {
    if (!organizationId) return;
    setCreatingForm(true);
    const { error } = await supabase.from("registration_forms").insert({
      organization_id: organizationId,
      webinar_id: webinarId,
      name: "Formulário de inscrição",
      page_name: "Página de inscrição",
    });
    setCreatingForm(false);
    if (error) toast.error(friendlyError(error));
    else void refetchForms();
  };

  /* ---------- Eliminar ---------- */

  const removeWebinar = async () => {
    const { error } = await supabase.from("webinars").delete().eq("id", webinarId);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    invalidate(["webinars"]);
    toast.success("Webinar eliminado.");
    dirtyRef.current = false;
    await navigate({ to: "/webinars", search: { q: undefined } });
  };

  // Quando a oferta abre com o vídeo a tocar, a sala salta para o separador dela.
  const offerOpenNow = offerVisible && t >= (pitchSeconds ?? 0);
  useEffect(() => {
    if (offerOpenNow && playing) setRoomTab((current) => (current === "support" ? current : "offer"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerOpenNow]);

  /* ---------- Desenho ---------- */

  if (isLoading)
    return (
      <AppShell title="A carregar webinar" action={false}>
        <PageSkeleton variant="editor" />
      </AppShell>
    );

  if (!webinar)
    return (
      <AppShell title="Webinar não encontrado" action={false}>
        <p className="text-sm text-muted-foreground">Este webinar não existe ou não pertence ao seu workspace.</p>
      </AppShell>
    );

  const baseUrl = publicOrigin();
  const roomOrigin = baseUrl.replace(/^https?:\/\//, "");
  const roomSlug = slugify(form.slug || form.public_title || form.internal_name);
  const roomLink = `${baseUrl}/w/${roomSlug}`;
  const active = STEP_UI[step];
  const videoUrl = selectedVideo && isDirectVideo(selectedVideo.source_url, selectedVideo.provider) ? selectedVideo.source_url : null;
  const sales = simulatedPurchases.map((p) => ({
    id: p.id,
    at: p.offset_seconds,
    buyer: p.buyer_name,
    product: p.product_name || product.trim() || "a vaga",
  }));
  const shownSales = salesEnabled ? sales : [];
  const viewers = format === "real" ? 1 : curveValueAt(curve, t, duration);
  const nextWindow = sessionWindow(
    {
      schedule_mode: form.schedule_mode,
      scheduled_at: isoFromLocalInput(form.scheduled_at, form.timezone),
      recurrence_enabled: form.recurrence_enabled,
      recurrence_pattern: form.recurrence_pattern,
      recurrence_weekday: Number(form.recurrence_weekday) || 0,
      recurrence_start_time: form.recurrence_start_time,
      jit_interval_minutes: Number(form.jit_interval_minutes) || 15,
      timezone: form.timezone,
      duration_seconds: duration,
    },
    Date.now(),
  );
  const nextSession = nextWindow.startMs ? formatSessionStart(nextWindow.startMs, form.timezone) : null;

  // O ecrã que cada etapa mostra.
  type Screen = "entry-gate" | "entry-card" | "room" | "waiting" | "whatsapp";
  const screen: Screen =
    step === "inicio"
      ? "entry-card"
      : step === "entrada"
        ? entryMoment === 1
          ? "entry-gate"
          : entryMoment === 2
            ? "entry-card"
            : "room"
        : step === "agenda"
          ? form.waiting_room_enabled && scheduleKind !== "ondemand" && nextWindow.startMs && nextWindow.startMs > Date.now()
            ? "waiting"
            : "entry-card"
          : step === "automacoes"
            ? "whatsapp"
            : "room";
  const defaultTab: RoomTab = step === "oferta" ? "offer" : step === "agente" ? "support" : "chat";
  const tab = roomTab ?? defaultTab;
  const screenName = { "entry-gate": "Página de entrada", "entry-card": "Página de entrada", room: "Sala ao vivo", waiting: "Sala de espera", whatsapp: "WhatsApp" }[screen];
  const ScreenIcon = { "entry-gate": LogIn, "entry-card": LogIn, room: Radio, waiting: CalendarDays, whatsapp: MessagesSquare }[screen];
  const screenDevice: Device = screen === "whatsapp" ? "phone" : device;
  const live = entryLiveLabel(nextWindow.startMs, form.timezone, Date.now());

  const watchChat = () => {
    setRoomTab("chat");
    if (t < 40 || t > duration - 20) seek(Math.min(60, duration));
    setPlaying(true);
  };
  const watchOffer = () => {
    setRoomTab("chat");
    seek(Math.max(0, (pitchSeconds ?? 0) - 4));
    setPlaying(true);
  };
  const room = (
    <RoomPreview
      device={screenDevice}
      t={t}
      playing={playing}
      onTogglePlay={() => setPlaying((p) => !p)}
      duration={duration}
      video={{ url: videoUrl, muted }}
      title={form.public_title || "O título do webinar"}
      host={{ name: form.host_name, role: form.host_role, avatarUrl: form.host_avatar_url }}
      viewers={viewers}
      pin={form.chat_pin_title}
      comments={comments.map((c) => ({ id: c.id, at: c.offset_seconds, author: c.author_name, message: c.message }))}
      sales={shownSales}
      offer={{
        visible: offerVisible,
        start: pitchSeconds,
        productName: product,
        imageUrl: form.cta_image_url || undefined,
        priceFrom: form.cta_price_original,
        priceNow: form.cta_price_now,
        buttonText: form.cta_text || "Quero minha vaga",
        countdown: Number(form.cta_countdown_seconds) || 0,
      }}
      agent={agentState}
      tab={tab}
      onTab={setRoomTab}
      forceOffer={step === "oferta"}
      highlight={focusKey}
      mine={mine}
      onSend={(text, where) => setMine((list) => [...list, { at: t, text, tab: where }])}
      reactions={reactions}
      onHeart={heart}
      onBuy={() => toast(`Abre o checkout num separador novo, com a origem da pessoa.`)}
    />
  );
  const entry = (moment: "gate" | "card") => (
    <EntryScreen
      preview
      className={screenDevice === "phone" ? "h-[852px] w-[393px]" : "h-[720px] w-[1280px]"}
      moment={moment}
      onOpen={() => setEntryMoment(2)}
      live={live.live}
      liveLabel={live.label}
      video={videoUrl ? { url: videoUrl, startSeconds: t } : null}
      fallback={{ kicker: selectedVideo?.name ?? "Sessão ao vivo", title: form.public_title }}
      badge={form.registration_badge_text || undefined}
      headline={form.registration_headline || form.public_title || "O título do webinar"}
      subtitle={form.registration_subtitle || undefined}
      buttonText={form.registration_button_text || "Entrar na sala"}
      progress={form.registration_progress_enabled ? Number(form.registration_progress_value) || 0 : null}
      phone={{ show: form.registration_collect_phone, required: form.registration_require_phone }}
      values={{ name: "", email: "", phone: "" }}
      country={{ code: "AO", name: "Angola", dial: "+244", flag: "🇦🇴" }}
      highlight={focusKey}
    />
  );
  const screenBody =
    screen === "room" ? (
      room
    ) : screen === "entry-gate" ? (
      entry("gate")
    ) : screen === "entry-card" ? (
      entry("card")
    ) : screen === "waiting" ? (
      <WaitingPreview
        device={screenDevice}
        title={form.public_title}
        remainingSeconds={nextWindow.startMs ? (nextWindow.startMs - Date.now()) / 1000 : 0}
        when={nextSession ?? ""}
        highlight={focusKey === "date"}
      />
    ) : (
      <WhatsAppPreview
        hostName={form.host_name}
        empty="Ainda sem mensagens. Crie as automações para ver o que cada pessoa recebe."
        bubbles={
          automations?.workflows.length
            ? [
                { tag: "Lembretes · 15 min antes", text: `Olá Marta! Faltam 15 minutos para «${form.public_title}». Entra por aqui: ${roomLink}`, time: "19:45" },
                { tag: "Sessão começou", text: `Marta, já estamos ao vivo. ${form.host_name.split(" ")[0] || "O apresentador"} começou agora: ${roomLink}`, time: "20:02" },
                {
                  tag: "Assistiu o pitch · 1 h depois",
                  text: `Marta, viste a aula até à oferta. ${product.trim() || "A oferta"}${form.cta_price_now ? ` por ${form.cta_price_now}` : ""} está aqui: ${form.cta_url || roomLink}`,
                  time: "21:06",
                },
              ]
            : []
        }
      />
    );

  const dock =
    DOCK_STEPS.includes(step) && duration > 0 && !published ? (
      <TimelineDock
        t={t}
        duration={duration}
        playing={playing}
        onToggle={() => setPlaying((p) => !p)}
        onSeek={seek}
        muted={muted}
        onMute={() => setMuted((m) => !m)}
        open={dockOpen}
        onOpenChange={setDockOpen}
        lane={lane}
        onLane={setLane}
        step={step}
        onOpenStep={setStep}
        onPitchHere={
          step === "oferta" && offerVisible
            ? () => {
                set({ cta_start_seconds: String(Math.round(t)) });
                toast.success(`Minuto do pitch: ${clock(t)}.`);
              }
            : undefined
        }
        data={{
          speech,
          comments: comments.map((c) => ({ at: c.offset_seconds, author: c.author_name, message: c.message })),
          audience: {
            curve: format === "real" ? null : curve,
            label: format === "real" ? "Só a real" : `${range.min} a ${range.max}`,
          },
          offer: { visible: offerVisible, start: pitchSeconds, countdown: Number(form.cta_countdown_seconds) || 0, suggested: suggestedPitch },
          sales: shownSales,
          risks: moments,
        }}
      />
    ) : null;

  const tools = (
    <>
      {screen !== "whatsapp" ? <DeviceToggle device={device} onChange={setDevice} /> : null}
    </>
  );

  return (
    <AppShell action={false} bleed rail>
      <div className="flex flex-1 flex-col lg:h-dvh lg:min-h-0">
        <header className="grid shrink-0 border-b bg-background lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="flex h-12 min-w-0 items-center gap-1.5 border-b px-2.5 lg:border-r lg:border-b-0">
            <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
              <Link to="/webinars" search={{ q: undefined }} aria-label="Voltar aos webinars">
                <ArrowLeft />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold">{form.public_title || form.internal_name || "Webinar sem título"}</p>
              <p className="flex items-center gap-1.5 truncate text-[11.5px] text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", form.status === "draft" ? "bg-gray-400" : "bg-[#1D8A5E]")} />
                {lifecycleLabel(lifecycle)}
                {dirty ? <span> · por guardar</span> : null}
                {launchIssues.length > 0 ? <span className="text-warning"> · {launchIssues.length} por resolver</span> : null}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
              <a href={`${roomLink}?teste=1`} target="_blank" rel="noopener noreferrer" aria-label="Sala de teste" title="Sala de teste: entra já e não conta nas métricas">
                <Eye />
              </a>
            </Button>
            <Button variant="dark" size="sm" className="shrink-0" onClick={publish} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Publicar
            </Button>
          </div>
          <nav
            aria-label="Etapas"
            className="flex min-w-0 items-center overflow-x-auto px-2 [justify-content:safe_center] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {STEPS.map((s, index) => {
              const Icon = s.icon;
              const current = s.id === step && !published;
              return (
                <Fragment key={s.id}>
                  {index > 0 && STEPS[index - 1]?.group !== s.group ? (
                    <span aria-hidden className="mx-1 h-[18px] w-px shrink-0 bg-border" />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    aria-current={current ? "step" : undefined}
                    title={`${GROUP_NAME[s.group]} · ${s.title}`}
                    className={cn(
                      "relative flex h-12 shrink-0 items-center gap-1.5 px-2 text-[13px] font-medium whitespace-nowrap transition-colors",
                      current
                        ? "text-foreground after:absolute after:inset-x-1.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {s.label}
                    {stepsWithIssues.has(s.id) ? <span className="size-1.5 rounded-full bg-warning" title="Por resolver" /> : null}
                  </button>
                </Fragment>
              );
            })}
          </nav>
        </header>

        {published ? (
          <PublishPage issues={launchIssues} roomLink={roomLink} onResolve={setStep} onBack={() => setPublished(false)} />
        ) : (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_minmax(0,1fr)]">
            <section className="flex min-h-0 min-w-0 flex-col bg-background lg:border-r">
              <div className="flex shrink-0 items-center gap-1 px-5 pb-1 pt-3.5">
                <h1 className="text-[17px] font-semibold tracking-tight">{active.title}</h1>
                <HelpButton topic={active.help} />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3.5 [scrollbar-width:thin]">
                {step === "inicio" ? (
                  <StepInicio
                    form={form}
                    set={set}
                    focus={focus}
                    roomOrigin={roomOrigin}
                    roomLink={roomLink}
                    uploading={uploadingImage}
                    onUpload={(file, field) => void uploadImage(file, field)}
                    onDelete={() => void removeWebinar()}
                  />
                ) : step === "entrada" ? (
                  <StepEntrada
                    form={form}
                    set={set}
                    focus={focus}
                    moment={entryMoment}
                    onMoment={setEntryMoment}
                    mode={entryMode}
                    onMode={setEntryMode}
                    roomLink={roomLink}
                    embed={{
                      code: forms[0]
                        ? `<div data-convertewebinar-form="${forms[0].id}"></div>\n<script src="${baseUrl}/api/public/forms/${forms[0].id}/embed" async></script>`
                        : null,
                      creating: creatingForm,
                      onCreate: () => void createForm(),
                    }}
                  />
                ) : step === "video" ? (
                  <StepVideo
                    video={
                      selectedVideo
                        ? {
                            id: selectedVideo.id,
                            name: selectedVideo.name,
                            provider: selectedVideo.provider,
                            source_url: selectedVideo.source_url,
                            duration_seconds: selectedVideo.duration_seconds,
                          }
                        : null
                    }
                    library={videoSources.map((v) => ({
                      id: v.id,
                      name: v.name,
                      provider: v.provider,
                      source_url: v.source_url,
                      duration_seconds: v.duration_seconds,
                    }))}
                    providerLabel={(p) => providerLabels[p as Provider] ?? p}
                    clock={editorClock}
                    transcript={speech}
                    onPick={(id) => set({ video_source_id: id })}
                    upload={{
                      state: videoUpload,
                      busy: uploading,
                      start: (file) => void uploadVideoFile(file),
                      pause: () => void videoUploadRef.current?.pause(),
                      resume: () => videoUploadRef.current?.resume(),
                      cancel: () => {
                        void videoUploadRef.current?.cancel();
                        videoUploadRef.current = null;
                        setVideoUpload(null);
                      },
                    }}
                    onAddLink={addVideoLink}
                  />
                ) : step === "chat" ? (
                  <StepChat
                    form={form}
                    set={set}
                    focus={focus}
                    rules={chatRules}
                    onRules={updateRules}
                    way={chatWay}
                    onWay={setChatWay}
                    questions={questions}
                    comments={comments.map((c) => ({
                      id: c.id,
                      at: c.offset_seconds,
                      author: c.author_name,
                      message: c.message,
                      type: c.comment_type ?? null,
                    }))}
                    clock={editorClock}
                    speechAt={speechAt}
                    job={
                      aiJob
                        ? {
                            running: aiJob.status === "running",
                            stage: aiJob.stage,
                            error: aiJob.status === "error" ? aiJob.error : "",
                            ready: aiJob.status === "ready" && Boolean(aiJob.drafts?.length),
                            onReview: () => setAiOpen(true),
                          }
                        : null
                    }
                    onGenerate={generate}
                    onImport={(file) => void importSheet(file)}
                    onWrite={writeComment}
                    onRemove={(id) => void removeComment(id)}
                    onWatch={watchChat}
                  />
                ) : step === "audiencia" ? (
                  <StepAudiencia
                    format={format}
                    onFormat={setFormat}
                    min={range.min}
                    max={range.max}
                    onRange={(min, max) => setRange({ min, max })}
                    curve={curve}
                    pitch={pitchSeconds ?? suggestedPitch}
                    clock={editorClock}
                    onFocusViewers={(on) => setFocusKey(on ? "viewers" : null)}
                  />
                ) : step === "oferta" ? (
                  <StepOferta
                    form={form}
                    set={set}
                    focus={focus}
                    product={product}
                    onProduct={setProduct}
                    suggestedPitch={suggestedPitch}
                    clock={editorClock}
                    onWatch={watchOffer}
                  />
                ) : step === "vendas" ? (
                  <StepVendas
                    offerVisible={offerVisible}
                    pitch={pitchSeconds}
                    enabled={salesEnabled}
                    onEnabled={(on) => void setSales(on, salesQty)}
                    qty={salesQty}
                    onQty={(qty) => void setSales(true, qty)}
                    sales={shownSales}
                    clock={editorClock}
                    onGoOffer={() => setStep("oferta")}
                    busy={salesBusy}
                  />
                ) : step === "automacoes" ? (
                  <StepAutomacoes
                    webinarId={webinarId}
                    organizationId={organizationId}
                    title={form.public_title || form.internal_name || "Webinar"}
                  />
                ) : step === "agente" ? (
                  <StepAgente webinarId={webinarId} onState={setAgentState} onSeek={seek} />
                ) : (
                  <StepAgenda
                    form={form}
                    set={set}
                    focus={focus}
                    kind={scheduleKind}
                    onKind={chooseScheduleKind}
                    nextSession={nextSession}
                    ended={sessionEnded}
                  />
                )}
              </div>
              <footer className="flex shrink-0 items-center justify-between gap-3 border-t bg-background px-4 py-3">
                <Button variant="ghost" onClick={() => prevStep && setStep(prevStep.id)} disabled={!prevStep}>
                  <ArrowLeft />
                  Voltar
                </Button>
                <Button variant="dark" onClick={saveAndGo} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : null}
                  {nextStep ? `Continuar para ${nextStep.label}` : "Publicar"}
                </Button>
              </footer>
            </section>

            <section className="flex min-h-[520px] min-w-0 flex-col bg-[var(--background)] lg:min-h-0">
              <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pt-2.5">
                <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium">
                  <ScreenIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{screenName}</span>
                  {screen === "room" ? <span className="font-mono text-muted-foreground">Aos {clock(t)}</span> : null}
                  {focusKey ? (
                    <span className="hidden rounded-md bg-[#FDE4D9] px-2 py-0.5 text-[12px] text-[#A82F05] sm:inline">A editar</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2">
                  <ExpandButton onClick={() => setFull(true)} />
                  {tools}
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-2 [scrollbar-gutter:stable]">
                <div className="flex min-h-full flex-col items-center justify-center gap-2.5">
                  <DeviceStage
                    device={screenDevice}
                    url={`${roomOrigin}/w/${roomSlug}`}
                    highlightUrl={focusKey === "url"}
                    light={screen === "whatsapp"}
                  >
                    {screenBody}
                  </DeviceStage>
                  {screen === "room" || step === "entrada" ? (
                    <div className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-chip p-1 [scrollbar-width:none]">
                      {SCREENS.map(([target, label]) => (
                        <button
                          key={target}
                          type="button"
                          onClick={() => setStep(target)}
                          aria-pressed={step === target || (target === "vendas" && step === "oferta")}
                          className={cn(
                            "h-[26px] shrink-0 rounded-lg px-3 text-[12.5px] font-medium",
                            step === target || (target === "vendas" && step === "oferta")
                              ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,.08)]"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              {dock}
            </section>
          </div>
        )}
      </div>

      {full ? (
        <FullScreen
          name={screenName}
          device={screenDevice}
          onDevice={setDevice}
          onClose={() => setFull(false)}
          room={
            screen === "room"
              ? { t, duration, playing, onToggle: () => setPlaying((p) => !p), pitch: offerVisible ? pitchSeconds : null }
              : undefined
          }
        >
          <DeviceStage device={screenDevice} url={`${roomOrigin}/w/${roomSlug}`} light={screen === "whatsapp"} full>
            {screenBody}
          </DeviceStage>
        </FullScreen>
      ) : null}

      <AiCommentsDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        webinarId={webinarId}
        webinarTitle={form.public_title || form.internal_name || "Webinar"}
        existing={comments.map((c) => ({ at: c.offset_seconds, author: c.author_name, message: c.message }))}
        replaceAll
        transcript={transcript}
        mediaUrl={selectedVideo?.source_url ?? null}
        onSeek={seek}
        onTranscript={keepTranscript}
        onInsert={(drafts) => insertGenerated(drafts)}
      />
    </AppShell>
  );
}
