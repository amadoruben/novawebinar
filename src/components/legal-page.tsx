import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div data-site data-surface="base" className="nova-landing">
      <SiteHeader />
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
