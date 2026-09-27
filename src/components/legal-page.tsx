import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import wordmarkAsset from "@/assets/brand/convertewebinar-logo.svg";
import { SiteFooter } from "@/components/site-footer";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="nova-landing">
      <header className="lp-header">
        <div className="lp-nav-wrap">
          <Link to="/" aria-label="Convertewebinar" className="lp-logo-link"><img src={wordmarkAsset} alt="Convertewebinar" /></Link>
          <nav className="lp-desktop-nav" aria-label="Navegação principal"><Link to="/">Início</Link></nav>
          <div className="lp-desktop-actions"><Link to="/auth/login">Entrar</Link></div>
        </div>
      </header>
      <main className="lp-legal">
        <div className="lp-legal-inner">
          <p className="lp-eyebrow">INFORMAÇÃO LEGAL</p>
          <h1>{title}</h1>
          <p className="lp-legal-updated">Última atualização: {updated}</p>
          <div className="lp-legal-body">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
