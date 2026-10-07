import { Bell, Monitor, Palette, Plus, Sparkles, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { clock, FOLLOW_NETWORKS, suggestFollowMoments, type FollowMoment, type LiveSettings } from "@/lib/room-logic";
import { LIVE_OFFER_PALETTES } from "@/components/room/live-parts";
import { Field, Note, Section, Seg, SwitchRow } from "./ui";
import type { EditorClock } from "./steps/video";

/**
 * O que se personaliza no formato Live: o vídeo no computador, as redes e os momentos do + Seguir,
 * o selo, a cor da oferta e o aviso do Suporte. Fica tudo em `chat_settings.live`.
 */
export function LiveOptions({
  live,
  onLive,
  clock: c,
  transcript,
  hostVerified,
}: {
  live: LiveSettings;
  onLive: (patch: Partial<LiveSettings>) => void;
  clock: EditorClock;
  transcript: readonly { at: number; text: string }[];
  hostVerified: boolean;
}) {
  const hasLink = FOLLOW_NETWORKS.some((n) => live.links[n.id]);
  const taken = (m: FollowMoment) => live.moments.some((x) => m.start < x.end && x.start < m.end);
  const suggestions = suggestFollowMoments(transcript).filter((m) => !taken(m));
  const addMoment = (m: FollowMoment) => onLive({ moments: [...live.moments, m].sort((a, b) => a.start - b.start) });
  const here = Math.round(c.t);
  return (
    <>
      <Section icon={Monitor} title="No computador">
        <Seg
          full
          label="Vídeo no computador"
          value={live.desk}
          onChange={(desk) => onLive({ desk })}
          options={[
            { value: "horizontal", label: "Horizontal (16:9)" },
            { value: "vertical", label: "Vertical (9:16)" },
          ]}
        />
        <Note icon={Monitor}>
          {live.desk === "horizontal"
            ? "Para um vídeo gravado deitado. No computador o vídeo fica em 16:9 com o chat ao lado; no telemóvel aparece inteiro, com o chat por baixo."
            : "Para um vídeo gravado ao alto. No telemóvel o vídeo enche o ecrã; no computador fica ao alto com o chat ao lado."}
        </Note>
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
          Quem toca em + Seguir vê estas redes. No telemóvel cada uma abre diretamente na app; no computador, numa janela
          pequena ao lado da sala.
        </p>
      </Section>

      <Section icon={Sparkles} title="Quando aparece o + Seguir">
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          Só nos minutos em que pede para seguir, e nunca durante a oferta. Fora disso, a pessoa segue tocando na foto ou no
          nome.
        </p>
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={taken({ start: here, end: here + 30 })}
            onClick={() => addMoment({ start: here, end: here + 30 })}
          >
            <Plus />
            Neste minuto ({clock(here)}), 30 s
          </Button>
        </div>
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

      <Section icon={Palette} title="Cores">
        {hostVerified ? (
          <Field label="Selo de verificado">
            <Seg
              label="Selo de verificado"
              value={live.badge}
              onChange={(badge) => onLive({ badge })}
              options={[
                { value: "white", label: "Branco" },
                { value: "blue", label: "Azul" },
              ]}
            />
          </Field>
        ) : null}
        <Field label="Cor da oferta" hint="O «Ao vivo» fica sempre vermelho e o + Seguir no laranja da marca.">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor da oferta">
            {Object.entries(LIVE_OFFER_PALETTES).map(([key, p]) => {
              const on = live.offerColor === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={p.name}
                  title={p.name}
                  onClick={() => onLive({ offerColor: key as LiveSettings["offerColor"] })}
                  className={cn("size-[30px] rounded-full ring-offset-2 transition", on ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-black/15")}
                  style={{ background: p.of }}
                />
              );
            })}
          </div>
        </Field>
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
