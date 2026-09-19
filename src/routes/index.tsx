import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Check, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  AssistanceVisual,
  DashboardVisual,
  OfferVisual,
  RoomVisual,
  ScheduleVisual,
} from "@/components/landing/product-visuals";
import { PUBLIC_PRESENTATION_VIDEO_URL } from "@/lib/public-site-config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NovaWebinar — grave uma vez, apresente todos os dias" },
      { name: "description", content: "Crie webinars automatizados com sessões recorrentes, chat programado, oferta e análise de retenção." },
      { property: "og:title", content: "NovaWebinar — grave uma vez, apresente todos os dias" },
      { property: "og:description", content: "Crie webinars automatizados com sessões recorrentes, chat programado, oferta e análise de retenção." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const headlinePhrases = [
  "pronto todos os dias.",
  "com tudo preparado.",
  "a trabalhar por si.",
];

const capabilities = [
  ["01", "Sessões", "Única, diária, semanal ou just in time"],
  ["02", "Chat", "Mensagens ligadas ao tempo do vídeo"],
  ["03", "Oferta", "Chamada à ação no momento definido"],
  ["04", "Análise", "Presença, retenção e pontos de saída"],
];

function useInViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? true), {
      rootMargin: "120px 0px",
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function useRevealOnce<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [observed, setObserved] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    setObserved(true);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setRevealed(true);
      observer.disconnect();
    }, { rootMargin: "0px 0px -8%" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, observed, revealed };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

function AnimatedHeadline({ paused, reduced }: { paused: boolean; reduced: boolean }) {
  const [active, setActive] = useState(0);
  const { ref, visible } = useInViewport<HTMLHeadingElement>();
  const pageVisible = usePageVisible();

  useEffect(() => {
    if (paused || reduced || !visible || !pageVisible) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % headlinePhrases.length);
    }, 3600);
    return () => window.clearInterval(timer);
  }, [pageVisible, paused, reduced, visible]);

  return (
    <h1 ref={ref} className="lp-animated-title lp-enter">
      <span className="sr-only">O seu webinar, pronto todos os dias, com tudo preparado e a trabalhar por si.</span>
      <span aria-hidden="true" className="lp-title-visual">
        <span className="lp-title-fixed">O seu webinar,</span>
        <span className="lp-title-rotator">
          {headlinePhrases.map((phrase, index) => (
            <span key={phrase} className={index === (reduced ? 0 : active) ? "is-active" : ""}>{phrase}</span>
          ))}
        </span>
      </span>
    </h1>
  );
}


const showcaseTabs = [
  { label: "Programar", render: () => <ScheduleVisual /> },
  { label: "Apresentar", render: () => <RoomVisual /> },
  { label: "Oferta", render: () => <OfferVisual /> },
  { label: "Vendas", render: () => <RoomVisual sales /> },
  { label: "Acompanhar", render: () => <DashboardVisual /> },
];

function PresentationStage({ paused, reduced }: { paused: boolean; reduced: boolean }) {
  const hasVideo = PUBLIC_PRESENTATION_VIDEO_URL.trim().length > 0;
  const [active, setActive] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const { ref, visible } = useInViewport<HTMLDivElement>();
  const pageVisible = usePageVisible();
  const shouldPause = paused || reduced || !visible || !pageVisible || interacting;

  useEffect(() => {
    if (hasVideo || shouldPause) return;
    const timer = window.setTimeout(() => setActive((current) => (current + 1) % showcaseTabs.length), 5000);
    return () => window.clearTimeout(timer);
  }, [active, hasVideo, shouldPause]);

  const activeTab = showcaseTabs[reduced ? 0 : active];
  if (!activeTab) return null;
  const ActivePreview = activeTab.render;

  return (
    <div ref={ref} className="lp-presentation" id="apresentacao">
      {hasVideo ? (
        <video src={PUBLIC_PRESENTATION_VIDEO_URL} controls preload="metadata" className="h-full w-full object-contain">
          O seu navegador não suporta a reprodução deste vídeo.
        </video>
      ) : (
        <div
          className="lp-showcase"
          onMouseEnter={() => setInteracting(true)}
          onMouseLeave={() => setInteracting(false)}
          onFocusCapture={() => setInteracting(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false);
          }}
        >
          <div className="lp-showcase-bar">
            <div role="tablist" aria-label="Pré-visualizações da plataforma" className="lp-showcase-tabs">
              {showcaseTabs.map((tab, index) => (
                <Button
                  key={tab.label}
                  type="button"
                  variant="ghost"
                  role="tab"
                  aria-selected={index === active}
                  tabIndex={index === active ? 0 : -1}
                  className={index === active ? "is-active" : ""}
                  onClick={() => setActive(index)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                    event.preventDefault();
                    const direction = event.key === "ArrowRight" ? 1 : -1;
                    const next = (active + direction + showcaseTabs.length) % showcaseTabs.length;
                    setActive(next);
                    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>("[role='tab']");
                    tabs?.[next]?.focus();
                  }}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <span>Pré-visualização ilustrativa</span>
          </div>
          <div className="lp-showcase-progress" aria-hidden="true">
            <span key={`${active}-${shouldPause}`} className={shouldPause ? "is-paused" : ""} />
          </div>
          <div key={active} className="lp-showcase-canvas" role="tabpanel" aria-label={activeTab.label}>
            <ActivePreview />
          </div>
        </div>
      )}
    </div>
  );
}

function RevealSection({ children, className, id }: { children: ReactNode; className: string; id?: string }) {
  const { ref, observed, revealed } = useRevealOnce<HTMLElement>();
  return <section ref={ref} id={id} className={`${className} ${observed ? "is-observed" : ""} ${revealed ? "is-revealed" : ""}`} data-reveal>{children}</section>;
}

function LandingPage() {
  const [animationsPaused, setAnimationsPaused] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (window.location.hostname === "admin.novawebinar.com") window.location.replace(`/dashboard${window.location.search}`);
  }, []);

  return (
    <div className={`nova-landing ${animationsPaused ? "lp-motion-paused" : ""}`}>
      <SiteHeader />



      <main>
        <section className="lp-hero">
          <p className="lp-eyebrow lp-enter">GRAVE UMA VEZ. APRESENTE TODOS OS DIAS.</p>
          <AnimatedHeadline paused={animationsPaused} reduced={reduced} />
          <p className="lp-hero-copy lp-enter-delayed">Transforme o seu conteúdo num webinar automatizado. Agende sessões diárias ou semanais, prepare as mensagens do chat e apresente a oferta no momento certo.</p>
          <div className="lp-hero-actions lp-enter-delayed"><Button variant="dark" size="lg" asChild><Link to="/auth/register">Criar o meu webinar <ArrowRight /></Link></Button><Button variant="secondary" size="lg" asChild><a href="#plataforma">Ver como funciona</a></Button></div>
        </section>

        <section className="lp-media-wrap" id="plataforma"><PresentationStage paused={animationsPaused} reduced={reduced} /></section>

        {!reduced && (
          <Button type="button" variant="ghost" className="lp-motion-control" aria-pressed={animationsPaused} onClick={() => setAnimationsPaused((value) => !value)}>
            {animationsPaused ? <Play /> : <Pause />}{animationsPaused ? "Retomar animações" : "Pausar animações"}
          </Button>
        )}

        <RevealSection className="lp-capabilities"><div className="lp-wide" aria-label="Capacidades da plataforma">{capabilities.map(([number, title, copy], index) => <div key={number} data-reveal-item style={{ "--lp-stagger": `${index * 75}ms` } as CSSProperties}><span>{number}</span><div><strong>{title}</strong><p>{copy}</p></div></div>)}</div></RevealSection>

        <RevealSection className="lp-features" id="funcionalidades">
          <div className="lp-wide lp-section-heading" data-reveal-item><p className="lp-eyebrow">UMA SESSÃO GRAVADA, BEM ORQUESTRADA</p><h2>Prepare o webinar antes de a sala abrir.</h2></div>
          <div className="lp-wide lp-feature-pair">
            <article className="lp-feature-block" data-reveal-item style={{ "--lp-stagger": "75ms" } as CSSProperties}><div className="lp-feature-copy"><span>01 / AGENDAR</span><h3>Da gravação à próxima sessão.</h3><p>Use um vídeo pré-gravado numa experiência de transmissão organizada. Escolha uma data, repetição diária ou semanal, just in time e, quando fizer sentido, disponibilize replay.</p><Link className="lp-inline-link" to="/funcionalidades/$slug" params={{ slug: "sessoes" }}>Saber mais sobre sessões <ArrowRight /></Link></div><div className="lp-visual-stage"><ScheduleVisual /></div></article>
            <article className="lp-feature-block is-lower" data-reveal-item style={{ "--lp-stagger": "150ms" } as CSSProperties}><div className="lp-feature-copy"><span>02 / SINCRONIZAR</span><h3>A conversa acompanha o conteúdo.</h3><p>Prepare mensagens e perguntas para momentos concretos do vídeo. As mensagens entram no momento certo da sessão e as notificações de venda aparecem no vídeo e no chat.</p><Link className="lp-inline-link" to="/funcionalidades/$slug" params={{ slug: "chat" }}>Saber mais sobre o chat <ArrowRight /></Link></div><div className="lp-visual-stage is-pink"><RoomVisual /></div></article>
          </div>
        </RevealSection>

        <RevealSection className="lp-assistance-section">
          <div className="lp-wide lp-assistance-grid"><div className="lp-feature-copy" data-reveal-item><span>03 / ASSISTIR</span><h2>Suporte com contexto, sem perder o controlo.</h2><p>O Agente IA apoia conversas privadas de suporte com base nas FAQs, objeções e conteúdo já apresentado. É identificado como assistente, pode ser pausado e encaminha situações para a equipa.</p><ul><li><Check /> Conhecimento limitado ao momento atual da sessão</li><li><Check /> Respostas orientadas pelas fontes configuradas</li><li><Check /> Escalação para atendimento humano</li></ul><Link className="lp-inline-link" to="/funcionalidades/$slug" params={{ slug: "assistente-ia" }}>Saber mais sobre o assistente <ArrowRight /></Link></div><div data-reveal-item style={{ "--lp-stagger": "90ms" } as CSSProperties}><AssistanceVisual /></div></div>
        </RevealSection>

        <RevealSection className="lp-insights" id="acompanhamento"><div className="lp-wide lp-insights-grid"><div className="lp-insights-copy" data-reveal-item><p className="lp-eyebrow">OFERTA E ANÁLISE</p><h2>Saiba o que aconteceu em cada momento.</h2><div className="lp-benefits"><div><span>01</span><p><strong>Oferta programada</strong> apresente a chamada à ação no ponto definido do vídeo.</p></div><div><span>02</span><p><strong>Participação real</strong> acompanhe inscritos, presenças, replay e cliques na oferta.</p></div><div><span>03</span><p><strong>Retenção</strong> identifique picos e o momento em que cada participante saiu.</p></div></div><Link className="lp-inline-link" to="/funcionalidades/$slug" params={{ slug: "analise" }}>Saber mais sobre a análise <ArrowRight /></Link></div><div data-reveal-item style={{ "--lp-stagger": "90ms" } as CSSProperties}><DashboardVisual /></div></div></RevealSection>

        <RevealSection className="lp-final-cta"><div className="lp-wide" data-reveal-item><p className="lp-eyebrow">O SEU CONTEÚDO, NUMA AGENDA CONSISTENTE</p><h2>Prepare uma vez. Defina quando volta a acontecer.</h2><Button variant="dark" size="lg" asChild><Link to="/auth/register">Criar o meu webinar <ArrowRight /></Link></Button></div></RevealSection>
      </main>

      <SiteFooter />
    </div>
  );
}
