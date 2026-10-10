import { useState } from "react";

/**
 * «Poupar dados» na sala, sempre automático (sem escolha no ⚙): liga-se sozinho com a poupança de
 * dados do telemóvel ou numa rede lenta (2G/3G). Com ele ligado: no HLS, no máximo 360p e pouco vídeo
 * guardado à frente; antes do toque, o vídeo não descarrega (fica a capa ou o primeiro fotograma por
 * trás do botão).
 */

type Connection = { saveData?: boolean | undefined; effectiveType?: string | undefined };

/** A rede pede poupança: «Poupança de dados» ligada ou ligação 2G/3G. */
export function slowConnection(connection: Connection | null | undefined) {
  return Boolean(connection?.saveData) || ["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "");
}

/**
 * A qualidade mais alta até `maxHeight` (as do HLS vêm da mais leve para a mais pesada). Sem
 * nenhuma tão baixa, a mais leve; -1 sem qualidades (fica a automática).
 */
export function levelCap(levels: readonly { height?: number | undefined }[], maxHeight = 360) {
  let cap = -1;
  levels.forEach((level, index) => {
    if ((level.height ?? 0) <= maxHeight) cap = index;
  });
  return cap === -1 && levels.length > 0 ? 0 : cap;
}

/** Lido uma vez à entrada: a rede pede poupança? */
export function useDataSaver() {
  const [on] = useState(
    () => typeof navigator !== "undefined" && slowConnection((navigator as Navigator & { connection?: Connection }).connection),
  );
  return on;
}
