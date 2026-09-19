/**
 * Escolha do ficheiro de áudio/vídeo enviado ao motor de transcrição.
 *
 * Regra fundamental: o 00:00.000 do que é transcrito tem de ser exactamente o
 * 00:00.000 do que o participante vê. Por isso nunca cortamos silêncio nem
 * introduções; quando a origem temporal for diferente, guardamos o desvio em
 * `offsetMs` para normalizar todos os tempos antes de criar frases, momentos,
 * eventos ou comentários.
 */

export type MediaForTranscription = {
  url: string;
  /** Diferença entre o 00:00 do ficheiro enviado e o 00:00 da timeline. */
  offsetMs: number;
  source: string;
};

/** Playlists HLS não são aceites pelo motor: usamos a versão directa do mesmo vídeo. */
export function mediaForTranscription(url: string): MediaForTranscription {
  const clean = url.split("?")[0] ?? url;
  if (clean.endsWith(".m3u8")) {
    const base = clean.replace(/\/[^/]+\.m3u8$/, "");
    return { url: `${base}/play_720p.mp4`, offsetMs: 0, source: "hls-direct-mp4" };
  }
  return { url, offsetMs: 0, source: "direct" };
}

/** Alternativas pela mesma origem temporal, por ordem de preferência. */
export function mediaFallbacks(url: string): string[] {
  const primary = mediaForTranscription(url);
  if (primary.source !== "hls-direct-mp4") return [primary.url];
  const base = primary.url.replace(/\/play_\d+p\.mp4$/, "");
  return [
    `${base}/play_720p.mp4`,
    `${base}/play_480p.mp4`,
    `${base}/play_360p.mp4`,
    `${base}/original`,
  ];
}
