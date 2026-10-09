import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronsLeft,
  ChevronsUpDown,
  Expand,
  Flag,
  Gift,
  Hourglass,
  LogIn,
  Lock,
  Mic,
  Minus,
  Monitor,
  Pause,
  Phone,
  Play,
  Plus,
  Radio,
  RotateCcw,
  RotateCw,
  Smartphone,
  Tablet,
  Video,
  X,
  ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/room-logic";
import { ROOM_FONT } from "@/components/room/entry-screen";

/** A pré-visualização do editor: o aparelho à escala, sem deformar, e o ecrã completo. */

export type Device = "desktop" | "tablet" | "phone";

/** O portátil inteiro ao tamanho real: ecrã 1280×720 com a barra do navegador, moldura e base. */
const LAPTOP = { w: 1452, h: 832 };
const PHONE = { w: 425, h: 878 };
/** O tablet ao alto (ecrã 820×1180, como o iPad Air) com a moldura. */
const TABLET = { w: 860, h: 1220 };
/** O ecrã por dentro da moldura e a altura da barra de estado, no telemóvel e no tablet. */
export const SCREENS = { phone: { w: 393, h: 852, top: 54 }, tablet: { w: 820, h: 1180, top: 32 } } as const;
/** O tablet deitado (1180×820). */
export const TABLET_WIDE = { w: 1180, h: 820, top: 32 } as const;

function frameSize(device: Device, landscape: boolean) {
  const frame = device === "desktop" ? LAPTOP : device === "tablet" ? TABLET : PHONE;
  return landscape && device !== "desktop" ? { w: frame.h, h: frame.w } : frame;
}

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
 * passar do tamanho real. O telemóvel usa a altura toda, para se ver bem.
 */
export function deviceScale(device: Device, width: number, height: number, landscape = false) {
  const pad = 16;
  const { w, h } = frameSize(device, landscape);
  const fit = Math.min((width - 2 * pad) / w, (height - 2 * pad) / h);
  return Math.max(0.1, Math.min(fit, 1));
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

/** O tablet ao alto ou deitado: moldura fina, a câmara e uma barra de estado pequena. */
export function TabletFrame({
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
  const [w, h] = landscape ? [TABLET.h, TABLET.w] : [TABLET.w, TABLET.h];
  return (
    <Scaled k={k} w={w} h={h}>
      <div
        className="relative rounded-[52px] bg-[#0A0A0B] p-5 shadow-[0_0_0_2px_#D9D5CD,0_0_0_3.5px_#A7A298,0_40px_70px_-20px_rgba(0,0,0,.45)]"
        style={{ width: w, height: h }}
      >
        <i
          className={cn(
            "absolute size-[7px] rounded-full bg-[#1D1D22] ring-1 ring-[#2B2B31]",
            landscape ? "left-[7px] top-1/2 -translate-y-1/2" : "left-1/2 top-[7px] -translate-x-1/2",
          )}
        />
        <div className="relative overflow-hidden rounded-[32px] bg-black" style={{ width: w - 40, height: h - 40 }}>
          <div
            className={cn("absolute inset-x-0 top-0 z-[8] flex h-8 items-center justify-between px-6 text-[14px] font-semibold", light ? "text-black" : "text-white")}
            style={{ fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif' }}
          >
            <span>9:41</span>
            <span className="flex items-center gap-1.5">
              <svg width="24" height="11" viewBox="0 0 26 12" fill="none" aria-hidden>
                <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" stroke="currentColor" opacity=".4" />
                <rect x="2" y="2" width="19" height="8" rx="2" fill="currentColor" />
              </svg>
            </span>
          </div>
          {children}
        </div>
      </div>
    </Scaled>
  );
}

/** O que fica por baixo do aparelho: o leitor e os ecrãs. */
export type Dock = { play?: ReactNode; tabs?: ReactNode };

/**
 * O aparelho certo, inteiro e centrado no espaço disponível. Por baixo, a barra do leitor e dos
 * ecrãs, alinhada com o aparelho, que se esconde e volta pela pega (como uma folha): escondida, o
 * aparelho ganha esse espaço.
 */
export function DeviceStage({
  device,
  landscape,
  url,
  highlightUrl,
  light,
  dock,
  dark,
  zoom,
  children,
}: {
  device: Device;
  landscape?: boolean | undefined;
  url: string;
  highlightUrl?: boolean | undefined;
  light?: boolean | undefined;
  dock?: Dock | undefined;
  /** No ecrã completo (fundo escuro). */
  dark?: boolean | undefined;
  /** Zoom em relação ao tamanho real (1 = 100%); sem zoom, o aparelho cabe inteiro no espaço. */
  zoom?: number | null | undefined;
  children: ReactNode;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const [open, setOpen] = useState(true);
  const has = Boolean(dock && (dock.play || dock.tabs));
  // A barra mede-se: com o leitor aberto pode passar a duas linhas, e o aparelho encolhe para caber.
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowH, setRowH] = useState(44);
  const shown = has && size.w > 0;
  useLayoutEffect(() => {
    const node = rowRef.current;
    if (!node) return;
    const read = () => setRowH(node.offsetHeight);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);
  const fit = deviceScale(device, size.w, size.h - (has ? (open ? rowH + 22 : 20) : 0), landscape);
  const k = zoom ?? fit;
  const frameW = frameSize(device, Boolean(landscape)).w * k;
  // Com zoom, o aparelho fica maior do que o espaço e desliza-se, com a barra à direita (como no ManyChat).
  return (
    <div ref={ref} className={cn("size-full min-h-0 min-w-0", zoom ? "scrollbar-thin overflow-auto" : "overflow-hidden")}>
    <div className={cn("flex min-h-full min-w-full flex-col items-center", zoom ? "w-max px-4 py-4" : "h-full justify-center")}>
      {size.w > 0 && size.h > 0 ? (
        device === "desktop" ? (
          <LaptopFrame k={k} url={url} highlightUrl={highlightUrl}>
            {children}
          </LaptopFrame>
        ) : device === "tablet" ? (
          <TabletFrame k={k} light={light} landscape={landscape}>
            {children}
          </TabletFrame>
        ) : (
          <PhoneFrame k={k} light={light} landscape={landscape}>
            {children}
          </PhoneFrame>
        )
      ) : null}
      {shown ? (
        <div className="flex shrink-0 flex-col items-center" style={{ width: zoom ? Math.max(frameW, 560) : Math.min(Math.max(frameW, 560), size.w - 16) }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Esconder o leitor e os ecrãs" : "Mostrar o leitor e os ecrãs"}
            title={open ? "Esconder" : "Mostrar o leitor e os ecrãs"}
            className="group grid h-5 w-16 place-items-center"
          >
            <span className={cn("block h-1 w-9 rounded-full transition", dark ? "bg-white/20 group-hover:bg-white/40" : "bg-black/15 group-hover:bg-black/30")} />
          </button>
          <div className={cn("grid w-full transition-[grid-template-rows,opacity] duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
            <div className="min-h-0 overflow-hidden">
              <div
                ref={rowRef}
                className="flex flex-wrap items-center justify-center gap-2 pb-0.5 pt-1"
              >
                {dock?.play}
                {dock?.tabs}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </div>
  );
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/**
 * O zoom do aparelho: o primeiro clique liga-o (100%, o tamanho real); depois «−» e «+» reduzem e
 * aumentam, e «Ajustar» volta ao aparelho inteiro no espaço.
 */
export function ZoomControl({ zoom, onZoom, dark }: { zoom: number | null; onZoom: (zoom: number | null) => void; dark?: boolean | undefined }) {
  const btn = cn("grid h-7 min-w-7 place-items-center rounded-[7px] px-1.5 transition disabled:opacity-40", segItem(false, dark));
  if (zoom === null) {
    return (
      <button
        type="button"
        onClick={() => onZoom(1)}
        title="Zoom: ver o aparelho ao tamanho real e deslizar"
        className={cn("inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 text-[12px] font-medium", dark ? SEG_BOX.dark : SEG_BOX.light, segItem(false, dark))}
      >
        <ZoomIn className="size-3.5" />
        {/* No telemóvel, só a lupa: o nome do ecrã precisa do espaço. */}
        <span className="sr-only sm:not-sr-only">Zoom</span>
      </button>
    );
  }
  const i = ZOOMS.findIndex((z) => z >= zoom);
  return (
    <div className={cn("inline-flex h-[34px] shrink-0 items-center gap-0.5 rounded-[10px] p-[3px] text-[12px] font-medium", dark ? SEG_BOX.dark : SEG_BOX.light)} role="group" aria-label="Zoom">
      <button type="button" className={btn} onClick={() => onZoom(ZOOMS[Math.max(0, i - 1)]!)} disabled={i <= 0} aria-label="Reduzir">
        <Minus className="size-3.5" />
      </button>
      <span className={cn("grid h-7 min-w-[46px] place-items-center rounded-[7px] font-mono tabular-nums", segItem(true, dark))}>{Math.round(zoom * 100)}%</span>
      <button type="button" className={btn} onClick={() => onZoom(ZOOMS[Math.min(ZOOMS.length - 1, i + 1)]!)} disabled={i >= ZOOMS.length - 1} aria-label="Aumentar">
        <Plus className="size-3.5" />
      </button>
      <button type="button" className={cn(btn, "px-2")} onClick={() => onZoom(null)} title="O aparelho inteiro no espaço">
        Ajustar
      </button>
    </div>
  );
}

/** Rodar o telemóvel ou o tablet: ao alto ou deitado. */
export function RotateButton({ landscape, onChange }: { landscape: boolean; onChange: (landscape: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!landscape)}
      title={landscape ? "Pôr ao alto" : "Deitar o ecrã"}
      aria-label={landscape ? "Pôr o ecrã ao alto" : "Deitar o ecrã"}
      aria-pressed={landscape}
      className="grid size-[34px] shrink-0 place-items-center rounded-lg border bg-white transition hover:bg-gray-100"
    >
      <RotateCw className="size-[15px]" />
    </button>
  );
}

/** As cores da barra de baixo e da escolha do aparelho: fundo cinza e a opção escolhida em branco (ou cinza, no escuro). */
const SEG_BOX = { light: "bg-[#EDEDED]", dark: "bg-[#1F1F1F]" };
const segItem = (on: boolean, dark?: boolean) =>
  on
    ? dark
      ? "bg-[#3A3A3A] text-white"
      : "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,.12)]"
    : dark
      ? "text-[#A1A1A1] hover:text-white"
      : "text-[#666] hover:bg-black/[0.05] hover:text-foreground";

const DEVICES: readonly [Device, string, typeof Monitor][] = [
  ["desktop", "Computador", Monitor],
  ["tablet", "Tablet", Tablet],
  ["phone", "Telemóvel", Smartphone],
];

/**
 * Ver o mesmo ecrã em cada aparelho: só muda a pré-visualização, não é uma configuração. Daí o
 * rótulo «Ver em» à frente e o «pré-visualização» ao lado do nome do ecrã.
 */
export function DeviceToggle({ device, onChange, dark }: { device: Device; onChange: (device: Device) => void; dark?: boolean | undefined }) {
  const id = useId();
  return (
    <div className="inline-flex shrink-0 items-center gap-1.5">
      <span id={id} className={cn("text-[11.5px] font-medium", dark ? "text-[#A1A1A1]" : "text-muted-foreground")}>
        Ver em
      </span>
      <div role="radiogroup" aria-labelledby={id} className={cn("inline-flex gap-0.5 rounded-[10px] p-[3px]", dark ? SEG_BOX.dark : SEG_BOX.light)}>
        {DEVICES.map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={device === value}
            aria-label={label}
            title={`Ver no ${label.toLowerCase()}`}
            onClick={() => onChange(value)}
            className={cn("inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-[7px] px-2 text-[11.5px] font-medium transition", segItem(device === value, dark))}
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
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
        "inline-flex h-9 max-w-full items-center gap-0.5 overflow-x-auto rounded-[10px] p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        dark ? SEG_BOX.dark : SEG_BOX.light,
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.active}
          onClick={t.onClick}
          className={cn("h-[30px] shrink-0 whitespace-nowrap rounded-[7px] px-3 text-[12.5px] font-medium transition", segItem(t.active, dark))}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** As fases da sala, pela ordem em que a pessoa as vive. */
export type Phase = "inscricao" | "espera" | "aovivo" | "fim";
/** O nome de cada fase: na barra e no título do ecrã inteiro. */
export const PHASE_NAME: Record<Phase, string> = { inscricao: "Inscrição", espera: "Espera", aovivo: "Ao vivo", fim: "Fim" };
const PHASES: readonly [Phase, typeof Monitor][] = [
  ["inscricao", LogIn],
  ["espera", Hourglass],
  ["aovivo", Radio],
  ["fim", Flag],
];

/** A fase que o ecrã mostra: a página, a espera, a sala ou a sala no fim do vídeo. O WhatsApp não é uma fase. */
export function phaseOf(screen: string, t: number, duration: number): Phase | null {
  if (screen === "entry") return "inscricao";
  if (screen === "waiting") return "espera";
  if (screen !== "room") return null;
  return duration > 0 && t >= duration - 0.5 ? "fim" : "aovivo";
}

/**
 * A pré-visualização por fases: Inscrição, Espera, Ao vivo e Fim. Cada uma mostra o ecrã que a pessoa
 * vê nesse momento; `off` desliga uma fase que este webinar não tem, com o porquê (ao tocar, num aviso:
 * o `title` não aparece no telemóvel nem no tablet).
 */
export function PhaseBar({
  phase,
  onPick,
  off,
  dark,
}: {
  phase: Phase | null;
  onPick: (phase: Phase) => void;
  off?: Partial<Record<Phase, string>> | undefined;
  dark?: boolean | undefined;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Fase da sala"
      className={cn(
        "inline-flex h-9 max-w-full shrink-0 items-center gap-0.5 overflow-x-auto rounded-[10px] p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        dark ? SEG_BOX.dark : SEG_BOX.light,
      )}
    >
      {PHASES.map(([value, Icon]) => {
        const label = PHASE_NAME[value];
        const why = off?.[value];
        return (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={phase === value}
          aria-disabled={why ? true : undefined}
          title={why ?? `Ver: ${label}`}
          onClick={() => (why ? toast(why) : onPick(value))}
          className={cn(
            "inline-flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2.5 text-[12.5px] font-medium transition aria-disabled:cursor-not-allowed aria-disabled:opacity-40",
            segItem(phase === value, dark),
          )}
        >
          <Icon className={cn("hidden size-3.5 sm:block", value === "aovivo" && phase === value && "text-[#E5243B]")} />
          {label}
        </button>
        );
      })}
    </div>
  );
}

/** Quanto recuar e avançar de cada vez. */
const JUMPS = [10, 60, 120, 300] as const;
const jumpLabel = (s: number) => (s < 60 ? `${s} s` : `${s / 60} min`);

export type PlayMark = { at: number; label: string; tone: "offer" | "follow" };

/**
 * O leitor da sala, por baixo do aparelho (ideia dos leitores da ElevenLabs, sem os instalar).
 * Fechado é o play e o minuto. Ao tocar no play abre: recuar e avançar (10 s, 1, 2 ou 5 min, à
 * escolha), a barra com as ofertas e o + Seguir marcados, e o tempo. A seta volta a fechá-lo.
 */
export function PlayChip({
  t,
  duration,
  playing,
  onToggle,
  onSeek,
  marks = [],
  dark,
}: {
  t: number;
  duration: number;
  playing: boolean;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  marks?: readonly PlayMark[] | undefined;
  dark?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [jump, setJump] = useState<(typeof JUMPS)[number]>(10);
  const [hover, setHover] = useState<number | null>(null);
  const d = Math.max(1, duration);
  const go = (delta: number) => onSeek(Math.max(0, Math.min(duration, t + delta)));
  const icon = cn(
    "inline-flex h-[30px] shrink-0 items-center gap-1 rounded-[7px] px-2 font-mono text-[11.5px] font-semibold tabular-nums transition",
    dark ? "text-[#D4D4D4] hover:bg-white/10" : "text-[#444] hover:bg-black/[0.06]",
  );
  const playButton = (
    <button
      type="button"
      onClick={() => {
        onToggle();
        setOpen(true);
      }}
      aria-label={playing ? "Pausar" : "Tocar"}
      className={cn(
        "grid size-[30px] shrink-0 place-items-center rounded-full transition",
        dark ? "bg-white text-[#0A0A0A]" : "bg-white text-foreground shadow-[0_1px_3px_rgba(0,0,0,.18)] hover:shadow-[0_2px_6px_rgba(0,0,0,.2)]",
      )}
    >
      {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="ml-px size-3.5 fill-current" />}
    </button>
  );
  const time = (
    <span className="shrink-0 px-1.5 font-mono text-[12.5px] tabular-nums">
      <b className="font-semibold">{clock(t)}</b>
      <span className={dark ? "text-[#8F8F8F]" : "text-muted-foreground"}> / {clock(duration)}</span>
    </span>
  );
  // Fechado: o play e o minuto, compacto.
  if (!open) {
    return (
      <span className={cn("inline-flex h-9 shrink-0 items-center gap-0.5 rounded-[10px] p-[3px] pr-1.5", dark ? SEG_BOX.dark : SEG_BOX.light)}>
        {playButton}
        <button type="button" onClick={() => setOpen(true)} aria-label="Abrir o leitor" className="rounded-lg py-1.5 transition hover:bg-black/[0.04]">
          {time}
        </button>
      </span>
    );
  }
  // Aberto: ocupa a linha. Num sítio estreito (telemóvel), a barra sobe para cima e os botões ficam por baixo.
  return (
    <div className="@container min-w-[min(100%,300px)] max-w-[640px] flex-1">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-x-0.5 gap-y-1 rounded-[10px] p-[3px] @max-[440px]:px-2 @max-[440px]:pt-2",
          dark ? SEG_BOX.dark : SEG_BOX.light,
        )}
      >
        <button type="button" onClick={() => go(-jump)} aria-label={`Recuar ${jumpLabel(jump)}`} title={`Recuar ${jumpLabel(jump)}`} className={icon}>
          <RotateCcw className="size-3.5" />
          {jumpLabel(jump)}
        </button>
        {playButton}
        <button type="button" onClick={() => go(jump)} aria-label={`Avançar ${jumpLabel(jump)}`} title={`Avançar ${jumpLabel(jump)}`} className={icon}>
          {jumpLabel(jump)}
          <RotateCw className="size-3.5" />
        </button>
        <SliderPrimitive.Root
          value={[Math.min(t, duration)]}
          max={d}
          step={1}
          onValueChange={([v]) => onSeek(v ?? 0)}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            setHover(Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) * d);
          }}
          onPointerLeave={() => setHover(null)}
          aria-label="Minuto do vídeo"
          className="group relative mx-2 flex h-[30px] min-w-[90px] flex-1 touch-none select-none items-center @max-[440px]:order-first @max-[440px]:mx-1 @max-[440px]:basis-full"
        >
          <SliderPrimitive.Track className={cn("relative h-1 grow overflow-hidden rounded-full", dark ? "bg-white/15" : "bg-black/10")}>
            <SliderPrimitive.Range className={cn("absolute h-full", dark ? "bg-white" : "bg-foreground")} />
          </SliderPrimitive.Track>
          {marks.map((m, i) => (
            <span
              key={`${m.tone}-${m.at}-${i}`}
              title={`${m.label} · ${clock(m.at)}`}
              className={cn(
                "pointer-events-none absolute top-1/2 h-2.5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full",
                m.tone === "offer" ? "bg-[#E8440C]" : "bg-[#0072F5]",
              )}
              style={{ left: `${(Math.min(m.at, d) / d) * 100}%` }}
            />
          ))}
          <SliderPrimitive.Thumb
            className={cn(
              "block size-3.5 rounded-full shadow-[0_1px_3px_rgba(0,0,0,.3)] transition-transform focus-visible:outline-none group-hover:scale-110",
              dark ? "bg-white" : "bg-foreground",
            )}
          />
          {hover !== null ? (
            <span
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 font-mono text-[11px] text-background"
              style={{ left: `${(hover / d) * 100}%` }}
            >
              {clock(hover)}
            </span>
          ) : null}
        </SliderPrimitive.Root>
        <span className="@max-[440px]:mr-auto">{time}</span>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Quanto recuar e avançar" title="Quanto recuar e avançar" className={cn(icon, "px-1.5")}>
              <ChevronsUpDown className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-[170px] p-1">
            <p className="px-2 pb-1 pt-1.5 text-[11.5px] font-medium text-muted-foreground">Recuar e avançar</p>
            {JUMPS.map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setJump(j)}
                className={cn("flex h-8 w-full items-center justify-between rounded-md px-2 text-[13px] hover:bg-chip", j === jump && "font-semibold")}
              >
                {jumpLabel(j)}
                {j === jump ? <Check className="size-3.5" /> : null}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fechar o leitor" title="Fechar" className={cn(icon, "px-1.5")}>
          <ChevronsLeft className="size-4" />
        </button>
      </div>
    </div>
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
  tools,
  phases,
  children,
}: {
  name: string;
  device: Device;
  onDevice: (device: Device) => void;
  onClose: () => void;
  /** À esquerda da escolha do aparelho (o zoom). */
  tools?: ReactNode;
  /** As fases da sala, numa linha por baixo. */
  phases?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0A0A0A] text-[#EDEDED]" role="dialog" aria-label={name}>
      <div className="flex h-14 shrink-0 items-center gap-2 px-4 sm:gap-3">
        {/* Por baixo do nome, para não se confundir a escolha do aparelho com uma configuração. */}
        <span className="grid min-w-0 flex-1 leading-tight">
          <b className="truncate text-sm">{name}</b>
          <small className="truncate text-[11px] text-[#A1A1A1]">Pré-visualização</small>
        </span>
        {tools}
        <DeviceToggle dark device={device} onChange={onDevice} />
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
      {phases ? <div className="flex shrink-0 justify-center px-4 pb-2">{phases}</div> : null}
      <div className="min-h-0 flex-1 px-2 pb-3 sm:px-4">{children}</div>
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
  const phone = device !== "desktop";
  const screen = device === "tablet" ? SCREENS.tablet : SCREENS.phone;
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
        phone ? "content-start pt-[200px]" : "h-[720px] w-[1280px]",
      )}
      style={{
        ...(phone ? { width: screen.w, height: screen.h } : null),
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
