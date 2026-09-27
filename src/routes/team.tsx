import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, MessageCircle, Pencil, Plus, Trash2, UserPlus, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptySection } from "@/components/page-primitives";
import { Avatar } from "@/components/support/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { whatsappLink } from "@/lib/contacts";
import { slugify, useWorkspace } from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import {
  useCases,
  useDepartments,
  useRoutingRules,
  useSkills,
  useStaff,
  useSupportInvalidate,
  useSupportRealtime,
  useSupportSetup,
  type StaffMember,
} from "@/lib/support/hooks";
import {
  canManageTeam,
  INTENTS,
  isOpenStatus,
  PRIORITIES,
  staffStatusLabel,
  type DepartmentRow,
  type RuleRow,
  type SkillRow,
} from "@/lib/support/model";
import { deleteSkill, inviteStaff, removeStaffAccess } from "@/lib/support/support.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Equipas | Convertewebinar" },
      { name: "description", content: "Quem atende, em que departamento, com que competências e por que regras." },
    ],
  }),
  component: TeamPage,
});

const NONE = "none";

function TeamPage() {
  const { data: workspace } = useWorkspace();
  const organizationId = workspace?.organizationId;
  const manager = canManageTeam(workspace?.role);
  const { data: setup } = useSupportSetup(organizationId);
  useSupportRealtime(organizationId);
  // Só depois de os valores iniciais existirem.
  const scope = setup ? organizationId : undefined;
  const { data: staff = [], isLoading } = useStaff(scope);
  const { data: departments = [] } = useDepartments(scope);
  const { data: skills = [] } = useSkills(scope);
  const { data: rules = [] } = useRoutingRules(scope);
  const { data: cases = [] } = useCases(manager ? scope : undefined);

  return (
    <AppShell
      title="Equipas"
      description="Quem atende, em que departamento e com que competências. É por aqui que cada caso chega à pessoa certa."
      action={false}
    >
      {!manager && workspace && (
        <p className="mb-4 rounded-lg border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Só o proprietário e os administradores podem alterar a equipa.
        </p>
      )}
      {isLoading || !organizationId ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Tabs defaultValue="staff">
          <TabsList className="mb-5 flex h-auto flex-wrap justify-start">
            <TabsTrigger value="staff">Funcionários · {staff.filter((s) => s.active).length}</TabsTrigger>
            <TabsTrigger value="departments">Departamentos · {departments.length}</TabsTrigger>
            <TabsTrigger value="skills">Competências · {skills.length}</TabsTrigger>
            <TabsTrigger value="rules">Regras de encaminhamento</TabsTrigger>
          </TabsList>
          <TabsContent value="staff">
            <StaffTab
              organizationId={organizationId}
              staff={staff}
              departments={departments}
              skills={skills}
              manager={manager}
              myUserId={workspace?.userId ?? ""}
            />
          </TabsContent>
          <TabsContent value="departments">
            <DepartmentsTab
              organizationId={organizationId}
              departments={departments}
              staff={staff}
              openByDepartment={countBy(
                cases.filter((c) => isOpenStatus(c.status)),
                (c) => c.department_id,
              )}
              manager={manager}
            />
          </TabsContent>
          <TabsContent value="skills">
            <SkillsTab organizationId={organizationId} skills={skills} staff={staff} manager={manager} />
          </TabsContent>
          <TabsContent value="rules">
            <RulesTab rules={rules} departments={departments} skills={skills} manager={manager} />
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}

function countBy<T>(rows: T[], key: (row: T) => string | null) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    if (k) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

/* ---------- Funcionários ---------- */

type StaffForm = {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  job_title: string;
  department_id: string | null;
  skills: string[];
  capacity: number;
  is_supervisor: boolean;
  active: boolean;
};

const EMPTY_STAFF: StaffForm = {
  id: null,
  name: "",
  email: "",
  phone: "",
  job_title: "",
  department_id: null,
  skills: [],
  capacity: 5,
  is_supervisor: false,
  active: true,
};

function StaffTab({
  organizationId,
  staff,
  departments,
  skills,
  manager,
  myUserId,
}: {
  organizationId: string;
  staff: StaffMember[];
  departments: DepartmentRow[];
  skills: SkillRow[];
  manager: boolean;
  myUserId: string;
}) {
  const invalidate = useSupportInvalidate();
  const invite = useServerFn(inviteStaff);
  const remove = useServerFn(removeStaffAccess);
  const [form, setForm] = useState<StaffForm | null>(null);
  const [link, setLink] = useState<{ person: StaffMember; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const sendInvite = async (person: StaffMember) => {
    setBusy(person.id);
    try {
      const result = await invite({ data: { staffId: person.id } });
      invalidate("staff");
      if (result.link) setLink({ person, url: result.link });
      else
        toast.success(
          `${person.name} já tinha conta: passa a ver este espaço de trabalho quando entrar com a palavra-passe que já usa.`,
        );
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível criar o convite."));
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (person: StaffMember) => {
    if (!window.confirm(`Tirar o acesso a ${person.name}? Os casos que tem ficam sem responsável.`)) return;
    setBusy(person.id);
    try {
      await remove({ data: { staffId: person.id } });
      invalidate("staff", "cases");
      toast.success(`${person.name} deixou de ter acesso.`);
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível tirar o acesso."));
    } finally {
      setBusy(null);
    }
  };

  const skillName = (slug: string) => skills.find((s) => s.slug === slug)?.name ?? slug;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Registe quem atende e convide cada pessoa a entrar. Só recebe casos quem está com o painel aberto e
          marcou “Disponível” ou “Online”.
        </p>
        {manager && (
          <Button onClick={() => setForm(EMPTY_STAFF)}>
            <Plus /> Novo funcionário
          </Button>
        )}
      </div>

      {staff.length === 0 ? (
        <EmptySection
          title="Ainda não há funcionários"
          description="Registe a primeira pessoa da equipa. Enquanto não houver ninguém, os casos ficam na fila do departamento."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Competências</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Casos</TableHead>
                <TableHead>Acesso</TableHead>
                {manager && <TableHead className="w-28 text-right">Acções</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((person) => (
                <TableRow key={person.id} className={cn(!person.active && "opacity-60")}>
                  <TableCell>
                    <span className="flex items-center gap-3">
                      <Avatar name={person.name} presence={person.presence} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-medium">
                          <span className="truncate">{person.name}</span>
                          {person.is_supervisor && <Badge variant="info">Supervisor</Badge>}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[person.job_title, person.email].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>{departments.find((d) => d.id === person.department_id)?.name ?? "—"}</TableCell>
                  <TableCell>
                    <span className="flex max-w-xs flex-wrap gap-1">
                      {person.skills.length === 0 && <span className="text-muted-foreground">—</span>}
                      {person.skills.map((slug) => (
                        <Badge key={slug} variant="outline">
                          {skillName(slug)}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell>{person.active ? staffStatusLabel(person.presence) : "Inactivo"}</TableCell>
                  <TableCell className="tabular-nums">
                    {person.openCases}/{person.capacity}
                  </TableCell>
                  <TableCell>
                    {person.user_id ? (
                      <Badge variant="success">Com acesso</Badge>
                    ) : (
                      <Badge variant="warning">Por convidar</Badge>
                    )}
                  </TableCell>
                  {manager && (
                    <TableCell>
                      <span className="flex justify-end gap-1">
                        {!person.user_id && person.active && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            disabled={busy === person.id}
                            onClick={() => void sendInvite(person)}
                            aria-label={`Convidar ${person.name}`}
                            title="Convidar"
                          >
                            <UserPlus />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() =>
                            setForm({
                              id: person.id,
                              name: person.name,
                              email: person.email,
                              phone: person.phone ?? "",
                              job_title: person.job_title,
                              department_id: person.department_id,
                              skills: person.skills,
                              capacity: person.capacity,
                              is_supervisor: person.is_supervisor,
                              active: person.active,
                            })
                          }
                          aria-label={`Editar ${person.name}`}
                          title="Editar"
                        >
                          <Pencil />
                        </Button>
                        {person.active && person.user_id !== myUserId && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive"
                            disabled={busy === person.id}
                            onClick={() => void revoke(person)}
                            aria-label={`Tirar o acesso a ${person.name}`}
                            title="Tirar o acesso"
                          >
                            <UserX />
                          </Button>
                        )}
                      </span>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <StaffDialog
        form={form}
        organizationId={organizationId}
        departments={departments}
        skills={skills}
        onClose={() => setForm(null)}
      />
      <InviteDialog link={link} onClose={() => setLink(null)} />
    </div>
  );
}

function StaffDialog({
  form,
  organizationId,
  departments,
  skills,
  onClose,
}: {
  form: StaffForm | null;
  organizationId: string;
  departments: DepartmentRow[];
  skills: SkillRow[];
  onClose: () => void;
}) {
  const invalidate = useSupportInvalidate();
  const [draft, setDraft] = useState<StaffForm>(EMPTY_STAFF);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (form) setDraft(form);
  }, [form]);
  const set = <K extends keyof StaffForm>(key: K, value: StaffForm[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const row = {
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
      phone: draft.phone.trim() || null,
      job_title: draft.job_title.trim(),
      department_id: draft.department_id,
      skills: draft.skills,
      capacity: Math.min(50, Math.max(1, Math.round(draft.capacity) || 1)),
      is_supervisor: draft.is_supervisor,
      active: draft.active,
    };
    const { error } = draft.id
      ? await supabase
          .from("support_staff")
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq("id", draft.id)
      : await supabase.from("support_staff").insert({ ...row, organization_id: organizationId });
    setSaving(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Já existe um funcionário com este email."
          : friendlyError(error, "Não foi possível guardar."),
      );
      return;
    }
    invalidate("staff");
    toast.success(draft.id ? "Funcionário actualizado." : "Funcionário registado. Falta convidá-lo a entrar.");
    onClose();
  };

  return (
    <Dialog open={form !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
          <DialogDescription>
            O departamento e as competências decidem que casos chegam a esta pessoa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" id="staff-name">
              <Input id="staff-name" value={draft.name} onChange={(e) => set("name", e.target.value)} required maxLength={100} />
            </Field>
            <Field label="Função" id="staff-title">
              <Input
                id="staff-title"
                value={draft.job_title}
                onChange={(e) => set("job_title", e.target.value)}
                maxLength={80}
                placeholder="Ex.: Comercial"
              />
            </Field>
            <Field label="Email" id="staff-email">
              <Input
                id="staff-email"
                type="email"
                value={draft.email}
                onChange={(e) => set("email", e.target.value)}
                required
                maxLength={255}
              />
            </Field>
            <Field label="Telefone" id="staff-phone">
              <Input
                id="staff-phone"
                value={draft.phone}
                onChange={(e) => set("phone", e.target.value)}
                maxLength={30}
                placeholder="+244 923 000 000"
              />
            </Field>
            <Field label="Departamento" id="staff-department">
              <Select
                value={draft.department_id ?? NONE}
                onValueChange={(value) => set("department_id", value === NONE ? null : value)}
              >
                <SelectTrigger id="staff-department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem departamento</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Casos ao mesmo tempo" id="staff-capacity">
              <Input
                id="staff-capacity"
                type="number"
                min={1}
                max={50}
                value={draft.capacity}
                onChange={(e) => set("capacity", Number(e.target.value))}
              />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Competências</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {skills.map((skill) => (
                <label key={skill.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.skills.includes(skill.slug)}
                    onCheckedChange={(checked) =>
                      set(
                        "skills",
                        checked === true
                          ? [...draft.skills, skill.slug]
                          : draft.skills.filter((s) => s !== skill.slug),
                      )
                    }
                  />
                  {skill.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-3 rounded-lg border p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Supervisor
                <span className="block text-xs text-muted-foreground">
                  Recebe os casos escalados e os que passam do prazo.
                </span>
              </span>
              <Switch checked={draft.is_supervisor} onCheckedChange={(value) => set("is_supervisor", value)} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Activo
                <span className="block text-xs text-muted-foreground">Inactivo não recebe casos.</span>
              </span>
              <Switch checked={draft.active} onCheckedChange={(value) => set("active", value)} />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function InviteDialog({
  link,
  onClose,
}: {
  link: { person: StaffMember; url: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [link]);
  if (!link) return <Dialog open={false} />;
  const message = `Olá ${link.person.name.split(" ")[0]}, este é o seu acesso ao atendimento. Abra o link e defina a sua palavra-passe: ${link.url}`;
  const wa = whatsappLink(link.person.phone, message);
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convite para {link.person.name}</DialogTitle>
          <DialogDescription>
            Envie este link só a esta pessoa. Quem o abrir entra com a conta dela e define a palavra-passe. O
            link só é mostrado agora.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label="Link de convite" />
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(link.url);
              setCopied(true);
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <DialogFooter>
          {wa && (
            <Button asChild variant="outline">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> Enviar no WhatsApp
              </a>
            </Button>
          )}
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Departamentos ---------- */

function DepartmentsTab({
  organizationId,
  departments,
  staff,
  openByDepartment,
  manager,
}: {
  organizationId: string;
  departments: DepartmentRow[];
  staff: StaffMember[];
  openByDepartment: Map<string, number>;
  manager: boolean;
}) {
  const invalidate = useSupportInvalidate();
  const [name, setName] = useState("");

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    const { error } = await supabase.from("support_departments").insert({
      organization_id: organizationId,
      name: clean,
      slug: slugify(clean),
      position: departments.length + 1,
    });
    if (error) {
      toast.error(error.code === "23505" ? "Já existe um departamento com este nome." : friendlyError(error));
      return;
    }
    setName("");
    invalidate("departments");
  };

  const rename = async (department: DepartmentRow, value: string) => {
    const clean = value.trim();
    if (!clean || clean === department.name) return;
    const { error } = await supabase.from("support_departments").update({ name: clean }).eq("id", department.id);
    if (error) toast.error(friendlyError(error));
    invalidate("departments");
  };

  const makeFallback = async (department: DepartmentRow) => {
    // Só pode haver um: primeiro sai o actual, depois entra o novo.
    const current = departments.find((d) => d.is_fallback);
    if (current) await supabase.from("support_departments").update({ is_fallback: false }).eq("id", current.id);
    const { error } = await supabase
      .from("support_departments")
      .update({ is_fallback: true })
      .eq("id", department.id);
    if (error) toast.error(friendlyError(error));
    invalidate("departments");
  };

  const remove = async (department: DepartmentRow) => {
    const people = staff.filter((s) => s.department_id === department.id).length;
    const open = openByDepartment.get(department.id) ?? 0;
    const warning =
      people || open
        ? `${department.name} tem ${people} funcionário(s) e ${open} caso(s) aberto(s), que ficam sem departamento. Apagar?`
        : `Apagar ${department.name}?`;
    if (!window.confirm(warning)) return;
    const { error } = await supabase.from("support_departments").delete().eq("id", department.id);
    if (error) toast.error(friendlyError(error));
    invalidate("departments", "staff", "rules", "cases");
  };

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Cada pedido vai para um departamento. O departamento geral recebe o que não cabe em mais nenhum.
      </p>
      <ul className="divide-y rounded-lg border bg-card">
        {departments.map((department) => (
          <li key={department.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Input
              defaultValue={department.name}
              disabled={!manager}
              onBlur={(e) => void rename(department, e.target.value)}
              aria-label={`Nome de ${department.name}`}
              className="h-9 max-w-xs"
            />
            {department.is_fallback && <Badge variant="info">Departamento geral</Badge>}
            <span className="ml-auto text-sm text-muted-foreground">
              {staff.filter((s) => s.department_id === department.id && s.active).length} funcionário(s) ·{" "}
              {openByDepartment.get(department.id) ?? 0} caso(s) aberto(s)
            </span>
            {manager && !department.is_fallback && (
              <>
                <Button size="sm" variant="ghost" onClick={() => void makeFallback(department)}>
                  Tornar geral
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-destructive"
                  onClick={() => void remove(department)}
                  aria-label={`Apagar ${department.name}`}
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {manager && (
        <form onSubmit={add} className="flex max-w-md gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Novo departamento"
            maxLength={60}
            aria-label="Nome do novo departamento"
          />
          <Button type="submit" variant="outline" disabled={!name.trim()}>
            <Plus /> Adicionar
          </Button>
        </form>
      )}
    </div>
  );
}

/* ---------- Competências ---------- */

function SkillsTab({
  organizationId,
  skills,
  staff,
  manager,
}: {
  organizationId: string;
  skills: SkillRow[];
  staff: StaffMember[];
  manager: boolean;
}) {
  const invalidate = useSupportInvalidate();
  const drop = useServerFn(deleteSkill);
  const [name, setName] = useState("");

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    const { error } = await supabase
      .from("support_skills")
      .insert({ organization_id: organizationId, name: clean, slug: slugify(clean) });
    if (error) {
      toast.error(error.code === "23505" ? "Essa competência já existe." : friendlyError(error));
      return;
    }
    setName("");
    invalidate("skills");
  };

  const remove = async (skill: SkillRow) => {
    const people = staff.filter((s) => s.skills.includes(skill.slug)).length;
    if (
      !window.confirm(
        people
          ? `${people} funcionário(s) têm “${skill.name}”. Apagar tira-a a todos e às regras que a pedem. Apagar?`
          : `Apagar “${skill.name}”?`,
      )
    )
      return;
    try {
      await drop({ data: { skillId: skill.id } });
      invalidate("skills", "staff", "rules");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível apagar."));
    }
  };

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        O que cada pessoa sabe tratar. Um caso pode pedir uma ou mais competências; quem as tem todas recebe
        primeiro.
      </p>
      <ul className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <li key={skill.id}>
            <Badge variant="outline" className="gap-2 py-1.5 pl-3 pr-1.5 text-sm font-normal">
              {skill.name}
              <span className="text-xs text-muted-foreground">
                {staff.filter((s) => s.skills.includes(skill.slug)).length}
              </span>
              {manager && (
                <button
                  type="button"
                  onClick={() => void remove(skill)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label={`Apagar ${skill.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </Badge>
          </li>
        ))}
      </ul>
      {manager && (
        <form onSubmit={add} className="flex max-w-md gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nova competência"
            maxLength={40}
            aria-label="Nome da nova competência"
          />
          <Button type="submit" variant="outline" disabled={!name.trim()}>
            <Plus /> Adicionar
          </Button>
        </form>
      )}
    </div>
  );
}

/* ---------- Regras ---------- */

function RulesTab({
  rules,
  departments,
  skills,
  manager,
}: {
  rules: RuleRow[];
  departments: DepartmentRow[];
  skills: SkillRow[];
  manager: boolean;
}) {
  const invalidate = useSupportInvalidate();
  const update = async (rule: RuleRow, changes: Partial<RuleRow>) => {
    const { error } = await supabase
      .from("support_routing_rules")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", rule.id);
    if (error) toast.error(friendlyError(error, "Não foi possível guardar a regra."));
    invalidate("rules");
  };

  const ordered = INTENTS.map((intent) => ({ intent, rule: rules.find((r) => r.intent === intent.id) })).filter(
    (row): row is { intent: (typeof INTENTS)[number]; rule: RuleRow } => Boolean(row.rule),
  );

  return (
    <div className="space-y-4">
      <div className="max-w-3xl space-y-1 text-sm text-muted-foreground">
        <p>
          Para cada tipo de pedido: o departamento, as competências que pede, a urgência e o prazo para a
          primeira resposta de uma pessoa.
        </p>
        <p>
          A pessoa é escolhida por esta ordem: departamento e competências, quem está disponível, quem tem
          capacidade, quem já atendeu o contacto, quem tem menos casos.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Competências</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Prazo (min)</TableHead>
              <TableHead>Sempre uma pessoa</TableHead>
              <TableHead>Pedir ligação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map(({ intent, rule }) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">{intent.label}</TableCell>
                <TableCell>
                  <Select
                    value={rule.department_id ?? NONE}
                    disabled={!manager}
                    onValueChange={(value) =>
                      void update(rule, { department_id: value === NONE ? null : value })
                    }
                  >
                    <SelectTrigger className="h-9 w-44" aria-label={`Departamento de ${intent.label}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Departamento geral</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <SkillPicker
                    value={rule.required_skills}
                    skills={skills}
                    disabled={!manager}
                    onChange={(required_skills) => void update(rule, { required_skills })}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={rule.priority}
                    disabled={!manager}
                    onValueChange={(priority) => void update(rule, { priority })}
                  >
                    <SelectTrigger className="h-9 w-32" aria-label={`Prioridade de ${intent.label}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    max={10080}
                    defaultValue={rule.sla_minutes}
                    disabled={!manager}
                    aria-label={`Prazo de ${intent.label}, em minutos`}
                    className="h-9 w-24"
                    onBlur={(e) => {
                      const minutes = Math.min(10080, Math.max(1, Math.round(Number(e.target.value)) || 1));
                      if (minutes !== rule.sla_minutes) void update(rule, { sla_minutes: minutes });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={rule.always_human}
                    disabled={!manager}
                    aria-label={`${intent.label}: sempre uma pessoa`}
                    onCheckedChange={(always_human) => void update(rule, { always_human })}
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={rule.call_required}
                    disabled={!manager}
                    aria-label={`${intent.label}: pedir ligação`}
                    onCheckedChange={(call_required) => void update(rule, { call_required })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        “Sempre uma pessoa”: a IA nunca responde sozinha a este tipo de pedido, mesmo que saiba a resposta.
      </p>
    </div>
  );
}

function SkillPicker({
  value,
  skills,
  disabled,
  onChange,
}: {
  value: string[];
  skills: SkillRow[];
  disabled: boolean;
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const names = value.map((slug) => skills.find((s) => s.slug === slug)?.name ?? slug);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="h-9 max-w-[14rem] justify-start font-normal"
      >
        <span className="truncate">{names.length ? names.join(", ") : "Nenhuma"}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Competências pedidas</DialogTitle>
            <DialogDescription>Quem tiver todas recebe primeiro.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {skills.map((skill) => (
              <label key={skill.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.includes(skill.slug)}
                  onCheckedChange={(checked) =>
                    setDraft(
                      checked === true ? [...draft, skill.slug] : draft.filter((s) => s !== skill.slug),
                    )
                  }
                />
                {skill.name}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
