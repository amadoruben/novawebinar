import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import wordmarkAsset from "@/assets/nova-logo-full.png.asset.json";
import { Button } from "@/components/ui/button";
import { landingFeatures } from "@/lib/landing-features";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!featuresOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!featuresRef.current?.contains(event.target as Node)) setFeaturesOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFeaturesOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [featuresOpen]);

  return (
    <header className="lp-header">
      <div className="lp-nav-wrap">
        <Link to="/" aria-label="NovaWebinar" className="lp-logo-link"><img src={wordmarkAsset.url} alt="NovaWebinar" /></Link>

        <nav className="lp-desktop-nav" aria-label="Navegação principal">
          <div className="lp-nav-menu" ref={featuresRef} onMouseLeave={() => setFeaturesOpen(false)}>
            <button
              type="button"
              className="lp-nav-trigger"
              aria-expanded={featuresOpen}
              onClick={() => setFeaturesOpen(true)}
              onMouseEnter={() => setFeaturesOpen(true)}
            >
              Funcionalidades <ChevronDown />
            </button>
            {featuresOpen && (
              <div className="lp-nav-panel" role="menu">
                {landingFeatures.map((feature) => (
                  <Link
                    key={feature.slug}
                    to="/funcionalidades/$slug"
                    params={{ slug: feature.slug }}
                    role="menuitem"
                    onClick={() => setFeaturesOpen(false)}
                  >
                    <strong>{feature.menuTitle}</strong>
                    <span>{feature.menuCopy}</span>
                  </Link>
                ))}
                <Link to="/funcionalidades" className="lp-nav-panel-all" onClick={() => setFeaturesOpen(false)}>
                  Ver todas as funcionalidades
                </Link>
              </div>
            )}
          </div>
          <Link to="/funcionalidades">Plataforma</Link>
          <Link to="/funcionalidades/$slug" params={{ slug: "analise" }}>Análise</Link>
        </nav>

        <div className="lp-desktop-actions">
          <Link to="/auth/login">Entrar</Link>
          <Button variant="dark" asChild><Link to="/auth/register">Começar agora</Link></Button>
        </div>

        <Button variant="ghost" size="icon" className="lp-menu-button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {menuOpen && (
        <nav className="lp-mobile-nav" aria-label="Navegação móvel">
          <div className="lp-mobile-nav-links">
            <Link to="/funcionalidades" className="lp-mobile-nav-all" style={{ animationDelay: "40ms" }} onClick={() => setMenuOpen(false)}>
              Todas as funcionalidades <ArrowRight />
            </Link>
            {landingFeatures.map((feature, index) => (
              <Link
                key={feature.slug}
                to="/funcionalidades/$slug"
                params={{ slug: feature.slug }}
                style={{ animationDelay: `${90 + index * 55}ms` }}
                onClick={() => setMenuOpen(false)}
              >
                <strong>{feature.menuTitle}</strong>
                <span>{feature.menuCopy}</span>
              </Link>
            ))}
          </div>
          <div className="lp-mobile-nav-actions" style={{ animationDelay: `${140 + landingFeatures.length * 55}ms` }}>
            <Link to="/auth/login" onClick={() => setMenuOpen(false)}>Entrar</Link>
            <Button variant="dark" asChild><Link to="/auth/register" onClick={() => setMenuOpen(false)}>Começar agora <ArrowRight /></Link></Button>
          </div>
        </nav>
      )}
    </header>
  );
}
