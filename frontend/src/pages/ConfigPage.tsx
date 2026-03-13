import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, Plus, Send, Loader2, LogIn, Lock, Upload, CheckCircle, ChevronDown, ChevronRight, GripVertical, Bell } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTeams, getMembers, getShifts, getOnCall, getConfig, updateConfig,
  testTelegram, createMember, updateMember, deleteMember, getMemberById,
  createShift, deleteShift, createOnCall, updateOnCall, deleteOnCall,
  login as apiLogin, setAuthToken, isAuthenticated, importXlsx,
} from "@/lib/api";
import type { Member, Shift, OnCallEntry, Team } from "@/lib/types";
import { ONCALL_TYPE_LABELS, ROLES_ANALYST, ROLES_MANAGER } from "@/lib/types";
import { toast } from "@/components/ui/use-toast";
import { ReportsTab } from "@/components/ReportsTab";
import { useAuth } from "@/lib/AuthContext";

// ─── Login Gate ──────────────────────────────────────────────────
function LoginGate({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true); setError("");
    try {
      const res = await apiLogin(user, pass);
      if (res.success) { setAuthToken(res.token); onLogin(); }
      else setError("Usuário ou senha incorretos.");
    } catch { setError("Erro ao conectar."); }
    finally { setLoading(false); }
  };

  return (
    <AppLayout title="Configurações">
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Área Restrita</CardTitle>
            <p className="text-sm text-muted-foreground">Acesso somente para administradores</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-destructive text-center bg-destructive/10 rounded p-2">{error}</p>}
            <div className="space-y-1.5">
              <Label>Usuário</Label>
              <Input value={user} onChange={e => setUser(e.target.value)} placeholder="admin" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <Button className="w-full" onClick={handleLogin} disabled={loading || !user || !pass}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// ─── Member Modal ─────────────────────────────────────────────────
function MemberModal({ open, onClose, memberId, teams }: {
  open: boolean; onClose: () => void; memberId?: string | null; teams: Team[];
}) {
  const qc = useQueryClient();
  const isEdit = !!memberId;
  const { data: existing } = useQuery({
    queryKey: ["member-edit", memberId],
    queryFn: () => getMemberById(memberId!),
    enabled: isEdit && open,
  });

  const empty: Partial<Member> = { name: "", email: "", role: "", phone: "", telegram_chat_id: "", team_id: "", technology: "", is_manager: 0, manager_order: 0 };
  const [form, setForm] = useState<Partial<Member>>(empty);
  const [synced, setSynced] = useState(false);

  if (existing && !synced) { setForm({ ...existing }); setSynced(true); }
  if (!open && synced) { setSynced(false); }

  const set = (k: keyof Member, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const isManager = !!form.is_manager;
  const roleOptions = isManager ? ROLES_MANAGER : ROLES_ANALYST;

  const mutation = useMutation({
    mutationFn: () => isEdit ? updateMember(memberId!, form) : createMember(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      onClose(); setSynced(false); setForm(empty);
      toast({ title: isEdit ? "Membro atualizado!" : "Membro criado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleClose = () => { onClose(); setSynced(false); setForm(empty); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Membro" : "Novo Membro"}</DialogTitle>
          <DialogDescription>Preencha os dados do membro.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={form.name || ""} onChange={e => set("name", e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={form.email || ""} onChange={e => set("email", e.target.value)} placeholder="user@empresa.com" />
            </div>
          </div>

          <div className="flex items-center gap-2 py-1">
            <Switch checked={!!form.is_manager} onCheckedChange={v => { set("is_manager", v ? 1 : 0); set("role", ""); }} />
            <Label className="cursor-pointer">Gestor / Manager</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Cargo *</Label>
              <Select value={form.role || ""} onValueChange={v => set("role", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Equipe</Label>
              <Select value={form.team_id || "none"} onValueChange={v => set("team_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tecnologia</Label>
              <Input value={form.technology || ""} onChange={e => set("technology", e.target.value)} placeholder="Ex: MSOC, Redes" />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={form.phone || ""} onChange={e => set("phone", e.target.value)} placeholder="(11) 99999-0000" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Telegram Chat ID</Label>
              <Input value={form.telegram_chat_id || ""} onChange={e => set("telegram_chat_id", e.target.value)} placeholder="123456789" />
            </div>
            {isManager && (
              <div className="space-y-1">
                <Label>Ordem de Escalation</Label>
                <Input type="number" min="1" value={form.manager_order || ""} onChange={e => set("manager_order", parseInt(e.target.value) || 0)} placeholder="1 = primeiro a acionar" />
                <p className="text-[10px] text-muted-foreground">Ordem de prioridade no Setor de Escalation</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shift Modal — sem campo de tipo, apenas horário ─────────────
function ShiftModal({ open, onClose, members, teams }: {
  open: boolean; onClose: () => void; members: Member[]; teams: Team[];
}) {
  const qc = useQueryClient();
  const [teamFilter, setTeamFilter] = useState("all");
  const [form, setForm] = useState({
    member_id: "", date: new Date().toISOString().split("T")[0],
    start_time: "08:00", end_time: "17:00",
    label: "", repeat: "none", repeat_end_date: "", days_of_week: [] as number[],
  });
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  // Derive shift type from start_time automatically
  function deriveType(startTime: string) {
    const h = parseInt(startTime.split(':')[0]);
    if (h >= 6 && h < 14) return 'morning';
    if (h >= 14 && h < 20) return 'afternoon';
    return 'night';
  }

  const filteredMembers = teamFilter === "all" ? members : members.filter(m => m.team_id === teamFilter);

  const mutation = useMutation({
    mutationFn: () => createShift({
      ...form,
      type: deriveType(form.start_time),
    }),
    onSuccess: (res: Record<string, unknown>) => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["shifts-config"] });
      onClose();
      const count = (res.created as number) || 1;
      toast({ title: `${count} turno${count > 1 ? 's criados' : ' criado'}!` });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const toggleDay = (d: number) => setForm(f => ({
    ...f, days_of_week: f.days_of_week.includes(d) ? f.days_of_week.filter(x => x !== d) : [...f.days_of_week, d]
  }));

  const daysLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Novo Turno</DialogTitle>
          <DialogDescription>O turno (manhã/tarde/noite) é detectado automaticamente pelo horário.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Filtrar por equipe</Label>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as equipes</SelectItem>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Analista *</Label>
              <Select value={form.member_id} onValueChange={v => set("member_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {filteredMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Data início *</Label>
            <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Hora início</Label>
              <Input type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Hora fim</Label>
              <Input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Label / Área <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input value={form.label} onChange={e => set("label", e.target.value)} placeholder="Ex: REDES, EMS, WINDOWS..." />
          </div>

          <div className="space-y-1">
            <Label>Repetição</Label>
            <Select value={form.repeat} onValueChange={v => set("repeat", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem repetição (único)</SelectItem>
                <SelectItem value="weekdays">Segunda a Sexta</SelectItem>
                <SelectItem value="everyday">Todos os dias</SelectItem>
                <SelectItem value="weekends">Finais de semana</SelectItem>
                <SelectItem value="12x36">Escala 12×36</SelectItem>
                <SelectItem value="custom">Dias específicos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.repeat === "custom" && (
            <div className="space-y-1.5">
              <Label>Dias da semana</Label>
              <div className="flex gap-1.5 flex-wrap">
                {daysLabels.map((d, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${form.days_of_week.includes(i) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.repeat !== "none" && (
            <div className="space-y-1">
              <Label>Repetir até</Label>
              <Input type="date" value={form.repeat_end_date} onChange={e => set("repeat_end_date", e.target.value)} />
            </div>
          )}

          {form.repeat === "12x36" && (
            <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
              Escala 12×36: trabalha 12h → folga 36h alternado. Os dias de trabalho são gerados automaticamente no período.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.member_id || !form.date}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── OnCall Modal ─────────────────────────────────────────────────
function OnCallModal({ open, onClose, initial, members }: {
  open: boolean; onClose: () => void; initial?: OnCallEntry | null; members: Member[];
}) {
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<Partial<OnCallEntry>>(
    initial || { type: "work", start_date: today, end_date: today, start_time: "00:00", end_time: "06:00", label: "" }
  );
  const [synced, setSynced] = useState(false);
  if (initial && !synced) { setForm({ ...initial }); setSynced(true); }
  if (!open && synced) setSynced(false);

  const set = (k: keyof OnCallEntry, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const isWork = form.type === "work";

  const oncallEligible = members.filter(m => m.team_id === 'l2' || m.team_id === 'gestao');
  const eligibleList = isWork ? oncallEligible : members;

  const mutation = useMutation({
    mutationFn: () => initial ? updateOnCall(initial.id, form) : createOnCall(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["oncall-config"] });
      qc.invalidateQueries({ queryKey: ["oncall-current"] });
      onClose(); setSynced(false);
      toast({ title: initial ? "Atualizado!" : "Criado!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleClose = () => { onClose(); setSynced(false); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar" : "Novo Sobreaviso / Ausência"}</DialogTitle>
          <DialogDescription>{isWork ? "Sobreaviso: Layer 2 e Gestão." : "Ausência: todos os membros."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1">
            <Label>Tipo *</Label>
            <Select value={form.type || "work"} onValueChange={v => { set("type", v); set("member_id", ""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ONCALL_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Analista * {isWork && <span className="text-xs text-muted-foreground">(Layer 2 / Gestão)</span>}</Label>
            <Select value={form.member_id || ""} onValueChange={v => set("member_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {eligibleList.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}{m.team_label ? ` — ${m.team_label}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data Início *</Label>
              <Input type="date" value={form.start_date || ""} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data Fim *</Label>
              <Input type="date" value={form.end_date || ""} onChange={e => set("end_date", e.target.value)} />
            </div>
          </div>
          {isWork && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Hora Início</Label>
                  <Input type="time" value={form.start_time || ""} onChange={e => set("start_time", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Hora Fim</Label>
                  <Input type="time" value={form.end_time || ""} onChange={e => set("end_time", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Label</Label>
                <Input value={form.label || ""} onChange={e => set("label", e.target.value)} placeholder="Ex: WFN, REDES, BKP" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.member_id}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Escalation Order Manager ────────────────────────────────────
function EscalationOrder({ managers }: { managers: Member[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState<Member[]>([]);

  const startEdit = () => {
    setList([...managers].sort((a, b) => (a.manager_order || 0) - (b.manager_order || 0)));
    setEditing(true);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...list];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setList(next);
  };

  const moveDown = (idx: number) => {
    if (idx === list.length - 1) return;
    const next = [...list];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setList(next);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < list.length; i++) {
        await updateMember(list[i].id, { ...list[i], manager_order: i + 1 });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      setEditing(false);
      toast({ title: "Ordem de escalation salva!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (managers.length === 0) return (
    <p className="text-sm text-muted-foreground px-4 py-3">Nenhum gestor cadastrado. Marque um membro como Gestor para configurar a ordem.</p>
  );

  return (
    <div className="px-4 pb-4">
      {!editing ? (
        <div className="space-y-2">
          {[...managers].sort((a, b) => (a.manager_order || 0) - (b.manager_order || 0)).map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/40">
              <span className="h-6 w-6 rounded-full bg-primary/80 flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">{i + 1}</span>
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold flex-shrink-0">{m.avatar}</div>
              <div className="flex-1">
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.role}</p>
              </div>
              {m.phone && <p className="text-xs text-accent font-medium">{m.phone}</p>}
            </div>
          ))}
          <Button variant="outline" size="sm" className="mt-2" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />Editar Ordem
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">Use os botões ↑ ↓ para reordenar a prioridade de escalation.</p>
          {list.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="h-6 w-6 rounded-full bg-primary/80 flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">{i + 1}</span>
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-semibold flex-shrink-0">{m.avatar}</div>
              <span className="flex-1 text-sm font-medium">{m.name}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveUp(i)} disabled={i === 0}>↑</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveDown(i)} disabled={i === list.length - 1}>↓</Button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Salvar Ordem
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Bulk Edit Modal ─────────────────────────────────────────────
function BulkEditModal({ open, onClose, count, teams, onSave }: {
  open: boolean; onClose: () => void; count: number; teams: Team[];
  onSave: (data: Partial<Member>) => void;
}) {
  const [field, setField] = useState("team_id");
  const [teamId, setTeamId] = useState("none");
  const [role, setRole] = useState("");
  const [technology, setTechnology] = useState("");

  const handleSave = () => {
    const data: Partial<Member> = {};
    if (field === "team_id") data.team_id = teamId === "none" ? "" : teamId;
    if (field === "role") data.role = role;
    if (field === "technology") data.technology = technology;
    onSave(data);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Editar em Massa</DialogTitle>
          <DialogDescription>{count} membro(s) selecionado(s). Escolha o campo a alterar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1">
            <Label>Campo a alterar</Label>
            <Select value={field} onValueChange={setField}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="team_id">Equipe</SelectItem>
                <SelectItem value="role">Cargo</SelectItem>
                <SelectItem value="technology">Tecnologia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {field === "team_id" && (
            <div className="space-y-1">
              <Label>Nova Equipe</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {field === "role" && (
            <div className="space-y-1">
              <Label>Novo Cargo</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {[...ROLES_ANALYST, ...ROLES_MANAGER].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {field === "technology" && (
            <div className="space-y-1">
              <Label>Tecnologia</Label>
              <Input value={technology} onChange={e => setTechnology(e.target.value)} placeholder="Ex: MSOC, Redes" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Aplicar a {count} membro(s)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Members Tab ─────────────────────────────────────────────────
function MembersTab({ members, teams, membersByTeam, unassigned, expandedTeams, toggleExpand, onNew, onEdit, onDelete, onBulkDelete, onBulkUpdate }: {
  members: Member[]; teams: Team[];
  membersByTeam: { team: Team; members: Member[] }[];
  unassigned: Member[];
  expandedTeams: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkUpdate: (ids: string[], data: Partial<Member>) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === members.length) setSelected(new Set());
    else setSelected(new Set(members.map(m => m.id)));
  };

  const toggleTeamSelect = (teamMembers: Member[]) => {
    const ids = teamMembers.map(m => m.id);
    const allSelected = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());
  const selectedArr = Array.from(selected);
  const hasSelection = selectedArr.length > 0;

  const MemberRow = ({ m }: { m: Member }) => (
    <tr className={`border-b hover:bg-secondary/20 transition-colors ${selected.has(m.id) ? "bg-primary/5" : ""}`}>
      <td className="px-3 py-2.5">
        <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)}
          className="h-4 w-4 rounded border-border cursor-pointer" />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-medium flex-shrink-0">{m.avatar}</div>
          <div>
            <p className="font-medium text-sm">{m.name}</p>
            {m.email && <p className="text-[10px] text-muted-foreground">{m.email}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground text-xs">{m.role || "—"}</td>
      <td className="px-4 py-2.5">{m.technology && <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">{m.technology}</span>}</td>
      <td className="px-4 py-2.5">{m.is_manager === 1 && <Badge variant="secondary" className="text-[10px]">Gestor #{m.manager_order}</Badge>}</td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(m.id)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(m.id, m.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </td>
    </tr>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Membros ({members.length})</CardTitle>
            {hasSelection && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">{selectedArr.length} selecionado(s)</span>
                <Button size="sm" variant="outline" onClick={() => setBulkEditOpen(true)} className="h-7 text-xs">
                  <Pencil className="h-3 w-3 mr-1" />Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => { onBulkDelete(selectedArr); clearSelection(); }} className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="h-3 w-3 mr-1" />Excluir
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection} className="h-7 text-xs">✕ Limpar</Button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={toggleAll} className="h-8 text-xs">
              {selected.size === members.length ? "Desmarcar Todos" : "Selecionar Todos"}
            </Button>
            <Button size="sm" onClick={onNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {membersByTeam.map(({ team, members: tm }) => {
            const expanded = expandedTeams[team.id] !== false;
            const teamSelected = tm.every(m => selected.has(m.id));
            return (
              <div key={team.id}>
                <div className="w-full flex items-center gap-2 px-3 py-2.5 bg-secondary/40 border-y">
                  <input type="checkbox" checked={teamSelected && tm.length > 0} onChange={() => toggleTeamSelect(tm)}
                    className="h-4 w-4 rounded border-border cursor-pointer flex-shrink-0" />
                  <button onClick={() => toggleExpand(team.id)} className="flex items-center gap-2 flex-1 text-sm font-semibold hover:text-primary transition-colors text-left">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {team.label} <span className="text-xs text-muted-foreground font-normal">({tm.length})</span>
                  </button>
                </div>
                {expanded && (
                  <table className="w-full text-sm"><tbody>
                    {tm.map(m => <MemberRow key={m.id} m={m} />)}
                  </tbody></table>
                )}
              </div>
            );
          })}
          {unassigned.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-secondary/30 border-y text-xs font-semibold text-muted-foreground flex items-center gap-2">
                <input type="checkbox"
                  checked={unassigned.every(m => selected.has(m.id)) && unassigned.length > 0}
                  onChange={() => toggleTeamSelect(unassigned)}
                  className="h-4 w-4 rounded border-border cursor-pointer" />
                Sem equipe ({unassigned.length})
              </div>
              <table className="w-full text-sm"><tbody>
                {unassigned.map(m => <MemberRow key={m.id} m={m} />)}
              </tbody></table>
            </div>
          )}
          {members.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Importe um XLSX em <strong>Sistema</strong> para começar.</p>}
        </CardContent>
      </Card>

      <BulkEditModal
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        count={selectedArr.length}
        teams={teams}
        onSave={(data) => { onBulkUpdate(selectedArr, data); clearSelection(); }}
      />
    </>
  );
}

// ─── Main ──────────────────────────────────────────────────────────
export default function ConfigPage() {
  const authRole = localStorage.getItem('auth_role');

  if (authRole !== 'admin') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-950/40 border border-red-800/50">
            <Lock className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
          <p className="text-muted-foreground text-sm text-center max-w-xs">
            Esta área é exclusiva para administradores.<br/>Entre em contato com o responsável.
          </p>
        </div>
      </AppLayout>
    );
  }

  return <ConfigPageInner />;
}

function ConfigPageInner() {
  const qc = useQueryClient();
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: getTeams });
  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: () => getMembers() });
  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts-config"],
    queryFn: () => getShifts({ start_date: new Date().toISOString().split("T")[0] }),
  });
  const { data: onCallEntries = [] } = useQuery({ queryKey: ["oncall-config"], queryFn: () => getOnCall() });
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: getConfig });

  const managers = members.filter(m => m.is_manager === 1);

  const [memberModal, setMemberModal] = useState<{ open: boolean; id?: string | null }>({ open: false });
  const [shiftModal, setShiftModal] = useState(false);
  const [ocModal, setOcModal] = useState<{ open: boolean; data?: OnCallEntry | null }>({ open: false });
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) => setExpandedTeams(p => ({ ...p, [id]: p[id] === undefined ? false : !p[id] }));
  useEffect(() => {
    if (teams.length > 0) {
      const init: Record<string, boolean> = {};
      teams.forEach(t => { init[t.id] = false; init[`s-${t.id}`] = false; });
      setExpandedTeams(init);
    }
  }, [teams.length]);

  const [telegramToken, setTelegramToken] = useState("");
  const [groupChatId, setGroupChatId] = useState("");
  const [notifTemplate, setNotifTemplate] = useState("");
  const [pushTemplate, setPushTemplate] = useState("");
  const [testChatId, setTestChatId] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, unknown> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const deleteMemberMut = useMutation({ mutationFn: deleteMember, onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); toast({ title: "Membro removido." }); } });
  const deleteShiftMut = useMutation({ mutationFn: deleteShift, onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts-config"] }); toast({ title: "Turno removido." }); } });
  const deleteOcMut = useMutation({ mutationFn: deleteOnCall, onSuccess: () => { qc.invalidateQueries({ queryKey: ["oncall-config"] }); toast({ title: "Evento removido." }); } });

  const saveConfigMut = useMutation({
    mutationFn: () => updateConfig({
      telegram_token: telegramToken || config?.telegram_token || "",
      telegram_group_chat_id: groupChatId || config?.telegram_group_chat_id || "",
      notification_template: notifTemplate || config?.notification_template || "",
      push_notification_template: pushTemplate || config?.push_notification_template || "",
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["config"] }); toast({ title: "Configurações salvas!" }); },
  });

  const handleTestTelegram = async () => {
    if (!testChatId) { toast({ title: "Informe um Chat ID", variant: "destructive" }); return; }
    setTestLoading(true);
    try {
      const res = await testTelegram(testChatId);
      if (res.success) toast({ title: "✅ Mensagem enviada!" });
      else toast({ title: "❌ Falha", description: res.error, variant: "destructive" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
    finally { setTestLoading(false); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null); setImportError(null);
    try {
      const res = await importXlsx(file);
      setImportResult(res);
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["shifts-config"] });
      qc.invalidateQueries({ queryKey: ["oncall-config"] });
      toast({ title: "✅ Importação concluída!" });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      setImportError(msg);
      toast({ title: "Erro na importação", description: msg, variant: "destructive" });
    } finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const membersByTeam = teams.map(team => ({ team, members: members.filter(m => m.team_id === team.id) })).filter(g => g.members.length > 0);
  const unassigned = members.filter(m => !m.team_id || !teams.find(t => t.id === m.team_id));
  const shiftsByTeam = teams.map(t => ({ team: t, shifts: shifts.filter(s => s.member_team_id === t.id) })).filter(g => g.shifts.length > 0);

  const typeColors: Record<string, string> = {
    work: "bg-oncall/20 text-oncall border-oncall/30",
    vacation: "bg-muted text-muted-foreground border-border",
    "medical-leave": "bg-red-100 text-red-700 border-red-200",
    "day-off": "bg-blue-100 text-blue-700 border-blue-200",
    "comp-time": "bg-purple-100 text-purple-700 border-purple-200",
  };

  const DEFAULT_TEMPLATE = `🔔 <b>Sobreaviso Iniciando!</b>\n\n👤 Analista: <b>{{name}}</b>\n📅 Data: {{date}}\n⏰ Horário: {{start_time}} – {{end_time}}\n🏷️ Tipo: {{label}}\n\nMantenha o celular próximo!`;

  return (
    <AppLayout title="Configurações">
      <div className="animate-fade-in">
        <Tabs defaultValue="membros" className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-secondary/50 p-1 mb-6">
            {[["membros","Membros"],["escalas","Escalas"],["sobreaviso","Sobreaviso & Ausências"],["escalation","Escalation"],["sistema","Sistema"],["relatorios","📊 Relatórios"]].map(([v, label]) => (
              <TabsTrigger key={v} value={v} className="flex-1 min-w-[80px] text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── MEMBROS ── */}
          <TabsContent value="membros">
            <MembersTab
              members={members}
              teams={teams}
              membersByTeam={membersByTeam}
              unassigned={unassigned}
              expandedTeams={expandedTeams}
              toggleExpand={toggleExpand}
              onNew={() => setMemberModal({ open: true, id: null })}
              onEdit={(id: string) => setMemberModal({ open: true, id })}
              onDelete={(id: string, name: string) => { if (confirm(`Remover ${name}?`)) deleteMemberMut.mutate(id); }}
              onBulkDelete={(ids: string[]) => {
                if (confirm(`Remover ${ids.length} membro(s) selecionado(s)?`)) {
                  ids.forEach(id => deleteMemberMut.mutate(id));
                }
              }}
              onBulkUpdate={(ids: string[], data: Partial<Member>) => {
                Promise.all(ids.map(id => updateMember(id, data))).then(() => {
                  qc.invalidateQueries({ queryKey: ["members"] });
                  toast({ title: `${ids.length} membro(s) atualizados!` });
                });
              }}
            />
          </TabsContent>
          {/* ── ESCALAS ── */}
          <TabsContent value="escalas">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Turnos a partir de hoje</CardTitle>
                <Button size="sm" onClick={() => setShiftModal(true)}><Plus className="h-4 w-4 mr-1" />Novo Turno</Button>
              </CardHeader>
              <CardContent className="p-0">
                {shiftsByTeam.map(({ team, shifts: ts }) => {
                  const expanded = expandedTeams[`s-${team.id}`] !== false;
                  return (
                    <div key={team.id}>
                      <button onClick={() => toggleExpand(`s-${team.id}`)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 bg-secondary/40 border-y text-sm font-semibold hover:bg-secondary/60 transition-colors text-left">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {team.label} <span className="text-xs text-muted-foreground font-normal">({ts.length})</span>
                      </button>
                      {expanded && (
                        <table className="w-full text-sm"><tbody>
                          {ts.slice(0, 50).map(s => (
                            <tr key={s.id} className="border-b hover:bg-secondary/20">
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[9px]">{s.avatar}</div>
                                  <span>{s.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-muted-foreground text-xs">{new Date(s.date + 'T12:00:00').toLocaleDateString("pt-BR")}</td>
                              <td className="px-4 py-2 text-muted-foreground text-xs">{s.start_time}–{s.end_time}</td>
                              <td className="px-4 py-2 text-xs text-muted-foreground">{s.label}</td>
                              <td className="px-4 py-2 text-right">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Remover?")) deleteShiftMut.mutate(s.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </td>
                            </tr>
                          ))}
                          {ts.length > 50 && <tr><td colSpan={5} className="px-4 py-2 text-xs text-muted-foreground">+{ts.length - 50} turnos...</td></tr>}
                        </tbody></table>
                      )}
                    </div>
                  );
                })}
                {shifts.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum turno. Importe XLSX ou crie manualmente.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SOBREAVISO ── */}
          <TabsContent value="sobreaviso">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Sobreaviso & Ausências</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Sobreaviso: Layer 2 e Gestão · Ausências: todos</p>
                </div>
                <Button size="sm" onClick={() => setOcModal({ open: true, data: null })}><Plus className="h-4 w-4 mr-1" />Novo</Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-secondary/30">
                      {["Analista","Período","Tipo","Label","Horário",""].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {onCallEntries.map(e => (
                        <tr key={e.id} className="border-b hover:bg-secondary/20">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[9px]">{e.avatar}</div>
                              <span className="font-medium">{e.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">
                            {new Date(e.start_date + 'T12:00:00').toLocaleDateString("pt-BR")}
                            {e.start_date !== e.end_date && ` → ${new Date(e.end_date + 'T12:00:00').toLocaleDateString("pt-BR")}`}
                          </td>
                          <td className="px-4 py-2.5"><span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeColors[e.type] || ""}`}>{ONCALL_TYPE_LABELS[e.type]}</span></td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{e.label || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{e.type === "work" ? `${e.start_time}–${e.end_time}` : "—"}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOcModal({ open: true, data: e })}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Remover?")) deleteOcMut.mutate(e.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {onCallEntries.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum evento.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ESCALATION ── */}
          <TabsContent value="escalation">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ordem de Escalation — Gestores</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Define a prioridade de acionamento no Setor de Escalation da página Equipe.</p>
              </CardHeader>
              <EscalationOrder managers={managers} />
            </Card>
          </TabsContent>

          {/* ── SISTEMA ── */}
          <TabsContent value="sistema">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" />Importar Escala — Microsoft Teams (XLSX)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                    <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
                      {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {importing ? "Importando..." : "Selecionar XLSX"}
                    </Button>
                    {config?.last_import_date && (
                      <span className="text-xs text-muted-foreground">
                        Última: {new Date(config.last_import_date).toLocaleString("pt-BR")}
                        {config.last_import_period && ` · ${config.last_import_period.replace('__', ' → ')}`}
                      </span>
                    )}
                  </div>

                  {importError && (
                    <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-sm text-red-700">
                      <p className="font-medium">Erro na importação:</p>
                      <p className="font-mono text-xs mt-1">{importError}</p>
                      <p className="text-xs mt-2 text-red-600">Verifique os logs: <code>docker logs shift-navigator --tail=30</code></p>
                    </div>
                  )}

                  {importResult && (importResult.success as boolean) && (() => {
                    const r = importResult.result as Record<string, number>;
                    const period = importResult.period as Record<string, string>;
                    return (
                      <div className="rounded-lg p-3 bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                        <div className="flex items-center gap-2 font-medium text-sm mb-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          {(importResult.isNewCycle as boolean) ? 'Novo ciclo' : 'Atualização'} — {period?.from} → {period?.to}
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-xs text-center">
                          {[['members','Membros novos'],['updated','Atualizados'],['shifts','Turnos'],['timeoff','Sobreaviso/Ausências']].map(([k, lb]) => (
                            <div key={k}><p className="text-lg font-bold">{r?.[k] || 0}</p><p className="text-muted-foreground">{lb}</p></div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground">Exporte do Microsoft Teams Shifts em XLSX e importe aqui. Novo período = limpa e reimporta. Mesmo período = atualiza.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Telegram Bot</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Token do Bot</Label>
                    <Input type="password" value={telegramToken || config?.telegram_token || ""} onChange={e => setTelegramToken(e.target.value)} placeholder="123456:ABC..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Chat ID do Grupo</Label>
                    <Input value={groupChatId || config?.telegram_group_chat_id || ""} onChange={e => setGroupChatId(e.target.value)} placeholder="-100123456789" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Modelo de Notificação</Label>
                    <Textarea value={notifTemplate || config?.notification_template || DEFAULT_TEMPLATE} onChange={e => setNotifTemplate(e.target.value)} rows={6} className="font-mono text-xs" />
                    <p className="text-xs text-muted-foreground">Variáveis: <code>{"{{name}}"}</code> <code>{"{{date}}"}</code> <code>{"{{start_time}}"}</code> <code>{"{{end_time}}"}</code> <code>{"{{label}}"}</code></p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Modelo de Notificação Push</Label>
                    <Textarea
                      value={pushTemplate || config?.push_notification_template || "🔔 {{name}} inicia sobreaviso às {{start_time}}"}
                      onChange={e => setPushTemplate(e.target.value)}
                      rows={3}
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Texto exibido na notificação push do celular. Variáveis: <code>{"{{name}}"}</code> <code>{"{{start_time}}"}</code> <code>{"{{end_time}}"}</code> <code>{"{{label}}"}</code>
                    </p>
                  </div>
                  <Button onClick={() => saveConfigMut.mutate()} disabled={saveConfigMut.isPending} className="w-full">
                    {saveConfigMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Configurações
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Testar Notificação</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Chat ID para Teste</Label>
                    <Input value={testChatId} onChange={e => setTestChatId(e.target.value)} placeholder="Seu chat ID no Telegram" />
                    <p className="text-xs text-muted-foreground">Envie <code>/start</code> para <strong>@EmsOpsBot</strong> e depois rode:<br /><code className="text-[10px]">curl "https://api.telegram.org/bot[TOKEN]/getUpdates"</code></p>
                  </div>
                  <Button variant="outline" onClick={handleTestTelegram} disabled={testLoading} className="w-full">
                    {testLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Enviar Mensagem de Teste
                  </Button>
                  <p className="text-xs text-muted-foreground pt-2 border-t">O texto enviado usa o modelo configurado ao lado com dados fictícios.</p>
                  <div className="pt-2 border-t space-y-2">
                    <p className="text-xs font-medium">Testar Push</p>
                    <Button variant="outline" className="w-full" onClick={async () => {
                      try {
                        const res = await fetch('/api/push/test', { method: 'POST', headers: { 'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}` } });
                        const data = await res.json();
                        toast({ title: `✅ Push enviado para ${data.sent} dispositivo(s)` });
                      } catch { toast({ title: 'Erro ao enviar push', variant: 'destructive' }); }
                    }}>
                      <Bell className="mr-2 h-4 w-4" />Enviar Push de Teste
                    </Button>
                    <p className="text-xs text-muted-foreground">Envia para todos os dispositivos com push ativado.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="relatorios">
            <ReportsTab />
          </TabsContent>
        </Tabs>
      </div>

      <MemberModal open={memberModal.open} memberId={memberModal.id} teams={teams} onClose={() => setMemberModal({ open: false })} />
      <ShiftModal open={shiftModal} members={members} teams={teams} onClose={() => setShiftModal(false)} />
      <OnCallModal open={ocModal.open} initial={ocModal.data} members={members} onClose={() => setOcModal({ open: false })} />
    </AppLayout>
  );
}
