import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  Clapperboard,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { SidebarNav } from "@/components/ui/dashboard-sidebar";
import { NotificationsBell } from "@/components/notifications-bell";
import { PageLoader, useInitialPageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAdminHostRedirect, useWorkspace } from "@/lib/data";

export function AppShell({
  children,
  title,
  description,
  action = true,
  compact = false,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  action?: boolean | ReactNode;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  useAdminHostRedirect();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setCollapsed(localStorage.getItem("nw-sidebar-collapsed") === "1");
    const media = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setMobileViewport(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem("nw-sidebar-collapsed", prev ? "0" : "1");
      return !prev;
    });
  };
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const { data: workspace } = useWorkspace();

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
  const sidebarCollapsed = collapsed && !mobileViewport;

  const initial = (workspace?.fullName ?? "?").trim().charAt(0).toUpperCase() || "?";

  const tabItems = [
    { to: "/dashboard", title: "Painel", icon: LayoutDashboard, exact: true },
    { to: "/webinars", title: "Webinars", icon: Clapperboard },
    { to: "/calendar", title: "Calendário", icon: CalendarDays },
    { to: "/settings", title: "Definições", icon: Settings2 },
  ];

  const roleLabels: Record<NonNullable<typeof workspace>["role"], string> = {
    owner: "Proprietário",
    admin: "Administrador",
    member: "Membro",
    support: "Suporte",
  };

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
          onToggleCollapse={toggleCollapsed}
          onClose={() => setMenuOpen(false)}
        />
      </div>
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div
        aria-hidden={showLoader ? true : undefined}
        className={`flex min-h-screen flex-col transition-all duration-300 ${showLoader ? "invisible" : "visible"} ${collapsed ? "md:pl-[72px]" : "md:pl-[260px]"}`}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-card/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu />
            </Button>
            <form
              className="relative hidden w-72 items-center md:flex"
              onSubmit={(event) => {
                event.preventDefault();
                navigate({ to: "/webinars", search: { q: query.trim() || undefined } });
              }}
            >
              <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pesquisar webinars..."
                aria-label="Pesquisar webinars"
                className="w-full border-transparent bg-muted pl-9 hover:border-border focus-visible:bg-card"
              />
            </form>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <Link to="/settings" className="ml-2 flex items-center gap-2.5">
              {workspace?.avatarUrl ? (
                <img
                  src={workspace.avatarUrl}
                  alt={workspace.fullName || "Fotografia de perfil"}
                  className="size-9 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {initial}
                </span>
              )}
              <div className="hidden flex-col items-start sm:flex">
                <span className="text-sm font-semibold leading-tight">
                  {workspace?.fullName ?? ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {workspace ? roleLabels[workspace.role] : ""}
                </span>
              </div>
            </Link>
          </div>
        </header>
        <main
          className={`mx-auto flex w-full max-w-[1480px] min-h-[calc(100dvh-4rem)] flex-1 flex-col p-4 pb-32 md:min-h-0 md:pb-8 ${compact ? "md:px-6 md:py-5" : "md:p-8"}`}
        >
          {title && (
          <div
              className={`${compact ? "mb-4" : "mb-8"} flex flex-wrap items-start justify-between gap-4 pb-5`}
            >
              <div className="min-w-0">
                <h1
                  className={`${compact ? "text-xl md:text-2xl" : "text-2xl md:text-[1.75rem]"} font-semibold`}
                >
                  {title}
                </h1>
                {description && (
                  <p
                    className={`${compact ? "mt-0.5" : "mt-1"} text-sm leading-relaxed text-muted-foreground`}
                  >
                    {description}
                  </p>
                )}
              </div>
              {typeof action === "boolean"
                ? action && (
                    <Button asChild>
                      <Link to="/webinars/new">
                        <Plus />
                        Novo webinar
                      </Link>
                    </Button>
                  )
                : action}
            </div>
          )}
          {children}
        </main>
      </div>
      <nav
        aria-hidden={showLoader ? true : undefined}
        className={`fixed inset-x-0 bottom-0 z-30 items-stretch justify-around border-t border-border/60 bg-card pb-[env(safe-area-inset-bottom)] md:hidden ${showLoader ? "hidden" : "flex"}`}
        aria-label="Navegação principal"
      >
        {tabItems.map((item) => {
          const active = item.exact
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.title}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
