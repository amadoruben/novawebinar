import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Plus } from "lucide-react";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import iconAsset from "@/assets/brand/convertewebinar-icon.svg";
import { BottomNav, PageHeader, type BackLink, type Crumb, type RailItem } from "@/components/ds/navigation";
import { NAV_ICON, SidebarNav } from "@/components/ui/dashboard-sidebar";
import { NotificationsBell } from "@/components/notifications-bell";
import { PageLoader, useInitialPageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAdminHostRedirect, useWorkspace } from "@/lib/data";
import { useIntegrationsRoute, useSettingsRoute } from "@/lib/modal-route";
import { usePresence } from "@/lib/support/hooks";
import { canAttend, canOpenPath } from "@/lib/support/model";

export function AppShell({
  children,
  title,
  description,
  action = true,
  compact = false,
  crumbs,
  back,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  action?: boolean | ReactNode;
  compact?: boolean;
  /** Migalhas por cima do título (páginas de detalhe). */
  crumbs?: Crumb[];
  /** Botão voltar circular à esquerda do título. */
  back?: BackLink;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  useAdminHostRedirect();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(false);
  // Entre 768 e 1023 px a barra lateral fica recolhida (só ícones) para o conteúdo respirar.
  const [tabletViewport, setTabletViewport] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("nw-sidebar-collapsed") === "1");
    const mobile = window.matchMedia("(max-width: 767px)");
    const tablet = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const updateViewport = () => {
      setMobileViewport(mobile.matches);
      setTabletViewport(tablet.matches);
    };
    updateViewport();
    mobile.addEventListener("change", updateViewport);
    tablet.addEventListener("change", updateViewport);
    return () => {
      mobile.removeEventListener("change", updateViewport);
      tablet.removeEventListener("change", updateViewport);
    };
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem("nw-sidebar-collapsed", prev ? "0" : "1");
      return !prev;
    });
  };
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const { data: workspace } = useWorkspace();
  const role = workspace?.role;
  const supportOnly = role === "support";

  // Quem atende conta como presente com qualquer página do painel aberta, não
  // só a do Atendimento; sem isto passava a offline e deixava de receber casos.
  usePresence(workspace?.organizationId, canAttend(role));

  // A função "suporte" só abre o atendimento. As permissões a sério estão na
  // base de dados; isto evita mostrar-lhe páginas vazias.
  const blocked = !canOpenPath(role, pathname);
  useEffect(() => {
    if (blocked) void navigate({ to: "/support", search: { c: undefined }, replace: true });
  }, [blocked, navigate]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) navigate({ to: "/auth/login" });
      else setAuthorized(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate({ to: "/auth/login" });
      else setAuthorized(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  const showLoader = useInitialPageLoader(!authorized);
  const sidebarCollapsed = (collapsed || tabletViewport) && !mobileViewport;

  const initial = (workspace?.fullName ?? "?").trim().charAt(0).toUpperCase() || "?";

  const tabItems: RailItem[] = supportOnly
    ? [
        { to: "/support", label: "Atendimento", icon: NAV_ICON.support },
        { to: "/cases", label: "Casos", icon: NAV_ICON.cases },
        { to: "/contacts", label: "Contactos", icon: NAV_ICON.contacts },
      ]
    : [
        { to: "/dashboard", label: "Painel", icon: NAV_ICON.dashboard, exact: true },
        { to: "/webinars", label: "Webinars", icon: NAV_ICON.webinars },
        { to: "/calendar", label: "Agenda", icon: NAV_ICON.calendar },
        { to: "/automations", label: "Automações", icon: NAV_ICON.automations },
      ];
  const tabActive = (item: RailItem) =>
    item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
  const integrations = useIntegrationsRoute();
  const settings = useSettingsRoute();

  return (
    <div className="min-h-screen bg-background">
      {showLoader && (
        <div className="fixed inset-0 z-[100] isolate flex h-[100dvh] w-screen items-center justify-center bg-card">
          <PageLoader className="min-h-0 h-full bg-card" label="A carregar o painel" />
        </div>
      )}
      <div
        aria-hidden={showLoader ? true : undefined}
        className={`fixed inset-y-0 left-0 z-40 transform transition-all duration-300 ease-in-out md:translate-x-0 ${
          sidebarCollapsed ? "w-[72px]" : "w-[260px]"
        } ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <SidebarNav
          className="h-full"
          collapsed={sidebarCollapsed}
          onToggleCollapse={tabletViewport ? undefined : toggleCollapsed}
          onClose={() => setMenuOpen(false)}
          role={role}
        />
      </div>
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-navy/30 backdrop-blur-[2px] md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div
        aria-hidden={showLoader ? true : undefined}
        className={`flex min-h-screen flex-col transition-all duration-300 ${showLoader ? "invisible" : "visible"} ${sidebarCollapsed ? "md:pl-[72px]" : "md:pl-[260px]"}`}
      >
        {/* No computador a navegação, a pesquisa e a conta vivem na barra lateral;
            no telemóvel fica só uma barra fina com a marca e os avisos. */}
        <header className="glass sticky top-0 z-20 flex h-14 items-center justify-between gap-3 px-4 md:hidden">
          <Link
            to={supportOnly ? "/support" : "/dashboard"}
            className="flex items-center gap-2"
            aria-label="Convertewebinar"
          >
            <img src={iconAsset} alt="" className="size-7" draggable={false} />
            <span className="text-[15px] font-semibold tracking-[-0.04em]">Convertewebinar</span>
          </Link>
          <div className="flex items-center gap-1.5">
            {workspace?.isTest && <TestBadge />}
            <NotificationsBell quiet />
            <button
              type="button"
              onClick={() => settings.go([])}
              aria-label="Perfil e definições"
              className="cursor-pointer"
            >
              {workspace?.avatarUrl ? (
                <img
                  src={workspace.avatarUrl}
                  alt={workspace.fullName || "Fotografia de perfil"}
                  className="size-8 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-full bg-navy text-[13px] text-white">
                  {initial}
                </span>
              )}
            </button>
          </div>
        </header>
        <main
          className={`mx-auto flex w-full max-w-[1480px] min-h-[calc(100dvh-3.5rem)] flex-1 flex-col px-4 pt-4 pb-32 md:min-h-0 md:pb-10 ${compact ? "md:px-6 md:pt-6" : "md:px-8 md:pt-8"}`}
        >
          {title && (
            <PageHeader
              title={title}
              description={description}
              crumbs={crumbs}
              back={back}
              compact={compact}
              toolbar={
                typeof action === "boolean"
                  ? action &&
                    !supportOnly && (
                      <Button asChild>
                        <Link to="/webinars/new">
                          <Plus />
                          Novo webinar
                        </Link>
                      </Button>
                    )
                  : action
              }
            />
          )}
          {blocked ? null : children}
        </main>
      </div>
      <BottomNav
        items={tabItems}
        isActive={tabActive}
        hidden={showLoader}
        extra={{ label: "Menu", icon: Menu, onClick: () => setMenuOpen(true), active: menuOpen }}
      />
      {/* Integrações e Definições: pop-ups por cima da página onde se está (#integracoes, #definicoes). */}
      {authorized && integrations.open && (
        <Suspense fallback={null}>
          <IntegrationsModal />
        </Suspense>
      )}
      {authorized && settings.open && (
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
      )}
    </div>
  );
}

const IntegrationsModal = lazy(() => import("@/components/integrations-modal"));
const SettingsModal = lazy(() => import("@/components/settings-modal"));

/** Conta de teste: dados fictícios e nenhum envio real. */
function TestBadge() {
  return (
    <span
      className="shrink-0 rounded-xs bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-warning uppercase"
      title="Conta de teste: dados fictícios, nada sai para destinos reais"
    >
      Teste
    </span>
  );
}
