import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** A imagem de um vídeo a partir do link: YouTube e Bunny têm miniatura própria. */
export function posterFromUrl(url: string | null | undefined) {
  if (!url) return null;
  const youtube = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (youtube) return `https://i.ytimg.com/vi/${youtube[1]}/hqdefault.jpg`;
  const bunny = url.match(/(?:iframe|video)\.mediadelivery\.net\/(?:embed|play)\/(\d+)\/([\w-]+)/);
  if (bunny) return `https://vz-${bunny[1]}.b-cdn.net/${bunny[2]}/thumbnail.jpg`;
  const bunnyCdn = url.match(/^(https:\/\/[^/]*\.b-cdn\.net\/[0-9a-f-]+)\//i);
  if (bunnyCdn) return `${bunnyCdn[1]}/thumbnail.jpg`;
  return null;
}

/**
 * A miniatura de um vídeo: a imagem guardada, a da plataforma, ou um fotograma do próprio
 * ficheiro (aos 2 segundos, ou no segundo pedido). Sem nada disso, um ícone.
 */
export function VideoThumb({
  name,
  thumbnailUrl,
  sourceUrl,
  className,
  overlay = true,
  at = 2,
}: {
  name: string;
  thumbnailUrl: string | null | undefined;
  sourceUrl: string | null | undefined;
  className?: string | undefined;
  overlay?: boolean | undefined;
  /** O segundo do fotograma usado como capa, quando não há imagem (por omissão, aos 2 s). */
  at?: number | undefined;
}) {
  const [failed, setFailed] = useState(false);
  const poster = thumbnailUrl || posterFromUrl(sourceUrl);
  const isFile = !!sourceUrl && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(sourceUrl);

  return (
    <div className={cn("relative flex aspect-video items-center justify-center overflow-hidden bg-[#141414] text-white", className)}>
      {poster && !failed ? (
        <img src={poster} alt={name} loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : isFile && !failed ? (
        <video
          src={`${sourceUrl}#t=${Math.max(1, Math.round(at))}`}
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Play className="size-8 fill-current opacity-70" />
      )}
      {overlay && (poster || isFile) && !failed ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 text-white">
          <Play className="size-7 fill-current" />
        </span>
      ) : null}
    </div>
  );
}
