import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { AuthError, AuthHeading, AuthUI, EmailSent, PasswordField } from "@/components/ui/auth-ui";
import { useAdminHostRedirect } from "@/lib/admin-host";
import { friendlyError } from "@/lib/friendly-error";

/**
 * O cliente Supabase (~45 KB) só descarrega quando a pessoa começa a escrever
 * (ou o gestor de palavras-passe preenche) ou envia: a página abre leve em dados móveis.
 */
const loadSupabase = () => import("@/integrations/supabase/client").then((m) => m.supabase);
const warmUp = () => void loadSupabase();
/** Depois de entrar, o painel volta a mostrar o seu carregador (módulo do painel, carregado só aqui). */
const toDashboard = async (navigate: ReturnType<typeof useNavigate>) => {
  (await import("@/components/page-loader")).resetInitialPageLoader();
  await navigate({ to: "/dashboard" });
};
const looksLikeEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

function useSubmit(action: (form: FormData) => Promise<void>, fallback: string) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await action(new FormData(event.currentTarget));
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      setMessage(
        /invalid login credentials/i.test(raw)
          ? "Email ou palavra-passe incorretos. Tente novamente."
          : friendlyError(error, fallback),
      );
    } finally {
      setLoading(false);
    }
  };
  return { submit, message, loading };
}

function EmailField({
  id,
  defaultValue,
  autoFocus,
}: {
  id: string;
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="site-label">
        Email
      </label>
      <input
        id={id}
        name="email"
        type="email"
        required
        maxLength={255}
        autoComplete="email"
        placeholder="nome@empresa.com"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        className="site-field"
      />
    </div>
  );
}

function LoginScreen() {
  const navigate = useNavigate();
  const { submit, message, loading } = useSubmit(async (form) => {
    const supabase = await loadSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) throw error;
    await toDashboard(navigate);
  }, "Não foi possível entrar.");

  return (
    <AuthUI
      topLink={
        <>
          Ainda não tem conta?{" "}
          <Link
            to="/auth/register"
            className="font-medium text-s-text underline underline-offset-2"
          >
            Criar conta
          </Link>
        </>
      }
    >
      <AuthHeading title="Entrar">
        Entre para preparar, apresentar e acompanhar os seus webinars.
      </AuthHeading>
      <form onSubmit={submit} onInput={warmUp} className="grid gap-5">
        <EmailField id="login-email" autoFocus />
        <PasswordField
          id="login-password"
          name="password"
          label="Palavra-passe"
          autoComplete="current-password"
          after={
            <p className="text-right">
              <Link
                to="/auth/reset"
                className="inline-flex min-h-11 items-center text-site-small font-medium text-s-text-2 underline underline-offset-2 hover:text-s-text"
              >
                Esqueceu-se da palavra-passe?
              </Link>
            </p>
          }
        />
        {message && <AuthError>{message}</AuthError>}
        <button type="submit" className="site-btn site-btn-primary w-full" disabled={loading}>
          {loading ? "A entrar…" : "Entrar"}
        </button>
      </form>
    </AuthUI>
  );
}

/** Registo em dois passos: o email primeiro (vem preenchido da página inicial), depois o nome e a palavra-passe. */
function RegisterScreen({ initialEmail }: { initialEmail?: string | undefined }) {
  const navigate = useNavigate();
  const start = initialEmail && looksLikeEmail(initialEmail) ? initialEmail : "";
  const [email, setEmail] = useState(start);
  const [step, setStep] = useState<1 | 2 | "sent">(start ? 2 : 1);
  const [password, setPassword] = useState("");
  const longEnough = password.length >= 8;

  const { submit, message, loading } = useSubmit(async (form) => {
    const supabase = await loadSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: String(form.get("name")).trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    if (data.session) return toDashboard(navigate);
    setStep("sent");
  }, "Não foi possível criar a conta.");

  const topLink = (
    <>
      Já tem conta?{" "}
      <Link to="/auth/login" className="font-medium text-s-text underline underline-offset-2">
        Entrar
      </Link>
    </>
  );

  if (step === "sent") {
    return (
      <AuthUI topLink={topLink}>
        <EmailSent
          title="Confirme o seu email"
          email={email}
          onResend={async () => {
            const { error } = await (
              await loadSupabase()
            ).auth.resend({
              type: "signup",
              email,
              options: { emailRedirectTo: window.location.origin },
            });
            return error ? friendlyError(error, "Não foi possível reenviar.") : undefined;
          }}
        >
          <button
            type="button"
            className="site-btn w-full text-site-small text-s-text-2 hover:text-s-text"
            onClick={() => {
              setPassword("");
              setStep(1);
            }}
          >
            Usar outro email
          </button>
        </EmailSent>
      </AuthUI>
    );
  }

  if (step === 1) {
    return (
      <AuthUI topLink={topLink}>
        <AuthHeading title="Criar conta" step="Passo 1 de 2">
          Lance o primeiro webinar em minutos.
        </AuthHeading>
        <form
          onInput={warmUp}
          onSubmit={(event) => {
            event.preventDefault();
            setEmail(String(new FormData(event.currentTarget).get("email")).trim());
            setStep(2);
          }}
          className="grid gap-5"
        >
          <EmailField id="register-email" defaultValue={email} autoFocus />
          <button type="submit" className="site-btn site-btn-primary w-full">
            Continuar
          </button>
        </form>
      </AuthUI>
    );
  }

  return (
    <AuthUI topLink={topLink}>
      <AuthHeading title="Criar conta" step="Passo 2 de 2">
        Com <strong className="font-medium text-s-text">{email}</strong>.{" "}
        <button
          type="button"
          className="font-medium text-s-text underline underline-offset-2"
          onClick={() => setStep(1)}
        >
          Alterar
        </button>
      </AuthHeading>
      <form onSubmit={submit} onInput={warmUp} className="grid gap-5">
        <div>
          <label htmlFor="register-name" className="site-label">
            Como se chama?
          </label>
          <input
            id="register-name"
            name="name"
            required
            maxLength={100}
            autoComplete="name"
            autoFocus
            className="site-field"
          />
        </div>
        <PasswordField
          id="register-password"
          label="Crie uma palavra-passe"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="register-password-rule"
          after={
            <p
              id="register-password-rule"
              className={`mt-2 flex items-center gap-1.5 text-site-meta ${longEnough ? "text-[var(--status-success)]" : "text-s-text-2"}`}
            >
              <Check
                className={`size-4 ${longEnough ? "" : "opacity-40"}`}
                strokeWidth={2}
                aria-hidden="true"
              />
              Pelo menos 8 caracteres
            </p>
          }
        />
        {message && <AuthError>{message}</AuthError>}
        <button type="submit" className="site-btn site-btn-primary w-full" disabled={loading}>
          {loading ? "A criar…" : "Criar conta"}
        </button>
      </form>
    </AuthUI>
  );
}

function ResetScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const send = async (to: string) => {
    // Onde a pessoa define a palavra-passe nova.
    const { error } = await (
      await loadSupabase()
    ).auth.resetPasswordForEmail(to, { redirectTo: `${window.location.origin}/auth/welcome` });
    if (error) throw error;
  };
  const { submit, message, loading } = useSubmit(async (form) => {
    const to = String(form.get("email")).trim();
    await send(to);
    setEmail(to);
    setSent(true);
  }, "Não foi possível enviar o email.");

  const topLink = (
    <>
      Lembrou-se?{" "}
      <Link to="/auth/login" className="font-medium text-s-text underline underline-offset-2">
        Entrar
      </Link>
    </>
  );

  if (sent) {
    return (
      <AuthUI topLink={topLink}>
        <EmailSent
          title="Verifique o seu email"
          email={email}
          onResend={() =>
            send(email).then(
              () => undefined,
              (error: unknown) => friendlyError(error, "Não foi possível reenviar."),
            )
          }
        >
          <Link
            to="/auth/login"
            className="site-btn w-full text-site-small text-s-text-2 hover:text-s-text"
          >
            Voltar a entrar
          </Link>
        </EmailSent>
      </AuthUI>
    );
  }

  return (
    <AuthUI topLink={topLink}>
      <AuthHeading title="Recuperar acesso">
        Indique o email da conta. Enviamos um link para criar uma palavra-passe nova.
      </AuthHeading>
      <form onSubmit={submit} onInput={warmUp} className="grid gap-5">
        <EmailField id="reset-email" autoFocus />
        {message && <AuthError>{message}</AuthError>}
        <button type="submit" className="site-btn site-btn-primary w-full" disabled={loading}>
          {loading ? "A enviar…" : "Enviar link"}
        </button>
      </form>
    </AuthUI>
  );
}

export function AuthScreen({
  mode,
  email,
}: {
  mode: "login" | "register" | "reset";
  email?: string | undefined;
}) {
  useAdminHostRedirect();
  if (mode === "login") return <LoginScreen />;
  if (mode === "register") return <RegisterScreen initialEmail={email} />;
  return <ResetScreen />;
}
