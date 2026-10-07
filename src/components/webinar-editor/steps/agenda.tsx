import { useMemo } from "react";
import { CalendarDays, ChevronDown, Clock, Film, Play, Repeat, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Field, Note, Section, Seg, SwitchRow } from "../ui";
import type { EditorForm, FocusProps, SetForm } from "../form";

export type ScheduleKind = "single" | "repeat" | "jit" | "ondemand";

const ZONES: [string, [string, string][]][] = [
  [
    "África",
    [
      ["Africa/Luanda", "Angola · Luanda"],
      ["Africa/Maputo", "Moçambique · Maputo"],
      ["Atlantic/Cape_Verde", "Cabo Verde · Praia"],
      ["Africa/Bissau", "Guiné-Bissau · Bissau"],
      ["Africa/Sao_Tome", "São Tomé e Príncipe · São Tomé"],
      ["Africa/Lagos", "Nigéria · Lagos"],
      ["Africa/Johannesburg", "África do Sul · Joanesburgo"],
      ["Africa/Nairobi", "Quénia · Nairobi"],
      ["Africa/Cairo", "Egipto · Cairo"],
      ["Africa/Casablanca", "Marrocos · Casablanca"],
    ],
  ],
  [
    "Europa",
    [
      ["Europe/Lisbon", "Portugal · Lisboa"],
      ["Atlantic/Azores", "Portugal · Açores"],
      ["Europe/Madrid", "Espanha · Madrid"],
      ["Europe/Paris", "França · Paris"],
      ["Europe/London", "Reino Unido · Londres"],
      ["Europe/Berlin", "Alemanha · Berlim"],
      ["Europe/Rome", "Itália · Roma"],
      ["Europe/Zurich", "Suíça · Zurique"],
    ],
  ],
  [
    "América do Sul",
    [
      ["America/Sao_Paulo", "Brasil · São Paulo"],
      ["America/Manaus", "Brasil · Manaus"],
      ["America/Argentina/Buenos_Aires", "Argentina · Buenos Aires"],
      ["America/Bogota", "Colômbia · Bogotá"],
      ["America/Santiago", "Chile · Santiago"],
      ["America/Lima", "Peru · Lima"],
    ],
  ],
  [
    "América do Norte",
    [
      ["America/New_York", "Estados Unidos · Nova Iorque"],
      ["America/Chicago", "Estados Unidos · Chicago"],
      ["America/Denver", "Estados Unidos · Denver"],
      ["America/Los_Angeles", "Estados Unidos · Los Angeles"],
      ["America/Toronto", "Canadá · Toronto"],
      ["America/Mexico_City", "México · Cidade do México"],
    ],
  ],
  [
    "Ásia e Oceânia",
    [
      ["Asia/Dili", "Timor-Leste · Díli"],
      ["Asia/Macau", "Macau"],
      ["Asia/Dubai", "Emirados Árabes · Dubai"],
      ["Asia/Kolkata", "Índia · Calcutá"],
      ["Asia/Tokyo", "Japão · Tóquio"],
      ["Australia/Sydney", "Austrália · Sydney"],
    ],
  ],
  ["Geral", [["UTC", "UTC · tempo universal"]]],
];

function offsetLabel(zone: string) {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return part === "GMT" ? "GMT+0" : (part ?? "");
  } catch {
    return "";
  }
}

const DAYS: [number, string, string][] = [
  [1, "Seg", "Segunda-feira"],
  [2, "Ter", "Terça-feira"],
  [3, "Qua", "Quarta-feira"],
  [4, "Qui", "Quinta-feira"],
  [5, "Sex", "Sexta-feira"],
  [6, "Sáb", "Sábado"],
  [0, "Dom", "Domingo"],
];

/** Agenda: quando a sessão acontece. */
export function StepAgenda({
  form,
  set,
  focus,
  kind,
  onKind,
  nextSession,
  ended,
}: {
  form: EditorForm;
  set: SetForm;
  focus: FocusProps;
  kind: ScheduleKind;
  onKind: (kind: ScheduleKind) => void;
  /** «Sexta-feira, 2 de outubro, às 17:20» ou null. */
  nextSession: string | null;
  /** «02/10» quando a data única já passou. */
  ended: string | null;
}) {
  const [date = "", time = ""] = form.scheduled_at.split("T");
  const zones = useMemo(
    () => ZONES.map(([group, list]) => [group, list.map(([id, name]) => [id, `${name} (${offsetLabel(id)})`])] as const),
    [],
  );
  const known = ZONES.some(([, list]) => list.some(([id]) => id === form.timezone));
  const zoneSelect = (
    <Field label="Fuso horário">
      <div className="relative">
        <select
          value={form.timezone}
          onChange={(e) => set({ timezone: e.target.value })}
          aria-label="Fuso horário"
          className="h-9 w-full appearance-none rounded-sm bg-white pl-3 pr-9 text-sm shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)] outline-none focus:shadow-[inset_0_0_0_1px_var(--foreground)]"
        >
          {!known ? <option value={form.timezone}>{form.timezone}</option> : null}
          {zones.map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </Field>
  );
  const kinds: { value: ScheduleKind; icon: typeof CalendarDays; title: string; text: string }[] = [
    { value: "single", icon: CalendarDays, title: "Uma data", text: "Uma sessão, num dia e hora." },
    { value: "repeat", icon: Repeat, title: "Repetir", text: "Nos dias e horas que escolher." },
    { value: "jit", icon: Clock, title: "Just in time", text: "Começa a cada 15, 30 ou 60 min." },
    { value: "ondemand", icon: Play, title: "Sempre disponível", text: "Começa quando a pessoa entra." },
  ];
  const when =
    kind === "jit"
      ? `Sessões a cada ${form.jit_interval_minutes} minutos`
      : kind === "ondemand"
        ? "Começa quando a pessoa entra"
        : nextSession;

  return (
    <>
      <Section icon={CalendarDays} title="O que está a programar" help="agenda">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="O que está a programar">
          {kinds.map((k) => (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={kind === k.value}
              onClick={() => onKind(k.value)}
              className={cn(
                "grid content-start gap-1 rounded-xl border bg-white p-3 text-left hover:bg-gray-50",
                kind === k.value && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
              )}
            >
              <k.icon className="size-4" />
              <b className="mt-1.5 text-sm font-semibold">{k.title}</b>
              <span className="text-[12.5px] leading-snug text-muted-foreground">{k.text}</span>
            </button>
          ))}
        </div>
      </Section>

      {kind === "single" ? (
        <Section icon={Clock} title="Quando" help="agendaQuando">
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Data" required>
              <Input
                type="date"
                value={date}
                onChange={(e) => set({ scheduled_at: e.target.value ? `${e.target.value}T${time || "20:00"}` : "" })}
                {...focus("date")}
              />
            </Field>
            <Field label="Hora" required>
              <Input
                type="time"
                value={time}
                onChange={(e) => date && set({ scheduled_at: `${date}T${e.target.value || "20:00"}` })}
                disabled={!date}
              />
            </Field>
          </div>
          {zoneSelect}
          {ended ? <p className="text-[12.5px] text-warning">A sessão de {ended} já terminou. Escolha uma nova data.</p> : null}
        </Section>
      ) : kind === "repeat" ? (
        <Section icon={Clock} title="Quando" help="agendaQuando">
          <Field label="Dias">
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map(([n, short, full]) => {
                const on = form.recurrence_days.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={full}
                    aria-pressed={on}
                    onClick={() =>
                      set({
                        recurrence_days: on
                          ? form.recurrence_days.filter((d) => d !== n)
                          : [...form.recurrence_days, n].sort((a, b) => a - b),
                      })
                    }
                    className={cn(
                      "h-9 rounded-md border bg-white text-[12.5px] font-medium",
                      on && "border-foreground bg-foreground text-background",
                    )}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Horas" required>
            <div className="flex flex-wrap items-center gap-2">
              {form.recurrence_times.map((time, i) => (
                <span key={`${time}-${i}`} className="inline-flex h-9 items-center gap-1 rounded-md border bg-white pl-2 pr-1">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) =>
                      set({ recurrence_times: form.recurrence_times.map((t, j) => (j === i ? e.target.value || t : t)) })
                    }
                    className="w-[84px] bg-transparent text-sm outline-none"
                    aria-label={`Hora ${i + 1}`}
                    {...(i === 0 ? focus("date") : {})}
                  />
                  {form.recurrence_times.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => set({ recurrence_times: form.recurrence_times.filter((_, j) => j !== i) })}
                      aria-label="Tirar esta hora"
                      className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-[var(--ds-gray-alpha-200)]"
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ))}
              {form.recurrence_times.length < 6 ? (
                <button
                  type="button"
                  onClick={() => set({ recurrence_times: [...form.recurrence_times, "20:00"] })}
                  className="inline-flex h-9 items-center gap-1 rounded-md border border-dashed px-2.5 text-[13px] font-medium hover:bg-gray-50"
                >
                  + Hora
                </button>
              ) : null}
            </div>
          </Field>
          {form.recurrence_days.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">Sem dias escolhidos, repete todos os dias.</p>
          ) : null}
          {zoneSelect}
        </Section>
      ) : kind === "jit" ? (
        <Section icon={Clock} title="Intervalo" help="agendaIntervalo">
          <Seg
            small
            value={["15", "30", "60"].includes(form.jit_interval_minutes) ? form.jit_interval_minutes : "15"}
            onChange={(jit_interval_minutes) => set({ jit_interval_minutes })}
            options={[
              { value: "15", label: "15 min" },
              { value: "30", label: "30 min" },
              { value: "60", label: "1 hora" },
            ]}
          />
          <SwitchRow
            title="Sem sessões de noite"
            description="Entre as 22:00 e as 07:00, a próxima sessão é às 07:00."
            checked={form.jit_skip_night}
            onChange={(jit_skip_night) => set({ jit_skip_night })}
          />
          {zoneSelect}
        </Section>
      ) : (
        <Section>
          <Note icon={Play}>Não há hora marcada: o vídeo começa do início quando a pessoa entra.</Note>
        </Section>
      )}

      {when ? (
        <section className="pb-[18px]">
          <div className="flex items-center gap-3 rounded-xl bg-foreground p-3.5 text-background">
            <CalendarDays className="size-[18px] shrink-0" />
            <span className="min-w-0">
              <small className="block text-[12px] opacity-70">{kind === "ondemand" ? "Sessões" : "Próxima sessão"}</small>
              <b className="block text-sm font-semibold first-letter:uppercase">{when}</b>
            </span>
          </div>
        </section>
      ) : null}

      <Section title="Sessão" help="agendaSessao">
        {kind !== "ondemand" ? (
          <>
            <SwitchRow
              icon={CalendarDays}
              title="Sala de espera"
              description="Contagem decrescente antes da hora."
              checked={form.waiting_room_enabled}
              onChange={(waiting_room_enabled) => set({ waiting_room_enabled })}
            />
            <SwitchRow
              icon={Film}
              title="Vídeo sincronizado"
              description="Quem entra às 20:05 vê a partir do minuto 5."
              checked={form.sync_video_with_start}
              onChange={(sync_video_with_start) => set({ sync_video_with_start })}
            />
          </>
        ) : null}
        <SwitchRow
          icon={Video}
          title="Replay depois da sessão"
          description="O mesmo vídeo, para quem não viu ao vivo."
          checked={form.replay_enabled}
          onChange={(replay_enabled) => set({ replay_enabled })}
        />
      </Section>
    </>
  );
}
