import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CalendarDays } from "@/components/page-primitives";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { useWebinars, useWorkspace } from "@/lib/data";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendário | NovaWebinar" },
      { name: "description", content: "Agenda de webinars e sessões." },
      { property: "og:title", content: "Calendário | NovaWebinar" },
      { property: "og:description", content: "Organize a agenda de webinars." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { data: workspace } = useWorkspace();
  const { data: webinars = [], isLoading } = useWebinars(workspace?.organizationId);
  const [cursor, setCursor] = useState<Date | null>(null);
  useEffect(() => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  if (!cursor)
    return (
      <AppShell title="Calendário" description="Planeie as próximas sessões e replays.">
        <PageSkeleton variant="calendar" />
      </AppShell>
    );

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 },
    (_, i) => i - firstWeekday + 1,
  );

  const eventsByDay = new Map<number, typeof webinars>();
  for (const w of webinars) {
    if (!w.scheduled_at) continue;
    const date = new Date(w.scheduled_at);
    if (date.getFullYear() !== year || date.getMonth() !== month) continue;
    const day = date.getDate();
    eventsByDay.set(day, [...(eventsByDay.get(day) ?? []), w]);
  }

  if (isLoading)
    return (
      <AppShell title="Calendário" description="Planeie as próximas sessões e replays.">
        <PageSkeleton variant="calendar" />
      </AppShell>
    );

  return (
    <AppShell title="Calendário" description="Planeie as próximas sessões e replays.">
      <div className="rounded-lg border bg-card p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="text-primary" />
            <h2 className="font-semibold capitalize">
              {cursor.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
            </h2>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Mês anterior"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Mês seguinte"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="hidden grid-cols-7 border-l border-t sm:grid">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <div
              key={d}
              className="border-b border-r bg-muted/50 p-2 text-xs font-medium text-muted-foreground"
            >
              {d}
            </div>
          ))}
          {cells.map((day, i) => (
            <div key={i} className="min-h-28 border-b border-r p-2 text-sm">
              <span className="text-muted-foreground">
                {day > 0 && day <= daysInMonth ? day : ""}
              </span>
              {(eventsByDay.get(day) ?? []).map((w) => (
                <Link
                  key={w.id}
                  to="/webinars/$webinarId/edit"
                  params={{ webinarId: w.id }}
                  className="mt-2 block truncate rounded-md bg-primary p-2 text-xs text-primary-foreground"
                >
                  {new Date(w.scheduled_at ?? 0).toLocaleTimeString("pt-PT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {w.public_title}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="divide-y sm:hidden">
          {Array.from(eventsByDay.entries())
            .sort(([a], [b]) => a - b)
            .map(([day, events]) => (
              <section key={day} className="grid grid-cols-[2.5rem_1fr] gap-3 py-4 first:pt-0">
                <div>
                  <span className="block text-xl font-semibold">{day}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">dia</span>
                </div>
                <div className="space-y-2">
                  {events.map((w) => (
                    <Link
                      key={w.id}
                      to="/webinars/$webinarId/edit"
                      params={{ webinarId: w.id }}
                      className="block rounded-md border bg-background p-3"
                    >
                      <span className="text-xs font-medium text-primary">
                        {new Date(w.scheduled_at ?? 0).toLocaleTimeString("pt-PT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="mt-1 block text-sm font-medium">{w.public_title}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          {eventsByDay.size === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum webinar agendado neste mês.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
