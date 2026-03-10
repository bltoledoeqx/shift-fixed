const express = require('express');
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

function parseMins(t) {
  const [h, m] = (t || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
}

// Active on-call right now (for escalation)
router.get('/current', (req, res) => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const entries = db.prepare(`
    SELECT oc.*, m.name, m.avatar, m.technology, m.team_id, m.phone, m.is_team_leader
    FROM oncall_entries oc JOIN members m ON oc.member_id = m.id
    WHERE oc.type = 'work' AND oc.start_date <= ? AND oc.end_date >= ?
    ORDER BY oc.start_time
  `).all(dateStr, dateStr);

  const active = entries.filter(e => {
    const s = parseMins(e.start_time), en = parseMins(e.end_time);
    return en > s ? (nowMins >= s && nowMins < en) : (nowMins >= s || nowMins < en);
  });

  res.json(active);
});

router.get('/', (req, res) => {
  const { member_id, start_date, end_date, type } = req.query;
  let q = `SELECT oc.*, m.name, m.avatar, m.team_id, m.phone, m.is_team_leader, t.label as team_label FROM oncall_entries oc JOIN members m ON oc.member_id = m.id LEFT JOIN teams t ON m.team_id = t.id WHERE 1=1`;
  const p = [];

  if (member_id) { q += ' AND oc.member_id = ?'; p.push(member_id); }
  if (type) { q += ' AND oc.type = ?'; p.push(type); }
  if (start_date) { q += ' AND oc.end_date >= ?'; p.push(start_date); }
  if (end_date) { q += ' AND oc.start_date <= ?'; p.push(end_date); }

  q += ' ORDER BY oc.start_date, oc.start_time';
  res.json(db.prepare(q).all(...p));
});

router.post('/', (req, res) => {
  const { member_id, start_date, end_date, start_time, end_time, type, label } = req.body;
  const id = uuidv4();
  db.prepare(`INSERT INTO oncall_entries (id, member_id, start_date, end_date, start_time, end_time, type, label, notified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`)
    .run(id, member_id, start_date, end_date, start_time || '00:00', end_time || '00:00', type, label || '');
  res.json({ id, member_id, start_date, end_date, start_time, end_time, type, label });
});

router.put('/:id', (req, res) => {
  const { member_id, start_date, end_date, start_time, end_time, type, label } = req.body;
  db.prepare(`UPDATE oncall_entries SET member_id=?, start_date=?, end_date=?, start_time=?, end_time=?, type=?, label=?, notified=0 WHERE id=?`)
    .run(member_id, start_date, end_date, start_time || '00:00', end_time || '00:00', type, label || '', req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM oncall_entries WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
