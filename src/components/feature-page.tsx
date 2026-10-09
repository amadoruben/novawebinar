import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  AssistanceVisual,
  DashboardVisual,
  OfferVisual,
  ReplayVisual,
  RoomVisual,
  ScheduleVisual,
} from "@/components/landing/product-visuals";
import { landingFeatures, type FeatureDefinition, type FeatureVisual } from "@/lib/landing-features";

function Visual({ kind }: { kind: FeatureVisual }) {
  if (kind === "schedule") return <ScheduleVisual />;
  if (kind === "room") return <RoomVisual />;
  if (kind === "sales") return <RoomVisual sales />;
  if (kind === "offer") return <OfferVisual />;
  if (kind === "replay") return <ReplayVisual />;
  if (kind === "assistance") return <AssistanceVisual />;
  return <DashboardVisual />;
}

export function FeaturePage({ feature }: { feature: FeatureDefinition }) {
  const others = landingFeatures.filter((item) => item.slug !== feature.slug);

  return (
    <div data-site data-surface="base" className="nova-landing">
      <SiteHeader />
      <main className="lp-feature-page">
        <section className="lp-feature-hero">
          <div className="lp-feature-inner">
            <p className="lp-eyebrow">{feature.eyebrow}</p>
            <h1>{feature.title}</h1>
            <p className="lp-feature-intro">{feature.intro}</p>
            <div className="lp-hero-actions">
              <Link to="/auth/register" className="site-btn site-btn-primary">Criar conta <ArrowRight aria-hidden="true" /></Link>
              <Link to="/funcionalidades" className="site-btn site-btn-outline">Ver todas as funcionalidades</Link>
            </div>
          </div>
        </section>

        <section className="lp-feature-demo">
          <div className="lp-feature-inner">
            <div className="lp-demo-frame"><Visual kind={feature.heroVisual} /></div>
            <p className="lp-demo-caption">{feature.heroCaption}</p>
          </div>
        </section>

        <section className="lp-feature-highlights">
          <div className="lp-feature-inner">
            <ul>
              {feature.highlights.map((item) => <li key={item}><Check /> {item}</li>)}
            </ul>
          </div>
        </section>

        {feature.sections.map((section, index) => (
          <section key={section.title} className={`lp-feature-section ${index % 2 ? "is-alt" : ""}`}>
            <div className="lp-feature-inner">
              <div className="lp-feature-text">
                <h2>{section.title}</h2>
                <p>{section.body}</p>
                {section.points ? (
                  <ul>{section.points.map((point) => <li key={point}><Check /> {point}</li>)}</ul>
                ) : null}
              </div>
              {section.visual ? (
                <div>
                  <div className="lp-demo-frame"><Visual kind={section.visual} /></div>
                  {section.visualCaption ? <p className="lp-demo-caption">{section.visualCaption}</p> : null}
                </div>
              ) : null}
            </div>
          </section>
        ))}

        <section className="lp-feature-more">
          <div className="lp-feature-inner">
            <h2>Continuar a explorar</h2>
            <div className="lp-feature-cards">
              {others.map((item) => (
                <Link key={item.slug} to="/funcionalidades/$slug" params={{ slug: item.slug }}>
                  <strong>{item.menuTitle}</strong>
                  <span>{item.menuCopy}</span>
                  <ArrowRight />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
