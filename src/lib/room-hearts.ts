/**
 * Corações simulados na sala (como numa live a sério): de vez em quando sobe uma rajada. Saem do
 * segundo do vídeo e do webinar, por isso quem vê o mesmo segundo vê os mesmos (como os comentários
 * gerados). Sem pedidos ao servidor e fora das «Reacções» do Painel, que só contam os toques reais.
 */
import { useEffect, useRef, useState } from "react";

export type SimHeart = { id: string; at: number; offset: number; size: number };

/** Um número de 0 a 1 sempre igual para o mesmo texto (FNV-1a, baralhado no fim para segundos seguidos não darem números parecidos). */
function unit(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Os corações entre `from` (incluído) e `to` (excluído), em segundos do vídeo. Uma rajada a cada
 * ~30 s; com a oferta aberta (`strong`), uma a cada ~12 s e maior.
 */
export function heartsBetween(seed: string, from: number, to: number, strong: boolean): SimHeart[] {
  const out: SimHeart[] = [];
  const rate = strong ? 1 / 12 : 1 / 30;
  for (let s = Math.max(0, Math.floor(from) - 4); s < to; s++) {
    if (unit(`${seed}:${s}`) >= rate) continue;
    const count = (strong ? 3 : 2) + Math.floor(unit(`${seed}:${s}:n`) * (strong ? 5 : 4));
    for (let i = 0; i < count; i++) {
      const at = s + i * 0.35 + unit(`${seed}:${s}:${i}:t`) * 0.2;
      if (at < from || at >= to) continue;
      out.push({
        id: `sim-${s}-${i}`,
        at,
        offset: Math.round(unit(`${seed}:${s}:${i}:o`) * 60 - 30),
        size: 26 + Math.floor(unit(`${seed}:${s}:${i}:z`) * 7),
      });
    }
  }
  return out;
}

/**
 * Os corações simulados que estão a subir agora, para juntar aos reais no botão do coração. Num salto
 * (entrar a meio, avançar) só conta o último segundo: nunca uma enxurrada.
 */
export function useSimulatedHearts(seconds: number, seed: string, strong: boolean, on = true) {
  const [list, setList] = useState<SimHeart[]>([]);
  const prev = useRef<number | null>(null);
  const timers = useRef(new Set<number>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) window.clearTimeout(t);
    };
  }, []);
  useEffect(() => {
    const from = prev.current;
    prev.current = seconds;
    if (!on || from === null || seconds <= from) return;
    const due = heartsBetween(seed, seconds - from > 4 ? seconds - 1 : from, seconds, strong);
    due.forEach((heart, i) => {
      const later = (fn: () => void, ms: number) => {
        const t = window.setTimeout(() => {
          timers.current.delete(t);
          fn();
        }, ms);
        timers.current.add(t);
      };
      later(() => {
        // Recuar 1–5 s e voltar a passar pelo mesmo segundo repete o mesmo coração: uma só vez no ecrã (chave única).
        setList((p) => (p.some((h) => h.id === heart.id) ? p : [...p.slice(-24), heart]));
        later(() => setList((p) => p.filter((h) => h.id !== heart.id)), 2600);
      }, i * 220);
    });
  }, [seconds, seed, strong, on]);
  return list;
}
