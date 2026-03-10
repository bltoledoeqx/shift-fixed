const express = require('express');
const { db } = require('../db');
const { sendTelegramMessage } = require('../telegram');
const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare("SELECT key, value FROM app_config WHERE key != 'seeded'").all();
  const result = {};
  rows.forEach(r => { result[r.key] = r.value; });
  res.json(result);
});

router.put('/', (req, res) => {
  const allowed = ['telegram_token', 'telegram_group_chat_id', 'notification_template', 'push_notification_template'];
  allowed.forEach(key => {
    if (req.body[key] !== undefined) {
      db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)").run(key, req.body[key]);
    }
  });
  res.json({ success: true });
});

router.post('/test-telegram', async (req, res) => {
  const { chat_id } = req.body;
  const tokenRow = db.prepare("SELECT value FROM app_config WHERE key = 'telegram_token'").get();
  const templateRow = db.prepare("SELECT value FROM app_config WHERE key = 'notification_template'").get();
  const token = tokenRow?.value;
  if (!token) return res.status(400).json({ success: false, error: 'Token não configurado' });

  const template = templateRow?.value || '🔔 Teste de notificação do Shift Navigator!';
  const testMsg = template
    .replace('{{name}}', 'Analista Teste')
    .replace('{{date}}', new Date().toISOString().split('T')[0])
    .replace('{{start_time}}', '08:00')
    .replace('{{end_time}}', '14:00')
    .replace('{{label}}', 'TESTE');

  const result = await sendTelegramMessage(chat_id, testMsg, token);
  res.json(result);
});

module.exports = router;
