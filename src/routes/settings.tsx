import { friendlyError } from "@/lib/friendly-error";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useWorkspace } from "@/lib/data";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Definições | Convertewebinar" },
      { name: "description", content: "Perfil e preferências da organização." },
      { property: "og:title", content: "Definições | Convertewebinar" },
      { property: "og:description", content: "Configure a sua conta e organização." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: workspace } = useWorkspace();
  const invalidate = useInvalidate();
  const [fullName, setFullName] = useState("");
  const [locale, setLocale] = useState("pt-PT");
  const [orgName, setOrgName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!workspace) return;
    setFullName(workspace.fullName);
    setLocale(workspace.locale);
    setOrgName(workspace.organizationName);
  }, [workspace]);

  const uploadAvatar = async (file: File) => {
    if (!workspace) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um ficheiro de imagem.");
      return;
    }
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${workspace.userId}/avatar-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setUploadingAvatar(false);
      toast.error("Não foi possível carregar a imagem.");
      return;
    }
    const { data: signed, error: signError } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (signError || !signed) {
      setUploadingAvatar(false);
      toast.error("Não foi possível gerar o endereço da imagem.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: signed.signedUrl, updated_at: new Date().toISOString() })
      .eq("id", workspace.userId);
    setUploadingAvatar(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    invalidate(["workspace"]);
    toast.success("Fotografia atualizada.");
  };

  const saveProfile = async () => {
    if (!workspace) return;
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

  const saveOrg = async () => {
    if (!workspace) return;
    const { error } = await supabase
      .from("organizations")
      .update({ name: orgName.trim() })
      .eq("id", workspace.organizationId);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    invalidate(["workspace"]);
    toast.success("Workspace atualizado.");
  };

  return (
    <AppShell
      title="Definições"
      description="Faça a gestão do seu perfil e do espaço de trabalho."
      action={false}
    >
      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-6">
          <section className="max-w-3xl rounded-card bg-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Informações pessoais</h2>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="relative">
                {workspace?.avatarUrl ? (
                  <img
                    src={workspace.avatarUrl}
                    alt={workspace.fullName || "Fotografia de perfil"}
                    className="size-20 rounded-full object-cover ring-2 ring-border"
                  />
                ) : (
                  <span className="flex size-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                    {(workspace?.fullName ?? "?").trim().charAt(0).toUpperCase() || "?"}
                  </span>
                )}
                <Button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  aria-label="Carregar fotografia"
                  size="icon"
                  className="absolute -bottom-2 -right-2 size-10 rounded-full"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Camera className="size-4" />
                  )}
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Fotografia de perfil</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Imagem quadrada fica melhor. Máximo 5 MB.
                </p>
              </div>
              <input
                ref={avatarInputRef}
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
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <Label>Nome</Label>
                <Input
                  className="mt-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input className="mt-2" value={workspace?.email ?? ""} readOnly />
              </div>
              <div>
                <Label>Idioma</Label>
                <Input
                  className="mt-2"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                />
              </div>
            </div>
            <Button className="mt-6" onClick={saveProfile} disabled={saving}>
              Guardar alterações
            </Button>
          </section>
        </TabsContent>

        <TabsContent value="workspace" className="mt-6">
          <section className="max-w-3xl rounded-card bg-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Organização</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <Label>Nome do workspace</Label>
                <Input
                  className="mt-2"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
              <div>
                <Label>Plano</Label>
                <Input className="mt-2" value={workspace?.plan ?? ""} readOnly />
              </div>
              <div>
                <Label>O seu papel</Label>
                <Input className="mt-2" value={workspace?.role ?? ""} readOnly />
              </div>
            </div>
            <Button className="mt-6" onClick={saveOrg}>
              Guardar workspace
            </Button>
          </section>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
