import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShiftBadge } from "@/components/ShiftBadge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { getTeams, getShifts, getOnCall } from "@/lib/api";
import { SHIFT_TYPE_LABELS, ONCALL_TYPE_LABELS } from "@/lib/types";
import type { OnCallEntry } from "@/lib/types";

const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getWeekDates(base: Date) {
  const start = new Date(base);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const absenceColors: Record<string, string> = {
  vacation:        "bg-gray-100 text-gray-700 border border-gray-300",
  "medical-leave": "bg-red-50 text-red-700 border border-red-200",
  "day-off":       "bg-blue-50 text-blue-700 border border-blue-200",
  "comp-time":     "bg-purple-50 text-purple-700 border border-purple-200",
};
const absenceEmoji: Record<string, string> = {
  vacation: "🏖️", "medical-leave": "🏥", "day-off": "📅", "comp-time": "🔄",
};

function AbsenceBadge({ entry }: { entry: OnCallEntry }) {
  const cls = absenceColors[entry.type] || "bg-muted text-muted-foreground";
  const emoji = absenceEmoji[entry.type] || "📋";
  return (
    <div className={`rounded px-1.5 py-1 text-[10px] leading-snug ${cls}`}>
      <p className="font-medium truncate">{emoji} {entry.name}</p>
      <p className="opacity-70">{ONCALL_TYPE_LABELS[entry.type]}</p>
    </div>
  );
}

function TeamSchedule({
  teamId, weekDates, today, absencesByMember,
}: {
  teamId: string; weekDates: Date[]; today: string;
  absencesByMember: Map<string, OnCallEntry[]>;
}) {
  const startDate = weekDates[0].toISOString().split("T")[0];
  const endDate   = weekDates[6].toISOString().split("T")[0];

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", teamId, startDate, endDate],
    queryFn: () => getShifts({ team_id: teamId, start_date: startDate, end_date: endDate }),
  });

  // Collect all member_ids that have shifts this week (for absence lookup)
  const memberIds = [...new Set(shifts.map(s => s.member_id))];

  // For a given date, get absences for members of this team
  function getAbsencesForDay(ds: string): OnCallEntry[] {
    const result: OnCallEntry[] = [];
    // Get unique members with absences whose team matches
    absencesByMember.forEach((entries, _memberId) => {
      entries.forEach(a => {
        if (a.team_id === teamId && a.start_date <= ds && a.end_date >= ds) {
          // Only add once per member per day
          if (!result.find(r => r.member_id === a.member_id)) result.push(a);
        }
      });
    });
    return result;
  }

  return (
    <>
      {/* Desktop */}
      <Card className="hidden md:block overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b">
            {weekDates.map((date, i) => {
              const ds = date.toISOString().split("T")[0];
              const isToday = ds === today;
              return (
                <div key={i} className={`p-3 text-center border-r last:border-r-0 ${isToday ? "bg-accent/10" : ""}`}>
                  <p className="text-xs text-muted-foreground">{daysOfWeek[i]}</p>
                  <p className={`text-lg font-semibold ${isToday ? "text-accent" : ""}`}>{date.getDate()}</p>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7 min-h-[280px]">
            {weekDates.map((date, i) => {
              const ds = date.toISOString().split("T")[0];
              const dayShifts   = shifts.filter(s => s.date === ds);
              const dayAbsences = getAbsencesForDay(ds);
              const isToday = ds === today;
              return (
                <div key={i} className={`p-2 border-r last:border-r-0 space-y-1.5 ${isToday ? "bg-accent/5" : ""}`}>
                  {dayShifts.map(shift => (
                    <div key={shift.id} className="p-2 rounded-md bg-secondary/60 space-y-1">
                      <ShiftBadge type={shift.type} label={SHIFT_TYPE_LABELS[shift.type]} className="text-[10px]" />
                      <p className="text-xs font-medium truncate">{shift.name}</p>
                      <p className="text-[10px] text-muted-foreground">{shift.start_time}–{shift.end_time}</p>
                      {shift.label && <p className="text-[9px] text-muted-foreground">{shift.label}</p>}
                    </div>
                  ))}
                  {dayAbsences.map(a => (
                    <AbsenceBadge key={`${a.id}-${ds}`} entry={a} />
                  ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {weekDates.map((date, i) => {
          const ds = date.toISOString().split("T")[0];
          const dayShifts   = shifts.filter(s => s.date === ds);
          const dayAbsences = getAbsencesForDay(ds);
          const isToday = ds === today;
          if (dayShifts.length === 0 && dayAbsences.length === 0) return null;
          return (
            <Card key={i} className={isToday ? "ring-2 ring-accent" : ""}>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className={isToday ? "text-accent" : ""}>
                    {daysOfWeek[i]}, {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                  {isToday && <span className="text-[10px] bg-accent text-accent-foreground px-2 py-0.5 rounded-full">Hoje</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {dayShifts.map(shift => (
                  <div key={shift.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-medium">
                        {shift.avatar}
                      </div>
                      <span className="text-sm">{shift.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{shift.start_time}–{shift.end_time}</span>
                      <ShiftBadge type={shift.type} label={SHIFT_TYPE_LABELS[shift.type]} />
                    </div>
                  </div>
                ))}
                {dayAbsences.map(a => (
                  <div key={`${a.id}-${ds}`} className={`flex items-center gap-2 p-2 rounded-md ${absenceColors[a.type] || "bg-muted"}`}>
                    <span className="text-base">{absenceEmoji[a.type] || "📋"}</span>
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-[10px] opacity-70">{ONCALL_TYPE_LABELS[a.type]}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const EXCLUDED_TEAMS = ['sobreaviso', 'gestao'];
  const { data: allTeams = [] } = useQuery({ queryKey: ["teams"], queryFn: getTeams });
  const teams = allTeams.filter(t => !EXCLUDED_TEAMS.includes(t.id));

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);
  const today      = new Date().toISOString().split("T")[0];
  const startDate  = weekDates[0].toISOString().split("T")[0];
  const endDate    = weekDates[6].toISOString().split("T")[0];
  const defaultTab = teams[0]?.id;

  // Fetch absences (non-work oncall) for the whole week, then pass down
  const { data: absenceList = [] } = useQuery({
    queryKey: ["absences-week", startDate, endDate],
    queryFn: () => getOnCall({ start_date: startDate, end_date: endDate }),
    select: data => data.filter(e => e.type !== "work"),
  });

  // Build a Map for quick lookup
  const absencesByMember = useMemo(() => {
    const map = new Map<string, OnCallEntry[]>();
    absenceList.forEach(a => {
      const list = map.get(a.member_id) || [];
      list.push(a);
      map.set(a.member_id, list);
    });
    return map;
  }, [absenceList]);

  return (
    <AppLayout title="Escala Normal">
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            {weekDates[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} –{" "}
            {weekDates[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Hoje</Button>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        {absenceList.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(absenceColors).map(([k, cls]) => (
              <div key={k} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded-sm ${cls}`} />
                <span className="text-muted-foreground">{absenceEmoji[k]} {ONCALL_TYPE_LABELS[k]}</span>
              </div>
            ))}
          </div>
        )}

        {teams.length > 0 && (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-secondary/50 p-1">
              {teams.map(team => (
                <TabsTrigger key={team.id} value={team.id}
                  className="text-xs flex-1 min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {team.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {teams.map(team => (
              <TabsContent key={team.id} value={team.id} className="mt-4">
                <TeamSchedule
                  teamId={team.id}
                  weekDates={weekDates}
                  today={today}
                  absencesByMember={absencesByMember}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
