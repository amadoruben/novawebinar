import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HmsInput } from "@/components/hms-input";
import {
  clockLabel,
  downloadCsv,
  toCsv,
  type MetricsParticipant,
  type WebinarMetrics,
} from "@/lib/webinar-metrics";
import { toast } from "sonner";

type FilterKey =
  | "live"
  | "replay"
  | "cta"
  | "pitch"
  | "atOffer"
  | "chat"
  | "team"
  | "m15"
  | "m30"
  | "m45"
  | "m60";

const FILTERS: { key: FilterKey; label: string; hint: string }[] = [
  { key: "live", label: "Assistiu ao vivo", hint: "Entrou durante a sessão em direto" },
  { key: "replay", label: "Assistiu ao replay", hint: "Viu depois, pela gravação" },
  { key: "cta", label: "Clicou no botão da oferta", hint: "Seguiu para o pagamento" },
  { key: "pitch", label: "Chegou ao pitch", hint: "Ainda estava na sala no momento do pitch" },
  { key: "atOffer", label: "Estava no momento da oferta", hint: "Ainda estava na sala quando a oferta abriu" },
  { key: "chat", label: "Enviou mensagem no chat", hint: "Escreveu pelo menos uma mensagem" },
  { key: "team", label: "Foi respondido pela equipa", hint: "Teve resposta no suporte" },
  { key: "m15", label: "Chegou aos 15 minutos", hint: "" },
  { key: "m30", label: "Chegou aos 30 minutos", hint: "" },
  { key: "m45", label: "Chegou aos 45 minutos", hint: "" },
  { key: "m60", label: "Chegou aos 60 minutos", hint: "" },
];

export function ExportMomentsDialog({
  open,
  onOpenChange,
  metrics,
  ctaStartSeconds,
  pitchSeconds,
  fileBase,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  metrics: WebinarMetrics | undefined;
  ctaStartSeconds: number | null;
  pitchSeconds: number | null;
  fileBase: string;
}) {
  const [selected, setSelected] = useState<FilterKey[]>([]);
  const [mode, setMode] = useState<"any" | "all">("any");
  const [from, setFrom] = useState("0");
  const [to, setTo] = useState("");

  const chat = useMemo(() => new Set(metrics?.chatParticipantIds ?? []), [metrics]);
  const team = useMemo(() => new Set(metrics?.teamChatParticipantIds ?? []), [metrics]);

  const matches = (p: MetricsParticipant, key: FilterKey) => {
    const watched = p.watched_seconds ?? 0;
    switch (key) {
      case "live":
        return p.viewing_mode !== "replay";
      case "replay":
        return p.viewing_mode === "replay";
      case "cta":
        return Boolean(p.cta_clicked);
      case "pitch":
        return pitchSeconds !== null && watched >= pitchSeconds;
      case "atOffer":
        return ctaStartSeconds !== null && watched >= ctaStartSeconds;
      case "chat":
        return chat.has(p.id);
      case "team":
        return team.has(p.id);
      case "m15":
        return watched >= 900;
      case "m30":
        return watched >= 1800;
      case "m45":
        return watched >= 2700;
      case "m60":
        return watched >= 3600;
    }
  };

  const fromSeconds = Math.max(0, Number(from) || 0);
  const toSeconds = to === "" ? null : Math.max(0, Number(to) || 0);

  const people = useMemo(() => {
    const all = metrics?.participants ?? [];
    return all.filter((p) => {
      const watched = p.watched_seconds ?? 0;
      if (watched < fromSeconds) return false;
      if (toSeconds !== null && watched > toSeconds) return false;
      if (!selected.length) return true;
      return mode === "all"
        ? selected.every((key) => matches(p, key))
        : selected.some((key) => matches(p, key));
    });
  }, [metrics, selected, mode, fromSeconds, toSeconds, chat, team, ctaStartSeconds, pitchSeconds]);

  const toggle = (key: FilterKey) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const allSelected = selected.length === FILTERS.length;

  const runExport = () => {
    if (!people.length) {
      toast.error("Nenhum participante corresponde a estes filtros.");
      return;
    }
    const retention = (metrics?.retention ?? []).map((point) => ({
      ...point,
      viewers: people.filter((p) => (p.watched_seconds ?? 0) >= point.second).length,
    }));
    const header = [
      ["Filtros aplicados", selected.length ? selected.map((k) => FILTERS.find((f) => f.key === k)!.label).join(" | ") : "Todos os participantes"],
      ["Combinação", selected.length > 1 ? (mode === "all" ? "Cumpre todos" : "Cumpre pelo menos um") : "—"],
      ["Intervalo de tempo assistido", `${clockLabel(fromSeconds)}${toSeconds !== null ? ` a ${clockLabel(toSeconds)}` : " até ao fim"}`],
      ["Momento do pitch", pitchSeconds === null ? "Por definir" : clockLabel(pitchSeconds)],
      ["Participantes selecionados", people.length],
      [],
    ];
    const momentRows = retention.map((point) => [
      point.label,
      point.second,
      point.viewers,
      people.length ? `${((point.viewers / people.length) * 100).toFixed(1)}%` : "0%",
    ]);
    const peopleRows = people.map((p) => [
      p.name,
      p.email ?? "",
      p.phone ?? "",
      clockLabel(p.watched_seconds ?? 0),
      p.viewing_mode === "replay" ? "Replay" : "Ao vivo",
      pitchSeconds === null
        ? "—"
        : (p.watched_seconds ?? 0) >= pitchSeconds
          ? "Sim"
          : "Não",
      p.cta_clicked ? "Sim" : "Não",
      chat.has(p.id) ? "Sim" : "Não",
    ]);

    const content = [
      toCsv(["Resumo", "Valor"], header),
      toCsv(["Momento", "Segundo", "Participantes presentes", "% do grupo"], momentRows),
      "",
      toCsv(
        [
          "Nome",
          "Email",
          "Contacto",
          "Tempo assistido",
          "Modo",
          "Chegou ao pitch",
          "Clicou na oferta",
          "Falou no chat",
        ],
        peopleRows,
      ),
    ].join("\n");

    downloadCsv(`${fileBase}-por-momento.csv`, content);
    toast.success(`Ficheiro criado com ${people.length} participantes.`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="size-4 text-primary" />
            Exportar participantes por momento
          </DialogTitle>
          <DialogDescription>
            Escolha quem quer no ficheiro. Sem filtros, entram todos os participantes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Assistiu a partir de
              </p>
              <HmsInput value={from} onChange={setFrom} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Até (opcional)
              </p>
              <HmsInput value={to} onChange={setTo} allowEmpty />
            </div>
          </div>

          <div className="rounded-xl border">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => setSelected(allSelected ? [] : FILTERS.map((f) => f.key))}
                />
                Selecionar todos
              </label>
              {selected.length > 1 ? (
                <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-xs">
                  <button
                    type="button"
                    className={`rounded-md px-2 py-1 ${mode === "any" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    onClick={() => setMode("any")}
                  >
                    Qualquer um
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-2 py-1 ${mode === "all" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    onClick={() => setMode("all")}
                  >
                    Todos
                  </button>
                </div>
              ) : null}
            </div>
            <ul className="max-h-64 space-y-1 overflow-y-auto p-2">
              {FILTERS.map((filter) => (
                <li key={filter.key}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
                    <Checkbox
                      className="mt-0.5"
                      checked={selected.includes(filter.key)}
                      onCheckedChange={() => toggle(filter.key)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{filter.label}</span>
                      {filter.hint ? (
                        <span className="block text-xs text-muted-foreground">{filter.hint}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{people.length}</strong> participantes correspondem
            a esta seleção.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={runExport}>Exportar ficheiro</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
