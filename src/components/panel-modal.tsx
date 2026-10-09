/**
 * Moldura dos pop-ups do painel (Integrações, Definições), como as definições da Manus:
 * 1092 × 590 com margem à volta, um só fundo, menu à esquerda separado por uma linha e o
 * conteúdo sempre com a mesma largura. No telemóvel e no tablet ao alto ocupa a altura
 * toda, menos a margem, com o nome em cima e as secções em botões que quebram de linha.
 */
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Workspace } from "@/lib/data";
import { cn } from "@/lib/utils";

export function PanelDialog({
  title,
  description,
  onClose,
  sidebar,
  mobileNav,
  mobileTitle,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  /** Menu da esquerda (computador). */
  sidebar: ReactNode;
  /** As mesmas entradas, em botões que quebram de linha (telemóvel). */
  mobileNav: ReactNode;
  /** O nome em cima no telemóvel (por omissão, o título). */
  mobileTitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* O X da base, um pouco maior e com área de toque redonda. */}
      <DialogContent className="flex h-[calc(100dvh-2rem)] w-[min(1092px,calc(100vw-2rem))] lg:h-[min(590px,calc(100dvh-4rem))] max-w-none gap-0 overflow-hidden bg-background p-0 sm:p-0 [&>button]:top-3 [&>button]:right-3 [&>button]:rounded-full [&>button]:p-1.5 [&>button]:opacity-80 [&>button]:hover:bg-[var(--hover-ghost)] [&>button>svg]:size-5">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>

        <aside className="scrollbar-thin hidden w-[224px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-hairline px-3 py-5 md:flex">
          {sidebar}
        </aside>

        <main className="scrollbar-thin min-w-0 flex-1 overflow-y-auto px-5 pt-2 pb-10 md:px-[52px] md:pt-12">
          {/* Telemóvel: o nome ao lado do X e todas as secções à vista, nada cortado. */}
          <p className="mb-3 flex min-h-10 items-center pr-10 text-[17px] font-semibold tracking-[-0.02em] text-foreground md:hidden">
            {mobileTitle ?? title}
          </p>
          <nav
            aria-label={title}
            className="mb-6 flex flex-wrap gap-1.5 md:hidden [&>button]:border [&>button]:border-hairline"
          >
            {mobileNav}
          </nav>
          <div className="mx-auto w-full max-w-[768px]">{children}</div>
        </main>
      </DialogContent>
    </Dialog>
  );
}

/** Título do menu da esquerda. */
export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 text-[15px] font-semibold tracking-[-0.02em] text-foreground">{children}</p>
  );
}

export function PanelNavGroup({ heading, children }: { heading?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      {heading && <span className="mb-1 px-3 text-[12px] text-gray-600">{heading}</span>}
      {children}
    </div>
  );
}

/** O fundo do menu, depois de uma linha (como "Criar uma equipa" e "Obter ajuda" na referência). */
export function PanelNavFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto flex flex-col gap-0.5 border-t border-hairline pt-3">{children}</div>
  );
}

/** Uma entrada do menu: ícone de traço fino, cinzento, laranja quando activa. */
export function PanelNavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 shrink-0 cursor-pointer items-center gap-3 rounded-md px-3 text-left text-[14px] tracking-[-0.01em] transition-colors",
        active ? "bg-chip text-foreground" : "text-gray-800 hover:bg-[var(--hover-ghost)]",
      )}
    >
      <Icon
        className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-gray-700")}
        strokeWidth={1.75}
        aria-hidden
      />
      {label}
    </button>
  );
}

export function PaneHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string | undefined;
  onBack?: (() => void) | undefined;
}) {
  return (
    <header className="mb-6 border-b border-hairline pb-5">
      <div className="flex items-center gap-1.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="-ml-2 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-[var(--hover-ghost)]"
          >
            <ChevronLeft className="size-5" strokeWidth={1.75} />
          </button>
        )}
        <h2 className="text-2xl text-foreground">{title}</h2>
      </div>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </header>
  );
}

/** Uma caixa branca com título por cima ("Visão geral", "Informações pessoais"…). */
export function PanelSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-7 first:mt-0", className)}>
      <h3 className="mb-3 text-[15px] font-medium text-foreground">{title}</h3>
      <div className="space-y-4 rounded-xl border border-hairline bg-white p-5 text-sm text-gray-800">
        {children}
      </div>
    </section>
  );
}

export function Avatar({
  workspace,
  className = "size-8",
}: {
  workspace: Workspace;
  className?: string;
}) {
  const name = workspace.fullName.trim() || "?";
  return workspace.avatarUrl ? (
    <img
      src={workspace.avatarUrl}
      alt=""
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  ) : (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-navy text-[13px] text-white",
        className,
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** A pessoa e a organização, no fundo do menu; abre as Definições. */
export function PanelProfile({
  workspace,
  onClick,
}: {
  workspace: Workspace;
  onClick: () => void;
}) {
  const name = workspace.fullName.trim() || "A minha conta";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Definições de ${name}`}
      className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--hover-ghost)]"
    >
      <Avatar workspace={workspace} />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-[14px] text-foreground">{name}</span>
        <span className="truncate text-[11px] text-muted-foreground">
          {workspace.organizationName}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-gray-500" aria-hidden />
    </button>
  );
}
