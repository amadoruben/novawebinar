import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { BarChart, ProgressRow } from "@/components/ds";
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
    <section className={cn("min-w-0 rounded-card bg-card p-5 sm:p-6", className)}>
      <header className="mb-5 flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold leading-6 tracking-[var(--tracking-title)]">{title}</h2>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-gray-700">
          <Icon className="size-4" />
        </span>
      </header>
      {children}
    </section>
  );
}

const nf = new Intl.NumberFormat("pt-PT");
const pf = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 });

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
    { name: "Telemóvel", value: devices.mobile, color: "var(--orange)" },
    { name: "Computador", value: devices.desktop, color: "var(--navy)" },
    { name: "Sem registo", value: devices.unknown, color: "var(--gray-250)" },
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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-x-3 gap-y-4">
          {funnel.map((step, i) => (
            <div key={step.label}>
              <p className="text-xs text-muted-foreground">{step.label}</p>
              <strong
                className={cn(
                  "mt-1 block text-[28px] leading-none font-semibold tracking-[var(--tracking-display)] tabular-nums",
                  i === funnel.length - 1 && "text-primary",
                )}
              >
                {nf.format(step.value)}
              </strong>
              <span className="mt-1 block text-xs text-muted-foreground">{pf.format(step.share)}%</span>
            </div>
          ))}
        </div>
        {top > 0 && (
          <BarChart
            className="mt-6"
            data={funnel.map((step) => ({ label: "", value: step.value, title: `${step.label}: ${nf.format(step.value)}` }))}
            highlight={funnel.length - 1}
            tag={`${pf.format(funnel[funnel.length - 1]?.share ?? 0)}%`}
            height={120}
            showLabels={false}
          />
        )}
      </Panel>

      <div className="grid min-w-0 gap-4 min-[1200px]:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <Panel title="Participantes por dia" icon={Users}>
          {(data?.daily ?? []).some((d) => d.value > 0) ? (
            <BarChart
              data={(data?.daily ?? []).map((d) => ({ ...d, title: `${d.label}: ${nf.format(d.value)} participantes` }))}
              tag={nf.format(Math.max(...(data?.daily ?? []).map((d) => d.value)))}
              height={190}
              gap={6}
              labelEvery={(data?.daily ?? []).length > 10 ? 3 : 1}
            />
          ) : (
            <p className="rounded-md bg-white px-4 py-10 text-center text-sm text-muted-foreground">
              Sem entradas no período.
            </p>
          )}
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
                  <strong className="text-xl font-semibold tracking-[var(--tracking-title)]">{mobileShare}%</strong>
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
            <div className="flex flex-col gap-1.5">
              {data!.regions.map((region, i) => (
                <ProgressRow
                  key={region.label}
                  label={region.label}
                  value={regionTop ? (region.value / regionTop) * 100 : 0}
                  display={nf.format(region.value)}
                  highlight={i === 0}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Eventos agendados" icon={CalendarDays}>
          <Calendar
            mode="single"
            className="mx-auto w-full max-w-[360px] overflow-hidden rounded-lg bg-white p-3 [--cell-size:2.25rem] sm:[--cell-size:2.5rem]"
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
              agendado: "bg-primary text-primary-foreground rounded-full",
            }}
          />
        </Panel>
      </div>
    </div>
  );
}
