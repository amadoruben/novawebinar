import {
  BarChart3,
  CalendarDays,
  Clock3,
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Play,
  Radio,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageSkeleton } from "@/components/page-skeleton";
import {
  publicOrigin,
  statusLabels,
  webinarStatusFromSchedule,
  type Webinar,
  type WebinarStatus,
} from "@/lib/data";

export { CalendarDays, Clock3, MoreHorizontal, Play, Radio, Users };

export function Metric({
  label,
  value,
  change,
  icon: Icon = Users,
}: {
  label: string;
  value: string;
  change?: string;
  icon?: typeof Users;
}) {
  return (
    <article className="min-w-0 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-xs font-medium leading-relaxed text-muted-foreground sm:text-sm">
            {label}
          </span>
          <strong className="mt-2 block break-words text-2xl font-semibold sm:text-[1.75rem]">
            {value}
          </strong>
        </div>
        <Icon className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      </div>
      {change && (
        <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2 sm:mt-4 sm:pt-3">
          <span className="text-xs font-medium text-muted-foreground">{change}</span>
        </div>
      )}
    </article>
  );
}

export function EmptySection({
  title,
  description,
  actionLabel,
  actionTo,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: "/webinars/new" | "/library" | "/webinars";
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-14 text-center">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionTo && (
        <Button className="mt-5" asChild>
          <Link to={actionTo}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}

export type WebinarRow = Webinar & {
  video_sources?: {
    name: string;
    source_url: string | null;
    duration_seconds: number;
    provider: string;
  } | null;
  participantCount?: number;
};

export function StatusBadge({ status }: { status: WebinarStatus }) {
  return (
    <Badge
      variant={status === "live" ? "destructive" : status === "draft" ? "outline" : "secondary"}
    >
      {status === "live" && <Radio className="mr-1 inline size-3" />}
      {statusLabels[status]}
    </Badge>
  );
}

export function ActivityBadge({ status }: { status: WebinarStatus }) {
  const active = status !== "draft";
  return (
    <Badge variant={active ? "success" : "outline"}>
      {active && <Radio className="mr-1 inline size-3" />}
      {active ? "Ativo" : "Inativo"}
    </Badge>
  );
}

function ActiveSwitch({ webinar }: { webinar: WebinarRow }) {
  const queryClient = useQueryClient();
  const active = webinar.status !== "draft";
  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      // Ao ativar, o estado segue a data marcada: futura → agendado (sala de espera),
      // sem data ou já iniciada → ao vivo; sem data marcada tratamos como "ao vivo".
      const derived = webinarStatusFromSchedule(
        webinar.scheduled_at,
        webinar.duration_seconds,
        webinar.replay_enabled,
      );
      const status = next ? (derived === "draft" ? "live" : derived) : "draft";
      const { error } = await supabase.from("webinars").update({ status }).eq("id", webinar.id);
      if (error) throw error;
    },
    onSuccess: (_data, next) => {
      void queryClient.invalidateQueries({ queryKey: ["webinars"] });
      void queryClient.invalidateQueries({ queryKey: ["webinar", webinar.id] });
      toast.success(next ? "Webinar ativado" : "Webinar inativado");
    },
    onError: () => toast.error("Não foi possível alterar o estado"),
  });
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={active}
        disabled={toggle.isPending}
        onCheckedChange={(next) => toggle.mutate(next)}
        aria-label={active ? "Inativar webinar" : "Ativar webinar"}
      />
      <ActivityBadge status={webinar.status} />
    </div>
  );
}

function LinkField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold">{label}</p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={value}
          className="h-9 text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success("Endereço copiado");
          }}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function WebinarDetailsDialog({
  webinar,
  open,
  onOpenChange,
}: {
  webinar: WebinarRow | null;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const origin = publicOrigin();
  if (!webinar) return null;
  const roomLink = `${origin}/w/${webinar.slug}`;
  // A sala de teste vive no mesmo domínio público das salas: qualquer pessoa
  // com o link entra, mesmo com a sessão inativa ou fora do horário.
  const testLink = `${roomLink}?teste=1`;
  const testReplayLink = `${roomLink}?teste=1&replay=1`;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{webinar.public_title || webinar.internal_name}</SheetTitle>
          <SheetDescription>Endereços e atalhos desta sessão.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4">
          <LinkField label="Sala principal" value={roomLink} />
          <LinkField label="Sala com login" value={roomLink} />
          {webinar.replay_enabled ? (
            <LinkField label="Replay" value={`${roomLink}?replay=1`} />
          ) : (
            <p className="text-xs text-muted-foreground">
              O replay está desligado neste webinar. Ative-o na edição para gerar o endereço
              automaticamente.
            </p>
          )}
          <LinkField label="Sala de teste" value={testLink} />
          <LinkField label="Sala de teste (replay)" value={testReplayLink} />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" asChild>
              <Link to="/webinars/$webinarId/edit" params={{ webinarId: webinar.id }}>
                Editar webinar
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={roomLink} target="_blank" rel="noreferrer">
                Abrir sala
              </a>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DeleteWebinarButton({ webinar }: { webinar: WebinarRow }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async () => {
      const wid = webinar.id;
      const { data: conversations } = await supabase
        .from("private_conversations")
        .select("id")
        .eq("webinar_id", wid);
      const conversationIds = (conversations ?? []).map((c) => c.id);
      if (conversationIds.length > 0) {
        await supabase.from("private_messages").delete().in("conversation_id", conversationIds);
      }
      await supabase.from("private_conversations").delete().eq("webinar_id", wid);
      await supabase.from("analytics_events").delete().eq("webinar_id", wid);
      await supabase.from("cta_events").delete().eq("webinar_id", wid);
      await supabase.from("scheduled_comments").delete().eq("webinar_id", wid);
      await supabase.from("audience_configuration").delete().eq("webinar_id", wid);
      await supabase.from("social_proof_settings").delete().eq("webinar_id", wid);
      await supabase.from("real_purchase_events").delete().eq("webinar_id", wid);
      await supabase.from("simulated_purchase_events").delete().eq("webinar_id", wid);
      await supabase.from("viewer_sessions").delete().eq("webinar_id", wid);
      await supabase.from("webinar_sessions").delete().eq("webinar_id", wid);
      await supabase.from("participants").delete().eq("webinar_id", wid);
      const { error } = await supabase.from("webinars").delete().eq("id", wid);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["webinars"] });
      toast.success("Webinar eliminado");
    },
    onError: () => toast.error("Não foi possível eliminar o webinar"),
  });
  return (
    <Button
      variant="ghost"
      size="icon"
      title="Eliminar"
      aria-label="Eliminar"
      className="text-destructive hover:text-destructive"
      disabled={remove.isPending}
      onClick={() => {
        if (
          window.confirm(
            `Eliminar "${webinar.public_title || webinar.internal_name}"? Esta ação não pode ser anulada.`,
          )
        ) {
          remove.mutate();
        }
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

export function WebinarTable({
  rows,
  title = "Webinars recentes",
  loading,
}: {
  rows: WebinarRow[];
  title?: string;
  loading?: boolean;
}) {
  const [selected, setSelected] = useState<WebinarRow | null>(null);
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-5">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">Acompanhe desempenho e sessões</p>
        </div>
      </div>
      {loading ? (
        <PageSkeleton variant="table" className="rounded-none border-0" />
      ) : rows.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">Ainda não existem webinars nesta lista.</p>
      ) : (
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Webinar</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Vídeo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} className="border-t transition-colors hover:bg-muted/40">
                  <td className="px-5 py-4 font-medium">
                    <div className="flex items-center gap-3">
                      {w.registration_cover_url ? (
                        <img
                          src={w.registration_cover_url}
                          alt={`Capa de ${w.public_title || w.internal_name}`}
                          className="size-11 shrink-0 rounded-md border object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                          <Play className="size-4" />
                        </span>
                      )}
                      <span className="min-w-0 truncate">{w.public_title || w.internal_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <ActiveSwitch webinar={w} />
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {w.video_sources?.name ?? "Por definir"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Detalhes"
                        aria-label="Detalhes"
                        onClick={() => setSelected(w)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        aria-label="Editar"
                        asChild
                      >
                        <Link to="/webinars/$webinarId/edit" params={{ webinarId: w.id }}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Métricas do webinar"
                        aria-label="Métricas do webinar"
                        asChild
                      >
                        <Link to="/webinars/$webinarId/metrics" params={{ webinarId: w.id }}>
                          <BarChart3 className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Métricas em tempo real"
                        aria-label="Métricas em tempo real"
                        asChild
                      >
                        <Link to="/live-view" search={{ webinar: w.id }}>
                          <Radio className="size-4" />
                        </Link>
                      </Button>
                      <DeleteWebinarButton webinar={w} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && rows.length > 0 && (
        <div className="divide-y md:hidden">
          {rows.map((w) => (
            <article key={w.id} className="p-4">
              <div className="flex items-start gap-3">
                {w.registration_cover_url ? (
                  <img
                    src={w.registration_cover_url}
                    alt=""
                    className="size-12 shrink-0 rounded-md border object-cover"
                  />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <Play className="size-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium">
                    {w.public_title || w.internal_name}
                  </h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {w.video_sources?.name ?? "Vídeo por definir"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Detalhes"
                  onClick={() => setSelected(w)}
                >
                  <MoreHorizontal />
                </Button>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
                <ActiveSwitch webinar={w} />
                <Button variant="outline" size="sm" asChild>
                  <Link to="/webinars/$webinarId/edit" params={{ webinarId: w.id }}>
                    Editar
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <WebinarDetailsDialog
        webinar={selected}
        open={Boolean(selected)}
        onOpenChange={(value) => !value && setSelected(null)}
      />
    </div>
  );
}
