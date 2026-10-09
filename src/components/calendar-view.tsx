/**
 * Peças da página Agenda, alimentadas por props (a página junta os dados): o mês com
 * os dias de cada webinar, as sugestões de dia e hora e a lista dos webinars.
 */
import { Link } from "@tanstack/react-router";
import { CalendarClock, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  MIN_PEOPLE_PER_SLOT,
  MIN_SLOTS,
  slotLabel,
  type DayEntry,
  type Slot,
  type Suggestions,
} from "@/lib/agenda";
import { cn } from "@/lib/utils";

const WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const pct = (value: number) => `${Math.round(value * 100)}%`;
const time = (e: DayEntry) =>
  new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: e.timezone,
  }).format(new Date(e.startMs));

function Card({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
  className,
}: {
  icon: typeof TrendingUp;
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section
      className={cn("flex min-w-0 flex-col gap-4 rounded-card bg-card p-4 sm:p-5", className)}
    >
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700">
          <Icon className="size-5" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          {subtitle && <p className="text-[13px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** O mês: grelha com as sessões (computador e tablet), pontos e lista por dia (telemóvel). */
export function AgendaMonth({
  year,
  month,
  today,
  entries,
  nowMs,
  onMove,
}: {
  year: number;
  /** 1–12. */
  month: number;
  /** O dia de hoje neste mês, ou null quando o mês mostrado é outro. */
  today: number | null;
  entries: Map<number, DayEntry[]>;
  nowMs: number;
  onMove: (step: -1 | 0 | 1) => void;
}) {
  const first = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const last = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + last) / 7) * 7 }, (_, i) => i - first + 1);
  const label = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
  const title = label.charAt(0).toUpperCase() + label.slice(1);
  const days = [...entries.keys()].sort((a, b) => a - b);

  const chip = (e: DayEntry, compact: boolean) => (
    <Link
      key={`${e.webinarId}:${e.startMs}`}
      to="/webinars/$webinarId/edit"
      params={{ webinarId: e.webinarId }}
      search={{ step: "agenda" }}
      title={`${time(e)} · ${e.title}`}
      className={cn(
        "block rounded-sm font-medium transition-colors",
        compact ? "mt-1 px-1.5 py-1 text-[12px] leading-tight" : "truncate px-3 py-2.5 text-sm",
        e.startMs < nowMs
          ? "bg-chip text-muted-foreground hover:bg-gray-200"
          : "bg-accent text-accent-700 hover:bg-accent/70",
      )}
    >
      {/* Na grelha a hora vai por cima: o título fica com a largura toda da célula. */}
      {compact ? (
        <>
          <span className="block font-semibold tabular-nums">{time(e)}</span>
          <span className="block truncate font-normal">{e.title}</span>
        </>
      ) : (
        <>
          <span className="tabular-nums">{time(e)}</span> · {e.title}
        </>
      )}
    </Link>
  );

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-card bg-card p-4 sm:p-5">
      <header className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 text-lg font-semibold tracking-[-0.02em]">{title}</h2>
        {today === null && (
          <Button variant="outline" className="h-10" onClick={() => onMove(0)}>
            Hoje
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Mês anterior"
          onClick={() => onMove(-1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Mês seguinte"
          onClick={() => onMove(1)}
        >
          <ChevronRight />
        </Button>
      </header>

      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-hairline">
        {WEEK.map((d) => (
          <div
            key={d}
            className="border-b border-hairline bg-gray-100 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const inMonth = day > 0 && day <= last;
          const list = inMonth ? (entries.get(day) ?? []) : [];
          return (
            <div
              key={i}
              className={cn(
                "min-h-12 border-hairline p-1 sm:min-h-28 sm:p-1.5",
                i % 7 !== 6 && "border-r",
                i < cells.length - 7 && "border-b",
                !inMonth && "bg-gray-100/60",
              )}
            >
              {inMonth && (
                <span
                  className={cn(
                    "mx-auto flex size-7 items-center justify-center rounded-full text-[13px] tabular-nums sm:mx-0",
                    day === today ? "bg-primary font-semibold text-white" : "text-foreground",
                  )}
                >
                  {day}
                </span>
              )}
              {/* Telemóvel: um ponto por dia com sessões; a lista vem por baixo. */}
              {list.length > 0 && (
                <span
                  className={cn(
                    "mx-auto mt-1 block size-1.5 rounded-full sm:hidden",
                    list.some((e) => e.startMs >= nowMs) ? "bg-brand" : "bg-gray-500",
                  )}
                  aria-hidden
                />
              )}
              <div className="hidden sm:block">{list.slice(0, 3).map((e) => chip(e, true))}</div>
              {list.length > 3 && (
                <p className="mt-1 hidden px-1.5 text-xs text-muted-foreground sm:block">
                  +{list.length - 3}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 sm:hidden">
        {days.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum webinar neste mês.
          </p>
        ) : (
          days.map((day) => (
            <div key={day} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3">
              <div className="pt-1 text-center">
                <span className="block text-xl leading-none font-semibold tabular-nums">{day}</span>
                <span className="text-xs text-muted-foreground">
                  {WEEK[(new Date(year, month - 1, day).getDay() + 6) % 7]}
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                {entries.get(day)!.map((e) => chip(e, false))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function SlotRow({ slot, rank, bySales }: { slot: Slot; rank: number; bySales: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg px-3.5 py-3",
        rank === 0 ? "bg-accent" : "bg-gray-100",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums",
          rank === 0 ? "bg-accent-strong text-white" : "bg-white text-foreground",
        )}
      >
        {rank + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{slotLabel(slot)}</p>
        <p className="truncate text-[12px] text-muted-foreground">
          {bySales
            ? `${pct(slot.attendance)} assistem`
            : `${slot.sessions} ${slot.sessions === 1 ? "sessão" : "sessões"}`}{" "}
          · {slot.people} inscritos
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "text-lg leading-none font-semibold tabular-nums",
            rank === 0 && "text-accent-700",
          )}
        >
          {pct(bySales ? slot.sales : slot.attendance)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {bySales ? "compram" : "assistem"}
        </p>
      </div>
    </li>
  );
}

/**
 * Melhores dias e horas de cada webinar (só se comparam horários do mesmo webinar), ou,
 * sem nenhum pronto, quanto falta ao que está mais perto.
 */
export function AgendaSuggestions({
  suggestions,
  titleOf,
}: {
  suggestions: Suggestions[] | null;
  titleOf: (webinarId: string) => string;
}) {
  const ready = suggestions?.filter((s) => s.ready) ?? [];
  const closest = suggestions?.[0];
  const waiting = closest && !closest.ready ? closest : null;
  return (
    <Card
      icon={TrendingUp}
      title="Melhores dias e horas"
      subtitle="Pelas vendas e presenças reais."
    >
      {!suggestions ? (
        <div className="h-28 animate-pulse rounded-lg bg-chip" />
      ) : ready.length > 0 ? (
        ready.slice(0, 3).map((s) => (
          <div key={s.webinarId} className="flex flex-col gap-2">
            <h3 className="truncate text-[13px] font-medium text-muted-foreground">
              {titleOf(s.webinarId)}
            </h3>
            <ol className="flex flex-col gap-2">
              {s.best.slice(0, 3).map((slot, i) => (
                <SlotRow key={slot.key} slot={slot} rank={i} bySales={s.bySales} />
              ))}
            </ol>
            {!s.bySales && (
              <p className="text-[12px] text-muted-foreground">
                Ainda sem vendas: ordenado pela presença ao vivo.
              </p>
            )}
          </div>
        ))
      ) : (
        <div className="flex flex-col gap-3">
          <p className="rounded-lg bg-gray-100 px-3.5 py-3 text-[14px]">
            {waiting && (
              <span className="mb-0.5 block truncate text-[13px] text-muted-foreground">
                {titleOf(waiting.webinarId)}
              </span>
            )}
            <span className="font-semibold">
              {(waiting?.missingSlots ?? MIN_SLOTS) === 1
                ? "Falta 1 horário"
                : `Faltam ${waiting?.missingSlots ?? MIN_SLOTS} horários`}
            </span>{" "}
            <span className="text-muted-foreground">
              com {MIN_PEOPLE_PER_SLOT} inscritos para comparar.
            </span>
          </p>
          {!waiting ? (
            <p className="text-[13px] text-muted-foreground">
              Os números aparecem um dia depois da primeira sessão com inscritos.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {waiting.slots.slice(0, 4).map((slot) => {
                const done = slot.people >= MIN_PEOPLE_PER_SLOT;
                return (
                  <li key={slot.key}>
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="truncate font-medium">{slotLabel(slot)}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {done
                          ? `${slot.people} inscritos`
                          : `faltam ${MIN_PEOPLE_PER_SLOT - slot.people}`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-gray-150">
                      <div
                        className={cn("h-full rounded-full", done ? "bg-success" : "bg-brand")}
                        style={{
                          width: `${Math.min(100, (slot.people / MIN_PEOPLE_PER_SLOT) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

export type AgendaWebinarRow = {
  id: string;
  title: string;
  /** «Seg e Qua às 20:00», «A cada 15 min»… */
  when: string;
  state: string;
  tone: "live" | "next" | "muted";
};

/** Todos os webinars e quando acontecem. */
export function AgendaWebinars({ rows }: { rows: AgendaWebinarRow[] | null }) {
  return (
    <Card
      icon={CalendarClock}
      title="Os seus webinars"
      subtitle={rows?.length ? `${rows.length} no total` : undefined}
    >
      {!rows ? (
        <div className="h-28 animate-pulse rounded-lg bg-chip" />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-[13px] text-muted-foreground">Ainda não criou nenhum webinar.</p>
          <Button asChild size="lg">
            <Link to="/webinars/new">Criar webinar</Link>
          </Button>
        </div>
      ) : (
        <ul className="-mx-1.5 flex flex-col">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to="/webinars/$webinarId/edit"
                params={{ webinarId: r.id }}
                search={{ step: "agenda" }}
                className="flex min-h-14 items-center gap-3 rounded-md px-1.5 py-2 transition-colors hover:bg-[var(--hover-ghost)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{r.title}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{r.when}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-pill px-2.5 py-1 text-xs font-medium",
                    r.tone === "live" && "bg-live text-white",
                    r.tone === "next" && "bg-accent text-accent-700",
                    r.tone === "muted" && "bg-chip text-muted-foreground",
                  )}
                >
                  {r.state}
                </span>
                <ChevronRight className="size-4 shrink-0 text-gray-500" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * O mês à esquerda; sugestões e webinars à direita. No telemóvel e no tablet vêm antes
 * do mês: a lista dos dias pode ser longa e escondia as sugestões.
 */
export function AgendaPage({
  month,
  suggestions,
  webinars,
}: {
  month: ReactNode;
  suggestions: ReactNode;
  webinars: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">{month}</div>
      <div className="order-first grid min-w-0 content-start gap-3 md:grid-cols-2 xl:order-none xl:grid-cols-1">
        {suggestions}
        {webinars}
      </div>
    </div>
  );
}
