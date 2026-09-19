import { useEffect, useState } from "react";

/**
 * Campo de duração/momento em três caixas (horas, minutos, segundos).
 * Guarda sempre o total em segundos como texto; "" significa vazio.
 */
export function HmsInput({
  value,
  onChange,
  allowEmpty = false,
}: {
  value: string;
  onChange: (seconds: string) => void;
  /** Quando verdadeiro, deixar tudo vazio mantém o campo sem valor. */
  allowEmpty?: boolean;
}) {
  const total = value === "" ? null : Math.max(0, Number(value) || 0);
  const [parts, setParts] = useState<[string, string, string]>(() => split(total));

  // Sincroniza quando o valor muda por fora (ex.: dados carregados da base de dados).
  useEffect(() => {
    setParts(split(total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function split(t: number | null): [string, string, string] {
    if (t === null) return ["", "", ""];
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return [String(h), String(m), String(s)];
  }

  function update(index: 0 | 1 | 2, raw: string) {
    const cleaned = raw.replace(/[^0-9]/g, "").slice(0, index === 0 ? 3 : 2);
    const next: [string, string, string] = [...parts] as [string, string, string];
    next[index] = cleaned;
    setParts(next);
    if (allowEmpty && next.every((p) => p === "")) {
      onChange("");
      return;
    }
    const h = Number(next[0]) || 0;
    const m = Math.min(59, Number(next[1]) || 0);
    const s = Math.min(59, Number(next[2]) || 0);
    onChange(String(h * 3600 + m * 60 + s));
  }

  const boxes: { label: string }[] = [{ label: "h" }, { label: "m" }, { label: "s" }];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {boxes.map((box, index) => (
        <div key={box.label} className="relative">
          <input
            inputMode="numeric"
            className="h-10 w-14 rounded-md border bg-background pr-5 text-center text-sm font-medium tabular-nums outline-none focus:ring-2 focus:ring-ring sm:w-16 sm:pr-6"
            placeholder="00"
            value={parts[index] ?? ""}
            onChange={(e) => update(index as 0 | 1 | 2, e.target.value)}
            aria-label={index === 0 ? "Horas" : index === 1 ? "Minutos" : "Segundos"}
          />
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
            {box.label}
          </span>
        </div>
      ))}
    </div>
  );
}
