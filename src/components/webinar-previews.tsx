import { useEffect, useRef, useState, type ReactNode } from "react";
import { VideoPlayer } from "@/components/video-player";
import {
  CalendarClock,
  ArrowRight,
  MessageSquare,
  MousePointerClick,
  Radio,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ctaButtonClass } from "@/lib/cta-colors";
import whatsappIcon from "@/assets/local/whatsapp-icon.webp";

export function PreviewShell({
  label,
  children,
  footer,
}: {
  label: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="relative bg-muted/40 p-5 xl:p-8">
      <div className="sticky top-6 flex flex-col gap-4">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {label}
        </p>
        <div className="flex min-h-0 flex-col">{children}</div>
        {footer}
      </div>
    </section>
  );
}

function formatClock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ---------------- Passo: Início ---------------- */

export function IdentityPreview({
  title,
  description,
  statusLabel,
  scheduledAt,
  internalName,
}: {
  title: string;
  description: string;
  statusLabel: string;
  scheduledAt: string;
  internalName: string;
}) {
  const date = scheduledAt ? new Date(scheduledAt) : null;
  const valid = date && !Number.isNaN(date.getTime());
  const diffMs = valid ? date.getTime() - Date.now() : 0;
  const days = Math.floor(Math.abs(diffMs) / 86400000);
  const hours = Math.floor((Math.abs(diffMs) % 86400000) / 3600000);
  const minutes = Math.floor((Math.abs(diffMs) % 3600000) / 60000);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="overflow-hidden rounded-card bg-card">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-5 py-3">
          <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-primary-foreground">
            {statusLabel}
          </span>
          <span className="truncate text-[11px] font-semibold text-muted-foreground">
            {internalName || "Sem nome interno"}
          </span>
        </div>
        <div className="space-y-3 px-5 py-6">
          <h3 className="text-2xl font-black leading-tight">{title || "Sem título público"}</h3>
          <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
            {description ||
              "A descrição aparece aqui para os participantes na página de inscrição e na sala."}
          </p>
        </div>
        <div className="flex items-center gap-3 border-t px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-primary">
            <CalendarClock className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              Agendamento
            </p>
            <p className="truncate text-sm font-bold">
              {valid
                ? date.toLocaleString("pt-PT", { dateStyle: "full", timeStyle: "short" })
                : "Ainda sem data definida"}
            </p>
          </div>
        </div>
      </div>

      {valid && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Dias", value: days },
            { label: "Horas", value: hours },
            { label: "Minutos", value: minutes },
          ].map((item) => (
            <div key={item.label} className="rounded-card bg-card py-4 text-center">
              <p className="text-2xl font-black tabular-nums">
                {String(item.value).padStart(2, "0")}
              </p>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                {diffMs < 0 ? `${item.label} atrás` : item.label}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Passo: Chat ---------------- */

export function ChatPreview({
  comments,
  durationSeconds,
  videoUrl,
  videoProvider,
}: {
  comments: { id: string; author_name: string; message: string; offset_seconds: number }[];
  durationSeconds: number;
  /** Vídeo do webinar: o chat avança conforme o tempo do vídeo. */
  videoUrl?: string | null | undefined;
  videoProvider?: string | null | undefined;
}) {
  const total = Math.max(durationSeconds, ...comments.map((c) => c.offset_seconds), 60);
  const sorted = [...comments].sort((a, b) => a.offset_seconds - b.offset_seconds);
  const [currentTime, setCurrentTime] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const hasVideo = Boolean(videoUrl);
  // Sem vídeo mostramos tudo; com vídeo só o que já "aconteceu".
  const visible = hasVideo ? sorted.filter((c) => c.offset_seconds <= currentTime + 0.5) : sorted;

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [visible.length]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      {hasVideo ? (
        <div className="overflow-hidden rounded-card bg-card">
          <VideoPlayer
            url={videoUrl ?? null}
            provider={videoProvider ?? null}
            controls
            quiet
            onTime={setCurrentTime}
            className="w-full"
          />
          <div className="flex items-center justify-between border-t px-4 py-2 text-[11px] font-semibold text-muted-foreground">
            <span>Avance o vídeo para ver o chat no momento exato.</span>
            <span className="tabular-nums">
              {formatClock(Math.round(currentTime))} / {formatClock(total)}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-card bg-card p-5 text-sm text-muted-foreground">
          Escolha o vídeo no passo Vídeo para acompanhar o chat sincronizado com a fala.
        </div>
      )}

      <div className="flex h-[520px] flex-col overflow-hidden rounded-card bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-bold">
            <MessageSquare className="size-3.5 text-primary" />
            Chat da sala
          </p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {hasVideo
              ? `${visible.length} de ${comments.length}`
              : `${comments.length} programado${comments.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {sorted.length === 0 ? (
            <p className="pt-10 text-center text-sm text-muted-foreground">
              Adicione comentários para ver como o chat se comporta ao vivo.
            </p>
          ) : visible.length === 0 ? (
            <p className="pt-10 text-center text-sm text-muted-foreground">
              Ainda sem mensagens neste momento do vídeo.
            </p>
          ) : (
            visible.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-black text-primary">
                  {c.author_name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
                  <p className="text-[11px] font-bold">
                    {c.author_name}
                    <span className="ml-2 font-semibold text-muted-foreground">
                      {formatClock(c.offset_seconds)}
                    </span>
                  </p>
                  <p className="text-sm leading-snug">{c.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t px-4 py-3">
          <div className="rounded-full bg-muted px-4 py-2 text-xs text-muted-foreground">
            Mensagens escritas por participantes reais são privadas.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Passo: Oferta ---------------- */

export function OfferPreview({
  ctaText,
  ctaUrl,
  ctaColor,
  priceOriginal = "",
  priceNow = "",
  imageUrl = "",
  countdownSeconds = 0,
  startSeconds,
  endSeconds,
  durationSeconds,
}: {
  ctaText: string;
  ctaUrl: string;
  ctaColor: string;
  priceOriginal?: string;
  priceNow?: string;
  imageUrl?: string;
  countdownSeconds?: number;
  startSeconds: number | null;
  endSeconds: number | null;
  durationSeconds: number;
}) {
  const total = Math.max(durationSeconds, endSeconds ?? 0, startSeconds ?? 0, 60);
  const start = startSeconds ?? 0;
  const openEnded = endSeconds === null;
  const end = endSeconds ?? total;
  const left = Math.min(100, (start / total) * 100);
  const width = Math.max(2, Math.min(100 - left, ((end - start) / total) * 100));

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="relative flex aspect-video items-end justify-center overflow-hidden rounded-2xl bg-[#0b0e14] p-6 ring-1 ring-black/10">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_10%,rgba(220,38,38,0.25),transparent_62%)]" />
        <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
          <MousePointerClick className="size-3" />
          {openEnded
            ? `Oferta visível de ${formatClock(start)} até ao fim`
            : `Oferta visível de ${formatClock(start)} a ${formatClock(end)}`}
        </div>
        <div className="relative w-full text-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Oferta"
              className="mx-auto mb-4 max-h-40 w-full rounded-xl object-cover"
            />
          ) : null}
          {(priceOriginal || priceNow) && (
            <p className="mb-3 flex flex-wrap items-baseline justify-center gap-2 text-white">
              {priceOriginal && (
                <span className="text-xs font-semibold text-white/60 line-through">
                  Antes {priceOriginal}
                </span>
              )}
              {priceNow && (
                <span className="text-sm font-black">
                  Agora por apenas <span className="text-primary">{priceNow}</span>
                </span>
              )}
            </p>
          )}
          {ctaText ? (
            <span
              className={cn(
                "inline-block rounded-full px-8 py-3.5 text-sm font-black shadow-[0_16px_40px_-10px_rgba(0,0,0,0.55)]",
                ctaButtonClass(ctaColor),
              )}
            >
              {ctaText}
            </span>
          ) : (
            <span className="inline-block rounded-full border border-dashed border-white/30 px-8 py-3.5 text-sm font-bold text-white/60">
              O botão da oferta aparece aqui
            </span>
          )}
          {countdownSeconds > 0 && (
            <p className="mt-3 text-3xl font-black tabular-nums text-white">
              {`${String(Math.floor(countdownSeconds / 60)).padStart(2, "0")}:${String(countdownSeconds % 60).padStart(2, "0")}`}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-card bg-card p-5">
        <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
          Janela da oferta na linha temporal
        </p>
        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 rounded-full bg-primary"
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-bold text-muted-foreground">
          <span>0:00</span>
          <span>{formatClock(total)}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Passo: Audiência ---------------- */

export function AudienceChartPreview({
  curve,
  min,
  max,
  modeLabel,
  durationSeconds,
}: {
  curve: number[];
  min: number;
  max: number;
  modeLabel: string;
  durationSeconds: number;
}) {
  const width = 640;
  const height = 240;
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(max, 1) * 1.12;
  const points = curve.map((value, index) => {
    const x = (index / Math.max(1, curve.length - 1)) * width;
    const y = height - (value / top) * height;
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const peakIndex = curve.indexOf(Math.max(...curve, 0));
  const peakPoint = points[peakIndex];

  const total = durationSeconds || 0;
  const hoverIndex = hover === null ? null : Math.max(0, Math.min(curve.length - 1, hover));
  const hoverPoint = hoverIndex === null ? null : points[hoverIndex];
  const hoverValue = hoverIndex === null ? null : curve[hoverIndex];
  const hoverSeconds =
    hoverIndex === null || !total ? null : (hoverIndex / Math.max(1, curve.length - 1)) * total;

  const readPosition = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
    setHover(Math.round(ratio * (curve.length - 1)));
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="rounded-card bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              Curva prevista de espectadores
            </p>
            <p className="mt-0.5 text-sm font-bold">{modeLabel}</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-primary">
            <TrendingUp className="size-3.5" />
            arranca no mínimo · estabiliza · desce
          </span>
        </div>

        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-48 w-full touch-none"
            preserveAspectRatio="none"
            role="img"
            aria-label="Curva de audiência"
            onMouseMove={readPosition}
            onMouseLeave={() => setHover(null)}
          >
            {[0.25, 0.5, 0.75].map((g) => (
              <line
                key={g}
                x1={0}
                x2={width}
                y1={height * g}
                y2={height * g}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
            ))}
            <path d={area} className="fill-primary/12" />
            <path
              d={line}
              className="stroke-primary"
              strokeWidth={3}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {peakPoint && (
              <circle cx={peakPoint[0]} cy={peakPoint[1]} r={6} className="fill-primary" />
            )}
            {hoverPoint && (
              <>
                <line
                  x1={hoverPoint[0]}
                  x2={hoverPoint[0]}
                  y1={0}
                  y2={height}
                  className="stroke-primary/45"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                />
                <circle
                  cx={hoverPoint[0]}
                  cy={hoverPoint[1]}
                  r={7}
                  className="fill-primary stroke-card"
                  strokeWidth={3}
                />
              </>
            )}
          </svg>

          {hoverPoint && hoverValue !== undefined && hoverValue !== null && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-card bg-card px-3 py-2 text-center shadow-lg"
              style={{
                left: `${(hoverPoint[0] / width) * 100}%`,
                top: `${Math.max(8, (hoverPoint[1] / height) * 100 - 6)}%`,
              }}
            >
              <p className="text-base font-black tabular-nums leading-none">
                {hoverValue.toLocaleString("pt-PT")}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {hoverSeconds !== null ? formatClock(hoverSeconds) : "a assistir"}
              </p>
            </div>
          )}
        </div>

        <div className="mt-2 flex justify-between text-[10px] font-bold text-muted-foreground">
          <span>Início</span>
          <span>{durationSeconds ? formatClock(durationSeconds / 2) : "Meio da sessão"}</span>
          <span>{durationSeconds ? formatClock(durationSeconds) : "Fim"}</span>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Passe o rato pela curva para ver o número exato em cada momento.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <AudienceStat icon={Users} label="Arranca com" value={min.toLocaleString("pt-PT")} />
        <AudienceStat icon={Radio} label="Máximo" value={max.toLocaleString("pt-PT")} highlight />
        <AudienceStat
          icon={TrendingUp}
          label="Média prevista"
          value={Math.round(
            curve.reduce((a, b) => a + b, 0) / Math.max(1, curve.length),
          ).toLocaleString("pt-PT")}
        />
      </div>
    </div>
  );
}

/* ---------------- Passo: Login ---------------- */

export function RegistrationPreview({
  title,
  headline,
  subtitle,
  buttonText,
  collectPhone,
  requirePhone,
  coverUrl = "",
  badgeText = "",
  progressEnabled = false,
  progressValue = 0,
  scarcityNote = "",
}: {
  title: string;
  headline: string;
  subtitle: string;
  buttonText: string;
  collectPhone: boolean;
  requirePhone: boolean;
  coverUrl?: string;
  badgeText?: string;
  progressEnabled?: boolean;
  progressValue?: number;
  scarcityNote?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-md">
      {coverUrl ? (
        <div className="mb-5 overflow-hidden rounded-xl">
          <img src={coverUrl} alt="Capa do webinar" className="h-36 w-full object-cover sm:h-44" />
        </div>
      ) : null}
      <div className="space-y-4">
        {badgeText ? (
          <div className="flex justify-center">
            <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
              {badgeText}
            </span>
          </div>
        ) : null}
        {progressEnabled ? (
          <div className="relative h-7 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progressValue))}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center px-3 text-xs font-semibold text-white drop-shadow-sm">
              {Math.min(100, Math.max(0, progressValue))}% das vagas preenchidas
            </span>
          </div>
        ) : null}
        <div>
          <h3 className="text-xl font-semibold leading-snug">
            [🔴 AO VIVO] {headline || title || "Reserve o seu lugar"}
          </h3>
          {subtitle ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
          <PreviewField label="Nome" placeholder="Como quer ser tratado" required />
          <PreviewField label="E-mail" placeholder="onde enviamos o acesso" required />
          {collectPhone && (
            <div className="grid gap-1.5">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <img src={whatsappIcon} alt="" className="size-4" />
                WhatsApp
                {requirePhone && <span className="ml-0.5 text-primary">*</span>}
              </p>
              <div className="flex gap-2">
                <div className="flex h-11 shrink-0 items-center gap-1 rounded-lg border bg-background px-2 text-xs font-medium">
                  🇵🇹 +351
                </div>
                <div className="flex-1 rounded-lg border bg-background px-3 py-2.5 text-sm text-muted-foreground">
                  900 000 000
                </div>
              </div>
            </div>
          )}
        </div>
        <span className="flex w-full items-center justify-center gap-2 rounded-pill bg-primary px-6 py-3 text-base font-semibold text-white hover:bg-accent-strong">
          {buttonText || "Entrar na sala"}
          <ArrowRight className="size-5" />
        </span>
        {scarcityNote ? (
          <p className="text-center text-xs text-muted-foreground">{scarcityNote}</p>
        ) : null}
      </div>
    </div>
  );
}

function PreviewField({
  label,
  placeholder,
  required,
  icon,
}: {
  label: string;
  placeholder: string;
  required: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <p className="flex items-center gap-1.5 text-sm font-bold">
        {icon}
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </p>
      <div className="rounded-lg border bg-background px-3 py-2.5 text-sm text-muted-foreground">
        {placeholder}
      </div>
    </div>
  );
}

function AudienceStat({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn("rounded-card bg-card p-4", highlight && "border-primary/40 bg-accent")}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-black tabular-nums", highlight && "text-primary")}>
        {value}
      </p>
    </div>
  );
}

/* ---------------- Passo: Design (pré-visualização dinâmica) ---------------- */

type RoomState = "espera" | "login" | "live" | "fim";

const ROOM_STATES: { id: RoomState; label: string }[] = [
  { id: "espera", label: "Sala de espera" },
  { id: "login", label: "Entrada" },
  { id: "live", label: "Ao vivo" },
  { id: "fim", label: "Fim da transmissão" },
];

export function RoomDesignPreview({
  theme,
  title,
  headline,
  subtitle,
  buttonText,
  coverUrl,
  ctaText,
  ctaColor,
  scheduledAt,
  viewersLabel,
}: {
  theme: "dark" | "light";
  title: string;
  headline: string;
  subtitle: string;
  buttonText: string;
  coverUrl: string;
  ctaText: string;
  ctaColor: string;
  scheduledAt: string;
  viewersLabel: string;
}) {
  const [state, setState] = useState<RoomState>("espera");
  const date = scheduledAt ? new Date(scheduledAt) : null;
  const valid = date && !Number.isNaN(date.getTime());
  const startLabel = valid
    ? date.toLocaleString("pt-PT", { dateStyle: "long", timeStyle: "short" })
    : "Data por definir";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex flex-wrap gap-1.5 rounded-full border bg-card p-1.5">
        {ROOM_STATES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setState(item.id)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-full px-3 py-2 text-[11px] font-bold transition",
              state === item.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "room-ambient overflow-hidden rounded-2xl p-5 ring-1 ring-room-line",
          theme === "light" && "room-light",
        )}
      >
        {state === "espera" && (
          <div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center text-room-text">
            <span className="rounded-full bg-room-surface px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-room-subtle ring-1 ring-room-line">
              Sala de espera
            </span>
            <h3 className="text-2xl font-black leading-tight">
              {title || "Título público do webinar"}
            </h3>
            <p className="text-xs text-room-subtle">Começa {startLabel}</p>
            <div className="flex gap-2">
              {["02", "07", "41", "12"].map((value, index) => (
                <div
                  key={index}
                  className="min-w-16 rounded-xl bg-room-surface px-3 py-3 ring-1 ring-room-line"
                >
                  <p className="text-2xl font-black tabular-nums">{value}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-room-subtle">
                    {["dias", "horas", "min", "seg"][index]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {state === "login" && (
          <div className="mx-auto w-full max-w-md text-room-text">
            {coverUrl ? (
              <div className="mb-4 flex justify-center">
                <img src={coverUrl} alt="" className="max-h-28 max-w-36 object-contain" />
              </div>
            ) : null}
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-xl font-semibold leading-snug">
                  [🔴 AO VIVO] {headline || title || "Reserve o seu lugar"}
                </h3>
                {subtitle ? (
                  <p className="mt-1.5 text-sm text-room-subtle">{subtitle}</p>
                ) : null}
              </div>
              {["Nome", "E-mail"].map((label) => (
                <div
                  key={label}
                  className="rounded-lg bg-room-raised px-3 py-2.5 text-sm text-room-subtle ring-1 ring-room-line"
                >
                  {label}
                </div>
              ))}
              <div className="flex gap-2">
                <div className="flex h-11 shrink-0 items-center gap-1 rounded-lg bg-room-raised px-2 text-xs font-semibold text-room-text ring-1 ring-room-line">
                  🇵🇹 +351
                </div>
                <div className="flex-1 rounded-lg bg-room-raised px-3 py-2.5 text-sm text-room-subtle ring-1 ring-room-line">
                  WhatsApp
                </div>
              </div>
              <div className="flex h-12 items-center justify-center gap-2 rounded-pill bg-primary px-4 text-center text-base font-semibold text-white hover:bg-accent-strong">
                {buttonText || "Entrar na sala"}
                <ArrowRight className="size-5" />
              </div>
            </div>
          </div>
        )}

        {state === "live" && (
          <div className="grid gap-3 text-room-text sm:grid-cols-[minmax(0,1fr)_150px]">
            <div className="space-y-3">
              <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black/80 ring-1 ring-room-line">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt=""
                    className="absolute inset-0 size-full object-cover opacity-70"
                  />
                ) : null}
                <span className="glass-chip absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-room-text">
                  Ao vivo
                </span>
                <span className="glass-chip absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold text-room-text">
                  {viewersLabel}
                </span>
              </div>
              <h3 className="text-base font-black leading-tight">
                {title || "Título público do webinar"}
              </h3>
              {ctaText ? (
                <span
                  className={cn(
                    "inline-flex rounded-xl px-5 py-2.5 text-xs font-black shadow-lg",
                    ctaButtonClass(ctaColor),
                  )}
                >
                  {ctaText}
                </span>
              ) : null}
            </div>
            <div className="hidden flex-col gap-2 rounded-xl bg-room-surface p-3 ring-1 ring-room-line sm:flex">
              <p className="text-[10px] font-bold uppercase tracking-widest text-room-subtle">
                Chat
              </p>
              {["Boa noite!", "Já cá estou 🔥", "Excelente"].map((message, index) => (
                <p key={index} className="text-[11px] leading-snug text-room-text">
                  <span className="font-bold text-primary">Participante</span> {message}
                </p>
              ))}
            </div>
          </div>
        )}

        {state === "fim" && (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center text-room-text">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
              Transmissão terminou
            </p>
            <h3 className="text-xl font-black">Obrigado por ter estado connosco</h3>
            <p className="max-w-sm text-xs text-room-subtle">
              {ctaText
                ? "A oferta continua disponível para quem ainda não decidiu."
                : "Volte para a próxima sessão."}
            </p>
            {ctaText ? (
              <span
                className={cn(
                  "inline-flex rounded-xl px-6 py-3 text-sm font-black shadow-lg",
                  ctaButtonClass(ctaColor),
                )}
              >
                {ctaText}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
