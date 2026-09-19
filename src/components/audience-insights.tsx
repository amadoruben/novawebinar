import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, Filter, MapPin, MonitorSmartphone, Users } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { useAudienceInsights } from "@/lib/audience-insights";
import type { DateRange } from "@/lib/date-range";
import { cn } from "@/lib/utils";

function Panel({
  title,
  icon: Icon,
  className,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border bg-card p-4 sm:p-5", className)}>
      <header className="mb-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </header>
      {children}
    </section>
  );
}

const nf = new Intl.NumberFormat("pt-PT");

export function AudienceInsights({
  organizationId,
  webinarId,
  range,
  className,
}: {
  organizationId?: string | undefined;
  webinarId?: string | undefined;
  range?: DateRange;
  className?: string | undefined;
}) {
  const { data } = useAudienceInsights(organizationId, webinarId, range);
  const funnel = data?.funnel ?? [];
  const top = funnel[0]?.value ?? 0;
  const devices = data?.devices ?? { mobile: 0, desktop: 0, unknown: 0 };
  const deviceTotal = devices.mobile + devices.desktop + devices.unknown;
  const deviceData = [
    { name: "Telemóvel", value: devices.mobile, color: "hsl(var(--primary))" },
    { name: "Computador", value: devices.desktop, color: "hsl(var(--muted-foreground))" },
    { name: "Sem registo", value: devices.unknown, color: "hsl(var(--muted))" },
  ].filter((slice) => slice.value > 0);
  const mobileShare = deviceTotal ? Math.round((devices.mobile / deviceTotal) * 100) : 0;
  const scheduledDates = (data?.scheduled ?? []).map((key) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y!, (m ?? 1) - 1, d ?? 1);
  });
  const regionTop = data?.regions?.[0]?.value ?? 0;

  return (
    <div className={cn("space-y-4", className)}>
      <Panel title="Funil de conversão" icon={Filter}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-x-3 gap-y-4">
          {funnel.map((step) => (
            <div key={step.label}>
              <p className="text-xs text-muted-foreground">{step.label}</p>
              <strong className="block text-xl font-semibold sm:text-2xl">{nf.format(step.value)}</strong>
              <span className="text-xs text-muted-foreground">{step.share.toFixed(2)}%</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-end gap-1">
          {funnel.map((step, index) => {
            const height = top ? Math.max(8, Math.round((step.value / top) * 100)) : 8;
            return (
              <div key={step.label} className="flex h-28 flex-1 items-end">
                <div
                  className="w-full rounded-md bg-primary transition-all"
                  style={{ height: `${height}%`, opacity: 0.45 + index * 0.12 }}
                />
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid min-w-0 gap-4 min-[1200px]:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <Panel title="Participantes por dia" icon={Users}>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.daily ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tick={{ fontSize: 11 }}
                />
                <YAxis width={40} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  formatter={(value: number) => [nf.format(value), "Participantes"]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Dispositivos" icon={MonitorSmartphone}>
          {deviceTotal === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda sem entradas registadas.</p>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_112px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_128px] sm:gap-4">
              <ul className="min-w-0 space-y-2 text-sm">
                {deviceData.map((slice) => (
                  <li key={slice.name} className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">{slice.name}</span>
                    <span className="shrink-0 text-muted-foreground">{nf.format(slice.value)}</span>
                  </li>
                ))}
              </ul>
              <div className="relative size-28 shrink-0 sm:size-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deviceData}
                      dataKey="value"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {deviceData.map((slice) => (
                        <Cell key={slice.name} fill={slice.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <strong className="text-base font-semibold">{mobileShare}%</strong>
                  <span className="text-[11px] text-muted-foreground">Telemóvel</span>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid min-w-0 gap-4 min-[1200px]:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <Panel title="Participantes por região" icon={MapPin}>
          {(data?.regions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda sem origens registadas.</p>
          ) : (
            <ul className="space-y-3">
              {data!.regions.map((region) => (
                <li key={region.label}>
                  <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-sm">
                    <span className="truncate">{region.label}</span>
                    <span className="shrink-0 text-muted-foreground">{nf.format(region.value)}</span>
                  </div>
                  <div className="h-2 rounded bg-muted">
                    <div
                      className="h-full rounded bg-primary"
                      style={{
                        width: `${regionTop ? Math.max(4, (region.value / regionTop) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Eventos agendados" icon={CalendarDays}>
          <Calendar
            mode="single"
            className="mx-auto w-full max-w-[360px] overflow-hidden rounded-lg bg-background p-3 [--cell-size:2.25rem] sm:[--cell-size:2.5rem]"
            classNames={{
              root: "w-full",
              month: "flex w-full flex-col gap-3",
              month_grid: "w-full border-collapse",
              weekdays: "grid grid-cols-7",
              weekday: "flex h-9 items-center justify-center text-xs text-muted-foreground",
              week: "mt-1 grid grid-cols-7",
              day: "flex h-9 w-full items-center justify-center p-0 text-center sm:h-10",
            }}
            modifiers={{ agendado: scheduledDates }}
            modifiersClassNames={{
              agendado: "bg-primary text-primary-foreground rounded-md font-semibold",
            }}
          />
        </Panel>
      </div>
    </div>
  );
}
