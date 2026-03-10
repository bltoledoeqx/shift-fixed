const express = require('express');
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM teams ORDER BY order_num').all());
});

router.post('/', (req, res) => {
  const { id, label, order_num } = req.body;
  const teamId = id || uuidv4();
  db.prepare('INSERT INTO teams (id, label, order_num) VALUES (?, ?, ?)').run(teamId, label, order_num || 0);
  res.json({ id: teamId, label, order_num: order_num || 0 });
});

router.put('/:id', (req, res) => {
  const { label, order_num } = req.body;
  db.prepare('UPDATE teams SET label = ?, order_num = ? WHERE id = ?').run(label, order_num, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
