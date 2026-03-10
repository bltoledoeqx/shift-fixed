const crypto = require('crypto');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '0zPQP#$4z4';
const VIEWER_USER = process.env.VIEWER_USER || 'EMSOPS';
const VIEWER_PASS = process.env.VIEWER_PASS || '0zPQP#$4z3';

// Active sessions: token -> expiry
const sessions = new Map();
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

// Brute force protection: track failed attempts per IP
const failedAttempts = new Map();
const MAX_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function isLockedOut(ip) {
  const entry = failedAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) { failedAttempts.delete(ip); return false; }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const entry = failedAttempts.get(ip) || { count: 0, resetAt: Date.now() + LOCKOUT_MS };
  entry.count++;
  if (entry.count === 1) entry.resetAt = Date.now() + LOCKOUT_MS;
  failedAttempts.set(ip, entry);
}

function clearAttempts(ip) {
  failedAttempts.delete(ip);
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run comparison to avoid timing leak
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function getUserRole(username) {
  if (username === ADMIN_USER) return 'admin';
  if (username === VIEWER_USER) return 'viewer';
  return null;
}

function createToken(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const role = getUserRole(username);
  sessions.set(token, { username, role, expiry: Date.now() + SESSION_TTL });
  return token;
}

function getTokenRole(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiry) { sessions.delete(token); return null; }
  return session.role || 'viewer';
}

function validateToken(token) {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiry) { sessions.delete(token); return false; }
  session.expiry = Date.now() + SESSION_TTL;
  return true;
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!validateToken(token)) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }
  next();
}

function adminMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  const role = getTokenRole(token);
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

module.exports = { ADMIN_USER, ADMIN_PASS, VIEWER_USER, VIEWER_PASS, createToken, validateToken, getTokenRole, authMiddleware, adminMiddleware, isLockedOut, recordFailedAttempt, clearAttempts, timingSafeEqual, getUserRole };
