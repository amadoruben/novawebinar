import { cn } from "@/lib/utils";

/*
 * Imagem de marca da referência: esferas 3D brilhantes em Laranja live
 * (convertewebinar-design/assets/imagery/spheres.png, recriada em CSS porque o
 * recorte original é de baixa resolução). Decorativa: por trás de um painel
 * de vidro (liquid gray), nunca como fundo de texto.
 */

// [x%, y%, tamanho em % da largura] — composição fixa, em cacho diagonal.
const SPHERES: [number, number, number][] = [
  [58, 6, 17], [72, 14, 19], [44, 18, 15], [62, 28, 21], [80, 34, 16], [48, 36, 18],
  [34, 44, 14], [66, 48, 17], [54, 58, 15], [40, 62, 12], [76, 60, 12], [88, 20, 10],
  [26, 58, 9], [30, 30, 8], [86, 50, 8], [20, 72, 6], [64, 72, 9], [48, 78, 7],
  [14, 50, 5], [92, 70, 5], [36, 84, 5], [22, 36, 4], [74, 84, 4], [10, 66, 3],
];

export function Spheres({ className }: { className?: string | undefined }) {
  return (
    <div aria-hidden className={cn("pointer-events-none relative", className)}>
      {SPHERES.map(([x, y, size], i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${size}%`,
            aspectRatio: "1",
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle at 32% 28%, var(--accent-100) 0%, var(--accent-300) 18%, var(--accent) 48%, var(--accent-700) 82%, var(--accent-deep) 100%)",
            boxShadow: "0 10px 24px -12px rgba(138,38,4,.55)",
          }}
        />
      ))}
    </div>
  );
}
