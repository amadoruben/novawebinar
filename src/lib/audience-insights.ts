import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { rangeKey, type DateRange } from "@/lib/date-range";

/**
 * Dados de audiência partilhados pelo painel inicial e pelo analítico:
 * funil de conversão, participantes por dia, dispositivos, origem e agenda.
 * Tudo vem de registos reais — nada aqui é simulado.
 */

export type FunnelStep = { label: string; value: number; share: number };

export type AudienceInsights = {
  funnel: FunnelStep[];
  daily: { label: string; value: number }[];
  devices: { mobile: number; desktop: number; unknown: number };
  regions: { label: string; value: number }[];
  scheduled: string[];
};

const dayKey = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

export function useAudienceInsights(
  organizationId?: string,
  webinarId?: string,
  range?: DateRange,
) {
  return useQuery<AudienceInsights>({
    queryKey: ["audience-insights", organizationId, webinarId ?? "todos", rangeKey(range)],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const scope = <T extends { eq: (col: string, val: string) => T }>(q: T) =>
        webinarId ? q.eq("webinar_id", webinarId) : q;
      const period = <T extends { gte: (col: string, val: string) => T; lt: (col: string, val: string) => T }>(
        q: T,
        column: string,
      ) => (range ? q.gte(column, range.from).lt(column, range.to) : q);

      const [people, ctaViews, purchasesRes, webinarsRes, sessionsRes] =
        await Promise.all([
          fetchAll((from, to) =>
            period(
              scope(
                supabase
                  .from("participants")
                  .select(
                    "id, webinar_id, joined_at, watched_seconds, cta_clicked, device, country, city",
                    { count: "exact" },
                  )
                  .eq("organization_id", organizationId!),
              ),
              "joined_at",
            )
              .order("joined_at", { ascending: false })
              .order("id")
              .range(from, to),
          ),
          fetchAll((from, to) =>
            period(
              scope(
                supabase
                  .from("cta_events")
                  .select("participant_id", { count: "exact" })
                  .eq("organization_id", organizationId!)
                  .eq("event_type", "view"),
              ),
              "occurred_at",
            )
              .order("id")
              .range(from, to),
          ),
          period(
            scope(
              supabase
                .from("real_purchase_events")
                .select("id", { count: "exact", head: true })
                .eq("organization_id", organizationId!),
            ),
            "created_at",
          ),
          supabase
            .from("webinars")
            .select("id, scheduled_at, pitch_seconds")
            .eq("organization_id", organizationId!),
          supabase
            .from("webinar_sessions")
            .select("webinar_id, starts_at")
            .eq("organization_id", organizationId!)
            .limit(2000),
        ]);

      if (purchasesRes.error) throw purchasesRes.error;
      const visits = people.length;
      const watched = people.filter((p) => (p.watched_seconds ?? 0) > 0).length;
      const sawOffer = new Set(
        ctaViews.map((row) => row.participant_id).filter(Boolean),
      ).size;
      const clicked = people.filter((p) => p.cta_clicked).length;
      const pitchByWebinar = new Map<string, number>();
      for (const webinar of webinarsRes.data ?? []) {
        if (webinar.pitch_seconds != null) pitchByWebinar.set(webinar.id, webinar.pitch_seconds);
      }
      const reachedPitch = people.filter((p) => {
        const pitch = pitchByWebinar.get(p.webinar_id);
        return pitch != null && (p.watched_seconds ?? 0) >= pitch;
      }).length;
      const bought = purchasesRes.count ?? 0;

      const share = (value: number) => (visits ? (value / visits) * 100 : 0);
      const funnel: FunnelStep[] = [
        { label: "Visitas", value: visits, share: visits ? 100 : 0 },
        { label: "Acedeu ao webinar", value: watched, share: share(watched) },
        { label: "Chegou ao pitch", value: reachedPitch, share: share(reachedPitch) },
        { label: "Chegou à oferta", value: sawOffer, share: share(sawOffer) },
        { label: "Clicou na oferta", value: clicked, share: share(clicked) },
        { label: "Comprou", value: bought, share: share(bought) },
      ];

      const days: { label: string; value: number }[] = [];
      const counts = new Map<string, number>();
      for (const person of people) {
        if (!person.joined_at) continue;
        const key = dayKey(person.joined_at);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const rangeStart = range ? new Date(range.from) : null;
      const rangeEnd = range ? new Date(range.to) : null;
      let spanDays = 15;
      if (rangeStart && rangeEnd) {
        const diff = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000);
        spanDays = Math.min(Math.max(diff, 1), 120);
      }
      for (let i = spanDays - 1; i >= 0; i -= 1) {
        const date = rangeEnd ? new Date(rangeEnd) : new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (rangeEnd ? i + 1 : i));
        days.push({
          label: `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
          value: counts.get(dayKey(date)) ?? 0,
        });
      }

      const devices = { mobile: 0, desktop: 0, unknown: 0 };
      const regionCounts = new Map<string, number>();
      for (const person of people) {
        if (person.device === "mobile") devices.mobile += 1;
        else if (person.device === "desktop") devices.desktop += 1;
        else devices.unknown += 1;
        const region = (person.country ?? "").trim() || "Origem desconhecida";
        regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
      }
      const regions = [...regionCounts.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      const scheduled = new Set<string>();
      for (const webinar of webinarsRes.data ?? []) {
        if (webinarId && webinar.id !== webinarId) continue;
        if (webinar.scheduled_at) scheduled.add(dayKey(webinar.scheduled_at));
      }
      for (const session of sessionsRes.data ?? []) {
        if (webinarId && session.webinar_id !== webinarId) continue;
        if (session.starts_at) scheduled.add(dayKey(session.starts_at));
      }

      return { funnel, daily: days, devices, regions, scheduled: [...scheduled] };
    },
  });
}
