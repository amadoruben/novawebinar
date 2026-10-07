import { Bell, Check, Moon, Palette, Plus, Sparkles, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  clock,
  FOLLOW_NETWORKS,
  OFFER_COLOR_SUGGESTIONS,
  suggestFollowMoments,
  type FollowMoment,
  type LiveSettings,
} from "@/lib/room-logic";
import type { Appearance } from "@/components/room/room-parts";
import { Field, Note, Section, SwitchRow, Swatches } from "./ui";
import type { EditorClock } from "./steps/video";

/**
 * Depois de escolher o formato, a sala personaliza-se igual nos dois (Webinar e Live): a aparência,
 * a cor do botão, as redes e os momentos do + Seguir e o aviso do Suporte. Fica em `chat_settings.live`.
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
  return (
    <>
      <Section icon={Moon} title="Aparência">
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

      <Section icon={Palette} title="Cor do botão">
        <Swatches label="Botão e oferta" value={live.offerColor} onChange={(offerColor) => onLive({ offerColor })} options={OFFER_COLOR_SUGGESTIONS} />
        <p className="text-[12.5px] text-muted-foreground">
          O botão da oferta e o cartão usam esta cor; o texto ajusta-se sozinho. «Ao vivo» fica sempre vermelho e o + Seguir no laranja da
          marca.
        </p>
      </Section>

      <Section icon={UserPlus} title="Botão Seguir">
        <div className="grid gap-2.5">
          {FOLLOW_NETWORKS.map((n) => (
            <Field key={n.id} label={n.name} htmlFor={`follow-${n.id}`}>
              <Input
                id={`follow-${n.id}`}
                inputMode="url"
                autoComplete="off"
                placeholder={n.example}
                value={live.links[n.id] ?? ""}
                onChange={(e) => onLive({ links: { ...live.links, [n.id]: e.target.value } })}
              />
            </Field>
          ))}
        </div>
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          Quem toca em + Seguir, na foto ou no nome vê estas redes. No telemóvel cada uma abre diretamente na app; no computador, numa
          janela pequena ao lado da sala.
        </p>
      </Section>

      <Section icon={Sparkles} title="Quando aparece o + Seguir">
        <p className="text-[12.5px] leading-snug text-muted-foreground">Só nos minutos em que pede para seguir, e nunca durante a oferta.</p>
        {live.moments.length ? (
          <div className="flex flex-wrap gap-1.5">
            {live.moments.map((m, i) => (
              <span key={`${m.start}-${i}`} className="inline-flex h-8 items-center gap-1 rounded-lg border bg-white pl-2.5 pr-1 text-[13px] font-medium">
                <button type="button" onClick={() => c.seek(Math.max(0, m.start - 2))} className="font-mono tabular-nums">
                  {clock(m.start)}–{clock(m.end)}
                </button>
                <button
                  type="button"
                  aria-label="Tirar este momento"
                  onClick={() => onLive({ moments: live.moments.filter((_, j) => j !== i) })}
                  className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-chip hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <Note icon={Sparkles}>Ainda sem momentos: o + Seguir não aparece sozinho.</Note>
        )}
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          disabled={taken({ start: here, end: here + 30 })}
          onClick={() => addMoment({ start: here, end: here + 30 })}
        >
          <Plus />
          Neste minuto ({clock(here)}), 30 s
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

      <Section icon={Bell} title="Suporte">
        <SwitchRow
          title="Avisar no chat quando o Suporte responde"
          description="Se a pessoa não abrir a resposta, o chat mostra-lhe «@Você, já respondemos à sua dúvida». Só ela vê."
          checked={live.notify}
          onChange={(notify) => onLive({ notify })}
        />
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
