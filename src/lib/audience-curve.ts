/**
 * Curva de audiência "inteligente": sobe depressa no arranque, estabiliza
 * perto do máximo durante o miolo da sessão e desce suavemente no final,
 * nunca saindo do intervalo mínimo/máximo definido pelo utilizador.
 */
export function buildAudienceCurve(min: number, max: number, points = 24): number[] {
  const lo = Math.max(0, Math.round(min));
  const hi = Math.max(lo, Math.round(max));
  const span = hi - lo;

  return Array.from({ length: points }, (_, i) => {
    const t = points === 1 ? 1 : i / (points - 1);
    let base: number;

    if (t < 0.32) {
      // subida acelerada
      const p = t / 0.32;
      base = lo + span * (1 - Math.pow(1 - p, 2)) * 0.94;
    } else if (t < 0.68) {
      // estagnação perto do pico, com micro-oscilação
      const p = (t - 0.32) / 0.36;
      base = lo + span * (0.94 + 0.06 * Math.sin(p * Math.PI));
    } else {
      // descida suave até cerca de 55% do intervalo
      const p = (t - 0.68) / 0.32;
      base = lo + span * (1 - 0.45 * Math.pow(p, 1.6));
    }

    // pequena variação natural, determinística
    const jitter = span * 0.012 * Math.sin(i * 2.399);
    return Math.min(hi, Math.max(lo, Math.round(base + jitter)));
  });
}

export function curveBounds(curve: unknown): { min: number; max: number } | null {
  if (!Array.isArray(curve) || curve.length === 0) return null;
  const values = curve.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}
