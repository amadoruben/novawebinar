import { useMemo, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  ArrowUpRight,
  Bot,
  ChevronDown,
  ChevronUp,
  Film,
  Flag,
  Gift,
  MessagesSquare,
  Mic,
  Pause,
  Play,
  ShoppingBag,
  Users,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clock, curveValueAt, offerCountdownLeft } from "@/lib/room-logic";
import type { EditorStep } from "@/lib/webinar-draft";

/** A linha do vídeo: o que acontece na sala em cada segundo, faixa a faixa, e o que cada uma faz. */

export type LaneKey = "video" | "fala" | "chat" | "audiencia" | "oferta" | "vendas" | "agente";
export type RiskZone = { from: number; to: number; kind: string; risk: "alto" | "moderado" | "baixo" };

type LaneDef = { key: LaneKey; label: string; icon: LucideIcon; color: string; step: EditorStep; about: string };

const LANES: LaneDef[] = [
  { key: "video", label: "Vídeo", icon: Film, color: "#52525B", step: "video", about: "O vídeo da sessão. Os traços brancos marcam os momentos da análise." },
  { key: "fala", label: "Fala", icon: Mic, color: "#8E4EC6", step: "video", about: "O que o apresentador diz, frase a frase. Tudo o resto acerta o tempo pela fala." },
  { key: "chat", label: "Chat", icon: MessagesSquare, color: "#0072F5", step: "chat", about: "Os comentários simulados. Cada traço é um comentário." },
  { key: "audiencia", label: "Audiência", icon: Users, color: "#12A594", step: "audiencia", about: "Quantas pessoas a sala mostra em cada minuto." },
  { key: "oferta", label: "Oferta", icon: Gift, color: "#E8440C", step: "oferta", about: "Quando a oferta abre na sala e quanto tempo fica aberta." },
  { key: "vendas", label: "Vendas", icon: ShoppingBag, color: "#30A46C", step: "vendas", about: "As compras que aparecem na sala. Cada ponto é uma compra." },
  { key: "agente", label: "Agente", icon: Bot, color: "#171717", step: "agente", about: "Os momentos em que se pode perder audiência, segundo a análise do vídeo." },
];

export const DEFAULT_LANE: Partial<Record<EditorStep, LaneKey>> = {
  video: "fala",
  chat: "chat",
  audiencia: "audiencia",
  oferta: "oferta",
  vendas: "vendas",
};

export type TimelineData = {
  speech: readonly { at: number; text: string }[];
  comments: readonly { at: number; author: string; message: string }[];
  audience: { curve: readonly number[] | null; label: string };
  offer: { visible: boolean; start: number | null; countdown: number; suggested: number | null };
  sales: readonly { at: number; buyer: string; product: string }[];
  risks: readonly RiskZone[];
};

export function TimelineDock({
  t,
  duration,
  playing,
  onToggle,
  onSeek,
  muted,
  onMute,
  open,
  onOpenChange,
  lane,
  onLane,
  data,
  step,
  onPitchHere,
  onOpenStep,
}: {
  t: number;
  duration: number;
  playing: boolean;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  muted: boolean;
  onMute: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lane: LaneKey;
  onLane: (lane: LaneKey) => void;
  data: TimelineData;
  step: EditorStep;
  onPitchHere?: (() => void) | undefined;
  onOpenStep: (step: EditorStep) => void;
}) {
  const sentence = [...data.speech].reverse().find((s) => s.at <= t);
  const d = Math.max(1, duration);
  const f = Math.min(1, Math.max(0, t / d));

  return (
    <div className="mx-4 mb-3 shrink-0 rounded-[10px] border bg-white">
      <div className="flex h-11 min-w-0 items-center gap-2.5 pl-2 pr-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? "Pausar" : "Tocar"}
          className="grid size-[30px] shrink-0 place-items-center rounded-full bg-foreground text-background"
        >
          {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
        </button>
        <span className="shrink-0 whitespace-nowrap font-mono text-[13px] font-semibold tabular-nums">
          {clock(t)} <span className="font-medium text-muted-foreground">/ {clock(duration)}</span>
        </span>
        <button
          type="button"
          onClick={onMute}
          aria-label={muted ? "Ligar o som" : "Tirar o som"}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-[var(--ds-gray-alpha-200)] hover:text-foreground"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <span className="hidden min-w-0 flex-1 items-center gap-2 text-[13px] text-muted-foreground md:flex">
          <Mic className="size-3.5 shrink-0" />
          <q className="truncate italic [quotes:'«''»']">{sentence ? sentence.text : "Ainda sem fala"}</q>
        </span>
        <span className="flex-1 md:hidden" />
        <button
          type="button"
          onClick={() => onSeek(Math.max(0, t - 10))}
          aria-label="Recuar 10 segundos"
          className="h-7 shrink-0 rounded-md border px-2 text-xs font-medium hover:bg-gray-100"
        >
          −10
        </button>
        <button
          type="button"
          onClick={() => onSeek(Math.min(duration, t + 10))}
          aria-label="Avançar 10 segundos"
          className="h-7 shrink-0 rounded-md border px-2 text-xs font-medium hover:bg-gray-100"
        >
          +10
        </button>
        {onPitchHere ? (
          <button
            type="button"
            onClick={onPitchHere}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-[#E8440C] px-2.5 text-xs font-medium text-white hover:bg-[#C93A08]"
          >
            <Flag className="size-3.5" />
            Pitch aqui
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-label={open ? "Recolher a linha do vídeo" : "Abrir a linha do vídeo"}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-[var(--ds-gray-alpha-200)] hover:text-foreground"
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
      </div>

      {open ? (
        <div className="grid gap-3 border-t px-3 pb-3 pt-2 xl:grid-cols-[minmax(0,1fr)_264px]">
          <div className="relative grid min-w-0 gap-1 [--lc:30px] md:[--lc:140px]">
            <div className="grid grid-cols-[30px_minmax(0,1fr)] items-end gap-2.5 md:grid-cols-[140px_minmax(0,1fr)]">
              <span className="hidden text-[11px] text-muted-foreground md:block">Clique numa faixa</span>
              <span className="md:hidden" />
              <Ruler duration={d} />
            </div>
            {LANES.map((def) => (
              <LaneRow key={def.key} def={def} selected={lane === def.key} onLane={onLane} sub={laneSub(def.key, data)}>
                <Track duration={d} onSeek={(s) => {
                  onLane(def.key);
                  onSeek(s);
                }} dark={def.key === "video"}>
                  <LaneContent lane={def.key} data={data} t={t} d={d} color={def.color} />
                </Track>
              </LaneRow>
            ))}
            {/* A agulha atravessa as faixas, no segundo actual. */}
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 top-[18px] w-0.5 -translate-x-1/2 bg-foreground"
              style={{ left: `calc(var(--lc) + 10px + (100% - var(--lc) - 10px) * ${f})` }}
            >
              <i className="absolute -top-[18px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[5px] bg-foreground px-1.5 py-px font-mono text-[10.5px] font-bold not-italic text-background">
                {clock(t)}
              </i>
            </div>
          </div>
          <Inspector lane={lane} data={data} t={t} d={d} step={step} onOpenStep={onOpenStep} />
        </div>
      ) : null}
    </div>
  );
}

function Ruler({ duration }: { duration: number }) {
  const step = duration > 1800 ? 600 : duration > 600 ? 300 : 60;
  const marks: number[] = [];
  // A última marca não encosta ao fim, onde já está a duração.
  for (let s = 0; s < duration - step * 0.4; s += step) marks.push(s);
  return (
    <div className="relative h-[18px] border-b">
      {marks.map((s) => (
        <span
          key={s}
          className="absolute bottom-[3px] -translate-x-1/2 font-mono text-[10.5px] text-muted-foreground first:translate-x-0"
          style={{ left: `${(s / duration) * 100}%` }}
        >
          {clock(s)}
        </span>
      ))}
      <span className="absolute bottom-[3px] right-0 font-mono text-[10.5px] text-muted-foreground">{clock(duration)}</span>
    </div>
  );
}

function LaneRow({
  def,
  selected,
  onLane,
  sub,
  children,
}: {
  def: LaneDef;
  selected: boolean;
  onLane: (lane: LaneKey) => void;
  sub: string;
  children: ReactNode;
}) {
  const Icon = def.icon;
  return (
    <div className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-2.5 [--lc:30px] md:grid-cols-[140px_minmax(0,1fr)] md:[--lc:140px]">
      <button
        type="button"
        onClick={() => onLane(def.key)}
        aria-pressed={selected}
        className="flex min-w-0 items-center gap-2 rounded-md p-0.5 text-left"
        style={selected ? { background: `${def.color}1A` } : undefined}
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-md text-white" style={{ background: def.color }}>
          <Icon className="size-3.5" />
        </span>
        <span className="hidden min-w-0 md:block">
          <b className="block truncate text-xs font-semibold leading-tight">{def.label}</b>
          <span className="block truncate text-[10.5px] leading-tight text-muted-foreground">{sub}</span>
        </span>
      </button>
      <div
        className="rounded-lg"
        style={selected ? { boxShadow: `0 0 0 1.5px ${def.color}`, background: `${def.color}0F` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

/** Uma faixa: clicar ou arrastar leva o vídeo a esse segundo. */
function Track({ duration, onSeek, dark, children }: { duration: number; onSeek: (s: number) => void; dark?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const seekAt = (event: ReactPointerEvent) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    onSeek(Math.round(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * duration));
  };
  return (
    <div
      ref={ref}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekAt(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons) seekAt(event);
      }}
      className={cn("relative cursor-pointer overflow-hidden rounded-lg", dark ? "h-[30px] bg-[#1b1d22]" : "h-[26px] bg-gray-100")}
    >
      {children}
    </div>
  );
}

const pct = (s: number, d: number) => `${(Math.min(d, Math.max(0, s)) / d) * 100}%`;

function LaneContent({ lane, data, t, d, color }: { lane: LaneKey; data: TimelineData; t: number; d: number; color: string }) {
  const empty = (text: string) => (
    <span className="absolute inset-0 flex items-center overflow-hidden whitespace-nowrap px-2.5 text-[11.5px] text-muted-foreground">{text}</span>
  );
  switch (lane) {
    case "video":
      return (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#26282e,#1b1d22_30%,#2a2420_70%,#1b1d22)]" />
          {data.risks.map((z) => (
            <span key={z.from} className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: pct(z.from, d) }} title={`${clock(z.from)} · ${z.kind}`} />
          ))}
        </>
      );
    case "fala": {
      if (data.speech.length === 0) return empty("Sem transcrição");
      const current = [...data.speech].reverse().find((s) => s.at <= t);
      return (
        <>
          {data.speech.map((s, i) => {
            const end = data.speech[i + 1]?.at ?? d;
            return (
              <span
                key={s.at}
                className="absolute inset-y-[6px] rounded-[3px]"
                style={{
                  left: pct(s.at, d),
                  width: `calc(${pct(end - s.at, d)} - 1px)`,
                  background: color,
                  opacity: s === current ? 1 : 0.3,
                }}
              />
            );
          })}
        </>
      );
    }
    case "chat":
      if (data.comments.length === 0) return empty("Sem comentários");
      return (
        <>
          {data.comments.map((c, i) => (
            <span key={i} className="absolute inset-y-[6px] w-0.5 rounded-sm" style={{ left: pct(c.at, d), background: color, opacity: 0.65 }} />
          ))}
        </>
      );
    case "audiencia": {
      const curve = data.audience.curve;
      if (!curve || curve.length < 2) return empty(data.audience.label);
      return <AreaCurve curve={curve} d={d} color={color} />;
    }
    case "oferta": {
      if (!data.offer.visible) return empty("Desligada");
      if (data.offer.start === null) {
        return (
          <>
            <span className="absolute inset-y-[3px] left-0 right-0 flex items-center overflow-hidden whitespace-nowrap rounded border-l-[3px] border-[#A86400] bg-[#FBEBCF] px-2 text-[11px] font-semibold text-[#6B4300]">
              Sem minuto: abre no início
            </span>
            {data.offer.suggested !== null ? (
              <span className="absolute inset-y-0.5 border-l-2 border-dashed border-[#E8440C]" style={{ left: pct(data.offer.suggested, d) }} title={`Pitch sugerido: ${clock(data.offer.suggested)}`} />
            ) : null}
          </>
        );
      }
      return (
        <span
          className="absolute inset-y-[3px] right-0 flex items-center overflow-hidden whitespace-nowrap rounded border-l-[3px] border-[#E8440C] bg-[#FDE4D9] px-2 text-[11px] font-semibold text-[#A82F05]"
          style={{ left: pct(data.offer.start, d) }}
        >
          Abre aos {clock(data.offer.start)}
          {data.offer.countdown > 0 ? ` · ${Math.round(data.offer.countdown / 60)} min` : ""}
        </span>
      );
    }
    case "vendas":
      if (data.sales.length === 0) return empty("Sem compras de demonstração");
      return (
        <>
          {data.sales.map((s, i) => (
            <span key={i} className="absolute top-1/2 -ml-[5px] -mt-[5px] size-2.5 rounded-full border-[2.5px] bg-white" style={{ left: pct(s.at, d), borderColor: color }} />
          ))}
        </>
      );
    case "agente":
      if (data.risks.length === 0) return empty("Sem análise do vídeo");
      return (
        <>
          {data.risks.map((z) => (
            <span
              key={z.from}
              title={`${clock(z.from)}–${clock(z.to)} · ${z.kind} · risco ${z.risk}`}
              className={cn(
                "absolute inset-y-[3px] rounded",
                z.risk === "alto" && "border-l-2 border-[#E5484D] bg-[repeating-linear-gradient(-45deg,#F6C3C8_0_4px,#FBE1E3_4px_8px)]",
                z.risk === "moderado" && "bg-[#FBEBCF]",
              )}
              style={{ left: pct(z.from, d), width: pct(z.to - z.from, d) }}
            />
          ))}
        </>
      );
  }
}

function AreaCurve({ curve, d, color }: { curve: readonly number[]; d: number; color: string }) {
  const path = useMemo(() => {
    const top = Math.max(1, ...curve) * 1.12;
    const points = Array.from({ length: 80 }, (_, i) => {
      const x = (i / 79) * 100;
      const y = 100 - (curveValueAt(curve, (i / 79) * d, d) / top) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return { line: `M${points.join(" L")}`, area: `M0,100 L${points.join(" L")} L100,100 Z` };
  }, [curve, d]);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
      <path d={path.area} fill={color} opacity={0.18} />
      <path d={path.line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function laneSub(lane: LaneKey, data: TimelineData) {
  switch (lane) {
    case "video":
      return "";
    case "fala":
      return `${data.speech.length} frases`;
    case "chat":
      return `${data.comments.length} comentários`;
    case "audiencia":
      return data.audience.label;
    case "oferta":
      return !data.offer.visible ? "Desligada" : data.offer.start === null ? "Sem minuto" : `Abre aos ${clock(data.offer.start)}`;
    case "vendas":
      return data.sales.length ? `${data.sales.length} compras` : "Nenhuma";
    case "agente": {
      const high = data.risks.filter((z) => z.risk === "alto").length;
      return high === 1 ? "1 risco alto" : `${high} riscos altos`;
    }
  }
}

function Inspector({
  lane,
  data,
  t,
  d,
  step,
  onOpenStep,
}: {
  lane: LaneKey;
  data: TimelineData;
  t: number;
  d: number;
  step: EditorStep;
  onOpenStep: (step: EditorStep) => void;
}) {
  const def = LANES.find((l) => l.key === lane)!;
  const Icon = def.icon;
  const zone = data.risks.find((z) => t >= z.from && t < z.to);
  const hot = lane === "agente" && zone?.risk === "alto";
  return (
    <div className="grid content-start gap-2.5 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md text-white" style={{ background: def.color }}>
          <Icon className="size-3.5" />
        </span>
        <b className="text-[13px] font-semibold">{def.label}</b>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{clock(t)}</span>
      </div>
      <p className="text-[12.5px] leading-snug text-muted-foreground">{def.about}</p>
      <div className={cn("rounded-lg px-3 py-2.5 text-[12.5px] leading-snug", hot ? "bg-[#FBE1E3] text-[#A61E2C]" : "bg-gray-100")}>
        <b className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide opacity-70">Neste minuto</b>
        {nowText(lane, data, t, d, zone)}
      </div>
      {def.step !== step ? (
        <button
          type="button"
          onClick={() => onOpenStep(def.step)}
          className="inline-flex items-center gap-1 justify-self-start text-[12.5px] font-medium text-foreground underline decoration-gray-300 underline-offset-4 hover:decoration-foreground"
        >
          Abrir {stepName(def.step)}
          <ArrowUpRight className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

const stepName = (step: EditorStep) =>
  ({ video: "Vídeo", chat: "Chat", audiencia: "Audiência", oferta: "Oferta", vendas: "Vendas", agente: "Agente IA" })[step as string] ?? step;

function nowText(lane: LaneKey, data: TimelineData, t: number, d: number, zone: RiskZone | undefined) {
  switch (lane) {
    case "video":
      return zone ? `Momento: ${zone.kind}` : "Início do vídeo.";
    case "fala": {
      const s = [...data.speech].reverse().find((x) => x.at <= t);
      return s ? `«${s.text}»` : "Ainda sem fala.";
    }
    case "chat": {
      const c = [...data.comments].reverse().find((x) => x.at <= t);
      return c ? `${c.author}: ${c.message}` : "Ainda sem comentários.";
    }
    case "audiencia":
      return data.audience.curve && data.audience.curve.length > 1
        ? `${curveValueAt(data.audience.curve, t, d).toLocaleString("pt-PT")} pessoas a ver.`
        : data.audience.label;
    case "oferta": {
      const o = data.offer;
      if (!o.visible) return "Desligada.";
      if (o.start === null) return "Sem minuto: aberta desde o início.";
      if (t < o.start) return `Fechada. Abre aos ${clock(o.start)}.`;
      return o.countdown > 0 ? `Aberta. Faltam ${clock(offerCountdownLeft(o.countdown, o.start, t))} no cronómetro.` : "Aberta.";
    }
    case "vendas": {
      const now = data.sales.find((s) => s.at <= t && t - s.at < 8);
      if (now) return `${now.buyer} comprou ${now.product}.`;
      if (data.sales.length === 0) return "Sem compras de demonstração.";
      const next = data.sales.find((s) => s.at > t);
      return next ? `Próxima compra aos ${clock(next.at)}.` : "Já apareceram todas.";
    }
    case "agente":
      if (!zone) return "Sem análise neste minuto.";
      return zone.risk === "alto"
        ? `Risco alto: ${zone.kind}. É um momento em que a audiência pode cair.`
        : `Risco ${zone.risk}: ${zone.kind}.`;
  }
}
