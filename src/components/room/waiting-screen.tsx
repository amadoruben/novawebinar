import { useEffect, useState } from "react";
import { formatSessionStart } from "@/lib/schedule";
import { PreliveCountdown } from "@/components/prelive-countdown";

/**
 * A sala de espera, antes de a sala abrir: o mesmo relógio da contagem (estilo e cor escolhidos no
 * editor), a contar até à hora da sessão, sem som. Quando a sala abre (`opensMs`), a contagem segue lá dentro.
 */
export function WaitingScreen({
  title,
  startMs,
  opensMs,
  timezone,
  themeClass,
  style,
  color,
  onZero,
  highlight,
}: {
  title: string;
  /** A hora da sessão. */
  startMs: number;
  /** A hora a que a sala abre (a contagem antes de começar abre-a uns minutos antes). */
  opensMs: number;
  timezone?: string | null;
  themeClass?: string;
  style: string;
  color: string;
  onZero: () => void;
  /** No editor: realça a data enquanto se escolhe na Agenda. */
  highlight?: boolean | undefined;
}) {
  const [now, setNow] = useState(() => Date.now());
  // O anel e a barra enchem desde que a pessoa chegou.
  const [total] = useState(() => Math.max(1, Math.floor((startMs - Date.now()) / 1000)));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = Math.max(0, Math.floor((startMs - now) / 1000));
  const opened = now >= opensMs;
  useEffect(() => {
    if (opened) onZero();
  }, [opened, onZero]);

  return (
    <main className={`room-ambient flex min-h-dvh items-center justify-center px-4 py-10 ${themeClass ?? ""}`}>
      <div className="w-full max-w-2xl text-center text-room-text">
        <h1 className="text-2xl font-black leading-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-room-subtle">
          <span
            className={
              highlight
                ? "rounded-sm outline outline-2 outline-offset-4 outline-[#E8440C]"
                : undefined
            }
          >
            Começa {formatSessionStart(startMs, timezone)}
          </span>
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-room-line">
          <PreliveCountdown
            remaining={remaining}
            total={total}
            message=""
            soundOn={false}
            soundEnabled={false}
            template={style}
            color={color}
            appearance={{ subtitle: "", showDays: remaining >= 86400, showHours: remaining >= 3600 }}
          />
        </div>
      </div>
    </main>
  );
}
