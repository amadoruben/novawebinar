import { FileUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { parseContactsCsv, type ImportRow } from "@/lib/contacts";
import { useInvalidate } from "@/lib/data";

const NEW_LIST = "__new__";
const NO_LIST = "__none__";

export function ImportContactsDialog({
  open,
  onOpenChange,
  organizationId,
  lists,
  defaultListId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  lists: { id: string; name: string }[];
  defaultListId: string | null;
}) {
  const invalidate = useInvalidate();
  const [parsed, setParsed] = useState<{ rows: ImportRow[]; skipped: number; file: string } | null>(
    null,
  );
  const [target, setTarget] = useState<string>(defaultListId ?? NEW_LIST);
  const [newName, setNewName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setParsed(null);
    setNewName("");
    setConsent(false);
    setTarget(defaultListId ?? NEW_LIST);
  };

  const readFile = async (file: File) => {
    const result = parseContactsCsv(await file.text());
    if (result.rows.length === 0) {
      toast.error("Não encontrámos contactos com email ou telefone neste ficheiro.");
      return;
    }
    const base = file.name.replace(/\.[^.]+$/, "");
    setParsed({ ...result, file: base });
    setNewName(base);
  };

  const run = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      let listId: string | null = target === NO_LIST ? null : target;
      if (target === NEW_LIST) {
        const { data, error } = await supabase
          .from("contact_lists")
          .insert({ organization_id: organizationId, name: newName.trim() })
          .select("id")
          .single();
        if (error) throw new Error(error.code === "23505" ? "Já existe uma lista com esse nome." : error.message);
        listId = data.id;
      }
      let imported = 0;
      for (let i = 0; i < parsed.rows.length; i += 1000) {
        const { data, error } = await supabase.rpc("import_contacts", {
          _organization_id: organizationId,
          _list_id: listId,
          _rows: parsed.rows.slice(i, i + 1000),
        });
        if (error) throw new Error(error.message);
        imported += data ?? 0;
      }
      toast.success(`${imported} contactos importados.`);
      invalidate(["contacts"]);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível importar.");
    } finally {
      setBusy(false);
    }
  };

  const listReady = target !== NEW_LIST || newName.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar contactos</DialogTitle>
          <DialogDescription>
            Exporte a folha do Excel, Google Sheets ou do seu CRM em CSV. Reconhecemos as colunas
            Nome, Email e Telefone/WhatsApp; quem já existe é actualizado, não duplicado.
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center hover:bg-muted/50">
            <FileUp className="size-6 text-muted-foreground" aria-hidden />
            <span className="font-medium">Escolher ficheiro CSV</span>
            <span className="text-xs text-muted-foreground">Até 5000 contactos por ficheiro</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
          </label>
        ) : (
          <div className="space-y-4 text-sm">
            <p role="status">
              <strong>{parsed.rows.length}</strong> contactos prontos a importar
              {parsed.skipped > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · {parsed.skipped} linhas sem email nem telefone ficam de fora
                </span>
              )}
            </p>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Telefone</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 4).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="max-w-[9rem] truncate px-3 py-2">{r.name || "—"}</td>
                      <td className="max-w-[10rem] truncate px-3 py-2">{r.email || "—"}</td>
                      <td className="px-3 py-2">{r.phone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <Label>Colocar na lista</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_LIST}>Nova lista…</SelectItem>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_LIST}>Nenhuma lista</SelectItem>
                </SelectContent>
              </Select>
              {target === NEW_LIST && (
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome da nova lista"
                  aria-label="Nome da nova lista"
                  maxLength={80}
                />
              )}
            </div>

            <label className="flex items-start gap-2">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <span>Confirmo que estas pessoas autorizaram ser contactadas por mim.</span>
            </label>
          </div>
        )}

        <DialogFooter>
          {parsed && (
            <Button variant="outline" onClick={reset} disabled={busy}>
              Outro ficheiro
            </Button>
          )}
          <Button onClick={run} disabled={!parsed || !consent || !listReady || busy}>
            {busy ? "A importar…" : parsed ? `Importar ${parsed.rows.length}` : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
