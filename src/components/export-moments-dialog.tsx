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
  | "offer"
  | "cta"
  | "checkout"
  | "failed"
  | "abandoned"
  | "bought"
  | "pitch"
  | "atOffer"
  | "chat"
  | "team"
  | "m15"
  | "m30"
  | "m45"
  | "m60";

const FILTERS: { key: FilterKey; label: string; hint: string }[] = [
  { key: "live", label: "Assistiu ao vivo", hint: "Viu a sessão em direto" },
  { key: "replay", label: "Assistiu ao replay", hint: "Viu depois, pela gravação" },
  { key: "offer", label: "Viu a oferta", hint: "A oferta apareceu-lhe na sala (ou clicou nela)" },
  { key: "cta", label: "Clicou no botão da oferta", hint: "Abriu a página de pagamento (não quer dizer que pagou)" },
  { key: "checkout", label: "Iniciou o pagamento", hint: "A plataforma de pagamento registou a tentativa" },
  { key: "failed", label: "Pagamento falhado", hint: "Tentou pagar, o pagamento falhou e não comprou depois" },
  { key: "abandoned", label: "Abandonou o pagamento", hint: "Começou o pagamento e não o concluiu" },
  { key: "bought", label: "Comprou", hint: "Compra aprovada atribuída a este webinar" },
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
  pitchSeconds,
  fileBase,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  metrics: WebinarMetrics | undefined;
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
    // Os momentos do vídeo são posição (até onde chegou), não tempo visto.
    const peak = p.peak_seconds ?? 0;
    switch (key) {
      case "live":
        return Boolean(p.attended) && p.viewing_mode !== "replay";
      case "replay":
        return Boolean(p.attended) && p.viewing_mode === "replay";
      case "offer":
        return Boolean(p.saw_offer);
      case "cta":
        return Boolean(p.clicked);
      case "checkout":
        return Boolean(p.checkout_started);
      case "failed":
        return Boolean(p.payment_failed);
      case "abandoned":
        return Boolean(p.checkout_abandoned);
      case "bought":
        return Boolean(p.purchased);
      case "pitch":
        return Boolean(p.reached_pitch);
      case "atOffer":
        return Boolean(p.reached_offer);
      case "chat":
        return chat.has(p.participant_id ?? "");
      case "team":
        return team.has(p.participant_id ?? "");
      case "m15":
        return peak >= 900;
      case "m30":
        return peak >= 1800;
      case "m45":
        return peak >= 2700;
      case "m60":
        return peak >= 3600;
    }
  };

  const fromSeconds = Math.max(0, Number(from) || 0);
  const toSeconds = to === "" ? null : Math.max(0, Number(to) || 0);

  const people = useMemo(() => {
    const all = metrics?.participants ?? [];
    return all.filter((p) => {
      const watched = p.actual_watch_seconds ?? 0;
      if (watched < fromSeconds) return false;
      if (toSeconds !== null && watched > toSeconds) return false;
      if (!selected.length) return true;
      return mode === "all"
        ? selected.every((key) => matches(p, key))
        : selected.some((key) => matches(p, key));
    });
  }, [metrics, selected, mode, fromSeconds, toSeconds, chat, team]);

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
      viewers: people.filter(
        (p) => (p.entry_seconds ?? 0) <= point.second && (p.peak_seconds ?? 0) >= point.second,
      ).length,
    }));
    const header = [
      ["Filtros aplicados", selected.length ? selected.map((k) => FILTERS.find((f) => f.key === k)!.label).join(" | ") : "Todos os participantes"],
      ["Combinação", selected.length > 1 ? (mode === "all" ? "Cumpre todos" : "Cumpre pelo menos um") : "—"],
      ["Intervalo de tempo assistido", `${clockLabel(fromSeconds)}${toSeconds !== null ? ` a ${clockLabel(toSeconds)}` : " até ao fim"}`],
      ["Momento do pitch", pitchSeconds === null ? "Por definir" : clockLabel(pitchSeconds)],
      ["Participações selecionadas", people.length],
      [],
    ];
    const momentRows = retention.map((point) => [
      point.label,
      point.second,
      point.viewers,
      people.length ? `${((point.viewers / people.length) * 100).toFixed(1)}%` : "0%",
    ]);
    const peopleRows = people.map((p) => [
      p.name ?? "",
      p.email ?? "",
      p.phone ?? "",
      clockLabel(p.actual_watch_seconds ?? 0),
      p.watch_measured ? "Medido" : "Estimado",
      clockLabel(p.peak_seconds ?? 0),
      p.viewing_mode === "replay" ? "Replay" : "Ao vivo",
      pitchSeconds === null ? "—" : p.reached_pitch ? "Sim" : "Não",
      ...[p.saw_offer, p.clicked, p.checkout_started, p.payment_failed, p.checkout_abandoned, p.purchased].map((fact) =>
        fact ? "Sim" : "Não",
      ),
      chat.has(p.participant_id ?? "") ? "Sim" : "Não",
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
          "Medição",
          "Chegou até ao momento",
          "Modo",
          "Chegou ao pitch",
          "Viu a oferta",
          "Clicou na oferta",
          "Iniciou o pagamento",
          "Pagamento falhado",
          "Abandonou o pagamento",
          "Comprou",
          "Falou no chat",
        ],
        peopleRows,
      ),
    ].join("\n");

    downloadCsv(`${fileBase}-por-momento.csv`, content);
    toast.success(`Ficheiro criado com ${people.length} ${people.length === 1 ? "participação" : "participações"}.`);
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
            Escolha quem quer no ficheiro. Sem filtros, entram todas as participações (quem entrou
            duas vezes aparece duas vezes).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Tempo assistido a partir de
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
            <strong className="text-foreground">{people.length}</strong>{" "}
            {people.length === 1 ? "participação corresponde" : "participações correspondem"} a esta
            seleção.
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
