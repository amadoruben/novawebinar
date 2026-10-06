import { toast } from "sonner";
import { AlertTriangle, Check, Copy, Eye, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorStep } from "@/lib/webinar-draft";

export type LaunchIssue = { step: EditorStep; title: string; detail: string };

/** Depois de «Publicar»: o que falta e os links da sala. */
export function PublishPage({
  issues,
  roomLink,
  onResolve,
  onBack,
}: {
  issues: readonly LaunchIssue[];
  roomLink: string;
  onResolve: (step: EditorStep) => void;
  onBack: () => void;
}) {
  const links = [
    { name: "Sala principal", text: "O endereço que partilha.", url: roomLink },
    { name: "Sala de teste", text: "Entra já e não conta nas métricas.", url: `${roomLink}?teste=1` },
    { name: "Replay", text: "O mesmo vídeo, depois da sessão.", url: `${roomLink}?replay=1` },
    { name: "Entrada com dados", text: "Para e-mails e WhatsApp: abre o cartão já preenchido.", url: `${roomLink}?nome={nome}&email={email}` },
  ];
  const n = issues.length;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8">
      <div className="mx-auto grid max-w-[760px] gap-6">
        <div className="flex items-start gap-3.5">
          <span
            className={
              n
                ? "grid size-10 shrink-0 place-items-center rounded-full bg-[#FBEBCF] text-[#A86400]"
                : "grid size-10 shrink-0 place-items-center rounded-full bg-[#DDF1E7] text-[#1D8A5E]"
            }
          >
            {n ? <AlertTriangle className="size-5" /> : <Check className="size-5" />}
          </span>
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight">
              {n ? `Falta pouco: ${n} ${n === 1 ? "ponto" : "pontos"}` : "O seu webinar está pronto"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {n
                ? "Já está guardado, mas estes pontos mudam o que as pessoas vêem e recebem."
                : "Está guardado. Partilhe a sala principal; a sala de teste serve para rever."}
            </p>
          </div>
        </div>

        {n ? (
          <div className="divide-y overflow-hidden rounded-xl border bg-white">
            {issues.map((issue) => (
              <div key={`${issue.step}-${issue.title}`} className="flex items-center gap-3 px-4 py-3">
                <span className="size-2 shrink-0 rounded-full bg-warning" />
                <span className="min-w-0 flex-1">
                  <b className="block text-sm font-medium">{issue.title}</b>
                  <span className="text-[12.5px] text-muted-foreground">{issue.detail}</span>
                </span>
                <Button variant="outline" size="sm" onClick={() => onResolve(issue.step)}>
                  Resolver
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="divide-y overflow-hidden rounded-xl border bg-white">
          {links.map((link) => (
            <div key={link.name} className="flex items-center gap-3 px-4 py-3">
              <Link2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <b className="block text-sm font-medium">{link.name}</b>
                <span className="block text-[12.5px] text-muted-foreground">{link.text}</span>
                <span className="block truncate font-mono text-[11.5px] text-muted-foreground">{link.url}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Copiar ${link.name}`}
                onClick={() => {
                  void navigator.clipboard.writeText(link.url);
                  toast.success("Link copiado.");
                }}
              >
                <Copy />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="dark" asChild>
            <a href={`${roomLink}?teste=1`} target="_blank" rel="noopener noreferrer">
              <Eye />
              Abrir a sala de teste
            </a>
          </Button>
          <Button variant="outline" onClick={onBack}>
            Voltar ao editor
          </Button>
        </div>
      </div>
    </div>
  );
}
