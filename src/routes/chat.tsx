import { friendlyError } from "@/lib/friendly-error";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, Send } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptySection } from "@/components/page-primitives";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useConversations, useInvalidate, useMessages, useWorkspace } from "@/lib/data";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat e interações | NovaWebinar" },
      { name: "description", content: "Atendimento privado aos participantes." },
      { property: "og:title", content: "Chat | NovaWebinar" },
      { property: "og:description", content: "Responda em privado aos participantes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Chat,
});

function Chat() {
  const { data: workspace } = useWorkspace();
  const invalidate = useInvalidate();
  const { data: conversations = [], isLoading } = useConversations(workspace?.organizationId);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [reply, setReply] = useState("");

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const { data: messages = [] } = useMessages(active?.id);

  useEffect(() => {
    if (!workspace) return;
    const channel = supabase
      .channel("team-private-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "private_messages" }, () => {
        invalidate(["messages", "conversations"]);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspace, invalidate]);

  if (isLoading)
    return (
      <AppShell
        title="Chat e interações"
        description="Mensagens privadas entre cada participante e a sua equipa."
        action={false}
      >
        <PageSkeleton variant="chat" />
      </AppShell>
    );

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active || !workspace || !reply.trim()) return;
    const body = reply.trim();
    setReply("");
    const { error } = await supabase.from("private_messages").insert({
      conversation_id: active.id,
      organization_id: workspace.organizationId,
      participant_id: active.participant_id,
      sender_kind: "team",
      sender_user_id: workspace.userId,
      body,
    });
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    await supabase
      .from("private_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        status: "active",
        assigned_to: workspace.userId,
      })
      .eq("id", active.id);
    invalidate(["messages", "conversations"]);
  };

  if (conversations.length === 0)
    return (
      <AppShell
        title="Chat e interações"
        description="Mensagens privadas entre cada participante e a sua equipa."
        action={false}
      >
        <EmptySection
          title="Sem conversas por agora"
          description="As mensagens escritas por participantes nas salas aparecem aqui, visíveis apenas para a equipa autorizada."
        />
      </AppShell>
    );

  return (
    <AppShell
      title="Chat e interações"
      description="Mensagens privadas entre cada participante e a sua equipa."
      action={false}
    >
      <div className="grid min-h-[650px] overflow-hidden rounded-md border bg-card md:grid-cols-[300px_1fr]">
        <aside className="border-r">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`flex w-full gap-3 border-b p-4 text-left ${active?.id === c.id ? "bg-accent" : "hover:bg-muted/50"}`}
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-sidebar text-xs text-sidebar-foreground">
                {(c.participants?.name ?? "?")
                  .split(" ")
                  .map((x) => x[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm">{c.participants?.name ?? "Participante"}</strong>
                <span className="block truncate text-xs text-muted-foreground">
                  {c.webinars?.public_title ?? ""}
                </span>
              </span>
              {c.status === "waiting" && <Badge>Novo</Badge>}
            </button>
          ))}
        </aside>
        <section className="flex flex-col">
          <header className="flex items-center justify-between gap-3 border-b p-4">
            <div className="min-w-0">
              <strong>{active?.participants?.name ?? "Participante"}</strong>
              <p className="truncate text-xs text-muted-foreground">
                {active?.webinars?.public_title ?? ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {active ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Bot className="size-4 text-primary" />
                  Assistente IA
                  <Switch
                    checked={!active.ai_paused}
                    onCheckedChange={async (checked) => {
                      const { error } = await supabase
                        .from("private_conversations")
                        .update({ ai_paused: !checked })
                        .eq("id", active.id);
                      if (error) {
                        toast.error(friendlyError(error));
                        return;
                      }
                      toast.success(
                        checked
                          ? "Assistente IA ativo nesta conversa."
                          : "Assistente IA em pausa nesta conversa.",
                      );
                      invalidate(["conversations"]);
                    }}
                    aria-label="Ativar ou pausar o assistente IA"
                  />
                </label>
              ) : null}
              <Badge variant="secondary">Privado</Badge>
            </div>
          </header>
          <div className="flex flex-1 flex-col justify-end gap-3 bg-muted/25 p-5">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.sender_kind === "team"
                    ? "ml-auto max-w-md rounded-md bg-primary p-3 text-sm text-primary-foreground"
                    : "max-w-md rounded-md border bg-card p-3 text-sm"
                }
              >
                {m.body}
              </div>
            ))}
          </div>
          <form className="flex gap-2 border-t p-4" onSubmit={send}>
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escreva uma resposta privada..."
            />
            <Button type="submit" size="icon" aria-label="Enviar">
              <Send />
            </Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
