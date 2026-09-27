import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Headset,
  Clapperboard,
  LayoutDashboard,
  LogOut,
  MonitorPlay,
  Plug,
  Radio,
  Settings2,
  Users,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import brandAsset from "@/assets/brand/convertewebinar-logo.svg";
import iconAsset from "@/assets/brand/convertewebinar-icon.svg";
import { Button } from "@/components/ui/button";
import { canAttend, canManageTeam, canOpenPath, type WorkspaceRole } from "@/lib/support/model";

type NavItem = {
  to: string;
  title: string;
  icon: React.ElementType;
  exact?: boolean;
  /** Quem vê a entrada, além do que a função já pode abrir. */
  show?: (role: WorkspaceRole | undefined) => boolean;
};

const groups: { heading?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: "/dashboard", title: "Painel", icon: LayoutDashboard, exact: true },
      { to: "/webinars", title: "Webinars", icon: Clapperboard },
      { to: "/calendar", title: "Calendário", icon: CalendarDays },
      { to: "/live-view", title: "Vista ao vivo", icon: Radio },
    ],
  },
  {
    heading: "Atendimento",
    items: [
      { to: "/support", title: "Atendimento", icon: Headset, show: canAttend },
      { to: "/cases", title: "Casos", icon: ClipboardList, show: canAttend },
      { to: "/team", title: "Equipas", icon: UsersRound, show: canManageTeam },
    ],
  },
  {
    heading: "Conteúdo",
    items: [
      { to: "/library", title: "Biblioteca", icon: MonitorPlay },
      { to: "/contacts", title: "Contactos", icon: Users },
      { to: "/analytics", title: "Analytics", icon: ChartColumn },
    ],
  },
  {
    heading: "Conta",
    items: [
      { to: "/integrations", title: "Integrações", icon: Plug },
      { to: "/credits", title: "Saldo de IA", icon: Wallet },
    ],
  },
];

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

  const visible = (item: NavItem) => canOpenPath(role, item.to) && (item.show?.(role) ?? true);
  const home = role === "support" ? "/support" : "/dashboard";

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão terminada");
    window.location.href = "/auth/login";
  };

  const row = (item: NavItem) => {
    const active = isActive(item);
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onClose}
        title={collapsed ? item.title : undefined}
        aria-label={item.title}
        className={`group flex min-h-10 items-center rounded-md border-l-2 px-3 py-2.5 text-[0.9rem] transition-colors ${
          collapsed ? "justify-center" : "gap-3"
        } ${
          active
            ? "border-primary bg-primary/6 font-medium text-foreground"
            : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <item.icon className="size-[19px] shrink-0" strokeWidth={1.75} />
        {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>}
      </Link>
    );
  };

  return (
    <div
      className={`relative flex h-full flex-col border-r border-border/60 bg-card font-sans ${
        collapsed ? "w-[72px]" : "w-[260px]"
      } ${className}`}
    >
      <div className="flex h-24 shrink-0 items-center gap-2 px-5">
        <Link to={home} className="flex min-w-0 flex-1 items-center" onClick={onClose}>
          <img
            src={collapsed ? iconAsset : brandAsset}
            alt="Convertewebinar"
            className={`select-none object-contain ${collapsed ? "h-9 w-9" : "h-10 w-full max-w-[184px]"}`}
            draggable={false}
          />
        </Link>
        {onClose && (
          <Button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            variant="ghost"
            size="icon"
            className="md:hidden"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {onToggleCollapse && (
        <Button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Abrir menu" : "Recolher menu"}
          title={collapsed ? "Abrir menu" : "Recolher menu"}
          variant="outline"
          size="icon"
          className="absolute -right-3 top-9 z-20 hidden size-6 rounded-full bg-card shadow-[var(--shadow-raised)] md:flex"
        >
          {collapsed ? (
            <ChevronRight className="size-3.5 shrink-0" strokeWidth={2} />
          ) : (
            <ChevronLeft className="size-3.5 shrink-0" strokeWidth={2} />
          )}
        </Button>
      )}

      <div className="flex flex-1 flex-col gap-7 overflow-y-auto px-3 pt-7 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups
          .map((group) => ({ ...group, items: group.items.filter(visible) }))
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.heading ?? "main"} className="flex flex-col gap-0.5">
              {group.heading && !collapsed && (
                <span className="mb-1.5 px-3 text-xs font-semibold tracking-wider text-muted-foreground/60 uppercase">
                  {group.heading}
                </span>
              )}
              {group.items.map(row)}
            </div>
          ))}
      </div>

      <div className="flex flex-col gap-0.5 p-3">
        {row({ to: "/settings", title: "Definições", icon: Settings2 })}
        <Button
          type="button"
          onClick={signOut}
          title={collapsed ? "Terminar sessão" : undefined}
          variant="ghost"
          className={`min-h-10 w-full items-center rounded-md border-l-2 border-transparent px-3 py-2.5 text-[0.9rem] font-normal text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
            collapsed ? "justify-center" : "gap-3"
          }`}
        >
          <span className="flex size-[19px] shrink-0 items-center justify-center">
            <LogOut className="!size-[19px]" strokeWidth={1.75} />
          </span>
          {!collapsed && <span className="min-w-0 flex-1 text-left">Terminar sessão</span>}
        </Button>
      </div>
    </div>
  );
}
