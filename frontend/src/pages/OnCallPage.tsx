import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Crown } from "lucide-react";
import { useState, useMemo } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { getOnCall } from "@/lib/api";
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

function getEntryColor(type: string) {
  if (type === "vacation" || type === "medical-leave") return "bg-muted/80 text-muted-foreground";
  if (type === "day-off") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
  if (type === "comp-time") return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
  return "bg-oncall/20 text-foreground border border-oncall/30";
}

function parseMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function getMemberHours(entries: OnCallEntry[], memberId: string, weekDates: Date[]) {
  let total = 0;
  weekDates.forEach((date) => {
    const ds = date.toISOString().split("T")[0];
    entries
      .filter((e) => e.member_id === memberId && e.type === "work" && e.start_date <= ds && e.end_date >= ds)
      .forEach((e) => {
        const s = parseMins(e.start_time), en = parseMins(e.end_time);
        total += en > s ? en - s : (24 * 60 - s) + en;
      });
  });
  return Math.round(total / 60);
}

export default function OnCallPage() {
  const [weekOffset, setWeekOffset] = useState(0);

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);
  const today = new Date().toISOString().split("T")[0];

  const startDate = weekDates[0].toISOString().split("T")[0];
  const endDate = weekDates[6].toISOString().split("T")[0];

  const { data: entries = [] } = useQuery({
    queryKey: ["oncall", startDate, endDate],
    queryFn: () => getOnCall({ start_date: startDate, end_date: endDate, type: "work" }),
    refetchInterval: 60000,
  });

  // Get unique members
  const memberMap = new Map<string, { id: string; name: string; avatar: string; is_team_leader: number }>();
  entries.forEach((e) => {
    if (e.member_id && !memberMap.has(e.member_id)) {
      memberMap.set(e.member_id, {
        id: e.member_id,
        name: e.name || "",
        avatar: e.avatar || "",
        is_team_leader: e.is_team_leader || 0,
      });
    }
  });

  const members = Array.from(memberMap.values()).sort((a, b) => {
    if (a.is_team_leader && !b.is_team_leader) return -1;
    if (!a.is_team_leader && b.is_team_leader) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <AppLayout title="Sobreaviso">
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-oncall">Sobreaviso</span>
            <span className="text-xs text-muted-foreground">Semanal</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Hoje</Button>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {weekDates[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} –{" "}
          {weekDates[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </p>

        <div className="flex flex-wrap gap-3 text-xs">
          {[
            { color: "bg-oncall/20 border border-oncall/30", label: "Sobreaviso" },
            { color: "bg-muted/80", label: "Férias / Licença" },
            { color: "bg-blue-100 dark:bg-blue-900/30", label: "Folga" },
            { color: "bg-purple-100 dark:bg-purple-900/30", label: "Banco de Horas" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-4 h-3 rounded-sm ${color}`} />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <Crown className="h-3 w-3 text-oncall" />
            <span className="text-muted-foreground">Team Leader</span>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <div className="min-w-[900px]">
                <div className="flex border-b bg-secondary/30 sticky top-0 z-10">
                  <div className="w-[180px] min-w-[180px] p-2 border-r flex items-center">
                    <span className="text-xs font-semibold text-muted-foreground">Analista</span>
                  </div>
                  <div className="flex-1 flex">
                    {weekDates.map((date, i) => {
                      const ds = date.toISOString().split("T")[0];
                      const isToday = ds === today;
                      const isWe = i === 0 || i === 6;
                      return (
                        <div key={i} className={`flex-1 text-center p-2 border-r last:border-r-0 ${isToday ? "bg-accent/10" : isWe ? "bg-secondary/20" : ""}`}>
                          <p className="text-[10px] text-muted-foreground">{daysOfWeek[i]}</p>
                          <p className={`text-sm font-semibold ${isToday ? "text-accent" : ""}`}>
                            {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {members.map((member) => {
                  const hours = getMemberHours(entries, member.id, weekDates);
                  return (
                    <div key={member.id} className="flex border-b last:border-b-0 hover:bg-secondary/20 transition-colors">
                      <div className="w-[180px] min-w-[180px] p-2 border-r flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[9px] font-medium flex-shrink-0">
                          {member.avatar}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-medium truncate">{member.name}</p>
                            {member.is_team_leader === 1 && <Crown className="h-3 w-3 text-oncall flex-shrink-0" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{hours}h</p>
                        </div>
                      </div>
                      <div className="flex-1 flex">
                        {weekDates.map((date, i) => {
                          const ds = date.toISOString().split("T")[0];
                          const isToday = ds === today;
                          const isWe = i === 0 || i === 6;
                          const dayEntries = entries.filter((e) => e.member_id === member.id && e.start_date <= ds && e.end_date >= ds);
                          return (
                            <div key={i} className={`flex-1 border-r last:border-r-0 p-0.5 min-h-[48px] ${isToday ? "bg-accent/5" : isWe ? "bg-secondary/10" : ""}`}>
                              {dayEntries.map((entry) => {
                                const isFull = entry.type !== "work";
                                return (
                                  <div
                                    key={entry.id}
                                    className={`${getEntryColor(entry.type)} rounded-sm px-1.5 py-0.5 text-[9px] leading-tight mb-0.5 ${isFull ? "min-h-[40px] flex flex-col justify-center" : ""}`}
                                    title={`${entry.start_time} – ${entry.end_time}\n${entry.label || ""}`}
                                  >
                                    {!isFull && <span className="font-medium block">{entry.start_time}–{entry.end_time}</span>}
                                    {entry.label && <span className={`block ${isFull ? "font-medium text-[10px]" : "text-muted-foreground"}`}>{entry.label}</span>}
                                    {isFull && (
                                      <span className="text-[8px] opacity-70">
                                        {new Date(entry.start_date + 'T12:00:00').toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}–{new Date(entry.end_date + 'T12:00:00').toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Mobile view */}
        <div className="md:hidden space-y-3">
          {weekDates.map((date, i) => {
            const ds = date.toISOString().split("T")[0];
            const isToday = ds === today;
            const isWe = i === 0 || i === 6;
            const dayEntries = entries.filter((e) => e.start_date <= ds && e.end_date >= ds);
            if (dayEntries.length === 0) return null;
            return (
              <Card key={i} className={isToday ? "ring-2 ring-accent" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-semibold ${isToday ? "text-accent" : ""}`}>
                      {daysOfWeek[i]}, {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                    {isToday && <span className="text-[10px] bg-accent text-accent-foreground px-2 py-0.5 rounded-full">Hoje</span>}
                    {isWe && <span className="text-[10px] bg-oncall/20 text-oncall px-2 py-0.5 rounded-full">FDS</span>}
                  </div>
                  <div className="space-y-1.5">
                    {dayEntries.map((entry) => (
                      <div key={entry.id} className={`flex items-center justify-between p-2 rounded-md ${getEntryColor(entry.type)}`}>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[8px] font-medium">
                            {entry.avatar}
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium">{entry.name}</span>
                              {entry.is_team_leader === 1 && <Crown className="h-3 w-3 text-oncall" />}
                            </div>
                            {entry.label && <span className="text-[10px] opacity-75">{entry.label}</span>}
                          </div>
                        </div>
                        {entry.type === "work" && (
                          <span className="text-[10px] opacity-75">{entry.start_time}–{entry.end_time}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
