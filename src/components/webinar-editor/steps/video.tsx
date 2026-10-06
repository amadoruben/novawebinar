import { useEffect, useRef, useState } from "react";
import {
  Check,
  FileText,
  Film,
  Link2,
  Loader2,
  Mic,
  Monitor,
  Moon,
  Pause,
  Play,
  Sun,
  Upload,
  Video as VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/room-logic";
import { formatBytes, type VideoUploadProgress } from "@/lib/video-upload";
import type { Appearance } from "@/components/room/room-parts";
import { CountPill, Note, Section, TimeChip } from "../ui";

export type VideoSourceLite = {
  id: string;
  name: string;
  provider: string;
  source_url: string | null;
  duration_seconds: number;
};

export type EditorClock = {
  t: number;
  duration: number;
  playing: boolean;
  toggle: () => void;
  seek: (seconds: number) => void;
};

type Platform = "vimeo" | "panda" | "bunny";
type Source = "computer" | "library" | "platform" | "link";

export type VideoUploadApi = {
  state: { file: File; progress: VideoUploadProgress } | null;
  busy: boolean;
  start: (file: File) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
};

/** Vídeo: carregar o vídeo, ver a transcrição e escolher a aparência da sala. */
export function StepVideo({
  video,
  library,
  providerLabel,
  clock: c,
  transcript,
  onPick,
  upload,
  onAddLink,
  appearance,
  onAppearance,
}: {
  video: VideoSourceLite | null;
  library: readonly VideoSourceLite[];
  providerLabel: (provider: string) => string;
  clock: EditorClock;
  transcript: readonly { at: number; text: string }[];
  onPick: (id: string) => void;
  upload: VideoUploadApi;
  onAddLink: (input: { name: string; provider: "hls" | Platform; url: string }) => Promise<boolean>;
  appearance: Appearance;
  onAppearance: (appearance: Appearance) => void;
}) {
  const [dialog, setDialog] = useState(false);
  const [full, setFull] = useState(false);
  let index = -1;
  transcript.forEach((s, i) => {
    if (s.at <= c.t) index = i;
  });
  const around = transcript.slice(Math.max(0, index - 1), Math.max(0, index - 1) + 3);

  return (
    <>
      {!video ? (
        <section className="pb-[18px]">
          <button
            type="button"
            onClick={() => setDialog(true)}
            className="grid w-full place-items-center gap-2 rounded-2xl border-2 border-dashed bg-white px-5 py-9 text-center transition hover:border-foreground/40 hover:bg-gray-50"
          >
            <span className="grid size-12 place-items-center rounded-full bg-foreground text-background">
              <Upload className="size-5" />
            </span>
            <b className="text-[15px] font-semibold">Carregar vídeo</b>
            <span className="max-w-[260px] text-[13px] text-muted-foreground">
              Do computador, da Biblioteca, do Vimeo, Panda ou Bunny, ou por link.
            </span>
          </button>
          <p className="mt-3 text-[12.5px] text-muted-foreground">
            Tudo na sala segue o tempo do vídeo: o chat, a audiência, a oferta e as vendas.
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-[minmax(0,1fr)] gap-3 pb-[18px]">
          <Player clock={c} />
          <div className="flex items-center gap-3 rounded-xl border bg-white p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-chip">
              <Film className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <b className="block truncate text-sm font-semibold">{video.name}</b>
              <span className="text-[12.5px] text-muted-foreground">
                {clock(video.duration_seconds)} · {providerLabel(video.provider)}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setDialog(true)}>
              Trocar
            </Button>
          </div>
        </section>
      )}

      {video ? (
        <Section icon={Mic} title="Transcrição" aside={transcript.length ? <CountPill>{transcript.length} frases</CountPill> : null}>
          {transcript.length === 0 ? (
            <Note icon={FileText}>
              Ainda sem transcrição. Ao criar os comentários no Chat, o sistema transcreve a fala e encontra os momentos do vídeo.
            </Note>
          ) : (
            <>
              <div className="divide-y overflow-hidden rounded-xl border bg-white">
                {around.map((s) => (
                  <SentenceRow key={s.at} at={s.at} text={s.text} active={s === transcript[index]} onSeek={c.seek} clamp />
                ))}
              </div>
              <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setFull(true)}>
                <FileText />
                Ver a transcrição completa
              </Button>
            </>
          )}
        </Section>
      ) : null}

      <Section icon={Moon} title="Aparência da sala">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Aparência da sala">
          {(
            [
              ["dark", "Escuro", Moon],
              ["light", "Claro", Sun],
              ["system", "Do dispositivo", Monitor],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={appearance === value}
              onClick={() => onAppearance(value)}
              className={cn(
                "grid justify-items-center gap-1.5 rounded-xl border bg-white px-2 py-3 text-[12.5px] font-medium",
                appearance === value && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-full place-items-center rounded-md ring-1 ring-black/10",
                  value === "dark" ? "bg-[#141414] text-white" : value === "light" ? "bg-[#F4F4F5] text-[#171717]" : "bg-[linear-gradient(90deg,#141414_50%,#F4F4F5_50%)]",
                )}
              >
                <Icon className={cn("size-4", value === "system" && "text-[#E8440C]")} />
              </span>
              {label}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          «Do dispositivo» segue o telemóvel ou o computador de quem vê. Cada pessoa pode trocar no ⚙ do vídeo.
        </p>
      </Section>

      <SourceDialog
        open={dialog}
        onOpenChange={setDialog}
        library={library}
        current={video?.id ?? null}
        providerLabel={providerLabel}
        onPick={(id) => {
          onPick(id);
          setDialog(false);
        }}
        upload={upload}
        onAddLink={async (input) => {
          const ok = await onAddLink(input);
          if (ok) setDialog(false);
          return ok;
        }}
      />

      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="max-h-[80vh] max-w-[560px] grid-rows-[auto_minmax(0,1fr)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Transcrição</DialogTitle>
            <DialogDescription>{transcript.length} frases. Clique numa frase para ir a esse minuto.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 divide-y overflow-y-auto rounded-xl border">
            {transcript.map((s, i) => (
              <SentenceRow
                key={s.at}
                at={s.at}
                text={s.text}
                active={i === index}
                onSeek={(t) => {
                  c.seek(t);
                  setFull(false);
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SentenceRow({
  at,
  text,
  active,
  onSeek,
  clamp,
}: {
  at: number;
  text: string;
  active: boolean;
  onSeek: (t: number) => void;
  clamp?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSeek(at)}
      className={cn(
        "flex w-full items-start gap-2.5 px-3 py-2 text-left text-[13px] leading-snug",
        active ? "bg-[#FDE4D9] text-foreground" : "text-muted-foreground hover:bg-gray-50",
      )}
    >
      <TimeChip seconds={at} active={active} />
      <span className={clamp ? "line-clamp-2" : undefined}>{text}</span>
    </button>
  );
}

/** A barra do vídeo no painel: tocar, pausar e ir a um minuto. O vídeo vê-se na sala ao lado. */
function Player({ clock: c }: { clock: EditorClock }) {
  const bar = useRef<HTMLDivElement>(null);
  const seekAt = (clientX: number) => {
    const box = bar.current?.getBoundingClientRect();
    if (!box) return;
    c.seek(Math.round(Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * c.duration));
  };
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[#141414] px-3 py-2.5 text-white">
      <button
        type="button"
        onClick={c.toggle}
        aria-label={c.playing ? "Pausar" : "Tocar"}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-black"
      >
        {c.playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
      </button>
      <div className="grid min-w-0 flex-1 gap-1.5">
        <span className="font-mono text-[11.5px] tabular-nums text-white/80">
          {clock(c.t)} / {clock(c.duration)}
        </span>
        <div
          ref={bar}
          role="slider"
          aria-label="Posição no vídeo"
          aria-valuemin={0}
          aria-valuemax={c.duration}
          aria-valuenow={Math.round(c.t)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") c.seek(Math.max(0, c.t - 5));
            if (e.key === "ArrowRight") c.seek(Math.min(c.duration, c.t + 5));
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            seekAt(e.clientX);
          }}
          onPointerMove={(e) => e.buttons && seekAt(e.clientX)}
          className="h-1.5 cursor-pointer rounded-full bg-white/20"
        >
          <div className="h-full rounded-full bg-[#E8440C]" style={{ width: `${(c.t / Math.max(1, c.duration)) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Carregar vídeo ---------- */

const PLATFORMS: Record<
  Platform,
  { name: string; color: string; mark: string; where: string[]; example: string; test: RegExp }
> = {
  vimeo: {
    name: "Vimeo",
    color: "#1AB7EA",
    mark: "v",
    where: ["Abra o vídeo no Vimeo.", "Carregue em «Partilhar».", "Copie o link do vídeo e cole aqui."],
    example: "https://vimeo.com/123456789",
    test: /vimeo\.com\//i,
  },
  panda: {
    name: "Panda Video",
    color: "#111827",
    mark: "P",
    where: ["Abra o vídeo no painel do Panda Video.", "Em «Incorporar», copie o link do player.", "Cole aqui o link (acaba em ?v=…)."],
    example: "https://player-vz-xxxx.tv.pandavideo.com.br/embed/?v=…",
    test: /pandavideo/i,
  },
  bunny: {
    name: "Bunny Stream",
    color: "#FF7B2F",
    mark: "B",
    where: ["Abra o vídeo na biblioteca do Bunny Stream.", "Copie o «HLS Playlist URL» (acaba em .m3u8).", "Cole aqui o link."],
    example: "https://vz-xxxx.b-cdn.net/…/playlist.m3u8",
    test: /b-cdn\.net|mediadelivery\.net/i,
  },
};

function PlatformMark({ platform, size = 36 }: { platform: Platform; size?: number }) {
  const p = PLATFORMS[platform];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg font-black text-white"
      style={{ background: p.color, width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden
    >
      {p.mark}
    </span>
  );
}

function SourceDialog({
  open,
  onOpenChange,
  library,
  current,
  providerLabel,
  onPick,
  upload,
  onAddLink,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  library: readonly VideoSourceLite[];
  current: string | null;
  providerLabel: (provider: string) => string;
  onPick: (id: string) => void;
  upload: VideoUploadApi;
  onAddLink: (input: { name: string; provider: "hls" | Platform; url: string }) => Promise<boolean>;
}) {
  const [source, setSource] = useState<Source>("computer");
  const [platform, setPlatform] = useState<Platform>("vimeo");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setUrl("");
    setName("");
  }, [source, platform]);
  const p = upload.state?.progress;
  const sources: { key: Source; icon: typeof Upload; title: string; text: string }[] = [
    { key: "computer", icon: Upload, title: "Do computador", text: "MP4 ou MOV, até 5 GB" },
    { key: "library", icon: Film, title: "Da Biblioteca", text: `${library.length} ${library.length === 1 ? "vídeo" : "vídeos"}` },
    { key: "platform", icon: VideoIcon, title: "De uma plataforma", text: "Vimeo, Panda, Bunny" },
    { key: "link", icon: Link2, title: "Por link", text: "MP4 ou HLS (.m3u8)" },
  ];
  const linkProblem = (() => {
    const value = url.trim();
    if (!value) return null;
    if (!/^https?:\/\/.+/i.test(value)) return "O link começa por https://";
    if (/youtube\.com|youtu\.be/i.test(value))
      return "O YouTube não serve: mostra os controlos e as sugestões dele por cima da aula. Use o Vimeo, o Panda, o Bunny ou o ficheiro.";
    if (source === "platform" && !PLATFORMS[platform].test.test(value))
      return `Este link não parece do ${PLATFORMS[platform].name}. Exemplo: ${PLATFORMS[platform].example}`;
    if (source === "link" && !/\.(mp4|mov|m4v|webm|m3u8)(\?|$)/i.test(value))
      return "O link tem de ir direto ao ficheiro (.mp4 ou .mov) ou à lista HLS (.m3u8).";
    return null;
  })();
  const submit = async () => {
    setSaving(true);
    try {
      await onAddLink({
        name: name.trim() || (source === "platform" ? `Vídeo do ${PLATFORMS[platform].name}` : "Vídeo do webinar"),
        provider: source === "platform" ? platform : "hls",
        url: url.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[86vh] w-[calc(100%-2rem)] max-w-[760px] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:p-0">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle className="text-base font-semibold">Carregar vídeo</DialogTitle>
          <DialogDescription>De onde vem o vídeo do webinar?</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 sm:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="flex gap-1 overflow-x-auto border-b p-2 sm:flex-col sm:border-b-0 sm:border-r">
            {sources.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSource(s.key)}
                aria-current={source === s.key}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition",
                  source === s.key ? "bg-chip" : "hover:bg-gray-50",
                )}
              >
                <s.icon className="size-4 shrink-0" />
                <span className="min-w-0">
                  <b className="block text-[13.5px] font-medium">{s.title}</b>
                  <span className="hidden text-[12px] text-muted-foreground sm:block">{s.text}</span>
                </span>
              </button>
            ))}
          </nav>
          <div className="min-h-[340px] overflow-y-auto p-5">
            {source === "computer" ? (
              <div className="grid gap-4">
                <button
                  type="button"
                  disabled={upload.busy}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) upload.start(file);
                  }}
                  className="grid place-items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition hover:border-foreground/40 disabled:opacity-60"
                >
                  <Upload className="size-6 text-muted-foreground" />
                  <b className="text-sm font-semibold">Arraste o vídeo para aqui</b>
                  <span className="text-[13px] text-muted-foreground">ou clique para escolher. MP4 ou MOV, até 5 GB.</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload.start(file);
                    e.target.value = "";
                  }}
                />
                {upload.state && p && p.status !== "done" ? (
                  <div className="grid gap-2.5 rounded-xl border p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{upload.state.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(p.bytesSent)} de {formatBytes(p.bytesTotal)}
                          {p.status === "paused" ? " · em pausa" : ""}
                          {p.status === "error" ? ` · ${p.error ?? "o envio falhou"}` : ""}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold tabular-nums">{p.percent}%</span>
                    </div>
                    <Progress value={p.percent} />
                    <div className="flex flex-wrap gap-2">
                      {p.status === "uploading" ? (
                        <Button variant="outline" size="sm" onClick={upload.pause}>
                          Pausar
                        </Button>
                      ) : null}
                      {p.status === "paused" || (p.status === "error" && p.recoverable) ? (
                        <Button size="sm" variant="dark" onClick={upload.resume}>
                          Retomar
                        </Button>
                      ) : null}
                      {p.status !== "cancelled" ? (
                        <Button variant="ghost" size="sm" onClick={upload.cancel}>
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <p className="text-[12.5px] text-muted-foreground">
                  O envio continua se a ligação cair. Quando acabar, o vídeo fica escolhido e guardado na Biblioteca.
                </p>
              </div>
            ) : source === "library" ? (
              library.length === 0 ? (
                <Note icon={Film}>A Biblioteca ainda está vazia. Carregue o primeiro vídeo do computador ou de uma plataforma.</Note>
              ) : (
                <div className="grid gap-2">
                  {library.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onPick(v.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-left transition hover:bg-gray-50",
                        current === v.id && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
                      )}
                    >
                      <span className="grid h-10 w-16 shrink-0 place-items-center rounded-md bg-[#141414] text-white">
                        <Play className="size-4 fill-current" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-sm font-medium">{v.name}</b>
                        <span className="text-[12.5px] text-muted-foreground">
                          {clock(v.duration_seconds)} · {providerLabel(v.provider)}
                        </span>
                      </span>
                      {current === v.id ? <Check className="size-4 shrink-0" /> : null}
                    </button>
                  ))}
                </div>
              )
            ) : source === "platform" ? (
              <div className="grid gap-4">
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PLATFORMS) as Platform[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPlatform(key)}
                      aria-pressed={platform === key}
                      className={cn(
                        "grid justify-items-center gap-2 rounded-xl border p-3 text-[13px] font-medium transition hover:bg-gray-50",
                        platform === key && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
                      )}
                    >
                      <PlatformMark platform={key} />
                      {PLATFORMS[key].name}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2 rounded-xl bg-gray-50 p-3.5">
                  <b className="flex items-center gap-2 text-[13px] font-semibold">
                    <PlatformMark platform={platform} size={20} />
                    Onde está o link no {PLATFORMS[platform].name}
                  </b>
                  <ol className="grid list-decimal gap-1 pl-5 text-[13px] text-muted-foreground">
                    {PLATFORMS[platform].where.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                </div>
                <LinkFields
                  name={name}
                  onName={setName}
                  url={url}
                  onUrl={setUrl}
                  placeholder={PLATFORMS[platform].example}
                  problem={linkProblem}
                  saving={saving}
                  onSubmit={() => void submit()}
                />
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-1.5 rounded-xl bg-gray-50 p-3.5 text-[13px]">
                  <b className="font-semibold">Que links funcionam</b>
                  <span className="text-muted-foreground">✓ Um ficheiro na internet: termina em .mp4 ou .mov</span>
                  <span className="text-muted-foreground">✓ Uma lista HLS: termina em .m3u8 (Bunny, Cloudflare, Mux…)</span>
                  <span className="text-muted-foreground">✗ YouTube: mostra os controlos e as sugestões dele por cima da aula</span>
                </div>
                <LinkFields
                  name={name}
                  onName={setName}
                  url={url}
                  onUrl={setUrl}
                  placeholder="https://…/video.mp4 ou …/playlist.m3u8"
                  problem={linkProblem}
                  saving={saving}
                  onSubmit={() => void submit()}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinkFields({
  name,
  onName,
  url,
  onUrl,
  placeholder,
  problem,
  saving,
  onSubmit,
}: {
  name: string;
  onName: (v: string) => void;
  url: string;
  onUrl: (v: string) => void;
  placeholder: string;
  problem: string | null;
  saving: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5 text-[13px] font-medium">
        Link do vídeo
        <Input value={url} onChange={(e) => onUrl(e.target.value)} placeholder={placeholder} />
      </label>
      {problem ? <p className="text-[12.5px] text-warning">{problem}</p> : null}
      <label className="grid gap-1.5 text-[13px] font-medium">
        Nome na Biblioteca <span className="font-normal text-muted-foreground">(opcional)</span>
        <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Ex.: Aula de lançamento" />
      </label>
      <Button variant="dark" className="justify-self-start" disabled={saving || !url.trim() || Boolean(problem)} onClick={onSubmit}>
        {saving ? <Loader2 className="animate-spin" /> : null}
        Usar este vídeo
      </Button>
    </div>
  );
}
