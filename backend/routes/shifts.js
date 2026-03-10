const express = require('express');
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

router.get('/', (req, res) => {
  const { team_id, member_id, date, start_date, end_date } = req.query;
  let q = `SELECT s.*, m.name, m.avatar, m.team_id as member_team_id FROM shifts s JOIN members m ON s.member_id = m.id WHERE 1=1`;
  const p = [];
  if (date) { q += ' AND s.date = ?'; p.push(date); }
  else if (start_date && end_date) { q += ' AND s.date >= ? AND s.date <= ?'; p.push(start_date, end_date); }
  else if (start_date) { q += ' AND s.date >= ?'; p.push(start_date); }
  if (team_id) { q += ' AND m.team_id = ?'; p.push(team_id); }
  if (member_id) { q += ' AND s.member_id = ?'; p.push(member_id); }
  q += ' ORDER BY s.date, s.start_time';
  res.json(db.prepare(q).all(...p));
});

// Create with optional recurrence
router.post('/', (req, res) => {
  const { member_id, date, type, start_time, end_time, label, color, repeat, repeat_end_date, days_of_week } = req.body;

  if (!repeat || repeat === 'none') {
    const id = uuidv4();
    db.prepare('INSERT OR IGNORE INTO shifts (id, member_id, date, type, start_time, end_time, label, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, member_id, date, type, start_time, end_time, label || '', color || '');
    return res.json({ id, member_id, date, type, start_time, end_time });
  }

  // Generate recurring shifts
  const start = new Date(date + 'T12:00:00');
  const end = repeat_end_date ? new Date(repeat_end_date + 'T12:00:00') : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const created = [];
  const insertStmt = db.prepare('INSERT OR IGNORE INTO shifts (id, member_id, date, type, start_time, end_time, label, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

  if (repeat === '12x36') {
    // Alternates: work day, 2 days off, work day...
    let cur = new Date(start);
    let workTurn = true;
    while (cur <= end) {
      if (workTurn) {
        const ds = cur.toISOString().split('T')[0];
        const id = uuidv4();
        insertStmt.run(id, member_id, ds, type, start_time, end_time, label || '', color || '');
        created.push(ds);
        cur.setDate(cur.getDate() + 1); // next day
      } else {
        cur.setDate(cur.getDate() + 1); // skip rest day 1
        // skip rest day 2 is handled by next iteration staying false
      }
      workTurn = !workTurn;
    }
  } else {
    // weekdays, everyday, custom
    const allowedDays = repeat === 'weekdays' ? [1,2,3,4,5]
      : repeat === 'everyday' ? [0,1,2,3,4,5,6]
      : repeat === 'weekends' ? [0,6]
      : (days_of_week || []);

    let cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      if (allowedDays.includes(dow)) {
        const ds = cur.toISOString().split('T')[0];
        const id = uuidv4();
        insertStmt.run(id, member_id, ds, type, start_time, end_time, label || '', color || '');
        created.push(ds);
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  res.json({ created: created.length, dates: created.slice(0, 5) });
});

router.put('/:id', (req, res) => {
  const { member_id, date, type, start_time, end_time, label, color } = req.body;
  db.prepare('UPDATE shifts SET member_id=?, date=?, type=?, start_time=?, end_time=?, label=?, color=? WHERE id=?')
    .run(member_id, date, type, start_time, end_time, label || '', color || '', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM shifts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});


// GET /api/shifts/current — analistas da escala normal ativos agora
router.get('/current', (req, res) => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const shifts = db.prepare(`
    SELECT s.*, m.name, m.avatar, m.team_id, m.phone, m.is_team_leader, t.label as team_label
    FROM shifts s
    JOIN members m ON s.member_id = m.id
    LEFT JOIN teams t ON m.team_id = t.id
    WHERE s.date = ?
    ORDER BY s.start_time
  `).all(dateStr);

  const active = shifts.filter(s => {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return end > start ? (nowMins >= start && nowMins < end) : (nowMins >= start || nowMins < end);
  });

  res.json(active);
});
module.exports = router;
