import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ORIGIN_LABEL, ORIGIN_PLACEMENTS, ORIGINS, originParts, PAGE_TYPE_LABEL, PAID_ORIGINS, type CanvasNode, type PageType } from "@/lib/workflow";

type GroupNode = Extract<CanvasNode, { kind: "group" }>;

/** As definições de uma página, grupo ou origem: só representação, não se executam. Montar com `key` = id. */
export function CanvasNodeSettings({
  node,
  groups,
  onSave,
  onRemove,
}: {
  node: CanvasNode;
  /** Os grupos do fluxo: o nome não se repete e só o primeiro com link dá o {{link_grupo}}. */
  groups: GroupNode[];
  onSave: (node: CanvasNode) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState<CanvasNode>(node);
  const others = groups.filter((g) => g.id !== draft.id);
  const sameName = draft.kind === "group" && others.some((g) => g.name.trim().toLowerCase() === draft.name.trim().toLowerCase());
  // O motor usa o link do primeiro grupo (pela ordem do fluxo) que o tem; um grupo novo fica no fim.
  const order = groups.some((g) => g.id === draft.id) ? groups.map((g) => (g.id === draft.id ? draft : g)) : [...groups, draft];
  const invite = order.find((g) => g.kind === "group" && g.url.trim());
  return (
      <div className="space-y-6">
        {draft.kind === "page" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Que página é esta?</Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(PAGE_TYPE_LABEL) as PageType[])
                  .filter((t) => t !== "inscricao")
                  .map((t) => {
                    const on = draft.pageType === t;
                    const defaults = new Set(["Página", ...Object.values(PAGE_TYPE_LABEL)]);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setDraft({ ...draft, pageType: t, name: defaults.has(draft.name) ? PAGE_TYPE_LABEL[t] : draft.name })}
                        className={cn(
                          "h-8 rounded-pill px-3 text-xs ring-1 transition-colors",
                          on ? "bg-navy text-white ring-navy" : "bg-white ring-[var(--border-subtle)] hover:bg-gray-50",
                        )}
                      >
                        {PAGE_TYPE_LABEL[t]}
                      </button>
                    );
                  })}
              </div>
              <p className="text-xs text-muted-foreground">A página de inscrição é a do formulário (Configuração → Captura).</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="page-name">Nome</Label>
              <Input id="page-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="page-url">Endereço</Label>
              <Input id="page-url" value={draft.url} placeholder="https://meusite.com/checkout" onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
              <p className="text-xs text-muted-foreground">A página vive fora da plataforma. O endereço entra nas mensagens e diz-nos quem lá chegou.</p>
            </div>
          </div>
        ) : draft.kind === "group" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Nome do grupo no WhatsApp</Label>
              <Input
                id="group-name"
                value={draft.name}
                maxLength={120}
                aria-invalid={sameName}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              {sameName ? (
                <p className="text-xs text-destructive">Já há um grupo com este nome.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Igual ao do WhatsApp: é por ele que as mensagens encontram o grupo.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-url">Link de convite</Label>
              <Input id="group-url" value={draft.url} placeholder="https://chat.whatsapp.com/…" onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                {invite && invite.id !== draft.id && invite.kind === "group"
                  ? `O convite nas mensagens ({{link_grupo}}) usa o link do grupo «${invite.name}».`
                  : "Vai na página de obrigado e nas mensagens como {{link_grupo}}."}
              </p>
            </div>
          </div>
        ) : (
          (() => {
            const parts = originParts(draft);
            const platform = parts.platform as (typeof ORIGINS)[number];
            const placements = ORIGIN_PLACEMENTS[platform] ?? [];
            const chip = (on: boolean) =>
              cn("h-8 rounded-pill px-3 text-xs ring-1 transition-colors", on ? "bg-navy text-white ring-navy" : "bg-white ring-[var(--border-subtle)] hover:bg-gray-50");
            return (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ORIGINS.map((o) => (
                      <button key={o} type="button" aria-pressed={platform === o} className={chip(platform === o)} onClick={() => setDraft({ ...draft, source: o, placement: undefined })}>
                        {ORIGIN_LABEL[o]}
                      </button>
                    ))}
                  </div>
                </div>
                {placements.length > 0 && (
                  <div className="space-y-2">
                    <Label>{PAID_ORIGINS.has(platform) ? "Onde anuncia?" : "Em que rede?"}</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {placements.map((p) => (
                        <button key={p} type="button" aria-pressed={parts.placement === p} className={chip(parts.placement === p)} onClick={() => setDraft({ ...draft, source: platform, placement: p })}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Só representa a origem no fluxo. Os dados reais de origem são as UTM de cada inscrição; não se gerem campanhas aqui.
                </p>
              </div>
            );
          })()
        )}
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="ghost" className="text-destructive" onClick={() => onRemove(draft.id)}>
            <Trash2 /> Retirar do fluxo
          </Button>
          <Button disabled={draft.kind === "group" && (sameName || !draft.name.trim())} onClick={() => onSave(draft)}>
            Guardar
          </Button>
        </div>
      </div>
  );
}
