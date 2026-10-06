import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown, Loader2, Play } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PHONE_COUNTRIES, type PhoneCountry } from "@/lib/phone-countries";
import { entryPalette } from "@/lib/room-logic";
import { cn } from "@/lib/utils";
import whatsappIcon from "@/assets/local/whatsapp-icon.webp";

/**
 * O ecrã antes da sala, em dois momentos: ao chegar, a aula a decorrer desfocada por trás, «Ao
 * vivo» a piscar e o botão; ao clicar, o cartão com os dados. Sem título nem número de pessoas
 * antes dos dados: a contagem só aparece na sala. A página pública e a pré-visualização do
 * editor desenham este mesmo componente.
 */

const ENTRY_CSS = `@keyframes cwBlink{50%{opacity:.2}}@keyframes cwPulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--cw-btn) 65%,transparent)}100%{box-shadow:0 0 0 24px transparent}}.cw-blink{animation:cwBlink 1.1s ease-in-out infinite}.cw-pulse{animation:cwPulse 1.6s ease-out infinite}@media (prefers-reduced-motion:reduce){.cw-blink,.cw-pulse{animation:none}}`;

export const ROOM_FONT = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';

export type EntryValues = { name: string; email: string; phone: string };

export type EntryScreenProps = {
  moment: "gate" | "card";
  onOpen?: (() => void) | undefined;
  /** «Ao vivo» ou, antes da hora, «Começa às 20:00». */
  liveLabel: string;
  live: boolean;
  /** A aula por trás; sem vídeo legível, o título do vídeo. */
  video?: { url: string; startSeconds?: number } | null | undefined;
  fallback?: { kicker: string; title: string } | null | undefined;
  badge?: string | undefined;
  headline: string;
  subtitle?: string | undefined;
  buttonText: string;
  progress?: number | null | undefined;
  phone: { show: boolean; required: boolean };
  cardColor?: string | null | undefined;
  buttonColor?: string | null | undefined;
  values: EntryValues;
  onChange?: ((values: EntryValues) => void) | undefined;
  country: PhoneCountry;
  onCountry?: ((country: PhoneCountry) => void) | undefined;
  onSubmit?: ((event: React.FormEvent) => void) | undefined;
  error?: string | undefined;
  entering?: boolean | undefined;
  /** Pré-visualização: os campos não recebem foco nem texto. */
  preview?: boolean | undefined;
  /** Na pré-visualização, o elemento em edição fica realçado. */
  highlight?: string | null | undefined;
  className?: string | undefined;
};

const ring = (on: boolean) =>
  on ? "outline-2 outline-offset-4 outline-[#E8440C] [outline-style:solid] shadow-[0_0_0_10px_rgba(232,68,12,.25)]" : "";

export function EntryScreen(props: EntryScreenProps) {
  const p = entryPalette(props.cardColor, props.buttonColor);
  const hl = (key: string) => ring(props.highlight === key);
  const vars = {
    "--cw-btn": p.button,
    "--cw-line": p.line,
    "--cw-field": p.field,
    "--cw-ph": p.placeholder,
    fontFamily: ROOM_FONT,
  } as CSSProperties;

  return (
    <div
      className={cn(
        "@container relative isolate flex w-full flex-col items-center justify-center overflow-hidden bg-[#0A0A0A] px-4 py-16 text-white",
        props.className,
      )}
      style={vars}
    >
      <style>{ENTRY_CSS}</style>
      <div aria-hidden className="absolute -inset-[30px] -z-10 [filter:blur(14px)_brightness(.5)]">
        {props.video?.url ? (
          <BackgroundVideo url={props.video.url} startSeconds={props.video.startSeconds ?? 0} />
        ) : (
          <div className="grid h-full content-center gap-3 bg-[radial-gradient(120%_90%_at_85%_10%,rgba(232,68,12,.2),transparent_55%),linear-gradient(160deg,#22262e,#111316)] px-[12%]">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#F28E63]">
              {props.fallback?.kicker}
            </p>
            <p className="max-w-xl text-5xl font-extrabold leading-tight tracking-tight">
              {props.fallback?.title}
            </p>
          </div>
        )}
      </div>

      <span
        className={cn(
          "absolute left-4 top-4 z-10 inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold @3xl:left-7 @3xl:top-7 @3xl:h-9 @3xl:gap-2 @3xl:px-3.5 @3xl:text-[15px]",
          props.live ? "bg-[#E5484D]" : "bg-black/60 ring-1 ring-white/15",
        )}
      >
        {props.live ? <i className="cw-blink size-[7px] rounded-full bg-white @3xl:size-[9px]" /> : null}
        {props.liveLabel}
      </span>

      {props.moment === "gate" ? (
        <button
          type="button"
          onClick={props.onOpen}
          tabIndex={props.preview ? -1 : undefined}
          className={cn(
            "cw-pulse relative z-10 inline-flex h-[52px] items-center gap-2.5 rounded-full px-[26px] text-base font-semibold @3xl:h-[60px] @3xl:px-8 @3xl:text-lg",
            hl("button"),
          )}
          style={{ background: p.button, color: p.buttonText }}
        >
          <Play className="size-4 fill-current" />
          {props.buttonText}
        </button>
      ) : (
        <EntryCard {...props} palette={p} hl={hl} />
      )}
    </div>
  );
}

function EntryCard({
  palette: p,
  hl,
  ...props
}: EntryScreenProps & { palette: ReturnType<typeof entryPalette>; hl: (key: string) => string }) {
  const inert = props.preview;
  const set = (patch: Partial<EntryValues>) => props.onChange?.({ ...props.values, ...patch });
  const input =
    "h-[50px] w-full min-w-0 rounded-xl bg-[var(--cw-field)] px-4 text-[15px] shadow-[0_0_0_1px_var(--cw-line)] outline-none placeholder:text-[var(--cw-ph)] focus:shadow-[0_0_0_2px_var(--cw-btn)] @3xl:h-[54px] @3xl:text-base";
  const progress = props.progress == null ? null : Math.min(100, Math.max(0, props.progress));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!inert) props.onSubmit?.(event);
      }}
      noValidate
      className="relative z-10 grid w-full max-w-[345px] gap-3.5 rounded-[18px] p-5 @3xl:max-w-[520px] @3xl:gap-4 @3xl:p-8"
      style={{
        background: p.card,
        color: p.text,
        boxShadow: `0 30px 80px rgba(0,0,0,.45), 0 0 0 1px ${p.line}`,
      }}
    >
      {props.badge ? (
        <span
          className={cn(
            "justify-self-start rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider @3xl:text-[11.5px]",
            hl("badge"),
          )}
          style={{ background: p.button, color: p.buttonText }}
        >
          {props.badge}
        </span>
      ) : null}
      <div className="grid gap-1.5">
        <h1
          className={cn(
            "text-[22px] font-bold leading-tight tracking-tight @3xl:text-[36px]",
            hl("headline"),
          )}
        >
          {props.headline}
        </h1>
        {props.subtitle ? (
          <p className={cn("text-[15px] @3xl:text-[18px]", hl("sub"))} style={{ color: p.muted }}>
            {props.subtitle}
          </p>
        ) : null}
      </div>
      {progress != null ? (
        <div className={cn("grid gap-1.5", hl("progress"))}>
          <p className="text-[13px] @3xl:text-sm" style={{ color: p.muted }}>
            {progress}% das vagas preenchidas
          </p>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: p.line }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: p.button }} />
          </div>
        </div>
      ) : null}

      <EntryField label="Nome completo" required>
        <input
          className={input}
          value={props.values.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Como quer ser tratado"
          autoComplete="name"
          readOnly={inert}
          tabIndex={inert ? -1 : undefined}
        />
      </EntryField>
      <EntryField label="E-mail" required>
        <input
          className={input}
          type="email"
          value={props.values.email}
          onChange={(e) => set({ email: e.target.value })}
          placeholder="Onde enviamos o acesso"
          autoComplete="email"
          readOnly={inert}
          tabIndex={inert ? -1 : undefined}
        />
      </EntryField>
      {props.phone.show ? (
        <EntryField
          label={
            <>
              <img src={whatsappIcon} alt="" className="size-4" />
              WhatsApp
            </>
          }
          required={props.phone.required}
        >
          <div className={cn("flex min-w-0 items-center gap-2", hl("phone"))}>
            <CountryPicker
              country={props.country}
              onCountry={props.onCountry}
              inert={inert}
              className={input}
            />
            <input
              className={input}
              value={props.values.phone}
              onChange={(e) => set({ phone: e.target.value.replace(/[^\d\s()-]/g, "") })}
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="900 000 000"
              readOnly={inert}
              tabIndex={inert ? -1 : undefined}
            />
          </div>
        </EntryField>
      ) : null}

      {props.error ? (
        <p className="text-sm font-medium" style={{ color: p.button }} role="alert">
          {props.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={props.entering}
        tabIndex={inert ? -1 : undefined}
        className={cn(
          "flex h-[54px] items-center justify-center gap-2 rounded-xl text-[16.5px] font-semibold transition hover:brightness-110 disabled:opacity-70 @3xl:h-[58px] @3xl:text-lg",
          hl("button"),
        )}
        style={{ background: p.button, color: p.buttonText }}
      >
        {props.entering ? <Loader2 className="size-5 animate-spin" /> : null}
        {props.buttonText}
      </button>
    </form>
  );
}

function EntryField({ label, required, children }: { label: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 @3xl:gap-2">
      <span className="flex items-center gap-1.5 text-sm font-medium opacity-85 @3xl:text-[15px]">
        {label}
        {required ? <span className="font-semibold text-[var(--cw-btn)]">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function CountryPicker({
  country,
  onCountry,
  inert,
  className,
}: {
  country: PhoneCountry;
  onCountry?: ((country: PhoneCountry) => void) | undefined;
  inert?: boolean | undefined;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = (
    <button
      type="button"
      aria-label="Escolher o indicativo do país"
      tabIndex={inert ? -1 : undefined}
      className={cn(className, "flex w-auto shrink-0 items-center gap-1.5 px-3")}
    >
      <span className="text-lg leading-none">{country.flag}</span>
      <span className="font-semibold tabular-nums">{country.dial}</span>
      <ChevronDown className="size-4 opacity-60" />
    </button>
  );
  if (inert || !onCountry) return trigger;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-64 overflow-y-auto p-1">
        {PHONE_COUNTRIES.map((option) => (
          <button
            key={`${option.code}-${option.dial}`}
            type="button"
            onClick={() => {
              onCountry(option);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            <span className="text-base leading-none">{option.flag}</span>
            <span className="flex-1 truncate">{option.name}</span>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">{option.dial}</span>
            {option.code === country.code && option.dial === country.dial ? (
              <Check className="size-3.5 text-primary" />
            ) : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** A aula a decorrer, sem som, a partir do minuto em que a sessão vai. */
function BackgroundVideo({ url, startSeconds }: { url: string; startSeconds: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const seek = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = startSeconds % video.duration;
      }
    };
    if (video.readyState >= 1) seek();
    else video.addEventListener("loadedmetadata", seek, { once: true });
    return () => video.removeEventListener("loadedmetadata", seek);
  }, [startSeconds, url]);
  return (
    <video
      ref={ref}
      src={url}
      muted
      autoPlay
      loop
      playsInline
      preload="metadata"
      className="h-full w-full object-cover"
    />
  );
}

/** Um vídeo que o browser toca directamente (não um leitor embebido de uma plataforma). */
export function isDirectVideo(url: string | null | undefined, provider?: string | null) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (provider === "upload") return true;
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

/** «Ao vivo» ou, antes da hora, «Começa às 20:00» (ou o dia, se não for hoje). */
export function entryLiveLabel(startMs: number | null, timezone: string | null | undefined, nowMs: number) {
  if (startMs === null || startMs <= nowMs) return { live: true, label: "Ao vivo" };
  const zone = timezone || "UTC";
  const day = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date(ms));
  const hour = new Intl.DateTimeFormat("pt-PT", { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(
    new Date(startMs),
  );
  if (day(startMs) === day(nowMs)) return { live: false, label: `Começa às ${hour}` };
  const date = new Intl.DateTimeFormat("pt-PT", { timeZone: zone, day: "numeric", month: "short" }).format(
    new Date(startMs),
  );
  return { live: false, label: `Começa a ${date.replace(".", "")}, ${hour}` };
}
