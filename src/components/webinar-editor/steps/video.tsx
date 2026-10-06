import { useEffect, useRef, useState } from "react";
import { Blocks, ChevronRight, FileText, Film, Link2, Loader2, Mic, Pause, Play, Upload, Video as VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { clock } from "@/lib/room-logic";
import { formatBytes, type VideoUploadProgress } from "@/lib/video-upload";
import { isDirectVideo } from "@/components/room/entry-screen";
import { SyncedVideo } from "../room-preview";
import { CountPill, Field, Section, Seg, TimeChip, Note } from "../ui";

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

/** Vídeo: o leitor, de onde vem o vídeo e a transcrição. */
export function StepVideo({
  video,
  library,
  providerLabel,
  clock: c,
  transcript,
  onPick,
  upload,
  onAddLink,
}: {
  video: VideoSourceLite | null;
  library: readonly VideoSourceLite[];
  providerLabel: (provider: string) => string;
  clock: EditorClock;
  transcript: readonly { at: number; text: string }[];
  onPick: (id: string) => void;
  upload: {
    state: { file: File; progress: VideoUploadProgress } | null;
    busy: boolean;
    start: (file: File) => void;
    pause: () => void;
    resume: () => void;
    cancel: () => void;
  };
  onAddLink: (input: { name: string; provider: "hls" | Platform; url: string }) => Promise<boolean>;
}) {
  const [picking, setPicking] = useState(!video);
  const [source, setSource] = useState<"computer" | "library" | "platform" | "link" | null>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (video) setPicking(false);
  }, [video?.id]);

  if (picking || !video) {
    return (
      <PickSource
        source={source}
        onSource={setSource}
        library={library}
        providerLabel={providerLabel}
        onPick={(id) => {
          onPick(id);
          setPicking(false);
          setSource(null);
        }}
        upload={upload}
        onAddLink={async (input) => {
          const ok = await onAddLink(input);
          if (ok) {
            setPicking(false);
            setSource(null);
          }
          return ok;
        }}
        onCancel={video ? () => setPicking(false) : undefined}
      />
    );
  }

  let index = -1;
  transcript.forEach((s, i) => {
    if (s.at <= c.t) index = i;
  });
  const around = transcript.slice(Math.max(0, index - 1), Math.max(0, index - 1) + 3);
  const direct = isDirectVideo(video.source_url, video.provider);

  return (
    <>
      <section className="grid gap-3 pb-[18px]">
        <Player url={direct ? video.source_url : null} clock={c} />
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <b className="block truncate text-sm font-semibold">{video.name}</b>
            <span className="text-[12.5px] text-muted-foreground">
              {clock(video.duration_seconds)} · {providerLabel(video.provider)}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
            Trocar
          </Button>
        </div>
      </section>

      <Section icon={Mic} title="Transcrição" aside={transcript.length ? <CountPill>{transcript.length} frases</CountPill> : null}>
        {transcript.length === 0 ? (
          <Note icon={FileText}>
            Ainda sem transcrição. Ao gerar os comentários no Chat, o sistema transcreve a fala e encontra os momentos do
            vídeo.
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

      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="max-h-[80vh] max-w-[560px] grid-rows-[auto_minmax(0,1fr)]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Transcrição</DialogTitle>
            <DialogDescription>
              {transcript.length} frases · {video.name}. Clique numa frase para ir a esse minuto.
            </DialogDescription>
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

/** O leitor do painel: segue o relógio do editor, como o vídeo da sala. */
function Player({ url, clock: c }: { url: string | null; clock: EditorClock }) {
  const bar = useRef<HTMLDivElement>(null);
  const seekAt = (clientX: number) => {
    const box = bar.current?.getBoundingClientRect();
    if (!box) return;
    c.seek(Math.round(Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * c.duration));
  };
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-[#121417] text-white">
      {url ? <SyncedVideo url={url} t={c.t} playing={c.playing} muted /> : null}
      <button
        type="button"
        onClick={c.toggle}
        aria-label={c.playing ? "Pausar" : "Tocar"}
        className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 backdrop-blur"
      >
        {c.playing ? <Pause className="size-5 fill-white" /> : <Play className="size-5 fill-white" />}
      </button>
      <div className="absolute inset-x-0 bottom-0 grid gap-1.5 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8">
        <span className="font-mono text-[11.5px] tabular-nums">
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
          className="h-1 cursor-pointer rounded-full bg-white/25"
        >
          <div className="h-full rounded-full bg-[#E8440C]" style={{ width: `${(c.t / Math.max(1, c.duration)) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function PickSource({
  source,
  onSource,
  library,
  providerLabel,
  onPick,
  upload,
  onAddLink,
  onCancel,
}: {
  source: "computer" | "library" | "platform" | "link" | null;
  onSource: (source: "computer" | "library" | "platform" | "link" | null) => void;
  library: readonly VideoSourceLite[];
  providerLabel: (provider: string) => string;
  onPick: (id: string) => void;
  upload: Parameters<typeof StepVideo>[0]["upload"];
  onAddLink: (input: { name: string; provider: "hls" | Platform; url: string }) => Promise<boolean>;
  onCancel: (() => void) | undefined;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [platform, setPlatform] = useState<Platform>("vimeo");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const options = [
    { key: "computer", icon: Upload, title: "Carregar do computador", description: "MP4 ou MOV, até 5 GB." },
    { key: "library", icon: Film, title: "Da Biblioteca", description: "Os vídeos que já carregou." },
    { key: "platform", icon: Blocks, title: "De uma plataforma", description: "Vimeo, Panda ou Bunny." },
    { key: "link", icon: Link2, title: "Por link", description: "Um endereço HLS (.m3u8) ou MP4." },
  ] as const;
  const p = upload.state?.progress;

  const submit = async (provider: "hls" | Platform) => {
    setSaving(true);
    try {
      await onAddLink({ name: name.trim() || "Vídeo do webinar", provider, url: url.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section icon={VideoIcon} title="Escolher o vídeo">
      <div className="divide-y overflow-hidden rounded-xl border bg-white">
        {options.map((o) => (
          <div key={o.key}>
            <button
              type="button"
              onClick={() => {
                onSource(source === o.key ? null : o.key);
                if (o.key === "computer") fileRef.current?.click();
              }}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-gray-50"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-chip">
                <o.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-sm font-medium">{o.title}</b>
                <span className="block text-xs text-muted-foreground">{o.description}</span>
              </span>
              <ChevronRight className={cn("size-4 text-muted-foreground transition", source === o.key && "rotate-90")} />
            </button>
            {source === "library" && o.key === "library" ? (
              <div className="max-h-56 divide-y overflow-y-auto border-t bg-gray-50">
                {library.length === 0 ? (
                  <p className="px-3.5 py-3 text-[13px] text-muted-foreground">A Biblioteca ainda está vazia.</p>
                ) : (
                  library.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onPick(v.id)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white"
                    >
                      <Film className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">{v.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {clock(v.duration_seconds)} · {providerLabel(v.provider)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
            {(source === "platform" && o.key === "platform") || (source === "link" && o.key === "link") ? (
              <div className="grid gap-3 border-t bg-gray-50 p-3.5">
                {o.key === "platform" ? (
                  <Seg
                    small
                    value={platform}
                    onChange={setPlatform}
                    options={[
                      { value: "vimeo", label: "Vimeo" },
                      { value: "panda", label: "Panda" },
                      { value: "bunny", label: "Bunny" },
                    ]}
                  />
                ) : null}
                <Field label="Nome">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como aparece na Biblioteca" />
                </Field>
                <Field label={o.key === "platform" ? "Link do vídeo" : "Endereço do vídeo"}>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
                </Field>
                <Button
                  variant="dark"
                  size="sm"
                  className="justify-self-start"
                  disabled={saving || !/^https?:\/\/.+/i.test(url.trim())}
                  onClick={() => void submit(o.key === "platform" ? platform : "hls")}
                >
                  {saving ? <Loader2 className="animate-spin" /> : null}
                  Usar este vídeo
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.start(file);
          e.target.value = "";
        }}
      />
      {upload.state && p && p.status !== "done" ? (
        <div className="grid gap-2.5 rounded-xl border bg-white p-3.5">
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
        Ao gerar os comentários, o sistema transcreve a fala e analisa o vídeo. Leva uns minutos.
      </p>
      {onCancel ? (
        <Button variant="ghost" size="sm" className="justify-self-start" onClick={onCancel}>
          Cancelar
        </Button>
      ) : null}
    </Section>
  );
}
