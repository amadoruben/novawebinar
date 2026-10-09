import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Ellipsis, LogOut, Plus, Search } from "lucide-react";
import { lazy, Suspense, useEffect, useState, type ElementType, type ReactNode } from "react";
import { toast } from "sonner";
import iconAsset from "@/assets/brand/convertewebinar-icon.svg";
import {
  BottomNav,
  PageHeader,
  type BackLink,
  type Crumb,
  type RailItem,
} from "@/components/ds/navigation";
import { Avatar } from "@/components/panel-modal";
import { NAV_ICON, navGroups, roleLabels, SidebarNav } from "@/components/ui/dashboard-sidebar";
import { NotificationsBell } from "@/components/notifications-bell";
import { PageLoader, useInitialPageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { switchWorkspace, useAdminHostRedirect, useWorkspace, type Workspace } from "@/lib/data";
import { useCreditsRoute, useIntegrationsRoute, useSettingsRoute } from "@/lib/modal-route";
import { cn } from "@/lib/utils";
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
  bleed = false,
  rail = false,
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
  /** Sem margens nem largura máxima: a página ocupa a área toda (o editor do webinar). */
  bleed?: boolean;
  /** O menu da plataforma fica recolhido, só com ícones. */
  rail?: boolean;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  useAdminHostRedirect();
  // «Mais» no menu de baixo do telemóvel: o resto da navegação numa folha que sobe.
  const [moreOpen, setMoreOpen] = useState(false);
  // A pesquisa (⌘K): no computador abre pela barra lateral, no telemóvel pela lupa de cima.
  const [searching, setSearching] = useState(false);
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

  // ⌘K / Ctrl+K abre a pesquisa em qualquer página do painel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearching((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
  const sidebarCollapsed = (rail || collapsed || tabletViewport) && !mobileViewport;

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
  const credits = useCreditsRoute();
  const tabPaths = new Set(tabItems.map((t) => t.to));
  const moreGroups = navGroups(role)
    .map((g) => ({ ...g, items: g.items.filter((it) => !tabPaths.has(it.to)) }))
    .filter((g) => g.items.length);
  const morePick = (to: string) => {
    setMoreOpen(false);
    if (to === "/integrations") integrations.go([]);
    else if (to === "/credits") credits.go([]);
    else if (to === "/settings") settings.go([]);
    else void navigate({ to: to as never });
  };
  const moreActive = (to: string) =>
    to === "/integrations"
      ? integrations.open
      : to === "/credits"
        ? credits.open
        : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <div className="min-h-screen bg-background">
      {showLoader && (
        <div className="fixed inset-0 z-[100] isolate flex h-[100dvh] w-screen items-center justify-center bg-card">
          <PageLoader className="min-h-0 h-full bg-card" label="A carregar o painel" />
        </div>
      )}
      <div
        aria-hidden={showLoader ? true : undefined}
        className={`fixed inset-y-0 left-0 z-40 -translate-x-full transform transition-all duration-300 ease-in-out md:translate-x-0 ${
          sidebarCollapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        <SidebarNav
          className="h-full"
          collapsed={sidebarCollapsed}
          onToggleCollapse={tabletViewport ? undefined : toggleCollapsed}
          role={role}
          searching={searching}
          onSearchingChange={setSearching}
        />
      </div>
      <div
        aria-hidden={showLoader ? true : undefined}
        className={`flex min-h-screen flex-col transition-all duration-300 ${showLoader ? "invisible" : "visible"} ${sidebarCollapsed ? "md:pl-[72px]" : "md:pl-[260px]"}`}
      >
        <MobileHeader
          home={supportOnly ? "/support" : "/dashboard"}
          workspace={workspace}
          onSearch={() => setSearching(true)}
          onProfile={() => settings.go([])}
        />
        <main
          className={
            bleed
              ? "flex w-full min-h-[calc(100dvh-3.5rem)] flex-1 flex-col pb-32 md:min-h-0 md:pb-0"
              : `mx-auto flex w-full max-w-[1480px] min-h-[calc(100dvh-3.5rem)] flex-1 flex-col px-4 pt-4 pb-32 md:min-h-0 md:pb-10 ${compact ? "md:px-6 md:pt-6" : "md:px-8 md:pt-8"}`
          }
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
        extra={{
          label: "Mais",
          icon: Ellipsis,
          onClick: () => setMoreOpen(true),
          // Aceso também quando a página aberta é uma das do «Mais» (Contactos, Créditos…).
          active: moreOpen || moreGroups.some((g) => g.items.some((it) => moreActive(it.to))),
        }}
      />
      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        groups={moreGroups}
        isActive={moreActive}
        onPick={morePick}
        workspace={workspace}
      />
      {/* Integrações, Definições e Créditos: pop-ups por cima da página onde se está
          (#integracoes, #definicoes, #creditos). */}
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
      {authorized && credits.open && (
        <Suspense fallback={null}>
          <CreditsModal />
        </Suspense>
      )}
    </div>
  );
}

const IntegrationsModal = lazy(() => import("@/components/integrations-modal"));
const SettingsModal = lazy(() => import("@/components/settings-modal"));
const CreditsModal = lazy(() => import("@/components/credits-modal"));

/**
 * A barra fina do telemóvel: a marca, a pesquisa, os avisos e a conta. No computador a
 * navegação, a pesquisa e a conta vivem na barra lateral.
 */
export function MobileHeader({
  home,
  workspace,
  onSearch,
  onProfile,
}: {
  home: "/support" | "/dashboard";
  workspace: Workspace | null | undefined;
  onSearch: () => void;
  onProfile: () => void;
}) {
  return (
    <header className="glass sticky top-0 z-20 flex h-14 items-center justify-between gap-3 px-4 md:hidden">
      <Link to={home} className="flex min-w-0 items-center gap-2" aria-label="Convertewebinar">
        <img src={iconAsset} alt="" className="size-7" draggable={false} />
        <span className="truncate text-[15px] font-semibold tracking-[-0.04em]">
          Convertewebinar
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        {workspace?.isTest && <TestBadge />}
        <button
          type="button"
          onClick={onSearch}
          aria-label="Pesquisar"
          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-[var(--hover-ghost)]"
        >
          <Search className="size-5" strokeWidth={1.5} />
        </button>
        <NotificationsBell quiet />
        <button
          type="button"
          onClick={onProfile}
          aria-label="Perfil e definições"
          className="ml-1 cursor-pointer rounded-full"
        >
          {workspace ? (
            <Avatar workspace={workspace} />
          ) : (
            <span className="block size-8 rounded-full bg-chip" />
          )}
        </button>
      </div>
    </header>
  );
}

/**
 * O «Mais» do telemóvel: o que não cabe nos quatro separadores de baixo, em mosaicos
 * grandes por grupo, e a conta no topo (abre as Definições).
 */
export function MoreSheet({
  open,
  onOpenChange,
  groups,
  isActive,
  onPick,
  workspace,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: { heading: string; items: { to: string; title: string; icon: ElementType }[] }[];
  isActive: (to: string) => boolean;
  onPick: (to: string) => void;
  workspace: Workspace | null | undefined;
}) {
  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão terminada");
    window.location.href = "/auth/login";
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="scrollbar-thin max-h-[88dvh] overflow-y-auto rounded-t-[20px] px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] md:hidden [&>button]:top-4 [&>button]:right-4 [&>button]:flex [&>button]:size-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-chip [&>button]:opacity-100 [&>button>svg]:size-[18px]"
      >
        <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-gray-300" aria-hidden />
        <SheetTitle className="sr-only">Mais</SheetTitle>
        <SheetDescription className="sr-only">O resto do menu e a sua conta.</SheetDescription>
        {/* Num div: as regras [&>button] acima só valem para o X da folha. */}
        <div>
          {workspace && (
            <button
              type="button"
              onClick={() => onPick("/settings")}
              className="flex w-[calc(100%-3rem)] cursor-pointer items-center gap-3 rounded-xl py-1 text-left"
            >
              <Avatar workspace={workspace} className="size-10 text-[15px]" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[15px] font-medium">
                  {workspace.fullName || "A minha conta"}
                </span>
                <span className="block truncate text-[12px] text-muted-foreground">
                  {workspace.organizationName} · {roleLabels[workspace.role]}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-gray-500" aria-hidden />
            </button>
          )}
          <div className="mt-4 flex flex-col gap-4">
            {groups.map((g) => (
              <section key={g.heading}>
                <h3 className="mb-2 px-1 text-[12px] font-medium text-gray-600">{g.heading}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {g.items.map((it) => {
                    const active = isActive(it.to);
                    return (
                      <button
                        key={it.to}
                        type="button"
                        onClick={() => onPick(it.to)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-[76px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl px-1 text-[13px] leading-tight transition-colors",
                          active
                            ? "bg-accent font-medium text-accent-700"
                            : "bg-gray-100 text-foreground active:bg-gray-200",
                        )}
                      >
                        <it.icon
                          className={cn("size-6", active ? "text-brand" : "text-gray-800")}
                          strokeWidth={1.6}
                          aria-hidden
                        />
                        <span className="max-w-full truncate">{it.title}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            {workspace && workspace.organizations.length > 1 && (
              <section>
                <h3 className="mb-2 px-1 text-[12px] font-medium text-gray-600">
                  Espaço de trabalho
                </h3>
                <div className="flex flex-col gap-1.5">
                  {workspace.organizations.map((org) => {
                    const current = org.id === workspace.organizationId;
                    return (
                      <button
                        key={org.id}
                        type="button"
                        disabled={current}
                        onClick={() => switchWorkspace(org.id)}
                        className={cn(
                          "flex h-12 cursor-pointer items-center gap-2 rounded-xl px-4 text-left text-[14px] disabled:cursor-default",
                          current ? "bg-chip font-medium" : "bg-gray-100 active:bg-gray-200",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{org.name}</span>
                        {org.isTest && <TestBadge />}
                        {current && (
                          <span className="text-[12px] text-muted-foreground">Actual</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl text-[14px] text-destructive active:bg-gray-100"
            >
              <LogOut className="size-[18px]" strokeWidth={1.75} aria-hidden /> Terminar sessão
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

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
