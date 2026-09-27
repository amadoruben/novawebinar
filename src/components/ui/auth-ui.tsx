import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { RoomVisual } from "@/components/landing/product-visuals";

export function AuthUI({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-form-col">
        <div className="auth-form-inner">{children}</div>
        <p className="auth-legal">
          Ao continuar, confirma que aceita os{" "}
          <Link to="/legal/termos">termos</Link> e a{" "}
          <Link to="/legal/privacidade">política de privacidade</Link>.
        </p>
      </section>

      <aside className="auth-aside" aria-label="Sobre o Convertewebinar">
        <div className="auth-aside-inner">
          <h2 className="auth-aside-title">
            Grave uma vez.
            <br />
            Apresente todos os dias.
          </h2>
          <ul className="auth-aside-list">
            <li><Check /> Sessões recorrentes com data e hora próprias</li>
            <li><Check /> Chat, oferta e suporte preparados por si</li>
            <li><Check /> Análise completa de cada sessão</li>
          </ul>
          <div className="auth-aside-demo" aria-hidden="false">
            <RoomVisual />
          </div>
        </div>
      </aside>
    </main>
  );
}
