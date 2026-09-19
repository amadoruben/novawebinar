import { Link } from "@tanstack/react-router";
import wordmarkAsset from "@/assets/nova-logo-full.png.asset.json";
import { landingFeatures } from "@/lib/landing-features";

export function SiteFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-wide lp-footer-grid">
        <div className="lp-footer-brand">
          <img src={wordmarkAsset.url} alt="NovaWebinar" />
          <p>Webinars automatizados: agende, prepare o chat e apresente a oferta no momento certo.</p>
        </div>
        <nav aria-label="Funcionalidades">
          <strong>Funcionalidades</strong>
          {landingFeatures.map((feature) => (
            <Link key={feature.slug} to="/funcionalidades/$slug" params={{ slug: feature.slug }}>{feature.menuTitle}</Link>
          ))}
        </nav>
        <nav aria-label="Plataforma">
          <strong>Plataforma</strong>
          <Link to="/">Início</Link>
          <Link to="/funcionalidades">Todas as funcionalidades</Link>
          <Link to="/auth/login">Entrar</Link>
          <Link to="/auth/register">Criar conta</Link>
        </nav>
        <nav aria-label="Informação legal">
          <strong>Legal</strong>
          <Link to="/legal/termos">Termos e condições</Link>
          <Link to="/legal/privacidade">Política de privacidade</Link>
          <Link to="/legal/cookies">Política de cookies</Link>
        </nav>
      </div>
      <div className="lp-wide lp-footer-base">
        <p>© {new Date().getFullYear()} NovaWebinar</p>
      </div>
    </footer>
  );
}
