import { friendlyError } from "@/lib/friendly-error";
import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  Blocks,
  Bot,
  ChevronRight,
  Webhook,
  CalendarClock,
  Check,
  Copy,
  Film,
  GanttChartSquare,
  ImagePlus,
  ShoppingBag,
  Loader2,
  LogIn,
  MessagesSquare,
  Moon,
  Palette,
  Sun,
  Plus,
  RefreshCw,
  Search,
  Radio,
  Presentation,
  Wand2,
  Trash2,
  Upload,
  Users,
  Workflow,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { WebinarAutomations } from "@/components/workflow/webinar-automations";
import { PageSkeleton } from "@/components/page-skeleton";
import {
  AiCommentsDialog,
  defaultAiSettings,
  parseClock,
  type DraftComment,
  type TranscriptSegment,
} from "@/components/ai-comments-dialog";
import { AiJobBanner, SyncJobBanner } from "@/components/ai-job-banner";
import { EngagementDiagnostics } from "@/components/engagement-diagnostics";
import { HmsInput } from "@/components/hms-input";
import { useAiJob } from "@/lib/ai-comment-jobs";
import { startSyncJob, useSyncJob } from "@/lib/sync-jobs";
import {
  generateEngagementComments,
  getWebinarAnalysis,
  getWebinarTranscript,
  saveWebinarTranscript,
} from "@/lib/ai-comments.functions";
import { clockLabel } from "@/lib/engagement-analysis";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { VideoPlayer } from "@/components/video-player";
import {
  AudienceChartPreview,
  ChatPreview,
  IdentityPreview,
  OfferPreview,
  PreviewShell,
  RegistrationPreview,
  RoomDesignPreview,
} from "@/components/webinar-previews";
import { AiImageDialog, type ImageKind } from "@/components/ai-image-dialog";
import { AgentPanel } from "@/components/ai-agent/agent-panel";
import { SocialProofEditor, useSimulatedPurchases } from "@/components/social-proof-editor";
import { WebinarTimeline, type TimelineMarker } from "@/components/webinar-timeline";
import {
  CommentInspector,
  msClock,
  type InspectableComment,
} from "@/components/comment-inspector";
import { getTranscriptInspection } from "@/lib/temporal/inspect.functions";
import { buildAudienceCurve, curveBounds } from "@/lib/audience-curve";
import { CTA_COLORS } from "@/lib/cta-colors";
import {
  formatSessionStart,
  lifecycleDetail,
  lifecycleLabel,
  sessionWindow,
  webinarLifecycle,
} from "@/lib/schedule";
import { WebinarPaymentsNotice } from "@/components/metricas/webinar-payments";
import {
  isoFromLocalInput,
  localInputFromIso,
  offerTiming,
  statusOnSave,
  webinarIssues,
} from "@/lib/webinar-draft";

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
import { PreliveTemplateGallery } from "@/components/prelive-template-gallery";
import {
  DEFAULT_PRELIVE_TEMPLATE,
  normalizeAppearance,
  type PreliveAppearance,
} from "@/lib/prelive-templates";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toStorageOffsets } from "@/lib/temporal/placement";
import {
  MAX_VIDEO_BYTES,
  VIDEO_BUCKET,
  createVideoUpload,
  formatBytes,
  safeObjectName,
  type VideoUploadHandle,
  type VideoUploadProgress,
} from "@/lib/video-upload";
import { supabase } from "@/integrations/supabase/client";
import { cn, offerUrl } from "@/lib/utils";
import {
  providerLabels,
  publicOrigin,
  statusLabels,
  statusFromLifecycle,
  useAudienceConfiguration,
  useInvalidate,
  useScheduledComments,
  useVideoSources,
  useWebinar,
  useWorkspace,
  slugify,
  type WebinarStatus,
} from "@/lib/data";
import type { Database } from "@/integrations/supabase/types";
import whatsappIconAsset from "@/assets/local/whatsapp-icon.webp";

function WhatsAppIcon({ className }: { className?: string }) {
  return <img src={whatsappIconAsset} alt="WhatsApp" className={className} />;
}

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
      {
        name: "description",
        content: "Edite vídeo, agendamento, comentários e oferta do webinar.",
      },
      { property: "og:title", content: "Editar webinar | Convertewebinar" },
      { property: "og:description", content: "Configuração completa do webinar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditWebinar,
});

const STEPS = [
  {
    id: "inicio",
    label: "Início",
    icon: Presentation,
    title: "Identidade do webinar",
    hint: "Nome interno, título público e o endereço por onde as pessoas entram.",
  },
  {
    id: "webinar",
    label: "Webinar",
    icon: CalendarClock,
    title: "Sessão e agendamento",
    hint: "Quando acontece, em que estado está e o que fazer com quem chega cedo.",
  },
  {
    id: "login",
    label: "Login",
    icon: LogIn,
    title: "Ecrã antes da sala",
    hint: "Os dados que pedimos antes de entrar. O nome indicado identifica a pessoa no chat.",
  },
  {
    id: "design",
    label: "Design",
    icon: Palette,
    title: "Aspeto das salas",
    hint: "Escolha o tema visual e veja como ficam a espera, a entrada, o direto e o fim.",
  },
  {
    id: "video",
    label: "Vídeo",
    icon: Film,
    title: "Configuração de vídeo",
    hint: "Escolha a fonte do conteúdo. O replay reutiliza exatamente o mesmo vídeo.",
  },
  {
    id: "oferta",
    label: "Oferta",
    icon: ShoppingBag,
    title: "Oferta e chamada à ação",
    hint: "Sem hora de fim, o botão fica visível até ao final da sessão.",
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessagesSquare,
    title: "Comentários programados",
    hint: "Comentários globais que aparecem no chat no segundo indicado.",
  },
  {
    id: "agente",
    label: "Agente IA",
    icon: Bot,
    title: "Agente IA de chat",
    hint: "Atende as mensagens reais dos participantes com o conhecimento que autorizar.",
  },
  {
    id: "vendas",
    label: "Vendas",
    icon: ShoppingBag,
    title: "Vendas e prova social",
    hint: "Notificações de compra durante a sessão. As de demonstração vão marcadas como simulação.",
  },
  {
    id: "audiencia",
    label: "Audiência",
    icon: Users,
    title: "Contagem de audiência",
    hint: "A contagem arranca no mínimo definido e nunca mistura real com simulada.",
  },
  {
    id: "integracoes",
    label: "Integrações",
    icon: Blocks,
    title: "Integrações do webinar",
    hint: "Ligações com o exterior. O WhatsApp define como o link da sala aparece ao ser partilhado.",
  },
  {
    id: "automacoes",
    label: "Automações",
    icon: Workflow,
    title: "Automações do webinar",
    hint: "A jornada de quem se inscreve: aquecimento, lembretes, recuperação e pós-compra, no workflow.",
  },
  {
    id: "timeline",
    label: "Linha de tempo",
    icon: GanttChartSquare,
    title: "Linha de tempo da sessão",
    hint: "Tudo o que acontece do minuto zero ao fim: chat, oferta, vendas e audiência.",
  },
] as const;

/** Passos que ocupam a largura toda, sem painel de pré-visualização. */
const FULL_WIDTH_STEPS = [
  "inicio",
  "webinar",
  "chat",
  "agente",
  "vendas",
  "integracoes",
  "automacoes",
  "timeline",
] as const;

type StepId = (typeof STEPS)[number]["id"];

const TIMEZONES: [string, string][] = [
  ["Africa/Luanda", "(GMT+01:00) Luanda"],
  ["Europe/Lisbon", "(GMT+00:00) Lisboa"],
  ["Europe/Madrid", "(GMT+01:00) Madrid"],
  ["America/Sao_Paulo", "(GMT-03:00) Brasília"],
  ["Atlantic/Azores", "(GMT-01:00) Açores"],
  ["America/New_York", "(GMT-05:00) Nova Iorque"],
  ["UTC", "(GMT+00:00) UTC"],
];

function formatOffset(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function EditWebinar() {
  const { webinarId } = Route.useParams();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: workspace } = useWorkspace();
  const { data: webinar, isLoading } = useWebinar(webinarId);
  const { data: videoSources = [] } = useVideoSources(workspace?.organizationId);
  const { data: comments = [] } = useScheduledComments(webinarId);
  const [inspecting, setInspecting] = useState<InspectableComment | null>(null);
  const fetchInspection = useServerFn(getTranscriptInspection);
  const { data: inspection = null } = useQuery({
    queryKey: ["transcript-inspection", webinarId],
    queryFn: () => fetchInspection({ data: { webinarId } }),
    staleTime: 5 * 60 * 1000,
  });
  const { data: audience } = useAudienceConfiguration(webinarId);
  const { data: simulatedPurchases = [] } = useSimulatedPurchases(webinarId);

  const initialStep = Route.useSearch().step;
  const [step, setStep] = useState<StepId>(() =>
    STEPS.some((s) => s.id === initialStep) ? (initialStep as StepId) : "inicio",
  );
  const [form, setForm] = useState({
    internal_name: "",
    public_title: "",
    description: "",
    host_name: "",
    host_role: "",
    host_avatar_url: "",
    chat_pin_title: "Participe no chat!",
    chat_pin_message: "",
    offer_pin_title: "Vagas abertas :",
    offer_pin_message: "",
    slug: "",
    scheduled_at: "",
    session_end_time: "",
    status: "draft" as WebinarStatus,
    video_source_id: "none",
    replay_enabled: true,
    waiting_room_enabled: true,
    prelive_enabled: false,
    prelive_seconds: 300,
    prelive_sound: true,
    prelive_message: "A transmissão começa já a seguir",
    prelive_template: DEFAULT_PRELIVE_TEMPLATE as string,
    prelive_appearance: normalizeAppearance(DEFAULT_PRELIVE_TEMPLATE, null) as PreliveAppearance,
    schedule_mode: "single" as "single" | "jit",
    recurrence_enabled: false,
    recurrence_pattern: "daily" as "daily" | "weekly",
    recurrence_weekday: "1",
    recurrence_start_time: "",
    recurrence_end_time: "",
    jit_interval_minutes: "15",
    timezone: "Europe/Lisbon",
    easy_access: false,
    sync_video_with_start: false,
    cta_text: "",
    cta_url: "",
    cta_color: "green",
    cta_price_original: "",
    cta_price_now: "",
    cta_image_url: "",
    cta_countdown_seconds: "300",
    cta_start_seconds: "",
    cta_end_seconds: "",
    registration_headline: "",
    registration_subtitle: "",
    registration_button_text: "Entrar na sala",
    registration_collect_phone: true,
    registration_require_phone: false,
    registration_cover_url: "",
    registration_badge_text: "",
    registration_progress_enabled: false,
    registration_progress_value: "92",
    registration_scarcity_note: "",
    room_theme: "dark" as "dark" | "light",
    share_title: "",
    share_description: "",
    share_image_url: "",
    webhook_url: "",
    webhook_enabled: false,
  });
  const [openIntegration, setOpenIntegration] = useState<"whatsapp" | "webhook" | null>(null);

  const [saving, setSaving] = useState(false);
  // O formulário como está gravado: o que difere dele são alterações por gravar.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const dirty = savedSnapshot !== null && JSON.stringify(form) !== savedSnapshot;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useBlocker({
    shouldBlockFn: ({ current, next }) =>
      dirtyRef.current &&
      current.pathname !== next.pathname &&
      !window.confirm("Há alterações por gravar. Sair mesmo assim?"),
    enableBeforeUnload: () => dirtyRef.current,
  });
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const hostAvatarInputRef = useRef<HTMLInputElement>(null);
  const offerImageInputRef = useRef<HTMLInputElement>(null);
  const shareImageInputRef = useRef<HTMLInputElement>(null);
  const [audienceMode, setAudienceMode] = useState("real");
  const [audienceMin, setAudienceMin] = useState("0");
  const [audienceMax, setAudienceMax] = useState("0");

  const [newComment, setNewComment] = useState({
    author_name: "",
    message: "",
    offset_seconds: "60",
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const aiJob = useAiJob(webinarId);
  // Mapa do webinar: o resultado mais recente da geração, ou o que ficou guardado.
  const { data: savedAnalysis } = useQuery({
    queryKey: ["webinar-analysis", webinarId],
    queryFn: async () => (await getWebinarAnalysis({ data: { webinarId } })).analysis,
  });
  const analysis = aiJob?.analysis ?? savedAnalysis ?? null;
  const announcedJobRef = useRef<number | null>(null);

  // Quando a geração termina, leva o organizador ao passo do chat e abre a revisão.
  useEffect(() => {
    if (aiJob?.status !== "ready" || !aiJob.drafts?.length) return;
    if (announcedJobRef.current === aiJob.startedAt) return;
    announcedJobRef.current = aiJob.startedAt;
    setStep("chat");
    setAiOpen(true);
  }, [aiJob?.status, aiJob?.startedAt, aiJob?.drafts?.length]);
  const [aiReplaceAll, setAiReplaceAll] = useState(false);
  const [aiRange, setAiRange] = useState<{ start: number; end: number } | undefined>();
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  // A transcrição fica guardada: se o vídeo for o mesmo, não se transcreve outra vez.
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
  const [segmentRange, setSegmentRange] = useState({ start: "00:00", end: "05:00" });
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [imageKind, setImageKind] = useState<ImageKind | null>(null);
  const [timelineCursor, setTimelineCursor] = useState(0);
  const [newVideo, setNewVideo] = useState({
    name: "",
    provider: "hls" as Provider,
    source_url: "",
    minutes: "",
  });
  const [linkDraft, setLinkDraft] = useState("");
  const [showNewVideo, setShowNewVideo] = useState(false);
  const [newVideoMode, setNewVideoMode] = useState<"menu" | "upload" | "tools">("menu");
  // Envio TUS em curso: progresso real, pausa, retoma e cancelamento.
  const [videoUpload, setVideoUpload] = useState<{
    file: File;
    progress: VideoUploadProgress;
  } | null>(null);
  const videoUploadRef = useRef<VideoUploadHandle | null>(null);
  const uploading =
    videoUpload?.progress.status === "uploading" || videoUpload?.progress.status === "paused";
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Carrega o formulário uma única vez por webinar: assim uma atualização em
  // segundo plano não apaga o que o organizador está a escrever.
  const hydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!webinar || hydratedRef.current === webinar.id) return;
    hydratedRef.current = webinar.id;
    const loaded: typeof form = {
      internal_name: webinar.internal_name,
      public_title: webinar.public_title,
      description: webinar.description,
      host_name: webinar.host_name ?? "",
      host_role: webinar.host_role ?? "",
      host_avatar_url: webinar.host_avatar_url ?? "",
      chat_pin_title: webinar.chat_pin_title ?? "Participe no chat!",
      chat_pin_message: webinar.chat_pin_message ?? "",
      offer_pin_title: webinar.offer_pin_title ?? "Vagas abertas :",
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
      prelive_message: webinar.prelive_message ?? "A transmissão começa já a seguir",
      prelive_template: (webinar as { prelive_template?: string | null }).prelive_template ?? DEFAULT_PRELIVE_TEMPLATE,
      prelive_appearance: normalizeAppearance(
        (webinar as { prelive_template?: string | null }).prelive_template,
        (webinar as { prelive_appearance?: unknown }).prelive_appearance,
      ),
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
    setForm(loaded);
    setSavedSnapshot(JSON.stringify(loaded));
  }, [webinar]);

  useEffect(() => {
    if (!audience) return;
    setAudienceMode(audience.mode);
    const bounds = curveBounds(audience.curve);
    setAudienceMin(String(bounds?.min ?? 0));
    setAudienceMax(String(bounds?.max ?? 0));
  }, [audience]);

  const uploadCover = async (
    file: File,
    field:
      | "registration_cover_url"
      | "cta_image_url"
      | "share_image_url"
      | "host_avatar_url" = "registration_cover_url",
  ) => {
    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${webinarId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("webinar-covers")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data, error: signError } = await supabase.storage
        .from("webinar-covers")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signError || !data) throw signError ?? new Error("Não foi possível preparar a imagem.");
      setForm((prev) => ({ ...prev, [field]: data.signedUrl }));
      toast.success("Imagem carregada. Guarde para aplicar.");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível carregar a imagem."));
    } finally {
      setUploadingCover(false);
    }
  };

  const nextSessionLabel = useMemo(() => {
    const window = sessionWindow(
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
      },
      Date.now(),
    );
    return window.startMs ? formatSessionStart(window.startMs, form.timezone) : null;
  }, [
    form.schedule_mode,
    form.scheduled_at,
    form.session_end_time,
    form.recurrence_enabled,
    form.recurrence_pattern,
    form.recurrence_weekday,
    form.recurrence_start_time,
    form.recurrence_end_time,
    form.jit_interval_minutes,
    form.timezone,
  ]);

  const socialProofSaverRef = useRef<(() => Promise<boolean>) | null>(null);

  const save = async (options?: { silent?: boolean }): Promise<boolean> => {
    if (!webinar) return false;
    const issues = webinarIssues(form, { durationSeconds: previewDuration });
    // Um erro que bloqueia não grava nada e leva ao passo do campo, também ao «Continuar».
    const blocking = issues.find((issue) => issue.blocking);
    if (blocking) {
      toast.error(blocking.message);
      setStep(blocking.step);
      return false;
    }
    const pendingWarning = options?.silent ? undefined : issues[0];
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
          offer_pin_title: form.offer_pin_title.trim() || "Vagas abertas :",
          offer_pin_message: form.offer_pin_message.trim(),
          slug: slugify(form.slug || form.public_title || form.internal_name),
          scheduled_at: isoFromLocalInput(form.scheduled_at, form.timezone),
          session_end_time: form.session_end_time || null,
          status: statusOnSave(webinar, derivedStatus),
          video_source_id: form.video_source_id === "none" ? null : form.video_source_id,
          replay_enabled: form.replay_enabled,
          waiting_room_enabled: form.waiting_room_enabled,
          prelive_enabled: form.prelive_enabled,
          prelive_seconds: Math.max(5, Math.min(3600, Number(form.prelive_seconds) || 300)),
          prelive_sound: form.prelive_sound,
          prelive_message: form.prelive_message,
          prelive_template: form.prelive_template,
          prelive_appearance: form.prelive_appearance,
          schedule_mode: form.schedule_mode,
          recurrence_enabled: form.recurrence_enabled,
          recurrence_pattern: form.recurrence_pattern,
          recurrence_weekday: Number(form.recurrence_weekday) || 1,
          recurrence_start_time: form.recurrence_start_time,
          recurrence_end_time: form.recurrence_end_time,
          jit_interval_minutes: Math.max(5, Number(form.jit_interval_minutes) || 15),
          timezone: form.timezone,
          easy_access: form.easy_access,
          sync_video_with_start: form.sync_video_with_start,
          cta_text: form.cta_text.trim() || null,
          cta_url: offerUrl(form.cta_url),
          cta_color: form.cta_color,
          cta_price_original: form.cta_price_original.trim(),
          cta_price_now: form.cta_price_now.trim(),
          cta_image_url: form.cta_image_url.trim(),
          cta_countdown_seconds: Math.max(0, Number(form.cta_countdown_seconds) || 0),
          // Um só minuto do pitch: a oferta aparece nele e os segmentos e as métricas comparam com ele.
          cta_start_seconds: offer.start,
          pitch_seconds: offer.start,
          cta_end_seconds: offer.end,
          registration_headline: form.registration_headline.trim(),
          registration_subtitle: form.registration_subtitle.trim(),
          registration_button_text: form.registration_button_text.trim() || "Entrar na sala",
          registration_collect_phone: form.registration_collect_phone,
          registration_require_phone:
            form.registration_collect_phone && form.registration_require_phone,
          registration_cover_url: form.registration_cover_url.trim() || null,
          registration_badge_text: form.registration_badge_text.trim(),
          registration_progress_enabled: form.registration_progress_enabled,
          registration_progress_value: Math.min(
            100,
            Math.max(0, Number(form.registration_progress_value) || 0),
          ),
          registration_scarcity_note: form.registration_scarcity_note.trim(),
          room_theme: form.room_theme,
          share_title: form.share_title.trim(),
          share_description: form.share_description.trim(),
          share_image_url: form.share_image_url.trim() || null,
          webhook_url: form.webhook_url.trim(),
          webhook_enabled: form.webhook_enabled && Boolean(form.webhook_url.trim()),
          updated_at: new Date().toISOString(),
        })

        .eq("id", webinarId);
      if (error) throw error;
      const socialProofOk = (await socialProofSaverRef.current?.()) ?? true;
      const audienceOk = await saveAudience({ silent: true });
      invalidate(["webinar", "webinars"]);
      if (!options?.silent) {
        if (!socialProofOk) {
          toast.error("Webinar guardado, mas as notificações de compra não foram guardadas.");
        } else if (!audienceOk) {
          toast.error("Webinar guardado, mas a audiência não foi guardada.");
        } else if (pendingWarning) {
          toast.warning(`Alterações guardadas. ${pendingWarning.message}`);
          setStep(pendingWarning.step);
        } else {
          toast.success("Alterações guardadas.");
        }
      }
      setSavedSnapshot(JSON.stringify(form));
      return socialProofOk && audienceOk;
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível guardar."));
      return false;
    } finally {
      setSaving(false);
    }
  };

  // «Continuar» segue a ordem do menu e só avança se gravou.
  const nextStep = STEPS[STEPS.findIndex((s) => s.id === step) + 1];
  const nextLabel = nextStep ? `Continuar para ${nextStep.label}` : "Guardar";
  const saveAndGo = () => {
    void save({ silent: true }).then((ok) => {
      if (ok && nextStep) setStep(nextStep.id);
    });
  };

  const saveAudience = async (options?: { silent?: boolean }): Promise<boolean> => {
    if (!workspace) return false;
    const min = Math.max(0, Number(audienceMin) || 0);
    const max = Math.max(min, Number(audienceMax) || 0);
    // Pelo «Guardar» geral só se escreve se a audiência mudou: a curva gravada fica como está.
    const saved = audience
      ? { mode: audience.mode, ...(curveBounds(audience.curve) ?? { min: 0, max: 0 }) }
      : { mode: "real", min: 0, max: 0 };
    if (options?.silent && saved.mode === audienceMode && saved.min === min && saved.max === max) {
      return true;
    }
    const curve = buildAudienceCurve(min, max, 28);
    const { error } = await supabase.from("audience_configuration").upsert(
      {
        webinar_id: webinarId,
        organization_id: workspace.organizationId,
        mode: audienceMode,
        curve,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "webinar_id" },
    );
    if (error) {
      toast.error(friendlyError(error));
      return false;
    }
    invalidate(["audience-configuration"]);
    if (!options?.silent) toast.success("Audiência atualizada.");
    return true;
  };

  const addComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspace) return;
    const { error } = await supabase.from("scheduled_comments").insert({
      webinar_id: webinarId,
      organization_id: workspace.organizationId,
      author_name: newComment.author_name.trim(),
      message: newComment.message.trim(),
      offset_seconds: Number(newComment.offset_seconds) || 0,
    });
    if (error) toast.error(friendlyError(error));
    else {
      setNewComment({ author_name: "", message: "", offset_seconds: "60" });
      invalidate(["scheduled-comments"]);
    }
  };

  const removeComment = async (id: string) => {
    const { error } = await supabase.from("scheduled_comments").delete().eq("id", id);
    if (error) toast.error(friendlyError(error));
    else invalidate(["scheduled-comments"]);
  };

  const removeAllComments = async () => {
    if (
      !window.confirm(
        "Tem a certeza que quer eliminar todos os comentários programados deste webinar?",
      )
    )
      return;
    const { error } = await supabase
      .from("scheduled_comments")
      .delete()
      .eq("webinar_id", webinarId);
    if (error) toast.error(friendlyError(error));
    else {
      invalidate(["scheduled-comments"]);
      toast.success("Todos os comentários foram eliminados.");
    }
  };

  const updateComment = async (
    id: string,
    patch: { author_name?: string; message?: string; offset_seconds?: number; avatar_url?: string },
  ) => {
    const { error } = await supabase.from("scheduled_comments").update(patch).eq("id", id);
    if (error) toast.error(friendlyError(error));
    else invalidate(["scheduled-comments"]);
  };

  // Realinha os comentários já programados com o momento real da fala.
  // Corre em segundo plano: pode mudar de passo ou de página sem perder nada.
  const syncJob = useSyncJob(webinarId);
  const syncing = syncJob?.status === "running";

  const syncComments = () => {
    if (comments.length === 0) return;
    startSyncJob({
      webinarId,
      webinarTitle: webinar?.internal_name ?? "Webinar",
      transcript,
      comments: comments.map((c) => ({
        id: c.id,
        offset_seconds: c.offset_seconds,
        author_name: c.author_name,
        message: c.message,
      })),
      onDone: () => invalidate(["scheduled-comments"]),
    });
  };


  const existingForAi = comments.map((c) => ({
    at: c.offset_seconds,
    author: c.author_name,
    message: c.message,
  }));

  const openAi = (options: { replaceAll?: boolean; range?: { start: number; end: number } }) => {
    setAiReplaceAll(Boolean(options.replaceAll));
    setAiRange(options.range);
    setAiOpen(true);
  };

  const insertAiComments = async (drafts: DraftComment[], replaceAll: boolean) => {
    if (!workspace) throw new Error("Não foi possível identificar o seu espaço de trabalho.");
    if (replaceAll) {
      const { error } = await supabase
        .from("scheduled_comments")
        .delete()
        .eq("webinar_id", webinarId);
      if (error) throw error;
    }
    // Última barreira antes da base: nada é gravado depois do fim do vídeo,
    // e `offset_seconds` deriva sempre de `offset_ms`.
    const source = videoSources.find((v) => v.id === form.video_source_id);
    const videoDuration = source?.duration_seconds || webinar?.duration_seconds || 0;
    const placed = drafts.map((draft) => ({ draft, ...toStorageOffsets(draft) }));
    const valid = placed.filter(
      ({ offset_seconds }) => videoDuration <= 0 || offset_seconds <= videoDuration,
    );
    const rejected = placed.length - valid.length;
    if (valid.length === 0) {
      throw new Error("Nenhum comentário cabe dentro da duração do vídeo.");
    }
    const { error } = await supabase.from("scheduled_comments").insert(
      valid.map(({ draft, offset_seconds, offset_ms }) => ({
        webinar_id: webinarId,
        organization_id: workspace.organizationId,
        author_name: draft.author,
        message: draft.message,
        offset_seconds,
        comment_type: draft.moment || "geral",
        ai_intent: draft.kind ?? null,
        ai_persona: draft.persona ?? null,
        offset_ms,
        trigger_type: draft.causality?.triggerType ?? null,
        trigger_id: draft.causality?.triggerId ?? null,
        trigger_start_ms: draft.causality?.triggerStartMs ?? null,
        trigger_end_ms: draft.causality?.triggerEndMs ?? null,
        temporal_relation: draft.causality?.temporalRelation ?? null,
        reaction_latency_ms: draft.causality?.reactionLatencyMs ?? null,
        generation_reason: draft.causality?.generationReason ?? draft.reason ?? null,
        causality_confidence: draft.causality?.confidence ?? null,
        validation_action: draft.validationAction ?? null,
        validation_rule: draft.validationRule ?? null,
        transcript_version_id: draft.transcriptVersionId ?? null,
      })),
    );
    if (error) throw error;
    invalidate(["scheduled-comments"]);
    toast.success(
      rejected > 0
        ? `${valid.length} comentários adicionados à timeline. ${rejected} ficaram de fora por estarem depois do fim do vídeo.`
        : `${valid.length} comentários adicionados à timeline.`,
    );
  };

  const regenerateComment = async (comment: { id: string; offset_seconds: number }) => {
    setRegenerating(comment.id);
    try {
      const result = await generateEngagementComments({
        data: {
          webinarId,
          settings: defaultAiSettings,
          transcript,
          range: {
            start: Math.max(0, comment.offset_seconds - 20),
            end: comment.offset_seconds + 20,
          },
          existing: existingForAi.filter((c) => c.at !== comment.offset_seconds),
          count: 1,
        },
      });
      const next = result.comments[0];
      if (next)
        await updateComment(comment.id, { author_name: next.author, message: next.message });
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível regenerar."));
    } finally {
      setRegenerating(null);
    }
  };

  const selectedVideo = videoSources.find((v) => v.id === form.video_source_id) ?? null;

  useEffect(() => {
    setLinkDraft(selectedVideo?.source_url ?? "");
  }, [selectedVideo?.id, selectedVideo?.source_url]);

  const linkIsValid = /^https?:\/\/.+/i.test(linkDraft.trim());

  const addVideo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspace) return;
    const url = newVideo.source_url.trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      toast.error("Indique o link do vídeo, começado por https://");
      return;
    }
    // Duração real do vídeo quando o navegador a consegue ler; senão, os minutos indicados.
    const detected = await readDurationFromSrc(url);
    const { data, error } = await supabase
      .from("video_sources")
      .insert({
        organization_id: workspace.organizationId,
        name: newVideo.name.trim(),
        provider: newVideo.provider,
        source_url: url,
        duration_seconds: detected || Math.round((Number(newVideo.minutes) || 0) * 60),
      })
      .select("id")
      .single();
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    setForm((f) => ({ ...f, video_source_id: data.id }));
    setNewVideo({ name: "", provider: "hls", source_url: "", minutes: "" });
    setShowNewVideo(false);
    setNewVideoMode("menu");
    invalidate(["video-sources"]);
    toast.success("Vídeo adicionado e selecionado. Guarde as alterações.");
  };

  /** Lê a duração real a partir de um endereço (ficheiro local ou URL). Devolve 0 se não for possível. */
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
      el.onloadedmetadata = () =>
        finish(Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration) : 0);
      el.onerror = () => finish(0);
      el.src = src;
    });

  /** Lê a duração do ficheiro antes do envio, para a biblioteca ficar completa. */
  const readDuration = async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    try {
      return await readDurationFromSrc(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  /** Depois do ficheiro estar no bucket: regista a fonte com `storage_path` e um link assinado. */
  const registerUploadedVideo = async (file: File, path: string, duration: number) => {
    if (!workspace) return;
    // O link assinado continua a ser guardado para os ecrãs que já o usam
    // (pré-visualização, transcrição). A sala pública passa a assinar a partir
    // de `storage_path` na altura da reprodução.
    const signed = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (signed.error || !signed.data?.signedUrl) {
      toast.error(friendlyError(signed.error ?? "Não foi possível preparar o link do vídeo."));
      return;
    }
    const { data, error } = await supabase
      .from("video_sources")
      .insert({
        organization_id: workspace.organizationId,
        name: file.name.replace(/\.[^.]+$/, ""),
        provider: "upload",
        source_url: signed.data.signedUrl,
        storage_path: path,
        duration_seconds: duration,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    setForm((f) => ({ ...f, video_source_id: data.id }));
    setShowNewVideo(false);
    setNewVideoMode("menu");
    setVideoUpload(null);
    videoUploadRef.current = null;
    invalidate(["video-sources"]);
    toast.success(`Vídeo enviado (${formatBytes(file.size)}) e selecionado. Guarde as alterações.`);
  };

  const uploadVideoFile = async (file: File) => {
    if (!workspace) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    const active = videoUploadRef.current;
    if (active && uploading) {
      const sameFile =
        active.file.name === file.name &&
        active.file.size === file.size &&
        active.file.lastModified === file.lastModified;
      toast.error(
        sameFile
          ? "Este vídeo já está a ser enviado."
          : "Já há um envio em curso. Espere que termine ou cancele-o primeiro.",
      );
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(
        `O ficheiro tem ${formatBytes(file.size)} e ultrapassa o limite de 5 GB por vídeo. Comprima-o ou use um link externo.`,
      );
      return;
    }
    if (file.size === 0) {
      toast.error("O ficheiro está vazio.");
      return;
    }
    const duration = await readDuration(file);
    const path = `${workspace.organizationId}/${crypto.randomUUID()}-${safeObjectName(file.name)}`;
    const handle = createVideoUpload({
      file,
      path,
      onProgress: (progress) => {
        setVideoUpload({ file, progress });
        if (progress.status === "error" && progress.error) toast.error(progress.error);
      },
      onSuccess: (finalPath) => {
        void registerUploadedVideo(file, finalPath, duration);
      },
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

  const pauseVideoUpload = () => void videoUploadRef.current?.pause();
  const resumeVideoUpload = () => videoUploadRef.current?.resume();
  const cancelVideoUpload = async () => {
    await videoUploadRef.current?.cancel();
    videoUploadRef.current = null;
    setVideoUpload(null);
    toast("Envio cancelado.");
  };

  const saveVideoLink = async () => {

    if (!selectedVideo) return;
    const url = linkDraft.trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      toast.error("Indique o link do vídeo, começado por https://");
      return;
    }
    // O vídeo é da biblioteca: mudar o link aqui mudava-o em todos os webinars que o usam.
    const { count, error: countError } = await supabase
      .from("webinars")
      .select("id", { count: "exact", head: true })
      .eq("video_source_id", selectedVideo.id)
      .neq("id", webinarId);
    if (countError) {
      toast.error(friendlyError(countError));
      return;
    }
    if (count) {
      toast.error(
        `Este vídeo também é usado em ${count === 1 ? "outro webinar" : `mais ${count} webinars`}. Para não os alterar, adicione o novo link como um vídeo novo.`,
      );
      return;
    }
    // Ao guardar o link, corrige a duração para a real sempre que for legível.
    const detected = await readDurationFromSrc(url);
    const { error } = await supabase
      .from("video_sources")
      .update(detected ? { source_url: url, duration_seconds: detected } : { source_url: url })
      .eq("id", selectedVideo.id);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    invalidate(["video-sources", "webinar"]);
    toast.success("Link do vídeo atualizado.");
  };

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

  const minValue = Math.max(0, Number(audienceMin) || 0);
  const maxValue = Math.max(minValue, Number(audienceMax) || 0);

  const audienceLabel = useMemo(() => {
    if (audienceMode === "real") return "Audiência real";
    if (audienceMode === "simulated") return `${maxValue.toLocaleString("pt-PT")} a assistir`;
    return `Real + ${maxValue.toLocaleString("pt-PT")}`;
  }, [audienceMode, maxValue]);

  const previewCurve = useMemo(
    () => buildAudienceCurve(minValue, maxValue, 28),
    [minValue, maxValue],
  );

  const activeStep = STEPS.find((s) => s.id === step) ?? STEPS[0];
  const previewUrl = useMemo(() => {
    const draft = linkDraft.trim();
    const saved = selectedVideo?.source_url?.trim();
    if (/^https?:\/\/.+/i.test(draft)) return draft;
    if (/^https?:\/\/.+/i.test(saved || "")) return saved;
    return "";
  }, [linkDraft, selectedVideo?.source_url]);
  const previewDuration = selectedVideo?.duration_seconds ?? 0;
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  // O ciclo de vida com o horário que está no formulário: a mesma regra das páginas e
  // da base de dados. Um webinar sob demanda mantém-se inativo até ser activado.
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
      // Sem vídeo escolhido, a duração do webinar: a mesma regra de lifecycleOf e das métricas.
      duration_seconds: previewDuration || webinar?.duration_seconds || 0,
    },
    Date.now(),
  );
  const derivedStatus: WebinarStatus =
    lifecycle.kind === "on_demand" && form.status === "draft"
      ? "draft"
      : statusFromLifecycle(lifecycle, form.replay_enabled);
  const offerErrors = webinarIssues(form, { durationSeconds: previewDuration }).filter(
    (issue) => issue.step === "oferta",
  );
  const fullWidth = (FULL_WIDTH_STEPS as readonly string[]).includes(step);
  const baseUrl = publicOrigin();

  /** Marcas da linha de tempo: chat, oferta, vendas simuladas e audiência. */
  const timelineMarkers = useMemo<TimelineMarker[]>(() => {
    const items: TimelineMarker[] = comments.map((c) => ({
      id: `c-${c.id}`,
      at: c.offset_seconds,
      kind: c.ai_intent != null ? "ai" : "manual",
      label: `${c.author_name}: ${c.message.slice(0, 40)}`,
    }));
    const ctaStart = Number(form.cta_start_seconds) || 0;
    if (form.cta_text) {
      items.push({ id: "cta", at: ctaStart, kind: "offer", label: `Oferta: ${form.cta_text}` });
    }
    for (const purchase of simulatedPurchases) {
      items.push({
        id: `p-${purchase.id}`,
        at: purchase.offset_seconds,
        kind: "sales",
        label: `Compra simulada: ${purchase.buyer_name}`,
      });
    }
    if (previewDuration > 0) {
      items.push({ id: "audience", at: 0, kind: "audience", label: "Arranque da audiência" });
    }
    return items.sort((a, b) => a.at - b.at);
  }, [comments, form.cta_start_seconds, form.cta_text, simulatedPurchases, previewDuration]);
  const roomOrigin = baseUrl.replace(/^https?:\/\//, "");
  const roomLink = `${baseUrl}/w/${slugify(form.slug || form.public_title || form.internal_name)}`;
  const copyRoomLink = () => {
    void navigator.clipboard.writeText(roomLink);
    toast.success("Link da sala copiado.");
  };

  if (isLoading)
    return (
      <AppShell title="A carregar webinar" action={false}>
        <PageSkeleton variant="editor" />
      </AppShell>
    );

  if (!webinar)
    return (
      <AppShell title="Webinar não encontrado" action={false}>
        <p className="text-sm text-muted-foreground">
          Este webinar não existe ou não pertence ao seu workspace.
        </p>
      </AppShell>
    );

  return (
    <AppShell action={false} compact>
      <div className="overflow-hidden rounded-card bg-card shadow-[0_24px_48px_-28px_color-mix(in_oklab,var(--foreground)_28%,transparent)]">
        {/* Step rail */}
        <nav className="border-b px-3 py-3 sm:px-4 sm:py-4 xl:px-6">
          <ol className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STEPS.map((s, index) => {
              const Icon = s.icon;
              const isActive = s.id === step;
              const isDone = index < stepIndex;
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    aria-current={isActive ? "step" : undefined}
                    className={cn(
                      "flex w-[74px] flex-col items-center gap-2 rounded-xl px-1.5 py-3 text-xs font-semibold transition-all sm:w-[96px] sm:gap-2.5 sm:px-2 sm:py-3.5",
                      isActive
                        ? "bg-accent text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-11 place-items-center transition-all sm:size-14",
                        isActive
                          ? "text-primary"
                          : isDone
                            ? "text-primary"
                            : "text-muted-foreground",
                      )}
                    >
                      {isDone ? (
                        <Check className="size-5 sm:size-6" />
                      ) : (
                        <Icon className="size-5 sm:size-6" />
                      )}
                    </span>
                    <span className="text-[10px] leading-tight sm:text-[11px]">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div
          className={cn(
            "grid xl:min-h-[calc(100vh-184px)]",
            !fullWidth && "xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]",
          )}
        >
          {/* Editor pane */}
          <section
            className={cn(
              "@container min-w-0 border-b bg-card p-4 sm:p-5 xl:border-b-0 xl:p-7",
              !fullWidth && "xl:border-r",
            )}
          >

            <header className="mb-5">
              <p className="text-xs text-muted-foreground">
                Passo {stepIndex + 1} de {STEPS.length}
              </p>
              <h2 className="mt-1 text-xl font-bold">{activeStep.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {activeStep.hint}
              </p>
            </header>

            {step === "inicio" && (
              <div className="w-full space-y-5">
                <div className="grid gap-5 @md:grid-cols-2">
                  <Field label="Nome interno">
                    <Input
                      value={form.internal_name}
                      onChange={(e) => setForm({ ...form, internal_name: e.target.value })}
                    />
                  </Field>
                  <Field label="Título público">
                    <Input
                      value={form.public_title}
                      onChange={(e) => setForm({ ...form, public_title: e.target.value })}
                    />
                  </Field>
                </div>

                <Field label="Endereço da sala">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center rounded-md border bg-background pl-3">
                      <span className="shrink-0 truncate text-xs text-muted-foreground">
                        {roomOrigin}/w/
                      </span>
                      <Input
                        value={form.slug}
                        onChange={(e) => setForm({ ...form, slug: e.target.value })}
                        onBlur={() =>
                          setForm((f) => ({
                            ...f,
                            slug: slugify(f.slug || f.public_title || f.internal_name),
                          }))
                        }
                        className="border-0 px-1 shadow-none focus-visible:ring-0"
                        placeholder="o-meu-evento"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyRoomLink}
                      className="shrink-0"
                    >
                      <Copy className="size-4" />
                      Copiar link
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    É este o endereço que partilha. Quem abrir passa primeiro pelo ecrã de entrada.
                  </p>
                </Field>

                <Field label="Descrição">
                  <textarea
                    className="min-h-28 w-full rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Field>

                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="mb-4 text-sm font-semibold">Especialista</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nome">
                      <Input
                        value={form.host_name}
                        onChange={(e) => setForm({ ...form, host_name: e.target.value })}
                        placeholder="Ex.: Daniel Marques"
                      />
                    </Field>
                    <Field label="Cargo" hint="Aparece por baixo do nome na sala ao vivo.">
                      <Input
                        value={form.host_role}
                        onChange={(e) => setForm({ ...form, host_role: e.target.value })}
                        placeholder="Ex.: Especialista em Leilões"
                      />
                    </Field>
                  </div>
                  <Field label="Foto">
                    <div className="flex items-center gap-3">
                      {form.host_avatar_url ? (
                        <img
                          src={form.host_avatar_url}
                          alt=""
                          className="size-14 shrink-0 rounded-full border object-cover"
                        />
                      ) : (
                        <span className="grid size-14 shrink-0 place-items-center rounded-full border bg-background text-sm font-semibold text-muted-foreground">
                          {form.host_name.trim() ? form.host_name.trim()[0]?.toUpperCase() : "—"}
                        </span>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={hostAvatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void uploadCover(file, "host_avatar_url");
                          }}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={uploadingCover}
                          onClick={() => hostAvatarInputRef.current?.click()}
                        >
                          {uploadingCover ? "A carregar…" : form.host_avatar_url ? "Trocar foto" : "Carregar foto"}
                        </Button>
                        {form.host_avatar_url ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setForm({ ...form, host_avatar_url: "" })}
                          >
                            Remover
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </Field>
                </div>

                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="mb-4 text-sm font-semibold">Nota fixada no chat</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Título" hint="Deixe o texto vazio para esconder a nota.">
                      <Input
                        value={form.chat_pin_title}
                        onChange={(e) => setForm({ ...form, chat_pin_title: e.target.value })}
                        placeholder="Participe no chat!"
                      />
                    </Field>
                    <Field label="Texto">
                      <Input
                        value={form.chat_pin_message}
                        onChange={(e) => setForm({ ...form, chat_pin_message: e.target.value })}
                        placeholder="Faça perguntas ou diga de onde está a assistir."
                      />
                    </Field>
                  </div>
                </div>

                <StepFooter
                  onSave={save}
                  saving={saving}
                  onNext={saveAndGo}
                  nextLabel={nextLabel}
                />
              </div>
            )}

            {step === "webinar" && (
              <div className="space-y-4">
                <div className="inline-flex rounded-xl border bg-muted/40 p-1">
                  {(
                    [
                      ["single", "Webinar único"],
                      ["jit", "Just in time"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm({ ...form, schedule_mode: value })}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        form.schedule_mode === value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {form.schedule_mode === "single" ? (
                  <div className="grid items-start gap-3 @sm:grid-cols-2">
                    <Field label="Data e hora">
                      <Input
                        type="datetime-local"
                        value={form.scheduled_at}
                        onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                      />
                    </Field>
                    <Field
                      label="Hora de fim"
                      hint="Opcional. Se ficar vazia, a sessão termina quando o vídeo acabar."
                    >
                      <Input
                        type="time"
                        value={form.session_end_time}
                        onChange={(e) => setForm({ ...form, session_end_time: e.target.value })}
                      />
                    </Field>
                  </div>
                ) : (
                  <Field
                    label="Repetir a cada"
                    hint="No modo just in time a sessão recomeça em intervalos curtos, para quem chega a qualquer hora."
                  >
                    <Select
                      value={form.jit_interval_minutes}
                      onValueChange={(v) => setForm({ ...form, jit_interval_minutes: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["5", "10", "15", "30", "60"].map((value) => (
                          <SelectItem key={value} value={value}>
                            {value} minutos
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}

                {/* O fuso vale para a data única e para a repetição: fica sempre à vista. */}
                <Field
                  label="Fuso horário"
                  hint="As horas desta página são lidas neste fuso, seja qual for o do seu computador."
                >
                  <Select
                    value={form.timezone}
                    onValueChange={(v) => setForm({ ...form, timezone: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="space-y-4 rounded-xl border bg-background px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="recurrence"
                      checked={form.recurrence_enabled}
                      onCheckedChange={(v) =>
                        setForm({
                          ...form,
                          recurrence_enabled: v,
                          recurrence_start_time:
                            v && !form.recurrence_start_time
                              ? form.scheduled_at
                                ? form.scheduled_at.slice(11, 16)
                                : "20:00"
                              : form.recurrence_start_time,
                        })
                      }
                    />
                    <Label htmlFor="recurrence" className="text-sm font-medium">
                      Ativar repetição automática
                    </Label>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    O webinar diário ou semanal acontece uma vez por dia ou uma vez por semana, no
                    horário que definir. Ao contrário do just in time, aqui o evento corre apenas
                    uma vez no dia ou na semana.
                  </p>
                  {form.recurrence_enabled && (
                    <div className="grid items-start gap-3 @sm:grid-cols-2 @xl:grid-cols-4">
                      <Field label="Quando">
                        <Select
                          value={form.recurrence_pattern}
                          onValueChange={(v) =>
                            setForm({ ...form, recurrence_pattern: v as "daily" | "weekly" })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Diário</SelectItem>
                            <SelectItem value="weekly">Semanal</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Hora de início">
                        <Input
                          type="time"
                          value={form.recurrence_start_time}
                          onChange={(e) =>
                            setForm({ ...form, recurrence_start_time: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Hora de fim">
                        <Input
                          type="time"
                          value={form.recurrence_end_time}
                          onChange={(e) =>
                            setForm({ ...form, recurrence_end_time: e.target.value })
                          }
                        />
                      </Field>
                      {form.recurrence_pattern === "weekly" && (
                        <Field label="Dia da semana">
                          <Select
                            value={form.recurrence_weekday}
                            onValueChange={(v) => setForm({ ...form, recurrence_weekday: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                "Domingo",
                                "Segunda",
                                "Terça",
                                "Quarta",
                                "Quinta",
                                "Sexta",
                                "Sábado",
                              ].map((label, index) => (
                                <SelectItem key={label} value={String(index)}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    </div>
                  )}
                </div>
                <p className="rounded-xl border bg-background px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  {lifecycle.kind === "session" && lifecycle.state === "finished" ? (
                    <>
                      Última sessão:{" "}
                      <strong className="text-foreground">{nextSessionLabel}</strong>.{" "}
                      {lifecycleDetail(lifecycle, form.timezone)} Para uma nova sessão, escolha
                      outra data e hora ou active a repetição automática.
                    </>
                  ) : nextSessionLabel ? (
                    <>
                      {lifecycle.kind === "session" && lifecycle.state === "live"
                        ? "Sessão em curso desde"
                        : "Próxima sessão:"}{" "}
                      <strong className="text-foreground">{nextSessionLabel}</strong>. Termina à
                      hora de fim, se a definir, ou no fim do vídeo. O estado é automático e o
                      sistema dá a sessão como terminada sozinho — neste momento:{" "}
                      <strong className="text-foreground">{lifecycleLabel(lifecycle).toLowerCase()}</strong>.
                    </>
                  ) : (
                    <>
                      Falta definir quando a sessão arranca. Escolha a data e hora, o intervalo do
                      just in time ou a repetição automática.
                    </>
                  )}
                </p>
                <div className="flex items-start gap-3 rounded-xl border bg-background px-4 py-3">
                  <Switch
                    id="waiting-room"
                    checked={form.waiting_room_enabled}
                    onCheckedChange={(v) => setForm({ ...form, waiting_room_enabled: v })}
                  />
                  <div>
                    <Label htmlFor="waiting-room" className="text-sm font-medium">
                      Sala de espera antes do início
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Quem chega antes da hora aguarda numa página de espera em vez de entrar logo.
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border bg-background px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Switch
                      id="prelive"
                      checked={form.prelive_enabled}
                      onCheckedChange={(v) => setForm({ ...form, prelive_enabled: v })}
                    />
                    <div>
                      <Label htmlFor="prelive" className="text-sm font-medium">
                        Temporizador de arranque na live
                      </Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Antes da transmissão arrancar, a sala mostra uma contagem animada com som de
                        fundo — como no YouTube. O chat já está aberto e as pessoas podem falar.
                      </p>
                    </div>
                  </div>
                  {form.prelive_enabled ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
                      <div className="grid gap-1.5">
                        <Label className="text-xs font-medium">Duração da contagem</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={60}
                            value={Math.round((form.prelive_seconds || 0) / 60) || 1}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                prelive_seconds:
                                  Math.max(1, Math.min(60, Number(e.target.value) || 1)) * 60,
                              })
                            }
                            className="w-24"
                          />
                          <span className="text-xs text-muted-foreground">minutos</span>
                        </div>
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs font-medium">Frase da contagem</Label>
                        <Input
                          value={form.prelive_message}
                          onChange={(e) => setForm({ ...form, prelive_message: e.target.value })}
                          placeholder="A transmissão começa já a seguir"
                        />
                      </div>
                      <div className="flex items-center gap-3 sm:col-span-2">
                        <Switch
                          id="prelive-sound"
                          checked={form.prelive_sound}
                          onCheckedChange={(v) => setForm({ ...form, prelive_sound: v })}
                        />
                        <Label htmlFor="prelive-sound" className="text-sm font-medium">
                          Som de fundo durante a contagem
                        </Label>
                      </div>
                      <div className="sm:col-span-2">
                        <PreliveTemplateGallery
                          template={form.prelive_template}
                          appearance={form.prelive_appearance}
                          message={form.prelive_message || "A transmissão começa já a seguir"}
                          totalSeconds={Number(form.prelive_seconds) || 300}
                          onTemplateChange={(id, preset) =>
                            setForm({ ...form, prelive_template: id, prelive_appearance: preset })
                          }
                          onAppearanceChange={(value) =>
                            setForm({ ...form, prelive_appearance: value })
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
                  <Switch
                    checked={form.replay_enabled}
                    onCheckedChange={(v) => setForm({ ...form, replay_enabled: v })}
                    id="replay-session"
                  />
                  <Label htmlFor="replay-session" className="text-sm font-medium">
                    Replay ativo depois da sessão
                  </Label>
                </div>

                <details className="rounded-xl border bg-background px-4 py-3" open>
                  <summary className="cursor-pointer text-sm font-semibold">
                    Opções avançadas
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <Switch
                          id="easy-access"
                          checked={form.easy_access}
                          onCheckedChange={(v) => setForm({ ...form, easy_access: v })}
                        />
                        <Label htmlFor="easy-access" className="text-sm font-medium">
                          Acesso facilitado
                        </Label>
                      </div>
                      <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        Ligado, quem abre o endereço entra diretamente na sala, sem preencher o ecrã
                        de entrada.
                      </p>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-3">
                        <Switch
                          id="sync-video"
                          checked={form.sync_video_with_start}
                          onCheckedChange={(v) => setForm({ ...form, sync_video_with_start: v })}
                        />
                        <Label htmlFor="sync-video" className="text-sm font-medium">
                          Sincronizar vídeo com a hora de início
                        </Label>
                      </div>
                      <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        Quem chega atrasado apanha a sessão no ponto certo. Se o webinar começa às
                        20h00 e a pessoa entra às 20h05, o vídeo arranca no minuto 5.
                      </p>
                    </div>
                  </div>
                </details>

                <StepFooter
                  onSave={save}
                  saving={saving}
                  onNext={saveAndGo}
                  nextLabel={nextLabel}
                />
              </div>
            )}

            {step === "login" && (
              <div className="space-y-4">
                <Field
                  label="Capa do ecrã de entrada"
                  hint="Imagem apresentada por cima do formulário."
                >
                  <div className="space-y-3">
                    {form.registration_cover_url ? (
                      <img
                        src={form.registration_cover_url}
                        alt="Capa"
                        className="aspect-video w-full rounded-xl border object-cover"
                      />
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void uploadCover(file);
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={uploadingCover}
                        onClick={() => coverInputRef.current?.click()}
                      >
                        {uploadingCover
                          ? "A carregar…"
                          : form.registration_cover_url
                            ? "Trocar imagem"
                            : "Carregar imagem"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setImageKind("cover")}>
                        <Wand2 />
                        Gerar com IA
                      </Button>
                      {form.registration_cover_url ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setForm({ ...form, registration_cover_url: "" })}
                        >
                          Remover
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Field>
                <div className="space-y-3 rounded-xl border bg-background p-4">
                  <p className="text-sm font-semibold">Gatilhos de entrada</p>
                  <Field label="Etiqueta de destaque">
                    <Input
                      value={form.registration_badge_text}
                      onChange={(e) =>
                        setForm({ ...form, registration_badge_text: e.target.value })
                      }
                      placeholder="Ex.: Transmissão a começar já"
                    />
                  </Field>
                  <div className="flex items-center gap-3">
                    <Switch
                      id="progress-bar"
                      checked={form.registration_progress_enabled}
                      onCheckedChange={(v) =>
                        setForm({ ...form, registration_progress_enabled: v })
                      }
                    />
                    <Label htmlFor="progress-bar" className="text-sm font-medium">
                      Mostrar barra de lugares preenchidos
                    </Label>
                  </div>
                  <Field label="Percentagem inicial">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      disabled={!form.registration_progress_enabled}
                      value={form.registration_progress_value}
                      onChange={(e) =>
                        setForm({ ...form, registration_progress_value: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Aviso de escassez">
                    <Input
                      value={form.registration_scarcity_note}
                      onChange={(e) =>
                        setForm({ ...form, registration_scarcity_note: e.target.value })
                      }
                      placeholder="Ex.: Restam poucos lugares nesta sessão."
                    />
                  </Field>
                </div>
                <Field label="Título do ecrã de entrada">
                  <Input
                    value={form.registration_headline}
                    onChange={(e) => setForm({ ...form, registration_headline: e.target.value })}
                    placeholder={form.public_title || "Reserve o seu lugar"}
                  />
                </Field>
                <Field label="Frase de apoio">
                  <textarea
                    className="min-h-20 w-full rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    value={form.registration_subtitle}
                    onChange={(e) => setForm({ ...form, registration_subtitle: e.target.value })}
                    placeholder="Diga-nos como o devemos tratar durante a sessão."
                  />
                </Field>
                <Field label="Texto do botão">
                  <Input
                    value={form.registration_button_text}
                    onChange={(e) => setForm({ ...form, registration_button_text: e.target.value })}
                    placeholder="Entrar na sala"
                  />
                </Field>
                <div className="space-y-3 rounded-xl border bg-background p-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="collect-phone"
                      checked={form.registration_collect_phone}
                      onCheckedChange={(v) => setForm({ ...form, registration_collect_phone: v })}
                    />
                    <Label htmlFor="collect-phone" className="text-sm font-medium">
                      Pedir contacto telefónico
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      id="require-phone"
                      disabled={!form.registration_collect_phone}
                      checked={form.registration_require_phone}
                      onCheckedChange={(v) => setForm({ ...form, registration_require_phone: v })}
                    />
                    <Label htmlFor="require-phone" className="text-sm font-medium">
                      Tornar o contacto obrigatório
                    </Label>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Nome e e-mail são sempre pedidos. O nome escrito aqui é o que identifica a
                    pessoa no chat da sessão.
                  </p>
                </div>
                <StepFooter
                  onSave={save}
                  saving={saving}
                  onNext={saveAndGo}
                  nextLabel={nextLabel}
                />
              </div>
            )}

            {step === "design" && (
              <div className="space-y-4">
                <Field
                  label="Tema das salas"
                  hint="Aplica-se à sala de espera, ao ecrã de entrada, ao direto e ao fim da transmissão."
                >
                  <div className="grid items-start gap-3 @sm:grid-cols-2">
                    {[
                      {
                        value: "dark" as const,
                        label: "Escuro",
                        note: "Cinematográfico, foco total no vídeo.",
                        icon: Moon,
                      },
                      {
                        value: "light" as const,
                        label: "Claro",
                        note: "Limpo e arejado, bom para conteúdos didáticos.",
                        icon: Sun,
                      },
                    ].map((option) => {
                      const Icon = option.icon;
                      const active = form.room_theme === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setForm({ ...form, room_theme: option.value })}
                          className={cn(
                            "flex items-start gap-3 rounded-xl border bg-background p-4 text-left transition",
                            active
                              ? "border-primary shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_40%,transparent)]"
                              : "hover:border-primary/40",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-9 shrink-0 place-items-center rounded-full",
                              active
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          <span>
                            <span className="block text-sm font-bold">{option.label}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {option.note}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <p className="rounded-xl border bg-background px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  Use os separadores da pré-visualização para ver cada momento: sala de espera,
                  entrada, direto e fim da transmissão.
                </p>
                <StepFooter
                  onSave={save}
                  saving={saving}
                  onNext={saveAndGo}
                  nextLabel={nextLabel}
                />
              </div>
            )}

            {step === "video" && (
              <div className="space-y-4">
                <Field label="Vídeo da biblioteca">
                  <Select
                    value={form.video_source_id}
                    onValueChange={(v) => setForm({ ...form, video_source_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem vídeo</SelectItem>
                      {videoSources.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {selectedVideo && (
                  <Field label={`Link do vídeo (${providerLabels[selectedVideo.provider]})`}>
                    <div className="relative">
                      <Input
                        value={linkDraft}
                        onChange={(e) => setLinkDraft(e.target.value)}
                        placeholder="https://..."
                        className="pr-10"
                      />
                      {linkIsValid && (
                        <span className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">Partilhado com a Biblioteca.</p>
                      <Button type="button" variant="outline" size="sm" onClick={saveVideoLink}>
                        Guardar link
                      </Button>
                    </div>
                  </Field>
                )}

                <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
                  <Switch
                    checked={form.replay_enabled}
                    onCheckedChange={(v) => setForm({ ...form, replay_enabled: v })}
                    id="replay"
                  />
                  <Label htmlFor="replay" className="text-sm font-medium">
                    Replay ativo — usa exatamente o mesmo vídeo
                  </Label>
                </div>

                {showNewVideo ? (
                  <div className="space-y-4 rounded-2xl border bg-background p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold">Adicionar novo vídeo</h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowNewVideo(false);
                          setNewVideoMode("menu");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>

                    <div className="grid gap-3 @sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setNewVideoMode("upload")}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                          newVideoMode === "upload"
                            ? "border-primary"
                            : "hover:border-primary/40",
                        )}
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                          <Upload className="size-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-bold">Upload manual</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Envie o ficheiro de vídeo a partir do seu computador.
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewVideoMode("tools")}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                          newVideoMode === "tools" ? "border-primary" : "hover:border-primary/40",
                        )}
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                          <Blocks className="size-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-bold">Ferramentas</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Panda Video, Bunny Stream, Vimeo ou link direto.
                          </span>
                        </span>
                      </button>
                    </div>

                    {newVideoMode === "upload" && (
                      <div className="space-y-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadVideoFile(file);
                          }}
                        />
                        {videoUpload && videoUpload.progress.status !== "done" ? (
                          <div className="space-y-3 rounded-2xl border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{videoUpload.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatBytes(videoUpload.progress.bytesSent)} de{" "}
                                  {formatBytes(videoUpload.progress.bytesTotal)}
                                  {videoUpload.progress.resumedFromBytes != null
                                    ? " · envio retomado"
                                    : ""}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-bold tabular-nums">
                                {videoUpload.progress.percent}%
                              </span>
                            </div>
                            <Progress value={videoUpload.progress.percent} />
                            <p className="text-xs text-muted-foreground">
                              {videoUpload.progress.status === "uploading" && "A enviar vídeo…"}
                              {videoUpload.progress.status === "paused" &&
                                "Envio em pausa. Pode retomar quando quiser."}
                              {videoUpload.progress.status === "error" &&
                                (videoUpload.progress.error ?? "O envio falhou.")}
                              {videoUpload.progress.status === "cancelled" && "Envio cancelado."}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {videoUpload.progress.status === "uploading" && (
                                <Button type="button" variant="outline" size="sm" onClick={pauseVideoUpload}>
                                  Pausar
                                </Button>
                              )}
                              {videoUpload.progress.status === "paused" && (
                                <Button type="button" size="sm" onClick={resumeVideoUpload}>
                                  Retomar
                                </Button>
                              )}
                              {videoUpload.progress.status === "error" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={
                                    videoUpload.progress.recoverable
                                      ? resumeVideoUpload
                                      : () => void uploadVideoFile(videoUpload.file)
                                  }
                                >
                                  <RefreshCw />
                                  {videoUpload.progress.recoverable ? "Tentar de novo" : "Recomeçar"}
                                </Button>
                              )}
                              {videoUpload.progress.status !== "cancelled" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => void cancelVideoUpload()}
                                >
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-8 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
                        >
                          {uploading ? (
                            <Loader2 className="size-5 animate-spin" />
                          ) : (
                            <Upload className="size-5" />
                          )}
                          {uploading ? "A enviar vídeo…" : "Escolher ficheiro de vídeo"}
                          <span className="text-[11px] font-medium normal-case tracking-normal">
                            MP4, MOV ou WebM até 5 GB · envio com retoma automática
                          </span>
                        </button>
                      </div>
                    )}

                    {newVideoMode === "tools" && (
                      <div className="space-y-4">
                        <div className="grid gap-3 @sm:grid-cols-2">
                          {(
                            [
                              { value: "panda", label: "Panda Video", color: "#111827" },
                              { value: "bunny", label: "Bunny Stream", color: "#f97316" },
                              { value: "vimeo", label: "Vimeo", color: "#1ab7ea" },
                              { value: "hls", label: "URL / HLS", color: "#16a34a" },
                            ] as { value: Provider; label: string; color: string }[]
                          ).map((tool) => (
                            <button
                              key={tool.value}
                              type="button"
                              onClick={() => setNewVideo({ ...newVideo, provider: tool.value })}
                              className={cn(
                                "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                                newVideo.provider === tool.value
                                  ? "border-primary"
                                  : "hover:border-primary/40",
                              )}
                            >
                              <span
                                className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-white"
                                style={{ backgroundColor: tool.color }}
                                aria-hidden
                              >
                                {tool.label.charAt(0)}
                              </span>
                              <span className="text-sm font-medium">{tool.label}</span>
                            </button>
                          ))}
                        </div>

                        <form onSubmit={addVideo} className="space-y-4">
                          <div className="grid gap-4 @sm:grid-cols-2">
                            <Field label="Nome">
                              <Input
                                required
                                value={newVideo.name}
                                onChange={(e) => setNewVideo({ ...newVideo, name: e.target.value })}
                              />
                            </Field>
                            <Field label="Duração (min)">
                              <Input
                                type="number"
                                min={0}
                                value={newVideo.minutes}
                                onChange={(e) =>
                                  setNewVideo({ ...newVideo, minutes: e.target.value })
                                }
                              />
                            </Field>
                            <div className="@sm:col-span-2">
                              <Field label={`Link do vídeo (${providerLabels[newVideo.provider]})`}>
                                <Input
                                  required
                                  value={newVideo.source_url}
                                  onChange={(e) =>
                                    setNewVideo({ ...newVideo, source_url: e.target.value })
                                  }
                                  placeholder="https://..."
                                />
                              </Field>
                            </div>
                          </div>
                          <Button type="submit" variant="dark" size="sm">
                            <Plus />
                            Adicionar e selecionar
                          </Button>
                        </form>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewVideo(true);
                      setNewVideoMode("menu");
                    }}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Upload className="size-4" />
                    Adicionar novo vídeo
                  </button>
                )}


                <StepFooter
                  onSave={save}
                  saving={saving}
                  onNext={saveAndGo}
                  nextLabel={nextLabel}
                />
              </div>
            )}

            {step === "chat" && (
              <div className="space-y-5">
                {aiJob ? <AiJobBanner job={aiJob} onOpen={() => setAiOpen(true)} /> : null}
                {syncJob ? <SyncJobBanner job={syncJob} /> : null}
                <div className="grid items-start gap-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
                  <div className="min-w-0 space-y-4">
                <div className="space-y-4 rounded-2xl border bg-background p-5">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <Wand2 className="size-4 text-primary" />
                      Gerar com IA
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A IA ouve o vídeo, percebe cada momento e escreve a conversa sincronizada.
                      Fica sempre para revisão antes de publicar.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openAi({})}>
                      <Wand2 />
                      Gerar com IA
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={comments.length === 0}
                      onClick={() => openAi({ replaceAll: true })}
                    >
                      <RefreshCw />
                      Regenerar tudo com IA
                    </Button>
                    {analysis && analysis.segments.length > 0 ? (
                      <Button variant="outline" size="sm" onClick={() => setAnalysisOpen(true)}>
                        <BarChart3 />
                        Análise da IA
                      </Button>
                     ) : null}
                     <Button
                       variant="outline"
                       size="sm"
                       disabled={comments.length === 0 || syncing}
                       onClick={() => syncComments()}
                     >
                       {syncing ? <Loader2 className="animate-spin" /> : <CalendarClock />}
                       Sincronizar comentários com a fala
                     </Button>
                   </div>
                   <p className="text-xs text-muted-foreground">
                     A sincronização lê a transcrição e move cada comentário para logo depois da
                     frase a que responde.
                   </p>
                  <div className="flex flex-wrap items-end gap-3 border-t pt-4">
                    <Field label="Início do trecho">
                      <Input
                        className="w-28"
                        value={segmentRange.start}
                        onChange={(e) =>
                          setSegmentRange({ ...segmentRange, start: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Fim do trecho">
                      <Input
                        className="w-28"
                        value={segmentRange.end}
                        onChange={(e) => setSegmentRange({ ...segmentRange, end: e.target.value })}
                      />
                    </Field>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const start = parseClock(segmentRange.start);
                        const end = parseClock(segmentRange.end);
                        if (start === null || end === null || end <= start) {
                          toast.error(
                            "Indique o trecho no formato mm:ss, com o fim depois do início.",
                          );
                          return;
                        }
                        openAi({ range: { start, end } });
                      }}
                    >
                      <Plus />
                      Gerar mais comentários neste trecho
                    </Button>
                  </div>
                </div>

                <form
                  onSubmit={addComment}
                  className="space-y-4 rounded-2xl border bg-background p-5"
                >
                  <h3 className="text-sm font-bold">Novo comentário</h3>
                  <div className="grid gap-4 @sm:grid-cols-2">
                    <Field label="Autor">
                      <Input
                        required
                        value={newComment.author_name}
                        onChange={(e) =>
                          setNewComment({ ...newComment, author_name: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Momento no vídeo">
                      <HmsInput
                        value={newComment.offset_seconds}
                        onChange={(v) => setNewComment({ ...newComment, offset_seconds: v })}
                      />
                    </Field>
                  </div>
                  <Field label="Mensagem">
                    <textarea
                      className="min-h-24 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      required
                      value={newComment.message}
                      onChange={(e) => setNewComment({ ...newComment, message: e.target.value })}
                    />
                  </Field>
                  <Button type="submit" variant="dark" size="sm">
                    <Plus />
                    Adicionar
                  </Button>
                </form>

                <div className="overflow-hidden rounded-2xl border bg-background">
                  <div className="flex items-center justify-between border-b px-5 py-3">
                    <p className="text-xs text-muted-foreground">
                      {comments.length} comentário{comments.length === 1 ? "" : "s"} programado
                      {comments.length === 1 ? "" : "s"}
                    </p>
                    {comments.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto gap-1.5 px-2 py-1 text-xs text-destructive hover:text-destructive"
                        onClick={removeAllComments}
                      >
                        <Trash2 className="size-3.5" />
                        Eliminar todos
                      </Button>
                    )}
                  </div>
                  {comments.length === 0 ? (
                    <p className="p-5 text-sm text-muted-foreground">
                      Ainda não existem comentários programados.
                    </p>
                  ) : (
                    <ul className="max-h-[32rem] space-y-3 overflow-y-auto p-4">
                      {comments.map((c) => (
                        <li key={c.id} className="rounded-xl border bg-background p-3">
                          <div className="flex items-center gap-2">
                            <div className="shrink-0 [&_input]:h-9 [&_input]:w-12 [&_input]:pr-5">
                              <HmsInput
                                value={String(c.offset_seconds)}
                                onChange={(v) => {
                                  const seconds = Number(v) || 0;
                                  if (seconds !== c.offset_seconds)
                                    void updateComment(c.id, { offset_seconds: seconds });
                                }}
                              />
                            </div>
                            <Input
                              className="h-9 min-w-0 flex-1 bg-background font-medium"
                              defaultValue={c.author_name}
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                if (value && value !== c.author_name)
                                  void updateComment(c.id, { author_name: value });
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 shrink-0"
                              aria-label="Ver a causa desta mensagem"
                              onClick={() => setInspecting(c as InspectableComment)}
                            >
                              <Search className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 shrink-0"
                              aria-label="Regenerar este comentário"
                              disabled={regenerating === c.id}
                              onClick={() => regenerateComment(c)}
                            >
                              {regenerating === c.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <RefreshCw className="size-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 shrink-0 text-destructive hover:text-destructive"
                              aria-label="Remover"
                              onClick={() => removeComment(c.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          <textarea
                            className="mt-2 min-h-16 w-full resize-y rounded-lg border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                            defaultValue={c.message}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value && value !== c.message)
                                void updateComment(c.id, { message: value });
                            }}
                          />
                          {(c as InspectableComment).temporal_relation ? (
                            <button
                              type="button"
                              onClick={() => setInspecting(c as InspectableComment)}
                              className="mt-2 flex flex-wrap items-center gap-1.5 text-left text-[11px] text-muted-foreground"
                            >
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                                {(c as InspectableComment).temporal_relation === "SPONTANEOUS"
                                  ? "Espontâneo"
                                  : "Causa registada"}
                              </span>
                              {(c as InspectableComment).trigger_start_ms != null ? (
                                <span>
                                  {msClock((c as InspectableComment).trigger_start_ms!)} →{" "}
                                  {msClock((c as InspectableComment).trigger_end_ms ?? 0)}
                                </span>
                              ) : null}
                              {(c as InspectableComment).reaction_latency_ms != null ? (
                                <span>
                                  · {((((c as InspectableComment).reaction_latency_ms ?? 0)) / 1000).toFixed(1)}s depois
                                </span>
                              ) : null}
                            </button>
                          ) : null}
                          <div className="mt-2 flex items-center gap-2">
                            {(c as { avatar_url?: string }).avatar_url ? (
                              <img
                                src={(c as { avatar_url?: string }).avatar_url}
                                alt=""
                                className="size-8 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                {c.author_name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            <Input
                              className="h-8 flex-1 bg-background text-xs"
                              placeholder="Link da fotografia (opcional)"
                              defaultValue={(c as { avatar_url?: string }).avatar_url ?? ""}
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                if (value !== ((c as { avatar_url?: string }).avatar_url ?? "")) {
                                  void updateComment(c.id, { avatar_url: value });
                                }
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                  </div>
                  <div className="min-w-0 @3xl:sticky @3xl:top-4">
                    <div className="overflow-hidden rounded-2xl border bg-background">
                      <p className="border-b px-5 py-3 text-xs text-muted-foreground">
                        Simulação do chat
                      </p>
                      <div className="p-4">
                        <ChatPreview
                          comments={comments}
                          durationSeconds={previewDuration}
                          videoUrl={previewUrl || null}
                          videoProvider={selectedVideo?.provider ?? null}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <StepFooter
                  onSave={save}
                  saving={saving}
                  onNext={saveAndGo}
                  nextLabel={nextLabel}
                />
              </div>
            )}

            {step === "oferta" && (
              <div className="space-y-4">
                <Field label="Texto do botão">
                  <Input
                    value={form.cta_text}
                    onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
                    placeholder="Quero a minha vaga"
                  />
                </Field>
                <Field label="Link">
                  <Input
                    value={form.cta_url}
                    onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
                    placeholder="https://..."
                  />
                </Field>
                <Field label="Cor do botão" hint="A cor com que o botão da oferta aparece na sala.">
                  <div className="flex flex-wrap gap-2.5">
                    {CTA_COLORS.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        title={color.label}
                        onClick={() => setForm({ ...form, cta_color: color.id })}
                        className={cn(
                          "flex size-9 items-center justify-center rounded-full ring-offset-2 transition",
                          color.swatch,
                          form.cta_color === color.id
                            ? "ring-2 ring-foreground ring-offset-background"
                            : "opacity-70 hover:opacity-100",
                        )}
                      >
                        {form.cta_color === color.id && <Check className="size-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="grid gap-5 @sm:grid-cols-2">
                  <Field label="Preço anterior" hint="Mostrado riscado, como comparação.">
                    <Input
                      value={form.cta_price_original}
                      onChange={(e) => setForm({ ...form, cta_price_original: e.target.value })}
                      placeholder="497 €"
                    />
                  </Field>
                  <Field label="Preço agora" hint="Aparece como “Agora por apenas”.">
                    <Input
                      value={form.cta_price_now}
                      onChange={(e) => setForm({ ...form, cta_price_now: e.target.value })}
                      placeholder="197 €"
                    />
                  </Field>
                </div>
                <Field
                  label="Imagem da oferta"
                  hint="Aparece no separador Oferta, por cima do preço."
                >
                  <div className="space-y-3">
                    {form.cta_image_url ? (
                      <img
                        src={form.cta_image_url}
                        alt="Oferta"
                        className="w-full rounded-xl border object-cover"
                      />
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={offerImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void uploadCover(file, "cta_image_url");
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={uploadingCover}
                        onClick={() => offerImageInputRef.current?.click()}
                      >
                        {uploadingCover
                          ? "A carregar…"
                          : form.cta_image_url
                            ? "Trocar imagem"
                            : "Carregar imagem"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setImageKind("offer")}>
                        <Wand2 />
                        Gerar com IA
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setImageKind("product")}>
                        <ImagePlus />
                        Imagem do produto
                      </Button>
                      {form.cta_image_url ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setForm({ ...form, cta_image_url: "" })}
                        >
                          Remover
                        </Button>
                      ) : null}
                    </div>
                    <Input
                      value={form.cta_image_url}
                      onChange={(e) => setForm({ ...form, cta_image_url: e.target.value })}
                      placeholder="Ou cole o endereço de uma imagem"
                    />
                  </div>
                </Field>
                <Field
                  label="Nota fixada durante a oferta"
                  hint="Substitui a nota normal do chat enquanto a oferta está visível. O link usa o endereço da oferta configurado acima."
                >
                  <Input
                    value={form.offer_pin_title}
                    onChange={(e) => setForm({ ...form, offer_pin_title: e.target.value })}
                    placeholder="Vagas abertas :"
                  />
                  <Input
                    className="mt-1.5"
                    value={form.offer_pin_message}
                    onChange={(e) => setForm({ ...form, offer_pin_message: e.target.value })}
                    placeholder="Texto do link (ex.: comprar agora)"
                  />
                </Field>
                <Field
                  label="Contador da oferta"
                  hint="Conta a partir do momento em que a oferta abre. Tudo a zero esconde o contador."
                >
                  <HmsInput
                    value={form.cta_countdown_seconds}
                    onChange={(v) => setForm({ ...form, cta_countdown_seconds: v })}
                  />
                </Field>
                <div className="grid gap-5">
                  <Field
                    label="Minuto do pitch"
                    hint="Quando a oferta aparece na sala. Separa quem saiu antes do pitch de quem o assistiu, nas automações e nas métricas. Vazio abre a oferta logo no início."
                  >
                    <HmsInput
                      allowEmpty
                      value={form.cta_start_seconds}
                      onChange={(v) => setForm({ ...form, cta_start_seconds: v })}
                    />
                  </Field>
                  <Field label="Desaparece em" hint="Deixe vazio para ficar até ao fim.">
                    <HmsInput
                      allowEmpty
                      value={form.cta_end_seconds}
                      onChange={(v) => setForm({ ...form, cta_end_seconds: v })}
                    />
                  </Field>
                  {offerErrors.map((issue) => (
                    <p key={issue.field} className="text-sm text-destructive">
                      {issue.message}
                    </p>
                  ))}
                </div>
                <StepFooter
                  onSave={save}
                  saving={saving}
                  onNext={saveAndGo}
                  nextLabel={nextLabel}
                />
              </div>
            )}

            {step === "vendas" && (
              <div className="space-y-4">
                <WebinarPaymentsNotice webinarId={webinarId} organizationId={workspace?.organizationId} />
                <SocialProofEditor
                  webinarId={webinarId}
                  organizationId={workspace?.organizationId}
                  productFallback={form.cta_text || form.public_title}
                  webhookUrl={`${baseUrl}/api/public/purchase-webhook`}
                  offerStartSeconds={Number(form.cta_start_seconds) || 0}
                  saveRef={socialProofSaverRef}
                />
                <StepFooter
                  onSave={save}
                  saving={saving}
                  onNext={saveAndGo}
                  nextLabel={nextLabel}
                />
              </div>
            )}

            {step === "audiencia" && (
              <div className="space-y-4">
                <Field label="Modo">
                  <Select value={audienceMode} onValueChange={setAudienceMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="real">Apenas audiência real</SelectItem>
                      <SelectItem value="simulated">Audiência simulada</SelectItem>
                      <SelectItem value="hybrid">Real + simulada</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-4 @sm:grid-cols-2">
                  <Field label="Audiência mínima">
                    <Input
                      type="number"
                      min={0}
                      value={audienceMin}
                      onChange={(e) => setAudienceMin(e.target.value)}
                    />
                  </Field>
                  <Field label="Audiência máxima">
                    <Input
                      type="number"
                      min={0}
                      value={audienceMax}
                      onChange={(e) => setAudienceMax(e.target.value)}
                    />
                  </Field>
                </div>
                <p className="rounded-xl border bg-background p-4 text-xs leading-relaxed text-muted-foreground">
                  A contagem sobe rapidamente no arranque, estabiliza perto do máximo durante o
                  miolo da sessão e desce suavemente no final — sempre dentro do intervalo definido.
                  A audiência simulada nunca é misturada com os dados reais do Analytics.
                </p>
                <StepFooter onSave={save} saving={saving} onNext={saveAndGo} nextLabel={nextLabel} />
                <div className="flex flex-wrap gap-3">
                  <Button variant="ghost" className="text-destructive" onClick={removeWebinar}>
                    <Trash2 />
                    Eliminar webinar
                  </Button>
                </div>
              </div>
            )}

            {step === "integracoes" && openIntegration === null && (
              <section className="rounded-card bg-card p-5 sm:p-6">
                <h3 className="text-lg font-bold">As suas integrações</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha uma integração para configurar.
                </p>
                <div className="mt-5 grid gap-3 @sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setOpenIntegration("whatsapp")}
                    className="flex items-center gap-3 rounded-2xl border bg-background p-4 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#25D366]/12">
                      <WhatsAppIcon className="size-[1.15rem]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">WhatsApp</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        Cartão do link partilhado
                      </span>
                    </span>
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        form.share_title || form.share_image_url
                          ? "bg-[#25D366]"
                          : "bg-muted-foreground/30",
                      )}
                    />
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpenIntegration("webhook")}
                    className="flex items-center gap-3 rounded-2xl border bg-background p-4 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-foreground/8 text-foreground">
                      <Webhook className="size-[1.15rem]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">WebHook</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        Enviar inscrições e cliques na oferta
                      </span>
                    </span>
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        form.webhook_enabled && form.webhook_url
                          ? "bg-[#25D366]"
                          : "bg-muted-foreground/30",
                      )}
                    />
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                </div>

                <StepFooter
                  onSave={save}
                  saving={saving}
                  onNext={saveAndGo}
                  nextLabel={nextLabel}
                />
              </section>
            )}

            {step === "integracoes" && openIntegration === "webhook" && (
              <section className="rounded-card bg-card p-5 sm:p-6">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 mb-4"
                  onClick={() => setOpenIntegration(null)}
                >
                  <ArrowLeft />
                  Voltar às integrações
                </Button>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-2xl bg-foreground/8 text-foreground">
                    <Webhook className="size-[1.15rem]" />
                  </span>
                  <div>
                    <h3 className="font-bold">WebHook</h3>
                    <p className="text-xs text-muted-foreground">
                      Recebe um aviso sempre que alguém se inscreve ou clica na oferta.
                    </p>
                  </div>
                </div>

                <div className="mt-6 max-w-2xl space-y-5">
                  <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                    <div>
                      <p className="text-sm font-semibold">Ativar envio</p>
                      <p className="text-xs text-muted-foreground">
                        Só envia quando houver um endereço válido.
                      </p>
                    </div>
                    <Switch
                      checked={form.webhook_enabled}
                      onCheckedChange={(v) => setForm((p) => ({ ...p, webhook_enabled: v }))}
                    />
                  </div>
                  <Field
                    label="Endereço do webhook"
                    hint="Enviamos um pedido POST em JSON para este endereço."
                  >
                    <Input
                      value={form.webhook_url}
                      onChange={(e) => setForm((p) => ({ ...p, webhook_url: e.target.value }))}
                      placeholder="https://o-seu-sistema.com/webhook"
                    />
                  </Field>
                  <div className="rounded-xl border bg-muted/40 p-4">
                    <p className="text-xs text-muted-foreground">
                      Exemplo do que enviamos
                    </p>
                    <pre className="mt-2 overflow-x-auto text-xs leading-relaxed">
                      {`{
  "event": "registration",
  "webinar": "${form.public_title || "O seu webinar"}",
  "name": "Maria Silva",
  "email": "maria@exemplo.pt",
  "phone": "+351 900 000 000"
}`}
                    </pre>
                  </div>
                </div>

                <StepFooter
                  onSave={save}
                  saving={saving}
                  onNext={() => setOpenIntegration(null)}
                  nextLabel="Voltar às integrações"
                />
              </section>
            )}

            {step === "integracoes" && openIntegration === "whatsapp" && (
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2"
                  onClick={() => setOpenIntegration(null)}
                >
                  <ArrowLeft />
                  Voltar às integrações
                </Button>
                <div className="grid gap-6 @3xl:grid-cols-[1.05fr_1fr]">
                  <section className="rounded-card bg-card p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-2xl bg-[#25D366]/12 text-[#128C7E]">
                          <WhatsAppIcon className="size-[1.15rem]" />
                        </span>
                        <div>
                          <h3 className="font-bold">WhatsApp</h3>
                          <p className="text-xs text-muted-foreground">
                            Como o link da sala aparece quando é partilhado.
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest",
                          form.share_title || form.share_image_url
                            ? "bg-[#25D366]/15 text-[#15803d]"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {form.share_title || form.share_image_url
                          ? "Configurado"
                          : "Por configurar"}
                      </span>
                    </div>

                    <div className="mt-6 space-y-5">
                      <Field label="Título da mensagem de partilha">
                        <Input
                          value={form.share_title}
                          onChange={(e) => setForm((p) => ({ ...p, share_title: e.target.value }))}
                          placeholder={form.public_title || "Ex.: Workshop Marca Milionária"}
                        />
                      </Field>
                      <Field label="Descrição do webinar">
                        <Input
                          value={form.share_description}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, share_description: e.target.value }))
                          }
                          placeholder="Ex.: AO VIVO — garanta o seu lugar"
                        />
                      </Field>
                      <Field
                        label="Imagem de partilha"
                        hint="Aparece no cartão do link no WhatsApp."
                      >
                        <input
                          ref={shareImageInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadCover(file, "share_image_url");
                            e.target.value = "";
                          }}
                        />
                        {form.share_image_url ? (
                          <div className="overflow-hidden rounded-xl border">
                            <img
                              src={form.share_image_url}
                              alt="Imagem de partilha"
                              className="aspect-[1.91/1] w-full object-cover"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => shareImageInputRef.current?.click()}
                            className="grid w-full place-items-center rounded-xl border border-dashed p-8 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
                          >
                            Carregar imagem de partilha
                          </button>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingCover}
                            onClick={() => shareImageInputRef.current?.click()}
                          >
                            {uploadingCover ? <Loader2 className="animate-spin" /> : <Upload />}
                            {form.share_image_url ? "Trocar imagem" : "Carregar"}
                          </Button>
                          {form.share_image_url ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => setForm((p) => ({ ...p, share_image_url: "" }))}
                            >
                              <Trash2 />
                              Remover imagem
                            </Button>
                          ) : null}
                        </div>
                      </Field>
                    </div>

                    <StepFooter
                      onSave={save}
                      saving={saving}
                      onNext={saveAndGo}
                      nextLabel={nextLabel}
                    />
                  </section>

                  <section className="rounded-card bg-card p-5 sm:p-6">
                    <h3 className="font-bold">Pré-visualização</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      É assim que o link aparece numa conversa de WhatsApp.
                    </p>
                    <div className="mt-5 rounded-2xl bg-[#ece5dd] p-4 sm:p-6 dark:bg-[#0b141a]">
                      <div className="max-w-sm rounded-xl rounded-tl-none bg-white p-1.5 shadow-sm dark:bg-[#202c33]">
                        {form.share_image_url ? (
                          <img
                            src={form.share_image_url}
                            alt=""
                            className="aspect-[1.91/1] w-full rounded-t-lg object-cover"
                          />
                        ) : null}
                        <div className="border-l-4 border-[#25D366] bg-[#f0f2f5] px-3 py-2.5 dark:bg-[#182229]">
                          <p className="truncate text-sm font-semibold text-[#111b21] dark:text-[#e9edef]">
                            {form.share_title || form.public_title || "Título do webinar"}
                          </p>
                          <p className="truncate text-xs text-[#667781] dark:text-[#8696a0]">
                            {form.share_description || "Descrição do webinar"}
                          </p>
                        </div>
                        <p className="truncate px-2 py-1.5 text-sm text-[#027eb5] dark:text-[#53bdeb]">
                          {baseUrl}/w/{form.slug || "o-seu-webinar"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard.writeText(`${baseUrl}/w/${form.slug}`);
                          toast.success("Link da sala copiado.");
                        }}
                      >
                        <Copy />
                        Copiar link da sala
                      </Button>
                      <Button type="button" variant="dark" size="sm" asChild>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `${form.share_title || form.public_title} ${baseUrl}/w/${form.slug}`,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Partilhar no WhatsApp
                        </a>
                      </Button>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {step === "agente" && (
              <AgentPanel webinarId={webinarId} onSeek={(seconds) => setTimelineCursor(seconds)} />
            )}

            {step === "automacoes" && (
              <WebinarAutomations webinarId={webinarId} title={form.public_title || form.internal_name || "Webinar"} />
            )}
            {step === "timeline" && (
              <div className="space-y-4">
                <WebinarTimeline
                  durationSeconds={previewDuration}
                  markers={timelineMarkers}
                  cursor={timelineCursor}
                  onSeek={setTimelineCursor}
                />
                <p className="text-sm text-muted-foreground">
                  Momento escolhido:{" "}
                  <strong className="tabular-nums">{formatOffset(timelineCursor)}</strong>. Clique
                  na régua para saltar para outro ponto da sessão.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep("chat")}>
                    <MessagesSquare />
                    Abrir o chat neste momento
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setStep("vendas")}>
                    <ShoppingBag />
                    Abrir as vendas
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Preview pane */}
          {!fullWidth && (
            <PreviewShell
              label={
                step === "webinar"
                  ? "Como o webinar se apresenta"
                  : step === "login"
                    ? "Ecrã antes de entrar"
                    : step === "design"
                      ? "Pré-visualização dinâmica das salas"
                      : step === "video"
                        ? "Pré-visualização do vídeo"
                        : step === "oferta"
                          ? "Momento da oferta"
                          : "Curva de audiência"
              }
            >
              {step === "webinar" && (
                <IdentityPreview
                  title={form.public_title}
                  description={form.description}
                  statusLabel={lifecycleLabel(lifecycle)}
                  scheduledAt={form.scheduled_at}
                  internalName={form.internal_name}
                />
              )}

              {step === "login" && (
                <RegistrationPreview
                  title={form.public_title}
                  headline={form.registration_headline}
                  subtitle={form.registration_subtitle}
                  buttonText={form.registration_button_text}
                  collectPhone={form.registration_collect_phone}
                  requirePhone={form.registration_require_phone}
                  coverUrl={form.registration_cover_url}
                  badgeText={form.registration_badge_text}
                  progressEnabled={form.registration_progress_enabled}
                  progressValue={Number(form.registration_progress_value) || 0}
                  scarcityNote={form.registration_scarcity_note}
                />
              )}

              {step === "design" && (
                <RoomDesignPreview
                  theme={form.room_theme}
                  title={form.public_title}
                  headline={form.registration_headline}
                  subtitle={form.registration_subtitle}
                  buttonText={form.registration_button_text}
                  coverUrl={form.registration_cover_url}
                  ctaText={form.cta_text}
                  ctaColor={form.cta_color}
                  scheduledAt={form.scheduled_at}
                  viewersLabel={audienceLabel}
                />
              )}

              {step === "video" && (
                <div className="group relative mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-2xl bg-[#0b0e14] shadow-[0_36px_64px_-28px_rgba(0,0,0,0.55)] ring-1 ring-black/10">
                  {previewUrl ? (
                    <VideoPlayer
                      url={previewUrl}
                      provider={selectedVideo?.provider ?? null}
                      controls
                      onTime={() => {}}
                      className="size-full rounded-none"
                      autoPlay
                      muted
                      loop
                      quiet
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(220,38,38,0.22),transparent_60%)]" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10">
                        <p className="truncate text-sm font-bold text-white">
                          {form.public_title || "Sem título público"}
                        </p>
                        <p className="mt-1 text-[11px] text-white/60">
                          Adicione o link do vídeo para ver aqui a reprodução.
                        </p>
                      </div>
                    </>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4">
                    <span className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-primary-foreground">
                      <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" />
                      Ao vivo
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                      <Radio className="size-3" />
                      {audienceLabel}
                    </span>
                  </div>
                </div>
              )}

              {step === "oferta" && (
                <OfferPreview
                  ctaText={form.cta_text}
                  ctaUrl={form.cta_url}
                  ctaColor={form.cta_color}
                  priceOriginal={form.cta_price_original}
                  priceNow={form.cta_price_now}
                  imageUrl={form.cta_image_url}
                  countdownSeconds={Number(form.cta_countdown_seconds) || 0}
                  startSeconds={form.cta_start_seconds ? Number(form.cta_start_seconds) : null}
                  endSeconds={form.cta_end_seconds ? Number(form.cta_end_seconds) : null}
                  durationSeconds={previewDuration}
                />
              )}

              {step === "audiencia" && (
                <AudienceChartPreview
                  curve={previewCurve}
                  min={minValue}
                  max={maxValue}
                  modeLabel={
                    audienceMode === "real"
                      ? "Apenas audiência real"
                      : audienceMode === "simulated"
                        ? "Audiência simulada"
                        : "Real + simulada"
                  }
                  durationSeconds={previewDuration}
                />
              )}
            </PreviewShell>
          )}
        </div>
      </div>

      {/* Ações suspensas no fim da página */}
      <div className="pointer-events-none fixed bottom-24 right-4 z-30 md:bottom-6 md:right-6">
        <div className="glass glass-edge pointer-events-auto flex items-center gap-1.5 rounded-pill p-1.5 shadow-pop">

          <Button variant="ghost" size="sm" className="rounded-full" asChild>
            <Link to="/live/$webinarId" params={{ webinarId }}>
              Pré-visualizar
            </Link>
          </Button>

          {dirty && (
            <span className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              Por gravar
            </span>
          )}

          <Button
            variant="dark"
            size="sm"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-full px-5"
          >
            {saving && <Loader2 className="animate-spin" />}
            Guardar webinar
          </Button>
        </div>
      </div>
      <div className="h-24 md:h-16" aria-hidden="true" />

      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Análise da IA</DialogTitle>
          </DialogHeader>
          {analysis && analysis.segments.length > 0 ? (
            <EngagementDiagnostics
              analysis={analysis}
              onSeek={(seconds) => {
                setTimelineCursor(seconds);
                setSegmentRange({
                  start: clockLabel(seconds),
                  end: clockLabel(seconds + 300),
                });
                setAnalysisOpen(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AiCommentsDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        webinarId={webinarId}
        webinarTitle={form.public_title || form.internal_name || "Webinar"}
        existing={existingForAi}
        {...(aiRange ? { range: aiRange } : {})}
        replaceAll={aiReplaceAll}
        transcript={transcript}
        mediaUrl={selectedVideo?.source_url ?? null}
        onSeek={(seconds) => setTimelineCursor(seconds)}
        onTranscript={keepTranscript}
        onInsert={insertAiComments}
      />

      {imageKind ? (
        <AiImageDialog
          open
          onOpenChange={(next) => !next && setImageKind(null)}
          kind={imageKind}
          defaults={{
            product: form.cta_text || form.public_title,
            title: form.public_title,
            description: form.description,
          }}
          onApply={async (file) => {
            await uploadCover(
              file,
              imageKind === "cover" ? "registration_cover_url" : "cta_image_url",
            );
            setImageKind(null);
          }}
          onUpload={async (file) => {
            await uploadCover(
              file,
              imageKind === "cover" ? "registration_cover_url" : "cta_image_url",
            );
            setImageKind(null);
          }}
        />
      ) : null}
      <CommentInspector
        comment={inspecting}
        inspection={inspection}
        open={inspecting !== null}
        onOpenChange={(value) => {
          if (!value) setInspecting(null);
        }}
      />
    </AppShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs leading-snug text-muted-foreground">{hint}</p> : null}

    </div>
  );
}

function StepFooter({
  onSave,
  saving,
  onNext,
  nextLabel,
}: {
  onSave: () => void;
  saving: boolean;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t pt-4">
      <Button
        onClick={onSave}
        disabled={saving}
        variant="outline"
        className="shrink-0 border-primary font-medium text-primary hover:bg-primary/10 hover:text-primary"
      >
        {saving && <Loader2 className="animate-spin" />}
        Guardar alterações
      </Button>
      <Button
        onClick={onNext}
        className="shrink-0 rounded-full bg-primary px-5 font-medium text-primary-foreground hover:bg-primary/90"
      >
        {nextLabel}
      </Button>
    </div>
  );
}
