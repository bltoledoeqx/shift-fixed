const express = require('express');
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

router.get('/', (req, res) => {
  const { team_id } = req.query;
  const q = team_id
    ? 'SELECT m.*, t.label as team_label FROM members m LEFT JOIN teams t ON m.team_id = t.id WHERE m.team_id = ? ORDER BY m.is_manager DESC, m.manager_order, m.name'
    : 'SELECT m.*, t.label as team_label FROM members m LEFT JOIN teams t ON m.team_id = t.id ORDER BY t.order_num, m.is_manager DESC, m.manager_order, m.name';
  const rows = team_id ? db.prepare(q).all(team_id) : db.prepare(q).all();
  res.json(rows);
});

router.get('/managers', (req, res) => {
  res.json(db.prepare('SELECT * FROM members WHERE is_manager = 1 ORDER BY manager_order').all());
});

router.get('/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  res.json(m);
});

router.post('/', (req, res) => {
  const { name, email, role, avatar, phone, telegram_chat_id, team_id, is_team_leader, technology, is_manager, manager_order } = req.body;
  const id = uuidv4();
  const autoAvatar = avatar || name.split(' ').map(n => n[0]).join('').substring(0, 3).toUpperCase();
  db.prepare(`INSERT INTO members (id, name, email, role, avatar, phone, telegram_chat_id, team_id, is_team_leader, technology, is_manager, manager_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, name, email || '', role, autoAvatar, phone || '', telegram_chat_id || '', team_id || '', is_team_leader ? 1 : 0, technology || '', is_manager ? 1 : 0, manager_order || 0);
  res.json({ id, name, email, role, avatar: autoAvatar, phone, telegram_chat_id, team_id, is_team_leader, technology, is_manager, manager_order });
});

router.put('/:id', (req, res) => {
  const { name, email, role, avatar, phone, telegram_chat_id, team_id, is_team_leader, technology, is_manager, manager_order } = req.body;
  db.prepare(`UPDATE members SET name=?, email=?, role=?, avatar=?, phone=?, telegram_chat_id=?, team_id=?, is_team_leader=?, technology=?, is_manager=?, manager_order=? WHERE id=?`)
    .run(name, email || '', role, avatar || '', phone || '', telegram_chat_id || '', team_id || '', is_team_leader ? 1 : 0, technology || '', is_manager ? 1 : 0, manager_order || 0, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
