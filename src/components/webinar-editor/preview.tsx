import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronsLeft,
  Expand,
  Gift,
  Lock,
  Mic,
  Monitor,
  Pause,
  Phone,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Smartphone,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/room-logic";
import { ROOM_FONT } from "@/components/room/entry-screen";

/** A pré-visualização do editor: o aparelho à escala, sem deformar, e o ecrã completo. */

export type Device = "desktop" | "phone";

/** O portátil inteiro ao tamanho real: ecrã 1280×720 com a barra do navegador, moldura e base. */
const LAPTOP = { w: 1452, h: 832 };
const PHONE = { w: 425, h: 878 };

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const read = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * A escala que faz o aparelho caber inteiro no espaço, com margem à volta, sem deformar e sem
 * passar do tamanho real. O telemóvel ao alto fica um pouco mais pequeno, para não dominar.
 */
export function deviceScale(device: Device, width: number, height: number, landscape = false) {
  const pad = 24;
  const [w, h] = device === "desktop" ? [LAPTOP.w, LAPTOP.h] : landscape ? [PHONE.h, PHONE.w] : [PHONE.w, PHONE.h];
  const fit = Math.min((width - 2 * pad) / w, (height - 2 * pad) / h);
  const cap = device === "phone" && !landscape ? Math.min(0.8, ((height - 2 * pad) * 0.88) / h) : 1;
  return Math.max(0.1, Math.min(fit, cap, 1));
}

export function Scaled({ k, w, h, children }: { k: number; w: number; h: number; children: ReactNode }) {
  return (
    <div className="relative shrink-0" style={{ width: w * k, height: h * k }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: w, height: h, transform: `scale(${k})` }}>
        {children}
      </div>
    </div>
  );
}

/** O portátil: moldura preta com a câmara, a barra do navegador com o endereço e a base. */
export function LaptopFrame({
  k,
  url,
  highlightUrl,
  children,
}: {
  k: number;
  url: string;
  highlightUrl?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <Scaled k={k} w={LAPTOP.w} h={LAPTOP.h}>
      <div className="flex h-[832px] w-[1452px] flex-col items-center">
        <div className="relative rounded-[28px] bg-[#0A0A0B] p-5 shadow-[0_0_0_2px_#D9D5CD,0_0_0_3.5px_#A7A298]">
          <i className="absolute left-1/2 top-[7px] size-[7px] -translate-x-1/2 rounded-full bg-[#1D1D22] ring-1 ring-[#2B2B31]" />
          <div className="overflow-hidden rounded-[6px] bg-white">
            <div className="flex h-[42px] w-[1280px] items-center gap-2 border-b border-[#E5E5E5] bg-[#F4F4F5] px-4">
              {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                <i key={c} className="size-3 shrink-0 rounded-full" style={{ background: c }} />
              ))}
              <span
                className={cn(
                  "mx-auto flex h-[26px] w-[520px] min-w-0 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-[13px] text-[#52525B] shadow-[0_0_0_1px_#E4E4E7]",
                  highlightUrl && "outline outline-[3px] outline-[#E8440C]",
                )}
              >
                <Lock className="size-3 shrink-0" />
                <span className="truncate">{url}</span>
              </span>
              <span className="w-[52px] shrink-0" />
            </div>
            <div className="h-[720px] w-[1280px] overflow-hidden">{children}</div>
          </div>
        </div>
        <div className="relative h-[30px] w-[1452px] rounded-b-[20px] rounded-t-[3px] bg-[linear-gradient(#ECEAE5,#CFCBC2_55%,#A29E95)] shadow-[0_30px_40px_-24px_rgba(0,0,0,.6)]">
          <i className="absolute left-1/2 top-0 h-[10px] w-[240px] -translate-x-1/2 rounded-b-[10px] bg-[#BDB9B0]" />
        </div>
      </div>
    </Scaled>
  );
}

export function IosStatus({ dark }: { dark?: boolean | undefined }) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 z-[8] flex h-[54px] items-center justify-between pb-0 pl-[52px] pr-[30px] pt-2 text-[17px] font-semibold",
        dark ? "text-black" : "text-white",
      )}
      style={{ fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif' }}
    >
      <span>9:41</span>
      <span className="flex items-center gap-1.5">
        <svg width="19" height="12" viewBox="0 0 19 12" fill="currentColor" aria-hidden>
          <rect x="0" y="8" width="3.2" height="4" rx="1" />
          <rect x="5" y="5.5" width="3.2" height="6.5" rx="1" />
          <rect x="10" y="3" width="3.2" height="9" rx="1" />
          <rect x="15" y="0" width="3.2" height="12" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none" aria-hidden>
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" stroke="currentColor" opacity=".4" />
          <rect x="2" y="2" width="19" height="8" rx="2" fill="currentColor" />
          <rect x="24" y="4" width="1.6" height="4" rx=".8" fill="currentColor" opacity=".4" />
        </svg>
      </span>
    </div>
  );
}

export function PhoneFrame({
  k,
  light,
  landscape,
  children,
}: {
  k: number;
  light?: boolean | undefined;
  landscape?: boolean | undefined;
  children: ReactNode;
}) {
  if (landscape) {
    return (
      <Scaled k={k} w={PHONE.h} h={PHONE.w}>
        <div className="relative h-[425px] w-[878px] rounded-[70px] bg-[#0A0A0B] p-[13px] shadow-[0_0_0_2px_#D9D5CD,0_0_0_3.5px_#A7A298,0_40px_70px_-20px_rgba(0,0,0,.45)]">
          <div className="relative h-[393px] w-[852px] overflow-hidden rounded-[57px] bg-black">
            <div className="absolute left-6 top-1/2 z-[9] h-[124px] w-9 -translate-y-1/2 rounded-[20px] bg-black" />
            {children}
          </div>
        </div>
      </Scaled>
    );
  }
  return (
    <Scaled k={k} w={PHONE.w} h={PHONE.h}>
      <div className="relative h-[878px] w-[425px] px-[3px]">
        <i className="absolute left-0 top-[128px] h-[34px] w-1 rounded-sm bg-gradient-to-r from-[#A7A298] to-[#D9D5CD]" />
        <i className="absolute left-0 top-[190px] h-[62px] w-1 rounded-sm bg-gradient-to-r from-[#A7A298] to-[#D9D5CD]" />
        <i className="absolute left-0 top-[266px] h-[62px] w-1 rounded-sm bg-gradient-to-r from-[#A7A298] to-[#D9D5CD]" />
        <i className="absolute right-0 top-[214px] h-[100px] w-1 rounded-sm bg-gradient-to-r from-[#A7A298] to-[#D9D5CD]" />
        <div className="relative h-[878px] w-[419px] rounded-[70px] bg-[#0A0A0B] p-[13px] shadow-[0_0_0_2px_#D9D5CD,0_0_0_3.5px_#A7A298,0_40px_70px_-20px_rgba(0,0,0,.45)]">
          <div className="relative h-[852px] w-[393px] overflow-hidden rounded-[57px] bg-black">
            <div className="absolute left-1/2 top-6 z-[9] h-9 w-[124px] -translate-x-1/2 rounded-[20px] bg-black" />
            <IosStatus dark={light} />
            {children}
            <div
              className={cn(
                "absolute bottom-[21px] left-1/2 z-[9] h-[5px] w-[136px] -translate-x-1/2 rounded-[3px]",
                light ? "bg-black/85" : "bg-white/90",
              )}
            />
          </div>
        </div>
      </div>
    </Scaled>
  );
}

/** O que fica por baixo do aparelho: o leitor, os ecrãs e o formato. */
export type Dock = { play?: ReactNode; tabs?: ReactNode; format?: ReactNode };

/**
 * O aparelho certo, inteiro e centrado no espaço disponível, com margem à volta. Por baixo, a barra
 * do leitor e dos ecrãs alinhada com o aparelho: no computador vai de uma ponta à outra do portátil;
 * no telemóvel fica em duas linhas centradas (os ecrãs em cima, o leitor e o formato em baixo).
 */
export function DeviceStage({
  device,
  landscape,
  url,
  highlightUrl,
  light,
  dock,
  children,
}: {
  device: Device;
  landscape?: boolean | undefined;
  url: string;
  highlightUrl?: boolean | undefined;
  light?: boolean | undefined;
  dock?: Dock | undefined;
  children: ReactNode;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const has = Boolean(dock && (dock.play || dock.tabs || dock.format));
  const stacked = device === "phone" && !landscape;
  // O espaço da barra sai da altura do aparelho, para nada ficar por cima dele.
  const k = deviceScale(device, size.w, size.h - (has ? (stacked && dock?.tabs && (dock.play || dock.format) ? 100 : 52) : 0), landscape);
  const frameW = (device === "desktop" ? LAPTOP.w : landscape ? PHONE.h : PHONE.w) * k;
  return (
    <div ref={ref} className="flex size-full min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden">
      {size.w > 0 && size.h > 0 ? (
        device === "desktop" ? (
          <LaptopFrame k={k} url={url} highlightUrl={highlightUrl}>
            {children}
          </LaptopFrame>
        ) : (
          <PhoneFrame k={k} light={light} landscape={landscape}>
            {children}
          </PhoneFrame>
        )
      ) : null}
      {has && size.w > 0 ? (
        stacked ? (
          <div className="mt-3 grid shrink-0 justify-items-center gap-2">
            {dock?.tabs}
            {dock?.play || dock?.format ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {dock?.play}
                {dock?.format}
              </div>
            ) : null}
          </div>
        ) : (
          <div
            className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2"
            style={{ width: Math.min(Math.max(frameW, 560), size.w - 16) }}
          >
            <span className="flex min-w-0 items-center">{dock?.play}</span>
            {dock?.tabs}
            <span className="flex min-w-0 items-center justify-end">{dock?.format}</span>
          </div>
        )
      ) : null}
    </div>
  );
}

/** Rodar o telemóvel: ao alto ou deitado. */
export function RotateButton({ landscape, onChange }: { landscape: boolean; onChange: (landscape: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!landscape)}
      title={landscape ? "Pôr ao alto" : "Deitar o telemóvel"}
      aria-label={landscape ? "Pôr o telemóvel ao alto" : "Deitar o telemóvel"}
      aria-pressed={landscape}
      className="grid size-[34px] shrink-0 place-items-center rounded-lg border bg-white transition hover:bg-gray-100"
    >
      <RotateCw className="size-[15px]" />
    </button>
  );
}

export function DeviceToggle({ device, onChange }: { device: Device; onChange: (device: Device) => void }) {
  const option = (value: Device, label: string, Icon: typeof Monitor) => (
    <button
      type="button"
      aria-pressed={device === value}
      aria-label={label}
      title={label}
      onClick={() => onChange(value)}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition",
        device === value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-[var(--ds-gray-alpha-200)] hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
  return (
    <div className="inline-flex shrink-0 gap-0.5 rounded-[10px] border bg-white p-[3px] shadow-[0_1px_2px_rgba(0,0,0,.05)]">
      {option("desktop", "Computador", Monitor)}
      {option("phone", "Telemóvel", Smartphone)}
    </div>
  );
}

export type ScreenTab = { key: string; label: string; active: boolean; onClick: () => void };

/** Os ecrãs por baixo do aparelho, como no ManyChat: cada um abre a etapa que o define. */
export function ScreenTabs({ tabs, dark }: { tabs: readonly ScreenTab[]; dark?: boolean | undefined }) {
  return (
    <div
      role="tablist"
      aria-label="Ecrãs"
      className={cn(
        "inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        dark ? "bg-[#1F1F1F]" : "bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_0_0_1px_rgba(0,0,0,.06)]",
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.active}
          onClick={t.onClick}
          className={cn(
            "h-8 shrink-0 whitespace-nowrap rounded-lg px-3.5 text-[13px] font-medium transition",
            t.active
              ? dark
                ? "bg-[#EDEDED] text-[#0A0A0A]"
                : "bg-foreground text-background"
              : dark
                ? "text-[#A1A1A1] hover:text-[#EDEDED]"
                : "text-muted-foreground hover:bg-[var(--ds-gray-alpha-100)] hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/**
 * O formato da sala, por baixo do aparelho, ao lado dos ecrãs: Webinar ou Live. O botão de
 * afinar abre a etapa Vídeo, onde a sala se personaliza (igual nos dois).
 */
export function FormatSwitch<T extends string>({
  value,
  options,
  onChange,
  onCustomize,
  dark,
}: {
  value: T;
  options: readonly { id: T; name: string; hint: string }[];
  onChange: (value: T) => void;
  onCustomize?: (() => void) | undefined;
  dark?: boolean | undefined;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Formato da sala"
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 rounded-xl p-1",
        dark ? "bg-[#1F1F1F]" : "bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_0_0_1px_rgba(0,0,0,.06)]",
      )}
    >
      <span className={cn("pl-2 pr-1.5 text-[12px] font-medium", dark ? "text-[#A1A1A1]" : "text-muted-foreground")}>Formato</span>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.hint}
            onClick={() => onChange(o.id)}
            className={cn(
              "h-8 shrink-0 whitespace-nowrap rounded-lg px-3.5 text-[13px] font-medium transition",
              on
                ? dark
                  ? "bg-[#EDEDED] text-[#0A0A0A]"
                  : "bg-foreground text-background"
                : dark
                  ? "text-[#A1A1A1] hover:text-[#EDEDED]"
                  : "text-muted-foreground hover:bg-[var(--ds-gray-alpha-100)] hover:text-foreground",
            )}
          >
            {o.name}
          </button>
        );
      })}
      {onCustomize ? (
        <button
          type="button"
          onClick={onCustomize}
          aria-label="Personalizar o formato"
          title="Personalizar"
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg transition",
            dark ? "text-[#A1A1A1] hover:text-[#EDEDED]" : "text-muted-foreground hover:bg-[var(--ds-gray-alpha-100)] hover:text-foreground",
          )}
        >
          <SlidersHorizontal className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * O leitor da sala, por baixo do aparelho (ideia dos leitores de áudio da ElevenLabs, sem os
 * instalar). Fechado é só o play e o minuto; tocar no play abre as funções: recuar e avançar 10 s,
 * a barra para arrastar o cursor e o tempo. A seta à direita volta a fechá-lo.
 */
export function PlayChip({
  t,
  duration,
  playing,
  onToggle,
  onSeek,
  dark,
}: {
  t: number;
  duration: number;
  playing: boolean;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  dark?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  const icon = cn(
    "grid size-8 shrink-0 place-items-center rounded-lg transition",
    dark ? "text-[#A1A1A1] hover:bg-white/10 hover:text-[#EDEDED]" : "text-muted-foreground hover:bg-[var(--ds-gray-alpha-200)] hover:text-foreground",
  );
  const jump = (delta: number) => onSeek(Math.max(0, Math.min(duration, t + delta)));
  return (
    <span
      className={cn(
        "inline-flex h-10 min-w-0 shrink-0 items-center gap-1 rounded-xl p-1 transition-[width]",
        open ? "pr-1" : "pr-3",
        dark ? "bg-[#1F1F1F] text-[#EDEDED]" : "bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_0_0_1px_rgba(0,0,0,.06)]",
      )}
    >
      {open ? (
        <button type="button" onClick={() => jump(-10)} aria-label="Recuar 10 segundos" title="Recuar 10 s" className={icon}>
          <RotateCcw className="size-4" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          onToggle();
          setOpen(true);
        }}
        aria-label={playing ? "Pausar" : "Tocar"}
        className={cn("grid size-8 shrink-0 place-items-center rounded-lg", dark ? "bg-[#EDEDED] text-[#0A0A0A]" : "bg-foreground text-background")}
      >
        {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
      </button>
      {open ? (
        <>
          <button type="button" onClick={() => jump(10)} aria-label="Avançar 10 segundos" title="Avançar 10 s" className={icon}>
            <RotateCw className="size-4" />
          </button>
          <SliderPrimitive.Root
            value={[Math.min(t, duration)]}
            max={Math.max(1, duration)}
            step={1}
            onValueChange={([v]) => onSeek(v ?? 0)}
            aria-label="Minuto do vídeo"
            className="group relative mx-2 flex h-8 w-[180px] touch-none select-none items-center"
          >
            <SliderPrimitive.Track className={cn("relative h-1 grow overflow-hidden rounded-full", dark ? "bg-white/15" : "bg-[var(--ds-gray-alpha-300)]")}>
              <SliderPrimitive.Range className={cn("absolute h-full", dark ? "bg-[#EDEDED]" : "bg-foreground")} />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
              className={cn(
                "block size-3 rounded-full opacity-0 shadow transition-opacity focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100",
                dark ? "bg-[#EDEDED]" : "bg-foreground",
              )}
            />
          </SliderPrimitive.Root>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={open}
        className="shrink-0 pl-1 font-mono text-[12.5px] tabular-nums disabled:cursor-default"
        aria-label={open ? undefined : "Abrir o leitor"}
      >
        <b className="font-semibold">{clock(t)}</b>
        <span className={dark ? "text-[#8F8F8F]" : "text-muted-foreground"}> / {clock(duration)}</span>
      </button>
      {open ? (
        <button type="button" onClick={() => setOpen(false)} aria-label="Fechar o leitor" title="Fechar" className={icon}>
          <ChevronsLeft className="size-4" />
        </button>
      ) : null}
    </span>
  );
}

export function ExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Ecrã completo"
      aria-label="Ver em ecrã completo"
      className="grid size-[34px] shrink-0 place-items-center rounded-lg border bg-white transition hover:bg-gray-100"
    >
      <Expand className="size-[15px]" />
    </button>
  );
}

/** O ecrã completo: o aparelho sobre fundo escuro; o leitor e os ecrãs vêm na barra do aparelho. */
export function FullScreen({
  name,
  device,
  onDevice,
  onClose,
  children,
}: {
  name: string;
  device: Device;
  onDevice: (device: Device) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0A0A0A] text-[#EDEDED]" role="dialog" aria-label={name}>
      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <b className="min-w-0 flex-1 truncate text-sm">{name}</b>
        <DarkToggle device={device} onChange={onDevice} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-3 text-[13px] font-medium hover:bg-white/15"
        >
          <X className="size-4" />
          <span className="hidden sm:inline">Fechar</span>
        </button>
      </div>
      <div className="min-h-0 flex-1 px-2 pb-3 sm:px-4">{children}</div>
    </div>
  );
}

function DarkToggle({ device, onChange }: { device: Device; onChange: (device: Device) => void }) {
  const option = (value: Device, label: string, Icon: typeof Monitor) => (
    <button
      type="button"
      aria-pressed={device === value}
      aria-label={label}
      onClick={() => onChange(value)}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium",
        device === value ? "bg-[#EDEDED] text-[#0A0A0A]" : "text-[#A1A1A1] hover:text-[#EDEDED]",
      )}
    >
      <Icon className="size-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
  return (
    <div className="inline-flex shrink-0 gap-0.5 rounded-[10px] bg-[#1F1F1F] p-[3px]">
      {option("desktop", "Computador", Monitor)}
      {option("phone", "Telemóvel", Smartphone)}
    </div>
  );
}

/** A sala de espera: contagem decrescente até à sessão. */
export function WaitingPreview({
  device,
  title,
  remainingSeconds,
  when,
  highlight,
}: {
  device: Device;
  title: string;
  remainingSeconds: number;
  when: string;
  highlight?: boolean | undefined;
}) {
  const phone = device === "phone";
  const r = Math.max(0, Math.floor(remainingSeconds));
  const parts: [number, string][] = [
    [Math.floor(r / 86400), "dias"],
    [Math.floor((r % 86400) / 3600), "horas"],
    [Math.floor((r % 3600) / 60), "min"],
    [r % 60, "seg"],
  ];
  return (
    <div
      className={cn(
        "grid place-items-center text-white",
        phone ? "h-[852px] w-[393px] content-start pt-[200px]" : "h-[720px] w-[1280px]",
      )}
      style={{
        fontFamily: ROOM_FONT,
        background: "radial-gradient(70% 60% at 50% 0%, rgba(232,68,12,.14), transparent 60%), #141414",
      }}
    >
      <div className={cn("grid justify-items-center text-center", phone ? "w-[345px] gap-4" : "w-[680px] gap-5")}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#E8440C]">A sessão começa em</p>
        <div
          className={cn(
            "flex",
            phone ? "gap-2" : "gap-3",
            highlight && "outline outline-2 outline-offset-4 outline-[#E8440C]",
          )}
        >
          {parts.map(([value, label]) => (
            <div
              key={label}
              className={cn(
                "grid place-items-center content-center gap-0.5 rounded-2xl bg-[#1F1F1F] shadow-[0_0_0_1px_#2E2E2E]",
                phone ? "size-[76px]" : "size-[100px]",
              )}
            >
              <b className={cn("font-extrabold tabular-nums", phone ? "text-[28px]" : "text-[40px]")}>
                {String(value).padStart(2, "0")}
              </b>
              <small className="text-[11px] uppercase tracking-[0.16em] text-[#A3A3A3]">{label}</small>
            </div>
          ))}
        </div>
        <h1 className={cn("font-extrabold leading-tight", phone ? "text-[23px]" : "text-[30px]")}>{title}</h1>
        <p className="flex items-center gap-2 text-sm text-[#D4D4D4]">
          <CalendarDays className="size-4" />
          {when}
        </p>
        <span className="inline-flex h-[46px] items-center gap-2 rounded-full bg-[#262626] px-5 text-sm font-semibold shadow-[0_0_0_1px_#2E2E2E]">
          <CalendarDays className="size-4" />
          Adicionar ao calendário
        </span>
      </div>
    </div>
  );
}

export type WhatsAppBubble = { tag: string; text: ReactNode; time: string };

/** O que cada pessoa recebe no WhatsApp, no telemóvel. */
export function WhatsAppPreview({
  hostName,
  bubbles,
  empty,
}: {
  hostName: string;
  bubbles: readonly WhatsAppBubble[];
  empty: string;
}) {
  const initials = hostName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div
      className="flex h-[852px] w-[393px] flex-col bg-[#EFE7DE] text-[#111B21]"
      style={{ fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif' }}
    >
      <div className="shrink-0 border-b border-[#D9D9D9] bg-[#F6F6F6] pt-[54px]">
        <div className="flex items-center gap-2.5 pb-2.5 pl-2 pr-3.5 pt-1">
          <ChevronLeft className="size-6 text-[#007AFF]" />
          <span className="grid size-[38px] shrink-0 place-items-center rounded-full bg-[#E8440C] text-[13px] font-bold text-white">
            {initials || "C"}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[16.5px] font-semibold">{hostName || "A sua conta"}</b>
            <span className="text-[12.5px] text-[#667781]">conta comercial</span>
          </span>
          <Video className="size-5 text-[#007AFF]" />
          <Phone className="ml-3 size-[18px] text-[#007AFF]" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-[7px] overflow-hidden bg-[radial-gradient(rgba(120,100,80,.08)_1.2px,transparent_1.2px)] [background-size:18px_18px] px-3 py-3.5">
        {bubbles.length === 0 ? (
          <p className="m-auto max-w-[290px] rounded-[10px] bg-[#FFF6D8] px-3.5 py-2.5 text-center text-[13.5px] text-[#54656F]">
            {empty}
          </p>
        ) : (
          <>
            <span className="mb-1 self-center rounded-lg bg-white px-2.5 py-1 text-xs text-[#54656F] shadow-[0_1px_.5px_rgba(0,0,0,.13)]">
              Hoje
            </span>
            {bubbles.map((b, i) => (
              <div
                key={i}
                className="relative max-w-[84%] self-start rounded-[4px_18px_18px_18px] bg-white px-2.5 pb-5 pt-[7px] text-[15.5px] leading-[1.36] shadow-[0_1px_.5px_rgba(0,0,0,.13)]"
              >
                <span className="mb-0.5 block text-xs font-semibold text-[#C93A08]">{b.tag}</span>
                {b.text}
                <span className="absolute bottom-1 right-2.5 text-[11px] text-[#667781]">{b.time}</span>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2.5 bg-[#F6F6F6] px-3 pb-9 pt-2 text-[#007AFF]">
        <Plus className="size-6" />
        <div className="h-9 flex-1 rounded-full border border-[#E2E2E2] bg-white" />
        <Camera className="size-6" />
        <Mic className="size-6" />
      </div>
    </div>
  );
}
