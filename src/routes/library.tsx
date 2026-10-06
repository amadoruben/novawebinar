import { friendlyError } from "@/lib/friendly-error";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MonitorPlay, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Clock3, EmptySection } from "@/components/page-primitives";
import { PageSkeleton } from "@/components/page-skeleton";
import { VideoThumb } from "@/components/video-thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  formatDuration,
  providerLabels,
  useInvalidate,
  useVideoSources,
  useWorkspace,
} from "@/lib/data";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Biblioteca de vídeos | Convertewebinar" },
      { name: "description", content: "Vídeos reutilizáveis para live e replay." },
      { property: "og:title", content: "Biblioteca | Convertewebinar" },
      { property: "og:description", content: "Organize os vídeos dos seus webinars." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

type Provider = Database["public"]["Enums"]["video_provider"];

function LibraryPage() {
  const { data: workspace } = useWorkspace();
  const { data: videos = [], isLoading } = useVideoSources(workspace?.organizationId);
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    provider: "hls" as Provider,
    source_url: "",
    minutes: "",
  });

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspace) return;
    const url = form.source_url.trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      toast.error("Indique o link do vídeo, começado por https://");
      return;
    }
    const { error } = await supabase.from("video_sources").insert({
      organization_id: workspace.organizationId,
      name: form.name.trim(),
      provider: form.provider,
      source_url: url,
      duration_seconds: Math.round((Number(form.minutes) || 0) * 60),
    });
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    setForm({ name: "", provider: "hls", source_url: "", minutes: "" });
    setOpen(false);
    invalidate(["video-sources"]);
    toast.success("Vídeo adicionado à biblioteca.");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("video_sources").delete().eq("id", id);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    invalidate(["video-sources"]);
  };

  return (
    <AppShell
      title="Biblioteca"
      description="O mesmo vídeo serve a transmissão e o replay."
      action={false}
    >
      <div className="mb-5 flex justify-end">
        <Button onClick={() => setOpen((v) => !v)}>
          <Plus />
          Adicionar vídeo
        </Button>
      </div>

      {open && (
        <form
          onSubmit={add}
          className="mb-6 grid gap-5 rounded-card bg-card p-5 sm:grid-cols-2 xl:grid-cols-4 xl:p-6"
        >
          <div>
            <Label>Nome</Label>
            <Input
              className="mt-2"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Fornecedor</Label>
            <Select
              value={form.provider}
              onValueChange={(v) => setForm({ ...form, provider: v as Provider })}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(providerLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>URL</Label>
            <Input
              className="mt-2"
              value={form.source_url}
              onChange={(e) => setForm({ ...form, source_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label>Duração (min)</Label>
            <Input
              className="mt-2"
              type="number"
              min={0}
              value={form.minutes}
              onChange={(e) => setForm({ ...form, minutes: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2 xl:col-span-4">
            <Button type="submit">Guardar vídeo</Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <PageSkeleton variant="cards" />
      ) : videos.length === 0 ? (
        <EmptySection
          title="Biblioteca vazia"
          description="Adicione um upload ou uma fonte externa (Bunny, Panda, Vimeo ou URL/HLS)."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {videos.map((v) => (
            <article key={v.id} className="overflow-hidden rounded-card bg-card">
              <VideoThumb name={v.name} thumbnailUrl={v.thumbnail_url} sourceUrl={v.source_url} />
              <div className="p-4">
                <h2 className="font-medium">{v.name}</h2>
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3" />
                  {formatDuration(v.duration_seconds)} · {providerLabels[v.provider]}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" className="flex-1" asChild>
                    <a href={v.source_url ?? "#"} target="_blank" rel="noreferrer">
                      <MonitorPlay />
                      Ver fonte
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover"
                    onClick={() => remove(v.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
