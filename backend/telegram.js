const { db } = require('./db');

async function sendTelegramMessage(chatId, text, token) {
  if (!chatId || !token) return { success: false, error: 'Missing chatId or token' };
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await response.json();
    if (!data.ok) console.error('Telegram error:', data);
    return { success: data.ok, data };
  } catch (err) {
    console.error('Telegram fetch error:', err.message);
    return { success: false, error: err.message };
  }
}

function parseTimeToMinutes(t) {
  const [h, m] = (t || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
}

async function checkAndNotifyShifts() {
  try {
    const tokenRow   = db.prepare("SELECT value FROM app_config WHERE key = 'telegram_token'").get();
    const groupRow   = db.prepare("SELECT value FROM app_config WHERE key = 'telegram_group_chat_id'").get();
    const templateRow= db.prepare("SELECT value FROM app_config WHERE key = 'notification_template'").get();
    const token = tokenRow?.value;
    if (!token) return [];

    const now     = new Date();
    const todayStr= now.toISOString().split('T')[0];
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const template= templateRow?.value || '🔔 Sobreaviso iniciando: {{name}} - {{start_time}}–{{end_time}} ({{label}})';

    // Busca entradas não notificadas que começam hoje OU que cruzam meia-noite (start ontem, end hoje)
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const entries = db.prepare(`
      SELECT oc.*, m.name, m.telegram_chat_id
      FROM oncall_entries oc JOIN members m ON oc.member_id = m.id
      WHERE oc.type = 'work'
        AND oc.notified = 0
        AND (
          oc.start_date = ?
          OR (oc.start_date = ? AND oc.end_date = ?)
        )
    `).all(todayStr, yesterdayStr, todayStr);

    const notifiedEntries = [];
    for (const entry of entries) {
      const startMins = parseTimeToMinutes(entry.start_time);
      const endMins   = parseTimeToMinutes(entry.end_time);

      // Ajusta startMins para turnos que cruzam meia-noite vindos de ontem
      let effectiveStartMins = startMins;
      if (entry.start_date === yesterdayStr) {
        // Turno começou ontem (ex: 22:00), notificar quando nowMins+5 >= 1440+startMins? Não —
        // esses já deveriam ter sido notificados ontem às 21:55. Pular.
        continue;
      }

      // Janela: notifica entre 6 min antes e o momento exato do início (cobre reinicializações)
      // Também notifica se o turno começou há no máximo 5 minutos (container estava down)
      const diff = startMins - nowMins;
      const shouldNotify = (diff >= 0 && diff <= 6) || (diff < 0 && diff >= -5);

      if (shouldNotify) {
        const msg = template
          .replace(/{{name}}/g,       entry.name)
          .replace(/{{date}}/g,       entry.start_date)
          .replace(/{{start_time}}/g, entry.start_time)
          .replace(/{{end_time}}/g,   entry.end_time)
          .replace(/{{label}}/g,      entry.label || 'Sobreaviso');

        if (entry.telegram_chat_id) await sendTelegramMessage(entry.telegram_chat_id, msg, token);
        const groupId = groupRow?.value;
        if (groupId) await sendTelegramMessage(groupId, msg, token);

        db.prepare('UPDATE oncall_entries SET notified = 1 WHERE id = ?').run(entry.id);
        notifiedEntries.push(entry);

        const when = diff < 0 ? `(${Math.abs(diff)} min atraso — container estava down)` : `(${diff} min antes)`;
        console.log(`📱 Notified ${entry.name} ${entry.start_time}–${entry.end_time} ${when}`);
      }
    }
    return notifiedEntries;
  } catch (err) {
    console.error('Notification check error:', err.message);
    return [];
  }
}

module.exports = { sendTelegramMessage, checkAndNotifyShifts };
