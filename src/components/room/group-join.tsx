import { useState } from "react";
import { X } from "lucide-react";
import whatsappIcon from "@/assets/local/whatsapp-icon.webp";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * O pop-up do grupo da oferta: a pessoa confirma o nome, o e-mail e o WhatsApp e entra no
 * grupo, onde está o link com o desconto. Fica registado quem entrou.
 */
export function GroupJoinDialog({
  product,
  host,
  prefill,
  onClose,
  onJoin,
}: {
  product: string;
  host: string;
  prefill: { name: string; email: string; phone: string };
  onClose: () => void;
  onJoin: (data: { name: string; email: string; phone: string }) => void;
}) {
  const [name, setName] = useState(prefill.name);
  const [email, setEmail] = useState(prefill.email);
  const [phone, setPhone] = useState(prefill.phone);
  const [error, setError] = useState("");
  const input =
    "h-12 w-full min-w-0 rounded-xl bg-room-raised px-4 text-[15px] text-room-text outline-none ring-1 ring-room-line placeholder:text-room-subtle focus:ring-2 focus:ring-primary";
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal aria-label="Entrar no grupo">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const n = name.trim();
          const e = email.trim().toLowerCase();
          const p = phone.replace(/[^\d+]/g, "");
          if (n.length < 2) return setError("Diga-nos o seu nome.");
          if (e && !EMAIL.test(e)) return setError("Indique um e-mail válido.");
          if (!e && p.length < 6) return setError("Indique o seu e-mail ou o seu WhatsApp.");
          if (p && p.length < 6) return setError("Indique um WhatsApp válido, com o indicativo do país.");
          onJoin({ name: n, email: e, phone: phone.trim() });
        }}
        className="relative grid w-full max-w-[400px] gap-4 rounded-2xl bg-room-surface p-6 text-room-text shadow-2xl ring-1 ring-room-line"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-room-subtle hover:bg-room-raised hover:text-room-text"
        >
          <X className="size-5" />
        </button>
        <div className="flex items-center gap-3 pr-8">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#25D366]/15">
            <img src={whatsappIcon} alt="" className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight">Entrar no grupo</h2>
            <p className="text-[13.5px] leading-snug text-room-subtle">
              {product ? `O link com o desconto de ${product} está no grupo.` : "O link com o desconto está no grupo."}
            </p>
          </div>
        </div>
        <label className="grid gap-1.5 text-sm font-semibold">
          Nome
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="O seu nome" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          E-mail
          <input
            className={input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="Onde enviamos o acesso"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          WhatsApp
          <input
            className={input}
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s()+-]/g, ""))}
            autoComplete="tel"
            placeholder="+244 900 000 000"
          />
        </label>
        {error ? (
          <p className="text-sm font-medium text-[#E5484D]" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          // O texto escuro no verde do WhatsApp, como na própria app: o branco ficava sem contraste.
          className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-[#25D366] text-[16px] font-bold text-[#0B141A] transition hover:brightness-105"
        >
          Entrar no grupo
        </button>
        <p className="text-center text-[12px] text-room-subtle">
          Os seus dados ficam com {host || "a equipa"} para lhe enviar a oferta.
        </p>
      </form>
    </div>
  );
}
