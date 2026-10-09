import { useCallback, useState } from "react";

/**
 * «Poupar dados» na sala: liga-se sozinho com a poupança de dados do telemóvel ou numa rede lenta
 * (2G/3G); a escolha da pessoa no ⚙ > Qualidade fica neste browser e manda sobre a rede.
 * Com ele ligado: no HLS, no máximo 360p e pouco vídeo guardado à frente; antes do toque, o vídeo
 * não descarrega (fica a capa ou o primeiro fotograma por trás do botão).
 */
const KEY = "cw:poupar";

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

/** A escolha guardada («1» ligado, «0» desligado) ou, sem escolha, o que a rede pede. */
export function dataSaverDefault(saved: string | null, connection: Connection | null | undefined) {
  return saved === "1" ? true : saved === "0" ? false : slowConnection(connection);
}

export function useDataSaver(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    if (typeof window === "undefined") return false;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(KEY);
    } catch {
      /* sem armazenamento: segue a rede */
    }
    return dataSaverDefault(saved, (navigator as Navigator & { connection?: Connection }).connection);
  });
  const choose = useCallback((next: boolean) => {
    setOn(next);
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* fica só nesta visita */
    }
  }, []);
  return [on, choose];
}
