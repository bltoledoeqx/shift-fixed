import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, PhoneCall, Clock, Briefcase } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getMembers, getOnCall, getCurrentOnCall, getCurrentShifts } from "@/lib/api";

const today = new Date().toISOString().split("T")[0];

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: () => getMembers() });
  const { data: onCallToday = [] } = useQuery({
    queryKey: ["oncall-today"],
    queryFn: () => getOnCall({ start_date: today, end_date: today }),
    refetchInterval: 60000,
  });
  const { data: currentOnCall = [] } = useQuery({
    queryKey: ["oncall-current"],
    queryFn: getCurrentOnCall,
    refetchInterval: 60000,
  });
  const { data: currentShifts = [] } = useQuery({
    queryKey: ["shifts-current"],
    queryFn: getCurrentShifts,
    refetchInterval: 60000,
  });

  const activeOnCallToday = onCallToday.filter(e => {
    if (e.type !== "work") return false;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const todayStr = now.toISOString().split("T")[0];
    const [sh, sm] = e.start_time.split(":").map(Number);
    const [eh, em] = e.end_time.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;

    // Turno cruza meia-noite (ex: 22:00 -> 06:00)
    if (endMins <= startMins) {
      // Se hoje é o start_date: ainda não terminou (está no trecho noturno)
      if (e.start_date === todayStr) return nowMins >= startMins;
      // Se hoje é o end_date: ainda está ativo se não passou do fim
      if (e.end_date === todayStr) return nowMins < endMins;
      return false;
    }

    // Turno normal (sem cruzar meia-noite): só mostra se não terminou ainda
    return nowMins < endMins;
  });

  return (
    <AppLayout title="Painel">
      <div className="space-y-6 animate-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow hover:border-accent/50"
            onClick={() => navigate("/equipe")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-xs text-muted-foreground">Membros</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow hover:border-oncall/50"
            onClick={() => navigate("/sobreaviso")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-oncall/10 flex items-center justify-center">
                <PhoneCall className="h-5 w-5 text-oncall" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeOnCallToday.length}</p>
                <p className="text-xs text-muted-foreground">Sobreaviso Hoje</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-available/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-available" />
              </div>
              <div>
                <p className="text-2xl font-bold">24/7</p>
                <p className="text-xs text-muted-foreground">Cobertura</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Turno Atual — Escala Normal */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-accent" />
                Turno Atual
              </CardTitle>
            </CardHeader>
            <CardContent>              
{(() => {
  const now = new Date();
  const day = now.getDay(); // 0=dom, 1=seg, ..., 6=sab
  const isWeekend = day === 0 || day === 6;
  return (
    <div>
      <p className="text-xs font-medium text-accent uppercase tracking-wide mb-2">
        {isWeekend ? "Escala Normal — Ativo Agora" : "Turno Regular"}
      </p>
      {isWeekend && currentShifts.length > 0 ? (
        currentShifts.map((shift) => (
          <div key={shift.id} className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {shift.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{shift.name}</p>
              <p className="text-xs text-muted-foreground">
                {shift.start_time}–{shift.end_time}
                {shift.team_label ? ` · ${shift.team_label}` : ""}
                {shift.label ? ` · ${shift.label}` : ""}
              </p>
            </div>
          </div>
        ))
      ) : !isWeekend ? (
        <p className="text-sm text-muted-foreground">
          Segunda a sexta — equipe em escala normal de trabalho.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum turno ativo no momento.</p>
      )}
    </div>
  );
})()}
            </CardContent>
          </Card>
          {/* Sobreaviso Hoje */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-oncall" />
                Sobreaviso Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeOnCallToday.length > 0 ? (
                <div className="space-y-3">
                  {activeOnCallToday.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-oncall flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {entry.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">{entry.start_time}–{entry.end_time} · {entry.label}</p>
                      </div>
                      {entry.phone && (
                        <a href={`tel:${entry.phone}`} className="text-xs font-medium text-accent shrink-0 flex items-center gap-1 hover:underline">
                          📞 {entry.phone}
                        </a>
                      )}
                    </div>
                  ))}
                  {activeOnCallToday.length > 5 && (
                    <p className="text-xs text-muted-foreground">+{activeOnCallToday.length - 5} mais</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum sobreaviso ativo hoje.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
