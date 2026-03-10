const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const GROUP_MAP = {
  'EMS - Rotinas': 'ems-rotinas', 'EMS Rotinas': 'ems-rotinas',
  'Layer 1 - Fila A': 'l1a', 'Layer 1 Fila A': 'l1a',
  'Layer 1 - Fila B': 'l1b', 'Layer 1 Fila B': 'l1b',
  'Layer 2': 'l2', 'SOBREAVISO': 'sobreaviso',
  'Gestão': 'gestao', 'Gestao': 'gestao',
};

const TIMEOFF_MAP = {
  'Férias': 'vacation', 'Dia de Licença Médica': 'medical-leave',
  'Licença Parental': 'medical-leave', 'Saúde Mental Equinix': 'medical-leave',
  'Licença Gala - Casamento': 'medical-leave',
  'Folga': 'day-off', 'Alinhamento Gestão': 'day-off',
  'Não remunerado': 'day-off', 'CIEE': 'day-off',
  'Treinamento externo': 'day-off',
  'Abatimento de Banco de Horas': 'comp-time',
};

function toDateStr(val) {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear(), m = String(val.getMonth()+1).padStart(2,'0'), d = String(val.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  // M/D/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  // YYYY-MM-DD
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.substring(0, 10);
  return null;
}

function toTimeStr(val) {
  if (!val) return '00:00';
  if (val instanceof Date) {
    return `${String(val.getHours()).padStart(2,'0')}:${String(val.getMinutes()).padStart(2,'0')}`;
  }
  const s = String(val).trim();
  if (s.match(/^\d{1,2}:\d{2}/)) return s.substring(0, 5).padStart(5, '0');
  return '00:00';
}

function getAvatar(name) {
  return (name || '').split(' ').map(n => n[0]).join('').substring(0, 3).toUpperCase() || '?';
}

function classifyShift(startTime, startDate, endDate) {
  const h = parseInt((startTime || '0').split(':')[0]);
  if (startDate !== endDate) {
    if (h >= 18 || h <= 5) return 'night';
  }
  if (h >= 6 && h < 14) return 'morning';
  if (h >= 14 && h < 20) return 'afternoon';
  return 'night';
}

function getRow(row, headers) {
  const obj = {};
  headers.forEach((h, i) => { if (h) obj[h] = row.getCell(i + 1).value; });
  return obj;
}

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const result = { members: 0, shifts: 0, timeoff: 0, updated: 0, skipped: 0 };

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);

    // Ensure teams
    const teamsNeeded = [
      { id: 'l1a', label: 'Layer 1 - Fila A', order_num: 1 },
      { id: 'l1b', label: 'Layer 1 - Fila B', order_num: 2 },
      { id: 'l2', label: 'Layer 2', order_num: 3 },
      { id: 'ems-rotinas', label: 'EMS - Rotinas', order_num: 4 },
      { id: 'sobreaviso', label: 'Sobreaviso', order_num: 5 },
      { id: 'gestao', label: 'Gestão', order_num: 6 },
    ];
    teamsNeeded.forEach(t => db.prepare('INSERT OR IGNORE INTO teams (id, label, order_num) VALUES (?, ?, ?)').run(t.id, t.label, t.order_num));

    // ── Members sheet ──
    const memberSheet = wb.getWorksheet('Members');
    if (memberSheet) {
      memberSheet.eachRow((row, ri) => {
        if (ri < 2) return;
        const name = String(row.getCell(1).value || '').trim();
        const email = String(row.getCell(2).value || '').trim().toLowerCase();
        if (!name) return;
        const existing = db.prepare('SELECT id FROM members WHERE email = ? OR name = ?').get(email, name);
        if (!existing) {
          db.prepare('INSERT INTO members (id,name,email,role,avatar,phone,telegram_chat_id,team_id,is_team_leader,technology,is_manager,manager_order) VALUES (?,?,?,?,?,?,?,?,0,?,0,0)')
            .run(uuidv4(), name, email, '', getAvatar(name), '', '', '', '');
          result.members++;
        } else {
          db.prepare('UPDATE members SET email=?, name=? WHERE id=?').run(email, name, existing.id);
          result.updated++;
        }
      });
    }

    // ── Determine date range ──
    let minDate = null, maxDate = null;
    const shiftsSheet = wb.getWorksheet('Shifts');
    if (shiftsSheet) {
      shiftsSheet.eachRow((row, ri) => {
        if (ri < 2) return;
        const sd = toDateStr(row.getCell(4).value);
        const ed = toDateStr(row.getCell(6).value);
        if (sd && (!minDate || sd < minDate)) minDate = sd;
        if (ed && (!maxDate || ed > maxDate)) maxDate = ed;
      });
    }

    const lastPeriod = db.prepare("SELECT value FROM app_config WHERE key='last_import_period'").get()?.value || '';
    const currentPeriod = `${minDate}__${maxDate}`;
    const isNewCycle = currentPeriod !== lastPeriod;

    if (isNewCycle && minDate && maxDate) {
      db.prepare('DELETE FROM shifts WHERE date >= ? AND date <= ?').run(minDate, maxDate);
      db.prepare('DELETE FROM oncall_entries WHERE start_date >= ? AND start_date <= ?').run(minDate, maxDate);
    }

    // ── Shifts sheet ──
    if (shiftsSheet) {
      // Get headers from first row
      const headers = [];
      shiftsSheet.getRow(1).eachCell((cell, ci) => { headers[ci - 1] = String(cell.value || '').trim(); });

      shiftsSheet.eachRow((row, ri) => {
        if (ri < 2) return;
        const name = String(row.getCell(1).value || '').trim();
        const email = String(row.getCell(2).value || '').trim().toLowerCase();
        const group = String(row.getCell(3).value || '').trim();
        const sd = toDateStr(row.getCell(4).value);
        const st = toTimeStr(row.getCell(5).value);
        const ed = toDateStr(row.getCell(6).value);
        const et = toTimeStr(row.getCell(7).value);
        const notes = String(row.getCell(11).value || '').trim();

        if (!name || !sd) return;

        let member = db.prepare('SELECT id FROM members WHERE email = ?').get(email);
        if (!member) member = db.prepare('SELECT id FROM members WHERE name = ?').get(name);
        if (!member) { result.skipped++; return; }

        const teamId = GROUP_MAP[group] || '';

        if (group === 'SOBREAVISO') {
          const key = `${member.id}-${sd}-${st}`;
          const exists = db.prepare('SELECT id FROM oncall_entries WHERE id = ?').get(key);
          if (!exists) {
            db.prepare('INSERT INTO oncall_entries (id,member_id,start_date,end_date,start_time,end_time,type,label,notified) VALUES (?,?,?,?,?,?,?,?,0)')
              .run(key, member.id, sd, ed || sd, st, et, 'work', notes || 'Sobreaviso');
            result.timeoff++;
          }
        } else {
          if (teamId) {
            const m = db.prepare('SELECT team_id FROM members WHERE id=?').get(member.id);
            if (!m?.team_id) db.prepare('UPDATE members SET team_id=? WHERE id=?').run(teamId, member.id);
          }
          const shiftType = classifyShift(st, sd, ed || sd);
          const shiftId = `${member.id}-${sd}-${st}`;
          const exists = db.prepare('SELECT id FROM shifts WHERE id=?').get(shiftId);
          if (!exists) {
            db.prepare('INSERT INTO shifts (id,member_id,date,type,start_time,end_time,label,color) VALUES (?,?,?,?,?,?,?,?)')
              .run(shiftId, member.id, sd, shiftType, st, et, notes || '', '');
            result.shifts++;
          }
        }
      });
    }

    // ── Time Off sheet ──
    const timeOffSheet = wb.getWorksheet('Time Off');
    if (timeOffSheet) {
      timeOffSheet.eachRow((row, ri) => {
        if (ri < 2) return;
        const name = String(row.getCell(1).value || '').trim();
        const email = String(row.getCell(2).value || '').trim().toLowerCase();
        const sd = toDateStr(row.getCell(3).value);
        const st = toTimeStr(row.getCell(4).value);
        const ed = toDateStr(row.getCell(5).value);
        const et = toTimeStr(row.getCell(6).value);
        const reason = String(row.getCell(7).value || '').trim();

        if (!name || !sd) return;
        const type = TIMEOFF_MAP[reason] || 'day-off';

        let member = db.prepare('SELECT id FROM members WHERE email=?').get(email);
        if (!member) member = db.prepare('SELECT id FROM members WHERE name=?').get(name);
        if (!member) { result.skipped++; return; }

        const key = `to-${member.id}-${sd}-${type}`;
        const exists = db.prepare('SELECT id FROM oncall_entries WHERE id=?').get(key);
        if (!exists) {
          db.prepare('INSERT INTO oncall_entries (id,member_id,start_date,end_date,start_time,end_time,type,label,notified) VALUES (?,?,?,?,?,?,?,?,0)')
            .run(key, member.id, sd, ed || sd, st, et, type, reason || type);
          result.timeoff++;
        }
      });
    }

    db.prepare("INSERT OR REPLACE INTO app_config (key,value) VALUES ('last_import_date',?)").run(new Date().toISOString());
    db.prepare("INSERT OR REPLACE INTO app_config (key,value) VALUES ('last_import_period',?)").run(currentPeriod);
    db.prepare("INSERT OR REPLACE INTO app_config (key,value) VALUES ('seeded','1')").run();

    res.json({ success: true, isNewCycle, period: { from: minDate, to: maxDate }, result });

  } catch (err) {
    console.error('Import error:', err.stack || err.message);
    res.status(500).json({ error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  }
});

module.exports = router;
