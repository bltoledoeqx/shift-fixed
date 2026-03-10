const express = require('express');
const router = express.Router();
const { db } = require('../db');

// ── Helpers ──────────────────────────────────────────────────────
function calcHours(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60;
  return Math.round((endMins - startMins) / 60 * 10) / 10;
}

// Tipos reais de ausência no banco (type field)
const ABSENCE_TYPES_DB = ['vacation', 'day-off', 'medical-leave', 'sick-leave', 'bank-hours'];

function normalizeLabel(label) {
  if (!label) return null;
  const l = label.toUpperCase().trim();
  if (l === 'WIN' || l === 'WINDOWS') return ['WIN'];
  // WIN/BKP conta nos dois grupos
  if (l.includes('WIN') && l.includes('BKP')) return ['WIN', 'BKP'];
  if (l.startsWith('REDES') || l === 'OC' || l === 'OC-T') return ['REDES'];
  if (l.includes('BANCO')) return ['BANCO'];
  if (l === 'BKP') return ['BKP'];
  return [label];
}

function isAbsence(e) {
  return ABSENCE_TYPES_DB.includes(e.type);
}

function isOncall(e) {
  return e.type === 'work';
}

function getReportData(year, month) {
  const pad = String(month).padStart(2, '0');
  const startDate = `${year}-${pad}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${pad}-${String(lastDay).padStart(2,'0')}`;

  const members = db.prepare('SELECT * FROM members').all();
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

  const entries = db.prepare(`
    SELECT * FROM oncall_entries
    WHERE start_date >= ? AND start_date <= ?
  `).all(startDate, endDate);

  const oncallEntries = entries.filter(isOncall);
  const absenceEntries = entries.filter(isAbsence);

  // ── Hours per member per tech ──
  const oncallByMember = {};
  const oncallByTech = {};

  for (const e of oncallEntries) {
    const member = memberMap[e.member_id];
    if (!member) continue;
    const hours = calcHours(e.start_time, e.end_time);
    const techs = normalizeLabel(e.label) || ['Outros'];
    const name = member.name;

    if (!oncallByMember[name]) oncallByMember[name] = { total: 0, byTech: {} };
    // total conta apenas uma vez por entrada
    oncallByMember[name].total = Math.round((oncallByMember[name].total + hours) * 10) / 10;

    // horas contadas em cada tecnologia (WIN/BKP entra nos dois)
    for (const tech of techs) {
      oncallByMember[name].byTech[tech] = Math.round(((oncallByMember[name].byTech[tech] || 0) + hours) * 10) / 10;
      if (!oncallByTech[tech]) oncallByTech[tech] = {};
      oncallByTech[tech][name] = Math.round(((oncallByTech[tech][name] || 0) + hours) * 10) / 10;
    }
  }

  // ── Absences ──
  const absenceByMember = {};
  const absenceByType = {};
  const typeLabels = {
    'vacation': 'Férias',
    'day-off': 'Folga Alinhada',
    'medical-leave': 'Licença Médica',
    'sick-leave': 'Licença Médica',
    'bank-hours': 'Banco de Horas',
  };

  for (const e of absenceEntries) {
    const member = memberMap[e.member_id];
    if (!member) continue;
    const type = e.label || typeLabels[e.type] || e.type;
    const name = member.name;
    if (!absenceByMember[name]) absenceByMember[name] = {};
    absenceByMember[name][type] = (absenceByMember[name][type] || 0) + 1;
    absenceByType[type] = (absenceByType[type] || 0) + 1;
  }

  const ranking = Object.entries(oncallByMember)
    .map(([name, d]) => ({ name, hours: d.total, byTech: d.byTech }))
    .sort((a, b) => b.hours - a.hours);

  const totalOncallHours = Math.round(ranking.reduce((s, r) => s + r.hours, 0) * 10) / 10;
  const avgHours = ranking.length ? Math.round(totalOncallHours / ranking.length * 10) / 10 : 0;

  // ── Per-tech stats ──
  const techStats = {};
  for (const [tech, members] of Object.entries(oncallByTech)) {
    const vals = Object.values(members);
    const total = Math.round(vals.reduce((s, v) => s + v, 0) * 10) / 10;
    const avg = Math.round(total / vals.length * 10) / 10;
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const maxMember = Object.entries(members).find(([,v]) => v === max)?.[0];
    const minMember = Object.entries(members).find(([,v]) => v === min)?.[0];
    techStats[tech] = { total, avg, max, min, maxMember, minMember, memberCount: vals.length };
  }

  return {
    period: { year, month, startDate, endDate, monthName: new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long' }) },
    members: members.map(m => ({ id: m.id, name: m.name, role: m.role })),
    oncallByTech,
    oncallByMember,
    ranking,
    techStats,
    absenceByMember,
    absenceByType,
    summary: {
      totalOncallHours,
      avgHours,
      totalMembers: members.length,
      activeMembers: ranking.length,
      totalAbsences: absenceEntries.length,
    }
  };
}

// ── AI Analysis ──────────────────────────────────────────────────
async function generateAIAnalysis(data) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return generateRuleBasedAnalysis(data);

  try {
    const res = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: buildPrompt(data) }],
          temperature: 0.3,
          max_tokens: 2000
        })
      }
    );
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new Error(JSON.stringify(json.error || 'Empty response'));
    return text;
  } catch (err) {
    console.error('[Reports] Groq error:', err.message);
    return generateRuleBasedAnalysis(data);
  }
}

function buildPrompt(data) {
  const { period, ranking, techStats, absenceByType, summary } = data;

  const top3 = ranking
    .slice(0, 3)
    .map(r => `${r.name} (${r.hours}h)`)
    .join(', ');

  const bottom3 = [...ranking]
    .slice(-3)
    .reverse()
    .map(r => `${r.name} (${r.hours}h)`)
    .join(', ');

  const techOverview = Object.entries(techStats).map(([tech, s]) => {
    const deviation = s.avg ? Math.round(((s.max - s.min) / s.avg) * 100) : 0;
    return `${tech}: desvio ${deviation}% | maior carga ${s.maxMember} (${s.max}h) | menor carga ${s.minMember} (${s.min}h)`;
  }).join('\n');

  const absStr = Object.entries(absenceByType || {})
    .map(([t, c]) => `${t}: ${c}`)
    .join(', ') || 'Nenhuma';

  return `
Você é um analista sênior de operações de TI especializado em gestão de plantão e confiabilidade de sistemas (SRE).

Analise os dados de sobreaviso do time EMS referentes a ${period.monthName}/${period.year}.

REGRAS DE ANÁLISE
Priorize interpretação operacional em vez de descrição numérica.
Não repita números já fornecidos nos dados.

Considere desequilíbrio relevante quando:
- diferença entre maior e menor carga > 40% da média
- um membro possui >30% das horas da tecnologia
- até 3 membros concentram >60% das horas da tecnologia

RISCOS OPERACIONAIS

Burnout Risk
- membro com carga >70% acima da média do time

Injustiça de Escala
- membro com carga <40% da média do time

Concentração de Conhecimento
- membro com >35% das horas de uma tecnologia

Dependência Operacional
- dois membros concentram >50% das horas da tecnologia

DADOS GERAIS
Total horas: ${summary.totalOncallHours}h
Média por membro: ${summary.avgHours}h
Membros ativos: ${summary.activeMembers}
Ausências: ${summary.totalAbsences}

TECNOLOGIAS
${techOverview}

EXTREMOS DE CARGA
Mais horas: ${top3}
Menos horas: ${bottom3}

AUSÊNCIAS
${absStr}

Gere o relatório no formato:

## Resumo Executivo
1–2 frases avaliando o equilíbrio geral do mês.

## Riscos Operacionais
Identifique possíveis riscos de burnout, dependência técnica ou concentração de conhecimento.

## Tecnologias com Desequilíbrio
Explique apenas tecnologias com desvio relevante, sem repetir números.

## Membros com Carga Atípica
Destaque apenas pessoas significativamente acima ou abaixo da média.

## Recomendações Operacionais
Sugira ajustes simples para melhorar a distribuição do sobreaviso.

Limite máximo: 18 linhas.
`;
}

function generateRuleBasedAnalysis(data) {
  const { period, ranking, techStats, summary, absenceByType, absenceByMember } = data;
  if (ranking.length === 0) return '⚠️ Nenhum dado de sobreaviso encontrado para o período selecionado.';

  let md = `## Resumo Executivo\n`;
  md += `Em ${period.monthName}/${period.year}: **${summary.totalOncallHours}h** de sobreaviso, **${summary.activeMembers} membros**, média **${summary.avgHours}h/pessoa**.\n\n`;

  md += `## Balanceamento por Tecnologia\n`;
  for (const [tech, s] of Object.entries(techStats)) {
    const desvio = Math.round((s.max - s.avg) / s.avg * 100);
    const status = desvio > 50 ? '🔴 Crítico' : desvio > 25 ? '🟡 Atenção' : '🟢 OK';
    md += `**${tech}** ${status} — média ${s.avg}h | máx: ${s.maxMember} (${s.max}h) | mín: ${s.minMember} (${s.min}h) | desvio: ${desvio}%\n`;
  }

  md += `\n## Membros em Destaque\n`;
  md += `🔺 **Mais horas:** ${ranking.slice(0,3).map(r => `${r.name} (${r.hours}h)`).join(', ')}\n`;
  md += `🔻 **Menos horas:** ${ranking.slice(-3).reverse().map(r => `${r.name} (${r.hours}h)`).join(', ')}\n`;

  if (summary.totalAbsences > 0) {
    md += `\n## Ausências\n`;
    for (const [type, count] of Object.entries(absenceByType)) {
      md += `- ${type}: ${count} ocorrência(s)\n`;
    }
  }

  md += `\n## Recomendações\n`;
  for (const [tech, s] of Object.entries(techStats)) {
    if (s.max > s.avg * 1.5) {
      const excesso = Math.round((s.max - s.avg) / 2);
      md += `- **${tech}:** Redistribuir ~${excesso}h de ${s.maxMember} para ${s.minMember}\n`;
    }
  }

  return md;
}

// ── Routes ───────────────────────────────────────────────────────
router.get('/data', (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  try {
    res.json(getReportData(year, month));
  } catch (err) {
    console.error('[Reports] data error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/analysis', async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  try {
    const data = getReportData(year, month);
    const analysis = await generateAIAnalysis(data);
    res.json({ analysis, period: data.period });
  } catch (err) {
    console.error('[Reports] analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/pdf', async (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).json({ error: 'html required' });
  let browser;
  try {
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' } });
    await browser.close();
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="relatorio-${Date.now()}.pdf"`, 'Content-Length': pdf.length });
    res.end(pdf);
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('[Reports] PDF error:', err.message);
    res.status(500).json({ error: 'Erro ao gerar PDF: ' + err.message });
  }
});

module.exports = router;
