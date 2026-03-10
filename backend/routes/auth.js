const express = require('express');
const { ADMIN_USER, ADMIN_PASS, VIEWER_USER, VIEWER_PASS, createToken, isLockedOut, recordFailedAttempt, clearAttempts, timingSafeEqual } = require('../auth');
const router = express.Router();

router.post('/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  if (isLockedOut(ip)) {
    return res.status(429).json({ success: false, error: 'Muitas tentativas. Tente novamente em 15 minutos.' });
  }

  const { username, password } = req.body;
  const isAdmin  = timingSafeEqual(username || '', ADMIN_USER)  && timingSafeEqual(password || '', ADMIN_PASS);
  const isViewer = timingSafeEqual(username || '', VIEWER_USER) && timingSafeEqual(password || '', VIEWER_PASS);

  if (isAdmin || isViewer) {
    clearAttempts(ip);
    const token = createToken(username);
    const role = isAdmin ? 'admin' : 'viewer';
    return res.json({ success: true, token, role });
  }

  recordFailedAttempt(ip);
  res.status(401).json({ success: false, error: 'Usuário ou senha incorretos.' });
});

module.exports = router;
