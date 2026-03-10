const express = require('express');
const path = require('path');
const cors = require('cors');
const cron = require('node-cron');
const { initDb, db } = require('./db');
const { seedData } = require('./seed');
const { checkAndNotifyShifts } = require('./telegram');
const { authMiddleware, adminMiddleware, validateToken } = require('./auth');
const { sendPushToAll } = require('./routes/push');

const app = express();

// CSP — allow what our React app needs
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https://i.postimg.cc; " +
    "connect-src 'self' https://fcm.googleapis.com https://*.googleapis.com;"
  );
  next();
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Simple rate limiter for API routes
const apiHits = new Map();
app.use('/api', (req, res, next) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const max = 200;
  const entry = apiHits.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
  entry.count++;
  apiHits.set(ip, entry);
  if (entry.count > max) return res.status(429).json({ error: 'Muitas requisições. Aguarde.' });
  next();
});

initDb();
seedData();

// Public routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/members', (req,res,next) => ['POST','PUT','DELETE'].includes(req.method) ? adminMiddleware(req,res,next) : next(), require('./routes/members'));
app.use('/api/shifts', (req,res,next) => ['POST','PUT','DELETE'].includes(req.method) ? adminMiddleware(req,res,next) : next(), require('./routes/shifts'));
app.use('/api/oncall', (req,res,next) => ['POST','PUT','DELETE'].includes(req.method) ? adminMiddleware(req,res,next) : next(), require('./routes/oncall'));
app.use('/api/push', require('./routes/push').router);

// Protected admin routes
app.use('/api/reports', adminMiddleware, require('./routes/reports'));
app.use('/api/config', adminMiddleware, require('./routes/config'));
app.use('/api/import', adminMiddleware, require('./routes/import'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.get('/api/debug/modules', (req, res) => {
  const status = {};
  ['exceljs','multer','better-sqlite3','uuid','node-cron','web-push'].forEach(m => {
    try { require(m); status[m] = 'ok'; } catch(e) { status[m] = e.message; }
  });
  res.json(status);
});

// ── Viewer auth middleware — protege todas as rotas /api exceto login/health/push ──
const publicApiRoutes = ['/api/auth/login', '/api/health', '/api/push/vapid-public-key', '/api/push/subscribe', '/api/push/unsubscribe'];
app.use('/api', (req, res, next) => {
  if (publicApiRoutes.some(r => req.path === r)) return next();
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!validateToken(token)) {
    return res.status(401).json({ error: 'Não autorizado. Faça login.' });
  }
  next();
});

// Serve React frontend
const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));
app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

// Every minute: check oncall notifications (Telegram + Push) — 5 min before start
cron.schedule('* * * * *', async () => {
  const notified = await checkAndNotifyShifts();
  if (notified && notified.length > 0) {
    const pushTemplate = db.prepare("SELECT value FROM app_config WHERE key='push_notification_template'").get()?.value
      || '🔔 {{name}} inicia sobreaviso às {{start_time}}';

    for (const entry of notified) {
      const body = pushTemplate
        .replace('{{name}}', entry.name)
        .replace('{{start_time}}', entry.start_time)
        .replace('{{end_time}}', entry.end_time)
        .replace('{{label}}', entry.label || 'Sobreaviso')
        .replace('{{date}}', entry.start_date);

      await sendPushToAll({
        title: '🔔 Sobreaviso Iniciando',
        body,
        icon: '/logo.svg',
        url: '/sobreaviso',
      });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Shift Navigator on http://0.0.0.0:${PORT}`);
  console.log(`🔐 Admin routes protected`);
  console.log(`📱 Telegram + Push cron active\n`);
});
