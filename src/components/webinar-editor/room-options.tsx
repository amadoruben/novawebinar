import { Check, Clock, Moon, Palette, Plus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NETWORK_ICONS } from "@/components/room/live-parts";
import { cn } from "@/lib/utils";
import {
  clock,
  FOLLOW_NETWORKS,
  OFFER_COLOR_SUGGESTIONS,
  suggestFollowMoments,
  type FollowMoment,
  type FollowNetwork,
  type LiveSettings,
} from "@/lib/room-logic";
import type { Appearance } from "@/components/room/room-parts";
import { MinuteWheel, Note, PickerButton, Section, Seg, Swatches } from "./ui";
import type { EditorClock } from "./steps/video";

/** Quanto tempo o + Seguir fica à vista em cada momento. */
const LENGTHS = [15, 30, 60] as const;

/**
 * Depois de escolher o formato, a sala personaliza-se igual nos dois (Webinar e Live): a aparência,
 * a cor do botão, as redes e os momentos do + Seguir. Fica em `chat_settings.live`; o aviso do
 * Suporte está na etapa Chat, porque aparece no chat.
 */
export function RoomOptions({
  live,
  onLive,
  appearance,
  onAppearance,
  clock: c,
  transcript,
}: {
  live: LiveSettings;
  onLive: (patch: Partial<LiveSettings>) => void;
  appearance: Appearance;
  onAppearance: (appearance: Appearance) => void;
  clock: EditorClock;
  transcript: readonly { at: number; text: string }[];
}) {
  const hasLink = FOLLOW_NETWORKS.some((n) => live.links[n.id]);
  const taken = (m: FollowMoment) => live.moments.some((x) => m.start < x.end && x.start < m.end);
  const suggestions = suggestFollowMoments(transcript).filter((m) => !taken(m));
  const addMoment = (m: FollowMoment) => onLive({ moments: [...live.moments, m].sort((a, b) => a.start - b.start) });
  const here = Math.round(c.t);
  // As redes à vista: as que já têm link (ou acabaram de ser acrescentadas); sem nenhuma, o Instagram.
  const added = FOLLOW_NETWORKS.filter((n) => n.id in live.links).map((n) => n.id);
  const rows: readonly FollowNetwork[] = added.length ? added : ["instagram"];
  const missing = FOLLOW_NETWORKS.filter((n) => !rows.includes(n.id));
  return (
    <>
      <Section icon={Moon} title="Aparência" help="aparencia">
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Aparência da sala">
          {(
            [
              ["system", "Automático"],
              ["light", "Claro"],
              ["dark", "Escuro"],
            ] as const
          ).map(([value, label]) => {
            const on = appearance === value;
            return (
              <button key={value} type="button" role="radio" aria-checked={on} onClick={() => onAppearance(value)} className="group grid gap-2 text-left">
                <span
                  className={cn(
                    "relative block overflow-hidden rounded-xl ring-1 ring-black/10 transition",
                    on ? "ring-2 ring-foreground ring-offset-2" : "group-hover:ring-black/25",
                  )}
                >
                  <ThemeThumb theme={value} />
                  {on ? (
                    <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-foreground text-background">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </span>
                <span className={cn("text-[13px]", on ? "font-semibold" : "font-medium text-muted-foreground")}>{label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          «Automático» segue o telemóvel ou o computador de quem vê. Cada pessoa pode trocar no ⚙ do vídeo.
        </p>
      </Section>

      <Section icon={Palette} title="Cor do botão" help="corBotao">
        <Swatches label="Botão e oferta" value={live.offerColor} onChange={(offerColor) => onLive({ offerColor })} options={OFFER_COLOR_SUGGESTIONS} />
        <p className="text-[12.5px] text-muted-foreground">
          O botão da oferta e o cartão usam esta cor; o texto ajusta-se sozinho. «Ao vivo» fica sempre vermelho e o + Seguir no laranja da
          marca.
        </p>
      </Section>

      <Section icon={UserPlus} title="Botão Seguir" help="seguir">
        <div className="grid gap-2">
          {rows.map((id) => {
            const n = FOLLOW_NETWORKS.find((x) => x.id === id)!;
            return (
              <div key={id} className="flex items-center gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-chip [&_svg]:size-[18px]" title={n.name}>
                  {NETWORK_ICONS[id]}
                </span>
                <Input
                  inputMode="url"
                  autoComplete="off"
                  aria-label={n.name}
                  placeholder={n.example}
                  value={live.links[id] ?? ""}
                  onChange={(e) => onLive({ links: { ...live.links, [id]: e.target.value } })}
                  className="min-w-0 flex-1"
                />
                {rows.length > 1 || live.links[id] ? (
                  <button
                    type="button"
                    aria-label={`Tirar ${n.name}`}
                    onClick={() => {
                      const { [id]: _gone, ...rest } = live.links;
                      onLive({ links: rest });
                    }}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-chip hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        {missing.length ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="justify-self-start">
                <Plus />
                Adicionar rede
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[200px] p-1">
              {missing.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onLive({ links: { ...live.links, [n.id]: "" } })}
                  className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium hover:bg-chip [&_svg]:size-4"
                >
                  {NETWORK_ICONS[n.id]}
                  {n.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        ) : null}
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          Quem toca em + Seguir, na foto ou no nome vê estas redes. No telemóvel cada uma abre na app; no computador, numa janela
          pequena ao lado da sala.
        </p>
      </Section>

      <Section icon={Clock} title="Quando aparece o + Seguir" help="seguirMomentos">
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          Nos minutos em que pede para seguir, e nunca durante a oferta. Escolha o minuto exacto na roda ou use os da transcrição.
        </p>
        {live.moments.length ? (
          <div className="grid gap-2">
            {live.moments.map((m, i) => {
              const length = m.end - m.start;
              const patch = (next: FollowMoment) =>
                onLive({ moments: live.moments.map((x, j) => (j === i ? next : x)).sort((a, b) => a.start - b.start) });
              return (
                <div key={`${m.start}-${i}`} className="grid gap-2 rounded-xl border bg-white p-2.5">
                  <div className="flex items-center gap-2">
                    <PickerButton
                      className="h-9 min-w-0 flex-1"
                      value={
                        <>
                          <span className="font-normal text-muted-foreground">Aos </span>
                          <span className="font-mono">{clock(m.start)}</span>
                        </>
                      }
                      title="Quando aparece o + Seguir"
                      hint="Rode os minutos e os segundos. A sala vai para esse momento."
                    >
                      <MinuteWheel
                        value={m.start}
                        maxSeconds={Math.max(1, c.duration - 5)}
                        onChange={(start) => {
                          patch({ start, end: start + length });
                          c.seek(Math.max(0, start - 2));
                        }}
                      />
                    </PickerButton>
                    <button
                      type="button"
                      aria-label="Tirar este momento"
                      onClick={() => onLive({ moments: live.moments.filter((_, j) => j !== i) })}
                      className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-chip hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] text-muted-foreground">Fica à vista</span>
                    <Seg
                      small
                      label="Fica à vista"
                      value={String(length)}
                      onChange={(v) => patch({ start: m.start, end: m.start + Number(v) })}
                      options={LENGTHS.map((x) => ({ value: String(x), label: `${x} s` }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Note icon={Clock}>Ainda sem momentos: o + Seguir não aparece sozinho.</Note>
        )}
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          disabled={taken({ start: here, end: here + 30 })}
          onClick={() => addMoment({ start: here, end: here + 30 })}
        >
          <Plus />
          Adicionar momento ({clock(here)})
        </Button>
        {suggestions.length ? (
          <div className="grid gap-1.5">
            <span className="text-[12.5px] font-medium text-muted-foreground">Na transcrição, pede para seguir em:</span>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((m) => (
                <button
                  key={m.start}
                  type="button"
                  onClick={() => addMoment(m)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-chip px-2.5 font-mono text-[13px] tabular-nums transition hover:bg-[#FDE4D9] hover:text-[#A82F05]"
                >
                  <Plus className="size-3.5" />
                  {clock(m.start)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {!hasLink && live.moments.length ? (
          <p className="text-[12.5px] text-warning">Ponha pelo menos um link em Botão Seguir, senão o botão não aparece.</p>
        ) : null}
      </Section>
    </>
  );
}

/** A sala em miniatura no tema: o vídeo à esquerda e o painel à direita; «Automático» mostra os dois. */
function ThemeThumb({ theme }: { theme: Appearance }) {
  const half = (dark: boolean) => (
    <span className={cn("grid h-full grid-cols-[1fr_34%] gap-1 p-1.5", dark ? "bg-[#141414]" : "bg-white")}>
      <span className="grid content-start gap-1">
        <span className={cn("block aspect-video rounded-[3px]", dark ? "bg-[#2E2E2E]" : "bg-[#E5E5E5]")}>
          <i className="m-1 block h-1.5 w-3.5 rounded-[2px] bg-[#E5243B]" />
        </span>
        <i className={cn("block h-1.5 w-4/5 rounded-full", dark ? "bg-[#3A3A3A]" : "bg-[#D4D4D4]")} />
      </span>
      <span className={cn("grid content-end gap-1 rounded-[3px] p-1", dark ? "bg-[#1F1F1F]" : "bg-white ring-1 ring-[#E5E5E5]")}>
        {[0.9, 0.7, 0.8].map((w, i) => (
          <i key={i} className={cn("block h-1 rounded-full", dark ? "bg-[#3A3A3A]" : "bg-[#E5E5E5]")} style={{ width: `${w * 100}%` }} />
        ))}
        <i className={cn("mt-0.5 block h-2 rounded-full", dark ? "bg-[#2E2E2E]" : "bg-[#F2F2F2] ring-1 ring-[#E5E5E5]")} />
      </span>
    </span>
  );
  if (theme !== "system") return <span className="block aspect-[16/10]">{half(theme === "dark")}</span>;
  return (
    <span className="relative block aspect-[16/10]">
      <span className="absolute inset-0">{half(true)}</span>
      <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">{half(false)}</span>
    </span>
  );
}
