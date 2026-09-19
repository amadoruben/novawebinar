/**
 * Cálculo do horário real de cada sessão.
 *
 * Um webinar pode arrancar de três maneiras:
 *  - data única: começa na data e hora marcadas;
 *  - just in time: recomeça de X em X minutos, para quem chega a qualquer hora;
 *  - repetição automática: uma vez por dia ou por semana, à hora definida.
 *
 * Tudo é calculado no fuso horário escolhido pelo organizador.
 */

export type ScheduleInput = {
  schedule_mode?: string | null;
  scheduled_at?: string | null;
  /** Hora de fim (HH:MM) para sessões de data única; vazio = fim pela duração do vídeo. */
  session_end_time?: string | null;
  recurrence_enabled?: boolean | null;
  recurrence_pattern?: string | null;
  recurrence_weekday?: number | null;
  recurrence_start_time?: string | null;
  recurrence_end_time?: string | null;
  jit_interval_minutes?: number | null;
  timezone?: string | null;
  duration_seconds?: number | null;
};

export type SessionWindow = {
  /** Início da sessão em curso ou da próxima, em milissegundos. */
  startMs: number | null;
  /** Fim previsto da sessão, em milissegundos. */
  endMs: number | null;
  /** Verdadeiro quando a sessão já arrancou. */
  live: boolean;
  /** Fim da última sessão já terminada, em milissegundos (repetição automática). */
  endedMs: number | null;
  /** Verdadeiro quando a sala de espera deve abrir: no dia da próxima sessão. */
  waitingOpen: boolean;
};

function parseTime(value?: string | null): { hour: number; minute: number } | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function safeZone(timezone?: string | null) {
  if (!timezone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

function zoneParts(ms: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(new Date(ms));
  const read = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")) % 24,
    minute: Number(read("minute")),
    second: Number(read("second")),
    weekday: Math.max(0, weekdays.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "Sun")),
  };
}

function zoneOffset(ms: number, timezone: string) {
  const p = zoneParts(ms, timezone);
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000
  );
}

/** Converte uma hora local (no fuso indicado) para o instante real em milissegundos. */
export function zonedTimeToMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let ms = guess - zoneOffset(guess, timezone);
  ms = guess - zoneOffset(ms, timezone);
  return ms;
}

/** Devolve a janela da sessão em curso, ou da próxima, para o momento indicado. */
export function sessionWindow(webinar: ScheduleInput, nowMs = Date.now()): SessionWindow {
  const timezone = safeZone(webinar.timezone);
  const duration = Math.max(0, webinar.duration_seconds ?? 0) * 1000;

  // Just in time: arranca de X em X minutos.
  if (webinar.schedule_mode === "jit") {
    const interval = Math.max(5, webinar.jit_interval_minutes ?? 15) * 60 * 1000;
    const slot = Math.floor(nowMs / interval) * interval;
    // Quem chega nos primeiros dois minutos apanha a sessão que acabou de arrancar.
    const startMs = nowMs - slot <= 2 * 60 * 1000 ? slot : slot + interval;
    return {
      startMs,
      endMs: duration ? startMs + duration : null,
      live: startMs <= nowMs,
      endedMs: null,
      waitingOpen: true,
    };
  }

  // Repetição automática: diária ou semanal, à hora definida.
  const start = parseTime(webinar.recurrence_start_time);
  if (webinar.recurrence_enabled && start) {
    const end = parseTime(webinar.recurrence_end_time);
    const weekly = webinar.recurrence_pattern === "weekly";
    const targetWeekday = Math.min(6, Math.max(0, webinar.recurrence_weekday ?? 1));
    const today = zoneParts(nowMs, timezone);
    let lastEndedMs: number | null = null;

    for (let step = -1; step <= 14; step += 1) {
      const base = new Date(Date.UTC(today.year, today.month - 1, today.day + step));
      const weekday = base.getUTCDay();
      if (weekly && weekday !== targetWeekday) continue;
      const startMs = zonedTimeToMs(
        base.getUTCFullYear(),
        base.getUTCMonth() + 1,
        base.getUTCDate(),
        start.hour,
        start.minute,
        timezone,
      );
      const endMs = end
        ? zonedTimeToMs(
            base.getUTCFullYear(),
            base.getUTCMonth() + 1,
            base.getUTCDate() +
              (end.hour * 60 + end.minute <= start.hour * 60 + start.minute ? 1 : 0),
            end.hour,
            end.minute,
            timezone,
          )
        : duration
          ? startMs + duration
          : null;
      // Sessão a decorrer agora. Sem hora de fim nem duração conhecida,
      // assumimos uma sessão de duas horas para a sala de espera voltar a abrir.
      const fallbackEnd = startMs + 2 * 60 * 60 * 1000;
      const effectiveEnd = endMs ?? fallbackEnd;
      if (startMs <= nowMs && nowMs < effectiveEnd)
        return { startMs, endMs, live: true, endedMs: null, waitingOpen: false };
      // Sessão já terminada: guardamos o fim para mostrar "Transmissão terminou"
      // até ao dia da sessão seguinte.
      if (effectiveEnd <= nowMs) {
        lastEndedMs = effectiveEnd;
        continue;
      }
      // Próxima sessão: a sala de espera só abre no próprio dia da sessão.
      const nextDay = zoneParts(startMs, timezone);
      const sameDay =
        nextDay.year === today.year && nextDay.month === today.month && nextDay.day === today.day;
      return { startMs, endMs, live: false, endedMs: lastEndedMs, waitingOpen: sameDay };
    }
  }

  // Data única.
  if (webinar.scheduled_at) {
    const startMs = new Date(webinar.scheduled_at).getTime();
    if (!Number.isNaN(startMs)) {
      let endMs: number | null = null;
      const end = parseTime(webinar.session_end_time);
      if (end) {
        const day = zoneParts(startMs, timezone);
        endMs = zonedTimeToMs(day.year, day.month, day.day, end.hour, end.minute, timezone);
        // Se a hora de fim for anterior à de início, a sessão termina no dia seguinte.
        if (endMs <= startMs) endMs += 24 * 60 * 60 * 1000;
      } else if (duration) {
        endMs = startMs + duration;
      }
      return { startMs, endMs, live: startMs <= nowMs, endedMs: null, waitingOpen: true };
    }
  }

  return { startMs: null, endMs: null, live: false, endedMs: null, waitingOpen: true };
}

export function formatSessionStart(ms: number, timezone?: string | null) {
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: safeZone(timezone),
  }).format(new Date(ms));
}
