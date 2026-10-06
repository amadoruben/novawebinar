import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Camera,
  ChevronLeft,
  Expand,
  Gift,
  Lock,
  Mic,
  Monitor,
  Pause,
  Phone,
  Play,
  Plus,
  Smartphone,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/room-logic";
import { ROOM_FONT } from "@/components/room/entry-screen";

/** A pré-visualização do editor: o aparelho à escala, sem deformar, e o ecrã completo. */

export type Device = "desktop" | "phone";

const DESK = { w: 1280, h: 720 };
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

/** O computador ocupa a largura com respiro dos lados; o telemóvel nunca fica abaixo de 570 px. */
export function deviceScale(device: Device, width: number, height: number, full = false) {
  if (device === "desktop") {
    const side = Math.min(72, Math.max(32, width * 0.06));
    return Math.max(0.1, Math.min((width - 2 * side) / DESK.w, 1));
  }
  const target = Math.max(570, Math.min(height, full ? 790 : 790));
  return Math.max(0.1, Math.min(width / PHONE.w, target / PHONE.h));
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

export function BrowserFrame({
  url,
  k,
  highlightUrl,
  children,
}: {
  url: string;
  k: number;
  highlightUrl?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-[0_8px_24px_rgba(0,0,0,.08)]">
      <div className="flex h-[26px] items-center gap-1.5 border-b px-3">
        {[0, 1, 2].map((i) => (
          <i key={i} className="size-2 shrink-0 rounded-full bg-[#E5E5E5]" />
        ))}
        <span
          className={cn(
            "mx-2 flex h-[18px] min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full bg-gray-100 px-2.5 text-[11px] text-muted-foreground",
            highlightUrl && "outline outline-2 outline-[#E8440C]",
          )}
        >
          <Lock className="size-2.5 shrink-0" />
          <span className="truncate">{url}</span>
        </span>
      </div>
      <Scaled k={k} w={DESK.w} h={DESK.h}>
        {children}
      </Scaled>
    </div>
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

export function PhoneFrame({ k, light, children }: { k: number; light?: boolean | undefined; children: ReactNode }) {
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

/** O aparelho certo, à escala do espaço disponível. */
export function DeviceStage({
  device,
  url,
  highlightUrl,
  light,
  full,
  children,
}: {
  device: Device;
  url: string;
  highlightUrl?: boolean | undefined;
  light?: boolean | undefined;
  full?: boolean | undefined;
  children: ReactNode;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const k = deviceScale(device, size.w, size.h, full);
  return (
    <div ref={ref} className={cn("flex w-full min-w-0 justify-center", full ? "min-h-[calc(100dvh-56px)] items-start py-6" : "min-h-full items-center")}>
      {size.w > 0 ? (
        device === "desktop" ? (
          <div style={{ width: DESK.w * k }}>
            <BrowserFrame url={url} k={k} highlightUrl={highlightUrl}>
              {children}
            </BrowserFrame>
          </div>
        ) : (
          <PhoneFrame k={k} light={light}>
            {children}
          </PhoneFrame>
        )
      ) : null}
    </div>
  );
}

export function DeviceToggle({ device, onChange }: { device: Device; onChange: (device: Device) => void }) {
  const option = (value: Device, label: string, Icon: typeof Monitor) => (
    <button
      type="button"
      aria-pressed={device === value}
      onClick={() => onChange(value)}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition",
        device === value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-[var(--ds-gray-alpha-200)] hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
  return (
    <div className="inline-flex shrink-0 gap-0.5 rounded-[10px] border bg-white p-[3px] shadow-[0_1px_2px_rgba(0,0,0,.05)]">
      {option("desktop", "Computador", Monitor)}
      {option("phone", "Telemóvel", Smartphone)}
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

/** O ecrã completo: a página ao tamanho real, sobre fundo escuro, com o leitor pequeno. */
export function FullScreen({
  name,
  device,
  onDevice,
  onClose,
  room,
  children,
}: {
  name: string;
  device: Device;
  onDevice: (device: Device) => void;
  onClose: () => void;
  room?: { t: number; duration: number; playing: boolean; onToggle: () => void; pitch: number | null } | undefined;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0A0A0A] text-[#EDEDED]" role="dialog" aria-label={name}>
      <div className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <b className="truncate text-sm">{name}</b>
          {room ? (
            <>
              <button
                type="button"
                onClick={room.onToggle}
                aria-label={room.playing ? "Pausar" : "Tocar"}
                className="grid size-8 place-items-center rounded-full bg-white text-black"
              >
                {room.playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
              </button>
              <span className="font-mono text-[13px] tabular-nums">
                {clock(room.t)} <span className="text-[#8F8F8F]">/ {clock(room.duration)}</span>
              </span>
              {room.pitch !== null ? (
                <span className="hidden items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-xs sm:inline-flex">
                  <Gift className="size-3.5" />
                  Oferta aos {clock(room.pitch)}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        <div>{device === "phone" ? <DarkToggle device={device} onChange={onDevice} /> : null}</div>
        <div className="flex items-center justify-end gap-2">
          {device === "desktop" ? <DarkToggle device={device} onChange={onDevice} /> : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-3 text-[13px] font-medium hover:bg-white/15"
          >
            <X className="size-4" />
            Fechar
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">{children}</div>
    </div>
  );
}

function DarkToggle({ device, onChange }: { device: Device; onChange: (device: Device) => void }) {
  const option = (value: Device, label: string, Icon: typeof Monitor) => (
    <button
      type="button"
      aria-pressed={device === value}
      onClick={() => onChange(value)}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium",
        device === value ? "bg-[#EDEDED] text-[#0A0A0A]" : "text-[#A1A1A1] hover:text-[#EDEDED]",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
  return (
    <div className="inline-flex gap-0.5 rounded-[10px] bg-[#1F1F1F] p-[3px]">
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
