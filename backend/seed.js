const { db } = require('./db');

function seedData() {
  // Only create default teams if none exist
  const teamCount = db.prepare('SELECT COUNT(*) as c FROM teams').get().c;
  if (teamCount === 0) {
    const teams = [
      { id: 'l1a', label: 'Layer 1 - Fila A', order_num: 1 },
      { id: 'l1b', label: 'Layer 1 - Fila B', order_num: 2 },
      { id: 'l2', label: 'Layer 2', order_num: 3 },
      { id: 'ems-rotinas', label: 'EMS - Rotinas', order_num: 4 },
      { id: 'sobreaviso', label: 'Sobreaviso', order_num: 5 },
      { id: 'gestao', label: 'Gestão', order_num: 6 },
    ];
    const ins = db.prepare('INSERT OR IGNORE INTO teams (id, label, order_num) VALUES (?, ?, ?)');
    teams.forEach(t => ins.run(t.id, t.label, t.order_num));
    console.log('✅ Default teams created. Import XLSX to populate members and shifts.');
  }
}

module.exports = { seedData };
