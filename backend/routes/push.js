const express = require('express');
const webpush = require('web-push');
const { db } = require('../db');
const router = express.Router();

function getVapidKeys() {
  const pub = db.prepare("SELECT value FROM app_config WHERE key='vapid_public_key'").get()?.value;
  const priv = db.prepare("SELECT value FROM app_config WHERE key='vapid_private_key'").get()?.value;
  const email = db.prepare("SELECT value FROM app_config WHERE key='vapid_email'").get()?.value || 'mailto:admin@ems.local';
  return { pub, priv, email };
}

function initVapid() {
  const { pub, priv } = getVapidKeys();
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(getVapidKeys().email, pub, priv);
    return true;
  } catch { return false; }
}

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  const { pub } = getVapidKeys();
  if (!pub) {
    // Auto-generate keys on first request
    const keys = webpush.generateVAPIDKeys();
    db.prepare("INSERT OR REPLACE INTO app_config (key,value) VALUES ('vapid_public_key',?)").run(keys.publicKey);
    db.prepare("INSERT OR REPLACE INTO app_config (key,value) VALUES ('vapid_private_key',?)").run(keys.privateKey);
    console.log('🔑 VAPID keys generated');
    return res.json({ publicKey: keys.publicKey });
  }
  res.json({ publicKey: pub });
});

// POST /api/push/subscribe
router.post('/subscribe', (req, res) => {
  const { subscription, memberId } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

  const endpoint = subscription.endpoint;
  const existing = db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').get(endpoint);
  if (!existing) {
    db.prepare('INSERT INTO push_subscriptions (endpoint, keys, member_id, created_at) VALUES (?, ?, ?, ?)')
      .run(endpoint, JSON.stringify(subscription.keys || {}), memberId || null, new Date().toISOString());
  } else {
    db.prepare('UPDATE push_subscriptions SET keys=?, member_id=? WHERE endpoint=?')
      .run(JSON.stringify(subscription.keys || {}), memberId || null, endpoint);
  }
  res.json({ success: true });
});

// POST /api/push/unsubscribe
router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  res.json({ success: true });
});

// Send push to all subscribers (internal use)
async function sendPushToAll(payload) {
  if (!initVapid()) return;
  const subs = db.prepare('SELECT * FROM push_subscriptions').all();
  const dead = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: JSON.parse(sub.keys || '{}') },
        JSON.stringify(payload),
        { TTL: 3600 }
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) dead.push(sub.endpoint);
    }
  }
  // Clean expired subscriptions
  dead.forEach(ep => db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(ep));
  return subs.length - dead.length;
}

// POST /api/push/test (admin)
router.post('/test', async (req, res) => {
  const sent = await sendPushToAll({
    title: '🔔 EMS On Call — Teste',
    body: 'Notificações push funcionando! ✅',
    icon: '/logo.svg',
    url: '/',
  });
  res.json({ success: true, sent });
});

module.exports = { router, sendPushToAll };
