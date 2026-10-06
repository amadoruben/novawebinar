import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Blocks,
  Calendar,
  SquareActivity,
  ChevronsUpDown,
  ContactRound,
  LayoutGrid,
  Inbox,
  Library,
  LogOut,
  MessagesSquare,
  PanelLeft,
  MonitorDot,
  Search,
  Settings,
  WalletMinimal,
  UserRoundCog,
  Video,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import iconAsset from "@/assets/brand/convertewebinar-icon.svg";
import { NotificationsBell } from "@/components/notifications-bell";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchWorkspace, useWorkspace } from "@/lib/data";
import { useIntegrationsRoute, useSettingsRoute } from "@/lib/modal-route";
import { canAttend, canManageTeam, canOpenPath, type WorkspaceRole } from "@/lib/support/model";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  title: string;
  icon: React.ElementType;
  exact?: boolean;
  /** Quem vê a entrada, além do que a função já pode abrir. */
  show?: (role: WorkspaceRole | undefined) => boolean;
};

/*
 * Organização da navegação: só o essencial em cima, o resto em secções
 * discretas e a conta em baixo (referência: barras laterais simples, sem ruído).
 */
// Ícones da referência do projecto (convertewebinar-design: layout-grid, calendar,
// square-activity…) e próprios da Convertewebinar, diferentes dos da NovaWebinar.
export const NAV_ICON = {
  dashboard: LayoutGrid,
  webinars: Video,
  calendar: Calendar,
  support: MessagesSquare,
  contacts: ContactRound,
  automations: Zap,
  live: MonitorDot,
  cases: Inbox,
  analytics: SquareActivity,
  library: Library,
  team: UserRoundCog,
  integrations: Blocks,
  credits: WalletMinimal,
  settings: Settings,
} as const;

const MAIN: NavItem[] = [
  { to: "/dashboard", title: "Painel", icon: NAV_ICON.dashboard, exact: true },
  { to: "/webinars", title: "Webinars", icon: NAV_ICON.webinars },
  { to: "/calendar", title: "Agenda", icon: NAV_ICON.calendar },
  { to: "/support", title: "Atendimento", icon: NAV_ICON.support, show: canAttend },
  { to: "/contacts", title: "Contactos", icon: NAV_ICON.contacts },
  { to: "/automations", title: "Automações", icon: NAV_ICON.automations },
];

const SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Operação",
    items: [
      { to: "/live-view", title: "Ao vivo", icon: NAV_ICON.live },
      { to: "/cases", title: "Casos", icon: NAV_ICON.cases, show: canAttend },
      { to: "/analytics", title: "Análises", icon: NAV_ICON.analytics },
      { to: "/library", title: "Biblioteca", icon: NAV_ICON.library },
    ],
  },
];

const ACCOUNT: NavItem[] = [
  { to: "/team", title: "Utilizadores", icon: NAV_ICON.team, show: canManageTeam },
  { to: "/integrations", title: "Integrações", icon: NAV_ICON.integrations },
  { to: "/credits", title: "Créditos", icon: NAV_ICON.credits },
];

const roleLabels: Record<WorkspaceRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  support: "Suporte",
};

export function SidebarNav({
  className = "",
  collapsed = false,
  onToggleCollapse,
  onClose,
  role,
}: {
  /** Função de quem está a ver: decide as entradas do menu. */
  role?: WorkspaceRole | undefined;
  className?: string | undefined;
  collapsed?: boolean | undefined;
  onToggleCollapse?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
}) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const integrations = useIntegrationsRoute();
  const settings = useSettingsRoute();
  const { data: workspace } = useWorkspace();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const visible = (item: NavItem) => canOpenPath(role, item.to) && (item.show?.(role) ?? true);
  const home = role === "support" ? "/support" : "/dashboard";
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);

  const main = MAIN.filter(visible);
  const sections = SECTIONS.map((s) => ({ ...s, items: s.items.filter(visible) })).filter((s) => s.items.length);
  const account = ACCOUNT.filter(visible);
  const everything = [...main, ...sections.flatMap((s) => s.items), ...account];

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

  const go = (to: string, search?: Record<string, string | undefined>) => {
    setSearching(false);
    setQuery("");
    onClose?.();
    if (to === "/integrations") return integrations.go([]);
    if (to === "/settings") return settings.go([]);
    void navigate({ to: to as never, search: search as never });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão terminada");
    window.location.href = "/auth/login";
  };

  const row = (item: NavItem) => {
    // Integrações abre um pop-up por cima da página onde se está, em vez de mudar de página.
    const modal = item.to === "/integrations";
    const active = modal ? integrations.open : isActive(item);
    const props = {
      title: collapsed ? item.title : undefined,
      "aria-label": item.title,
      "aria-current": active ? ("page" as const) : undefined,
      className: cn(
        "group flex cursor-pointer items-center text-left transition-colors duration-[var(--duration-fast)]",
        collapsed
          ? "mx-auto size-10 justify-center rounded-full"
          : "h-9 gap-3 rounded-md px-3 text-[14px] tracking-[-0.01em]",
        active
          ? "bg-chip text-foreground"
          : "text-gray-800 hover:bg-[var(--hover-ghost)] hover:text-foreground",
      ),
    };
    const content = (
      <>
        <item.icon
          className={cn(
            "size-[18px] shrink-0",
            active ? "text-brand" : "text-gray-700 group-hover:text-foreground",
          )}
          strokeWidth={1.75}
        />
        {!collapsed && <span className="min-w-0 flex-1 truncate">{item.title}</span>}
      </>
    );
    return modal ? (
      <button
        key={item.to}
        type="button"
        onClick={() => {
          onClose?.();
          integrations.go([]);
        }}
        {...props}
      >
        {content}
      </button>
    ) : (
      <Link key={item.to} to={item.to} onClick={onClose} {...props}>
        {content}
      </Link>
    );
  };

  const name = workspace?.fullName?.trim() || "A minha conta";
  const initial = name.charAt(0).toUpperCase();
  const avatar = workspace?.avatarUrl ? (
    <img src={workspace.avatarUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] text-white">
      {initial}
    </span>
  );

  const iconButton =
    "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-[var(--hover-ghost)] hover:text-foreground";

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border-r border-hairline bg-sidebar-surface font-sans",
        collapsed ? "w-[72px]" : "w-[260px]",
        className,
      )}
    >
      {/* Cabeçalho: marca, pesquisa e recolher, como nas referências. */}
      <div className={cn("flex shrink-0 items-center gap-1 pt-5 pb-4", collapsed ? "flex-col gap-3 px-3" : "px-3")}>
        <Link
          to={home}
          onClick={onClose}
          aria-label="Convertewebinar"
          className={cn("flex min-w-0 items-center gap-2.5", !collapsed && "flex-1 pl-1")}
        >
          <img src={iconAsset} alt="" className="size-7 shrink-0 select-none" draggable={false} />
          {!collapsed && (
            <span className="truncate text-[15px] font-semibold tracking-[-0.04em] text-foreground">
              Convertewebinar
            </span>
          )}
        </Link>
        <div className={cn("flex items-center", collapsed ? "flex-col gap-1" : "gap-0.5")}>
          <button
            type="button"
            className={iconButton}
            onClick={() => setSearching(true)}
            title="Pesquisar (⌘K)"
            aria-label="Pesquisar"
          >
            <Search className="size-[17px]" strokeWidth={1.6} />
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              className={cn(iconButton, "hidden md:inline-flex")}
              onClick={onToggleCollapse}
              title={collapsed ? "Abrir menu" : "Recolher menu"}
              aria-label={collapsed ? "Abrir menu" : "Recolher menu"}
            >
              <PanelLeft className="size-[17px]" strokeWidth={1.6} />
            </button>
          )}
          {onClose && (
            <button type="button" className={cn(iconButton, "md:hidden")} onClick={onClose} aria-label="Fechar menu">
              <X className="size-[17px]" strokeWidth={1.6} />
            </button>
          )}
        </div>
      </div>

      <nav
        aria-label="Navegação principal"
        className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 pb-3"
      >
        <div className={cn("flex flex-col", collapsed ? "gap-2" : "gap-0.5")}>{main.map((item) => row(item))}</div>
        {sections.map((section) => (
          <div key={section.heading} className={cn("flex flex-col", collapsed ? "gap-2" : "gap-0.5")}>
            {!collapsed ? (
              <span className="mb-1 px-3 text-[12px] text-gray-600">{section.heading}</span>
            ) : (
              <span className="mx-auto mb-1 h-px w-6 bg-gray-250" aria-hidden />
            )}
            {section.items.map((item) => row(item))}
          </div>
        ))}
        {/* Conta: ferramentas da conta, no fundo da lista (desliza com ela). */}
        {account.length > 0 && (
          <div className={cn("mt-auto flex flex-col", collapsed ? "gap-2" : "gap-0.5")}>
            {!collapsed ? (
              <span className="mb-1 px-3 text-[12px] text-gray-600">Conta</span>
            ) : (
              <span className="mx-auto mb-1 h-px w-6 bg-gray-250" aria-hidden />
            )}
            {account.map((item) => row(item))}
          </div>
        )}
      </nav>

      {/* A pessoa, sempre visível no fundo (menu com definições e sessão). */}
      <div className="shrink-0 px-3 pb-4">
        <div
          className={cn(
            "flex items-center border-t border-[var(--border-subtle)] pt-3",
            collapsed ? "flex-col gap-2" : "gap-1",
          )}
        >
          {/* O nome abre as Definições (pop-up); a seta, a troca de workspace e a saída. */}
          <button
            type="button"
            onClick={() => go("/settings")}
            className={cn(
              "flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md text-left transition-colors hover:bg-[var(--hover-ghost)]",
              collapsed ? "p-1" : "flex-1 py-1 pr-2 pl-1",
              settings.open && "bg-chip",
            )}
            aria-label="Perfil e definições"
          >
            {avatar}
            {!collapsed && (
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[14px] tracking-[-0.01em]">{name}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {workspace?.organizationName ?? (workspace ? roleLabels[workspace.role] : "")}
                </span>
              </span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(iconButton, "data-[state=open]:bg-chip", collapsed && "size-7")}
                aria-label="Conta e espaço de trabalho"
                title="Conta e espaço de trabalho"
              >
                <ChevronsUpDown className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-64">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-sm text-foreground">{name}</span>
                <span>{workspace ? roleLabels[workspace.role] : ""}</span>
              </DropdownMenuLabel>
              {workspace && workspace.organizations.length > 1 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Espaço de trabalho</DropdownMenuLabel>
                  {workspace.organizations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      disabled={org.id === workspace.organizationId}
                      onSelect={() => switchWorkspace(org.id)}
                    >
                      <span className="truncate">{org.name}</span>
                      {org.isTest && (
                        <span className="shrink-0 rounded-xs bg-warning-soft px-1.5 py-0.5 text-[10px] tracking-wide text-warning uppercase">
                          Teste
                        </span>
                      )}
                      <span className="ml-auto pl-3 text-xs text-muted-foreground">{roleLabels[org.role]}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => go("/settings")}>
                <Settings /> Definições
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut /> Terminar sessão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="hidden md:block">
            <NotificationsBell quiet side={collapsed ? "right" : "top"} align="start" />
          </div>
        </div>
      </div>

      <CommandDialog open={searching} onOpenChange={setSearching}>
        <CommandInput placeholder="Pesquisar webinars ou ir para…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>Sem resultados.</CommandEmpty>
          {query.trim() && canOpenPath(role, "/webinars") && (
            <CommandGroup heading="Webinars">
              <CommandItem forceMount value={`pesquisar ${query}`} onSelect={() => go("/webinars", { q: query.trim() })}>
                <Search /> Pesquisar webinars por «{query.trim()}»
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup heading="Ir para">
            {everything.map((item) => (
              <CommandItem key={item.to} value={item.title} onSelect={() => go(item.to)}>
                <item.icon /> {item.title}
              </CommandItem>
            ))}
            <CommandItem value="Definições" onSelect={() => go("/settings")}>
              <Settings /> Definições
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
