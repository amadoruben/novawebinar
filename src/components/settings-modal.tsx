/**
 * Definições num pop-up, na mesma moldura das Integrações: perfil e workspace. Abre-se pelo
 * nome no fundo do menu (#definicoes) ou por cima das Integrações; o X volta ao sítio de onde veio.
 */
import { Building2, Camera, Loader2, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Avatar,
  PaneHeader,
  PanelDialog,
  PanelNavButton,
  PanelNavFooter,
  PanelNavGroup,
  PanelSection,
  PanelTitle,
} from "@/components/panel-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useWorkspace, type Workspace } from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import { useSettingsRoute } from "@/lib/modal-route";

const SECTIONS = [
  {
    id: "perfil",
    label: "Perfil",
    icon: UserRound,
    subtitle: "A sua fotografia, o nome e o idioma.",
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: Building2,
    subtitle: "A organização onde estão os webinars, os contactos e as integrações.",
  },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

/** Aberto pelo endereço (#definicoes/secção): o X fecha-o. */
export default function SettingsRouteModal() {
  const { section, go } = useSettingsRoute();
  return <SettingsModal section={section} onSection={(id) => go([id])} onClose={() => go(null)} />;
}

export function SettingsModal({
  section,
  onSection,
  onClose,
}: {
  section: string | undefined;
  onSection: (id: SectionId) => void;
  onClose: () => void;
}) {
  const { data: workspace } = useWorkspace();
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão terminada");
    window.location.href = "/auth/login";
  };

  const nav = (s: (typeof SECTIONS)[number]) => (
    <PanelNavButton
      key={s.id}
      icon={s.icon}
      label={s.label}
      active={s.id === current.id}
      onClick={() => onSection(s.id)}
    />
  );
  const out = (
    <PanelNavButton
      icon={LogOut}
      label="Terminar sessão"
      active={false}
      onClick={() => void signOut()}
    />
  );

  return (
    <PanelDialog
      title="Definições"
      description="Perfil e workspace."
      onClose={onClose}
      sidebar={
        <>
          {workspace && (
            <div className="flex items-center gap-2.5 px-3">
              <Avatar workspace={workspace} />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[14px] text-foreground">{workspace.fullName}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {workspace.organizationName}
                </span>
              </span>
            </div>
          )}
          <PanelNavGroup heading="Conta">{SECTIONS.map(nav)}</PanelNavGroup>
          <PanelNavFooter>{out}</PanelNavFooter>
        </>
      }
      mobileNav={
        <>
          {SECTIONS.map(nav)}
          {out}
        </>
      }
    >
      <PaneHeader title={current.label} subtitle={current.subtitle} />
      {!workspace ? (
        <Skeleton className="h-64 w-full" />
      ) : current.id === "perfil" ? (
        <Profile key={workspace.userId} workspace={workspace} />
      ) : (
        <Organization key={workspace.organizationId} workspace={workspace} />
      )}
    </PanelDialog>
  );
}

function Profile({ workspace }: { workspace: Workspace }) {
  const invalidate = useInvalidate();
  const [fullName, setFullName] = useState(workspace.fullName);
  const [locale, setLocale] = useState(workspace.locale);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFullName(workspace.fullName);
    setLocale(workspace.locale);
  }, [workspace.fullName, workspace.locale]);

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um ficheiro de imagem.");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${workspace.userId}/avatar-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setUploading(false);
      toast.error("Não foi possível carregar a imagem.");
      return;
    }
    const { data: signed, error: signError } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (signError || !signed) {
      setUploading(false);
      toast.error("Não foi possível gerar o endereço da imagem.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: signed.signedUrl, updated_at: new Date().toISOString() })
      .eq("id", workspace.userId);
    setUploading(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    invalidate(["workspace"]);
    toast.success("Fotografia atualizada.");
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), locale, updated_at: new Date().toISOString() })
      .eq("id", workspace.userId);
    setSaving(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    invalidate(["workspace"]);
    toast.success("Perfil atualizado.");
  };

  return (
    <PanelSection title="Informações pessoais">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar workspace={workspace} className="size-16 text-xl" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Carregar fotografia"
            className="absolute -right-1 -bottom-1 flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-primary text-white disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
          </button>
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">Fotografia de perfil</p>
          <p className="text-xs text-muted-foreground">Imagem quadrada fica melhor. Máximo 5 MB.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadAvatar(file);
            e.target.value = "";
          }}
        />
      </div>
      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="perfil-nome">Nome</Label>
          <Input id="perfil-nome" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="perfil-email">Email</Label>
          <Input id="perfil-email" value={workspace.email} readOnly />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="perfil-idioma">Idioma</Label>
          <Input id="perfil-idioma" value={locale} onChange={(e) => setLocale(e.target.value)} />
        </div>
      </div>
      <Button variant="dark" onClick={save} disabled={saving || !fullName.trim()}>
        Guardar alterações
      </Button>
    </PanelSection>
  );
}

function Organization({ workspace }: { workspace: Workspace }) {
  const invalidate = useInvalidate();
  const [name, setName] = useState(workspace.organizationName);
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(workspace.organizationName), [workspace.organizationName]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({ name: name.trim() })
      .eq("id", workspace.organizationId);
    setSaving(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    invalidate(["workspace"]);
    toast.success("Workspace atualizado.");
  };

  return (
    <PanelSection title="Organização">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="org-nome">Nome do workspace</Label>
          <Input id="org-nome" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-plano">Plano</Label>
          <Input id="org-plano" value={workspace.plan} readOnly />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-papel">O seu papel</Label>
          <Input id="org-papel" value={workspace.role} readOnly />
        </div>
      </div>
      <Button
        variant="dark"
        onClick={save}
        disabled={saving || !name.trim() || name.trim() === workspace.organizationName}
      >
        Guardar workspace
      </Button>
    </PanelSection>
  );
}
