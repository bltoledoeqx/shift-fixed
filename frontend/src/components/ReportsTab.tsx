import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileDown, Sparkles, TrendingUp, Users, Clock, CalendarOff, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface TechStat { total: number; avg: number; max: number; min: number; maxMember: string; minMember: string; memberCount: number; }
interface ReportData {
  period: { year: number; month: number; monthName: string; startDate: string; endDate: string };
  ranking: { name: string; hours: number; byTech: Record<string, number> }[];
  oncallByTech: Record<string, Record<string, number>>;
  techStats: Record<string, TechStat>;
  absenceByMember: Record<string, Record<string, number>>;
  absenceByType: Record<string, number>;
  summary: { totalOncallHours: number; avgHours: number; totalMembers: number; activeMembers: number; totalAbsences: number };
}

const TECH_COLORS: Record<string, string> = { WIN: '#6366f1', REDES: '#0ea5e9', BANCO: '#f59e0b', BKP: '#10b981', 'WIN/BKP': '#8b5cf6', Outros: '#94a3b8' };
const TECH_BG: Record<string, string> = { WIN: '#eef2ff', REDES: '#e0f2fe', BANCO: '#fffbeb', BKP: '#ecfdf5', 'WIN/BKP': '#f5f3ff', Outros: '#f9fafb' };

function HBar({ data, avg, color }: { data: { label: string; value: number }[]; avg?: number; color: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        const isAbove = avg !== undefined && d.value > avg * 1.3;
        const isBelow = avg !== undefined && d.value < avg * 0.7;
        return (
          <div key={d.label} className="flex items-center gap-2">
            <span className="text-xs text-gray-700 w-36 truncate shrink-0 font-medium">{d.label}</span>
            <div className="flex-1 bg-gray-100 rounded h-6 relative overflow-hidden">
              <div className="h-full rounded flex items-center px-2 transition-all duration-500" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: color }}>
                <span className="text-[11px] text-white font-semibold whitespace-nowrap">{d.value}h</span>
              </div>
              {avg !== undefined && (
                <div className="absolute top-0 bottom-0 w-px bg-red-500 opacity-70" style={{ left: `${(avg / max) * 100}%` }} />
              )}
            </div>
            {isAbove && <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" title="Acima da média" />}
            {isBelow && <AlertTriangle className="w-3.5 h-3.5 text-blue-400 shrink-0" title="Abaixo da média" />}
            {!isAbove && !isBelow && avg !== undefined && <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0 opacity-30" />}
          </div>
        );
      })}
      {avg !== undefined && <p className="text-[10px] text-gray-400 mt-1">Linha vermelha = média ({avg}h)</p>}
    </div>
  );
}

function MD({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm text-gray-700 leading-relaxed">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <h3 key={i} className="text-base font-bold text-gray-900 mt-5 mb-1 pb-1 border-b border-gray-200">{line.slice(3)}</h3>;
        if (line.startsWith('- ') || line.startsWith('* ')) {
          const parts = line.slice(2).split(/\*\*(.*?)\*\*/g);
          return <li key={i} className="ml-5 list-disc">{parts.map((p,j) => j%2===1 ? <strong key={j} className="text-gray-900">{p}</strong> : p)}</li>;
        }
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return <p key={i}>{parts.map((p,j) => j%2===1 ? <strong key={j} className="text-gray-900">{p}</strong> : p)}</p>;
      })}
    </div>
  );
}

function BalanceCard({ tech, stat, members }: { tech: string; stat: TechStat; members: Record<string, number> }) {
  const desvio = stat.avg > 0 ? Math.round((stat.max - stat.avg) / stat.avg * 100) : 0;
  const status = desvio > 60 ? { label: 'Crítico', cls: 'text-red-700 bg-red-100 border-red-300' }
    : desvio > 30 ? { label: 'Atenção', cls: 'text-orange-700 bg-orange-100 border-orange-300' }
    : { label: 'Equilibrado', cls: 'text-green-700 bg-green-100 border-green-300' };
  const sorted = Object.entries(members).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-xl border border-gray-200 p-4" style={{ backgroundColor: TECH_BG[tech] || '#f9fafb' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: TECH_COLORS[tech] || '#94a3b8' }}>{tech}</span>
          <span className="text-xs text-gray-500">{stat.memberCount} membros · {stat.total}h total · média {stat.avg}h</span>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${status.cls}`}>{status.label} · desvio {desvio}%</span>
      </div>
      <HBar data={sorted.map(([name, hours]) => ({ label: name, value: hours }))} avg={stat.avg} color={TECH_COLORS[tech] || '#94a3b8'} />
    </div>
  );
}

function buildPDF(data: ReportData, aiText: string | null): string {
  const { period, ranking, oncallByTech, techStats, absenceByType, absenceByMember, summary } = data;
  const rankRows = ranking.map((r,i) => `<tr><td>${i+1}</td><td>${r.name}</td><td><b>${r.hours}h</b></td><td>${Object.entries(r.byTech).map(([t,h])=>`${t}:${h}h`).join(', ')||'—'}</td></tr>`).join('');
  const techSec = Object.entries(techStats).map(([tech, s]) => {
    const d = s.avg > 0 ? Math.round((s.max-s.avg)/s.avg*100) : 0;
    const st = d > 60 ? '🔴 Crítico' : d > 30 ? '🟡 Atenção' : '🟢 Equilibrado';
    const rows = Object.entries(oncallByTech[tech]||{}).sort((a,b)=>b[1]-a[1]).map(([n,h])=>`<tr><td>${n}</td><td>${h}h</td><td>${h>s.avg*1.3?'⬆ Acima':h<s.avg*0.7?'⬇ Abaixo':'✓ OK'}</td></tr>`).join('');
    return `<h3>${tech} — ${st} · desvio ${d}% · média ${s.avg}h · total ${s.total}h</h3><table><tr><th>Membro</th><th>Horas</th><th>Status</th></tr>${rows}</table>`;
  }).join('');
  const absRows = Object.entries(absenceByType).map(([t,c])=>`<tr><td>${t}</td><td>${c}</td></tr>`).join('');
  const absMem = Object.entries(absenceByMember).map(([n,t])=>`<tr><td>${n}</td><td>${Object.entries(t).map(([k,v])=>`${k}(${v})`).join(', ')}</td></tr>`).join('');
  const aiHtml = aiText ? `<h2>Análise Inteligente</h2><div class="ai">${aiText.replace(/## (.*)/g,'<h3>$1</h3>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/^[-*] (.*)/gm,'<li>$1</li>').replace(/\n/g,'<br/>')}</div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#1e293b;padding:32px;font-size:12px;line-height:1.5}
h1{color:#4f46e5;font-size:20px;border-bottom:3px solid #4f46e5;padding-bottom:8px}
h2{color:#1e293b;font-size:14px;margin-top:24px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
h3{color:#334155;font-size:12px;margin-top:14px}
table{width:100%;border-collapse:collapse;margin:6px 0;font-size:11px}
th{background:#4f46e5;color:#fff;padding:5px 8px;text-align:left}
td{padding:4px 8px;border-bottom:1px solid #f1f5f9}
tr:nth-child(even) td{background:#f8fafc}
.cards{display:flex;gap:10px;margin:14px 0}
.card{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center}
.card .v{font-size:20px;font-weight:700;color:#4f46e5}.card .l{font-size:10px;color:#64748b}
.ai{background:#f8fafc;border-left:4px solid #4f46e5;padding:14px;border-radius:4px}
li{margin-left:18px}
.footer{margin-top:36px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px}
</style></head><body>
<h1>Relatório de Sobreaviso — ${period.monthName} ${period.year}</h1>
<p style="color:#64748b;font-size:11px">Período: ${period.startDate} a ${period.endDate}</p>
<div class="cards">
  <div class="card"><div class="v">${summary.totalOncallHours}h</div><div class="l">Total Horas</div></div>
  <div class="card"><div class="v">${summary.avgHours}h</div><div class="l">Média/Membro</div></div>
  <div class="card"><div class="v">${summary.activeMembers}/${summary.totalMembers}</div><div class="l">Membros</div></div>
  <div class="card"><div class="v">${summary.totalAbsences}</div><div class="l">Ausências</div></div>
</div>
<h2>Ranking Geral</h2><table><tr><th>#</th><th>Membro</th><th>Total</th><th>Por Tecnologia</th></tr>${rankRows}</table>
<h2>Balanceamento por Tecnologia</h2>${techSec}
${absRows?`<h2>Ausências por Tipo</h2><table><tr><th>Tipo</th><th>Ocorrências</th></tr>${absRows}</table>`:''}
${absMem?`<h2>Ausências por Membro</h2><table><tr><th>Membro</th><th>Detalhes</th></tr>${absMem}</table>`:''}
${aiHtml}
<div class="footer">Shift Navigator · EMS On Call · ${period.monthName} ${period.year} · Gerado em ${new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</div>
</body></html>`;
}

export function ReportsTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getMonth() === 0 ? now.getFullYear()-1 : now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() === 0 ? 12 : now.getMonth());
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  const { data, isLoading, isError, refetch } = useQuery<ReportData>({
    queryKey: ['report', year, month],
    queryFn: async () => {
      const res = await fetch(`/api/reports/data?year=${year}&month=${month}`, { headers });
      if (!res.ok) throw new Error('Erro');
      return res.json();
    },
    enabled: false,
  });

  const handleAI = async () => {
    setAiLoading(true); setAiText(null);
    try {
      const res = await fetch(`/api/reports/analysis?year=${year}&month=${month}`, { headers });
      const j = await res.json();
      setAiText(j.analysis);
    } catch { toast({ title: 'Erro ao gerar análise IA', variant: 'destructive' }); }
    finally { setAiLoading(false); }
  };

  const handlePDF = async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      const res = await fetch('/api/reports/pdf', { method: 'POST', headers, body: JSON.stringify({ html: buildPDF(data, aiText) }) });
      if (!res.ok) throw new Error('Falha');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `relatorio-${data.period.monthName}-${year}.pdf`;
      a.click();
      toast({ title: '✅ PDF gerado!' });
    } catch { toast({ title: 'Erro ao gerar PDF', variant: 'destructive' }); }
    finally { setPdfLoading(false); }
  };

  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1.5">Mês</p>
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-36 bg-white border-gray-300 text-gray-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200 z-50">
              {months.map((m,i) => <SelectItem key={i} value={String(i+1)} className="text-gray-900">{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1.5">Ano</p>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-28 bg-white border-gray-300 text-gray-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200 z-50">
              {[now.getFullYear()-1, now.getFullYear()].map(y => <SelectItem key={y} value={String(y)} className="text-gray-900">{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => refetch()} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Gerar Relatório
        </Button>
        {data && <>
          <Button variant="outline" onClick={handleAI} disabled={aiLoading} className="border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50">
            {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Análise IA
          </Button>
          <Button variant="outline" onClick={handlePDF} disabled={pdfLoading} className="border-gray-300 text-gray-700 bg-white hover:bg-gray-50">
            {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />} Exportar PDF
          </Button>
        </>}
      </div>

      {isError && <p className="text-red-500 text-sm">Erro ao carregar dados.</p>}

      {data && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Clock,       label: 'Total de Horas',   value: `${data.summary.totalOncallHours}h`, cls: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
              { icon: Users,       label: 'Média por Membro', value: `${data.summary.avgHours}h`,         cls: 'text-sky-600 bg-sky-50 border-sky-100' },
              { icon: TrendingUp,  label: 'Membros Ativos',   value: `${data.summary.activeMembers}/${data.summary.totalMembers}`, cls: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
              { icon: CalendarOff, label: 'Ausências',        value: `${data.summary.totalAbsences}`,     cls: 'text-amber-600 bg-amber-50 border-amber-100' },
            ].map(c => (
              <div key={c.label} className={`rounded-xl border p-4 ${c.cls.split(' ').slice(1).join(' ')}`}>
                <c.icon className={`h-5 w-5 ${c.cls.split(' ')[0]} mb-2`} />
                <p className={`text-2xl font-bold ${c.cls.split(' ')[0]}`}>{c.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Ranking */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" /> Ranking Geral — {data.period.monthName} {data.period.year}
            </h3>
            {data.ranking.length === 0
              ? <p className="text-sm text-gray-400">Nenhum dado no período.</p>
              : <HBar data={data.ranking.map(r => ({ label: r.name, value: r.hours }))} avg={data.summary.avgHours} color="#6366f1" />
            }
          </div>

          {/* Tech balance */}
          {Object.keys(data.techStats).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-500" /> Balanceamento por Tecnologia
              </h3>
              {Object.entries(data.techStats).map(([tech, stat]) => (
                <BalanceCard key={tech} tech={tech} stat={stat} members={data.oncallByTech[tech] || {}} />
              ))}
            </div>
          )}

          {/* Absences */}
          {data.summary.totalAbsences > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-amber-500" /> Ausências — {data.period.monthName} {data.period.year}
              </h3>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Por tipo</p>
                  <div className="space-y-1.5">
                    {Object.entries(data.absenceByType).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center py-1.5 px-3 bg-amber-50 rounded-lg border border-amber-100">
                        <span className="text-sm text-gray-700">{type}</span>
                        <span className="text-sm font-bold text-amber-700">{count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Por membro</p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {Object.entries(data.absenceByMember).map(([name, types]) => (
                      <div key={name} className="flex flex-wrap items-center gap-1.5 py-1.5 px-2 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-xs font-semibold text-gray-700 w-28 truncate">{name}</span>
                        {Object.entries(types).map(([t, c]) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium">{t} ({c})</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI */}
          {aiText && (
            <div className="bg-white rounded-xl border border-indigo-200 p-5">
              <h3 className="text-sm font-bold text-indigo-800 mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500" /> Análise Inteligente — {data.period.monthName} {data.period.year}
              </h3>
              <MD text={aiText} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
