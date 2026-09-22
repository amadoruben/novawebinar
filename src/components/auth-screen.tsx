import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import markAsset from "@/assets/local/nova-icon.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthUI } from "@/components/ui/auth-ui";
import { useAdminHostRedirect } from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import { resetInitialPageLoader } from "@/components/page-loader";

function LoginScreen() {
  const navigate = useNavigate();
  useAdminHostRedirect();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      resetInitialPageLoader();
      await navigate({ to: "/dashboard" });
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      setMessage(
        /invalid login credentials/i.test(raw)
          ? "Email ou palavra-passe incorretos. Tente novamente."
          : friendlyError(error, "Não foi possível entrar."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthUI>
      <div className="flex w-full flex-col gap-7">
        <div>
          <img src={markAsset} alt="NovaWebinar" className="mb-10 h-11 w-auto" />
          <h1 className="auth-heading">Bem-vindo de volta</h1>
          <p className="auth-sub">Entre para preparar, apresentar e acompanhar os seus webinars.</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="nome@empresa.com"
                className="h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                required
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Palavra-passe</Label>
                <Link
                  to="/auth/reset"
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Esqueceu-se?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="login-password"
                  type={show ? "text" : "password"}
                  className="h-11 pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  maxLength={128}
                  required
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShow(!show)}
                  className="absolute right-1.5 top-1/2 size-8 -translate-y-1/2 text-muted-foreground"
                  aria-label={show ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            {message && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {message}
              </p>
            )}
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? "A entrar..." : "Entrar"}
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Novo por aqui?{" "}
            <Link
              to="/auth/register"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </AuthUI>
  );
}

export function AuthScreen({ mode }: { mode: "login" | "register" | "reset" }) {
  useAdminHostRedirect();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  if (mode === "login") return <LoginScreen />;
  const isRegister = mode === "register";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage("Conta criada. Consulte o seu email para confirmar o acesso.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/login`,
        });
        if (error) throw error;
        setMessage("Enviámos as instruções de recuperação para o seu email.");
      }
    } catch (error) {
      setMessage(friendlyError(error, "Não foi possível concluir."));
    } finally {
      setLoading(false);
    }
  };
  const title = isRegister ? "Criar a sua conta" : "Recuperar palavra-passe";
  return (
    <AuthUI>
      {!isRegister && (
        <Link
          to="/auth/login"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Link>
      )}
      <img src={markAsset} alt="NovaWebinar" className="mb-10 h-11 w-auto" />
      <div className="mb-8">
        <h1 className="auth-heading">{title}</h1>
        <p className="auth-sub">
          {isRegister
            ? "Crie a sua conta e lance o primeiro webinar em minutos."
            : "Enviámos-lhe um endereço seguro para recuperar o acesso à conta."}
        </p>
      </div>
      <form onSubmit={submit} className="space-y-5">
        {isRegister && (
          <div>
            <Label htmlFor="full-name">Nome completo</Label>
            <Input
              id="full-name"
              className="mt-2 h-12"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              autoComplete="name"
              placeholder="O seu nome"
            />
          </div>
        )}
        <div>
          <Label htmlFor="auth-email">Email</Label>
          <div className="relative mt-2">
            <Mail className="pointer-events-none absolute left-4 top-4 size-4 text-muted-foreground" />
            <Input
              id="auth-email"
              className="h-12 pl-11"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              required
              autoComplete="email"
              placeholder="nome@empresa.com"
            />
          </div>
        </div>
        {isRegister && (
          <div>
            <Label htmlFor="auth-password">Palavra-passe</Label>
            <div className="relative mt-2">
              <LockKeyhole className="pointer-events-none absolute left-4 top-4 size-4 text-muted-foreground" />
              <Input
                id="auth-password"
                className="h-12 px-11"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={128}
                required
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
          </div>
        )}
        {message && (
          <p role="status" className="rounded-lg border bg-muted p-3 text-sm leading-5">
            {message}
          </p>
        )}
        <Button className="h-12 w-full text-base font-semibold" size="lg" disabled={loading}>
          {loading ? "A processar..." : isRegister ? "Criar conta" : "Enviar instruções"}
        </Button>
      </form>
      {isRegister && (
        <p className="mt-7 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/auth/login" className="font-semibold text-primary hover:underline">
            Entrar
          </Link>
        </p>
      )}
    </AuthUI>
  );
}
