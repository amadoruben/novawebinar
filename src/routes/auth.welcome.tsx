import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import markAsset from "@/assets/brand/convertewebinar-icon.svg";
import { resetInitialPageLoader } from "@/components/page-loader";
import { AuthUI } from "@/components/ui/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/friendly-error";

/** Chegada de um convite de equipa ou de uma recuperação: a pessoa define a palavra-passe. */
export const Route = createFileRoute("/auth/welcome")({
  head: () => ({
    meta: [
      { title: "Definir palavra-passe | Convertewebinar" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  /** null enquanto o cliente lê a sessão que vem no endereço. */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSignedIn(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setMessage(friendlyError(error, "Não foi possível guardar a palavra-passe."));
      return;
    }
    resetInitialPageLoader();
    // O painel leva cada função à sua página de entrada.
    await navigate({ to: "/dashboard" });
  };

  return (
    <AuthUI>
      <img src={markAsset} alt="Convertewebinar" className="mb-10 h-11 w-auto" />
      {signedIn === false ? (
        <div>
          <h1 className="auth-heading">Este endereço já não é válido</h1>
          <p className="auth-sub">
            O convite ou o pedido de recuperação expirou ou já foi usado. Peça um novo para definir
            a palavra-passe.
          </p>
          <Button asChild className="mt-8 h-11 w-full">
            <Link to="/auth/reset">Pedir novo endereço</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="auth-heading">Defina a sua palavra-passe</h1>
            <p className="auth-sub">É com ela e com o seu email que passa a entrar no painel.</p>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label htmlFor="new-password">Palavra-passe</Label>
              <div className="relative mt-2">
                <Input
                  id="new-password"
                  className="h-12 pr-11"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  maxLength={128}
                  required
                  autoFocus
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShow(!show)}
                  className="absolute right-2 top-2 size-8 text-muted-foreground"
                  aria-label={show ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Pelo menos 8 caracteres.</p>
            </div>
            {message && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {message}
              </p>
            )}
            <Button
              className="h-12 w-full text-base font-semibold"
              disabled={saving || signedIn === null}
            >
              {saving ? "A guardar..." : "Guardar e entrar"}
            </Button>
          </form>
        </>
      )}
    </AuthUI>
  );
}
