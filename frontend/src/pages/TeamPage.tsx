import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Crown, Phone, AlertTriangle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { getTeams, getMembers, getCurrentOnCall, getManagers } from "@/lib/api";

export default function TeamPage() {
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: getTeams });
  const { data: members = [] } = useQuery({ queryKey: ["members"], queryFn: () => getMembers() });
  const { data: currentOnCall = [] } = useQuery({
    queryKey: ["oncall-current"],
    queryFn: getCurrentOnCall,
    refetchInterval: 60 * 1000,
  });
  const { data: managers = [] } = useQuery({ queryKey: ["managers"], queryFn: getManagers });

  const defaultTab = teams[0]?.id;

  // Group on-call by technology
  const onCallByTech = currentOnCall.reduce<Record<string, typeof currentOnCall>>((acc, e) => {
    const tech = e.technology || "Geral";
    if (!acc[tech]) acc[tech] = [];
    acc[tech].push(e);
    return acc;
  }, {});

  return (
    <AppLayout title="Equipe">
      <div className="animate-fade-in space-y-8">
        {teams.length > 0 && (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-secondary/50 p-1 mb-4">
              {teams.map((team) => (
                <TabsTrigger
                  key={team.id}
                  value={team.id}
                  className="text-xs flex-1 min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {team.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {teams.map((team) => {
              const teamMembers = members.filter((m) => m.team_id === team.id && !m.is_manager);
              return (
                <TabsContent key={team.id} value={team.id}>
                  {teamMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Nenhum membro nesta equipe.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {teamMembers.map((member) => (
                        <Card key={member.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-5">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                                {member.avatar}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium truncate">{member.name}</p>
                                  {member.is_team_leader === 1 && <Crown className="h-4 w-4 text-oncall flex-shrink-0" />}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                  <Briefcase className="h-3 w-3" />
                                  <span>{member.role}</span>
                                </div>
                                {member.technology && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    <span className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">{member.technology}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {/* Setor de Escalation */}
        <div className="border-t pt-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-oncall" />
            <h2 className="text-lg font-semibold">Setor de Escalation</h2>
          </div>

          {/* Currently on-call analysts */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Analistas em Sobreaviso Agora
            </h3>
            {currentOnCall.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum analista em sobreaviso no momento.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(onCallByTech).map(([tech, techEntries]) => (
                  <Card key={tech} className="border-oncall/30 bg-oncall/5">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-oncall uppercase tracking-wide mb-3">{tech}</p>
                      <div className="space-y-3">
                        {techEntries.map((entry) => (
                          <div key={entry.id} className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-oncall flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {entry.avatar}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{entry.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {entry.start_time}–{entry.end_time}
                                {entry.label ? ` · ${entry.label}` : ""}
                              </p>
                            </div>
                            {entry.phone && (
                              <a href={`tel:${entry.phone}`} className="text-xs font-medium text-accent shrink-0 hover:underline">
                                📞 {entry.phone}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Managers escalation list */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Ordem de Escalation — Gestores
            </h3>
            {managers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum gestor cadastrado.</p>
            ) : (
              <div className="space-y-2">
                {managers.map((mgr, idx) => (
                  <div key={mgr.id} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-primary/80 flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold flex-shrink-0">
                      {mgr.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{mgr.name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Briefcase className="h-3 w-3" />
                        <span>{mgr.role}</span>
                      </div>
                    </div>
                    {mgr.phone && (
                      <div className="flex items-center gap-1.5 text-sm font-medium text-accent">
                        <Phone className="h-4 w-4" />
                        <span>{mgr.phone}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
