export type TeamGroup = 'l1l2-msoc' | 'l1a' | 'l1b' | 'l2' | 'ems-rotinas';

export const teamGroupLabels: Record<TeamGroup, string> = {
  'l1l2-msoc': 'Layer 1/Layer 2 - MSOC',
  'l1a': 'Layer 1 A',
  'l1b': 'Layer 1 B',
  'l2': 'Layer 2',
  'ems-rotinas': 'EMS Rotinas',
};

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  phone: string;
  team: TeamGroup;
  isTeamLeader?: boolean;
}

export interface Shift {
  id: string;
  memberId: string;
  date: string;
  type: 'morning' | 'afternoon' | 'night';
  startTime: string;
  endTime: string;
}

export type OnCallEntryType = 'work' | 'vacation' | 'medical-leave';

export interface OnCallEntry {
  id: string;
  memberId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  type: OnCallEntryType;
  label?: string; // e.g. "WFN", "REDES", "REDES - OC", "INFRA/BKP"
}

export const teamMembers: TeamMember[] = [
  // Layer 1/Layer 2 - MSOC
  { id: '1', name: 'Bruno Figueiredo', role: 'Analista Sênior', avatar: 'BF', phone: '(11) 99999-1001', team: 'l1l2-msoc', isTeamLeader: true },
  { id: '2', name: 'Fábio Brasil', role: 'Analista Pleno', avatar: 'FB', phone: '(11) 99999-1002', team: 'l1l2-msoc' },
  { id: '3', name: 'Laylla Rangel', role: 'Analista Pleno', avatar: 'LR', phone: '(11) 99999-1003', team: 'l1l2-msoc' },
  { id: '4', name: 'Eduardo de A.', role: 'Analista Júnior', avatar: 'EA', phone: '(11) 99999-1004', team: 'l1l2-msoc' },
  // Layer 1 A
  { id: '5', name: 'José Couto', role: 'Analista Pleno', avatar: 'JC', phone: '(11) 99999-2001', team: 'l1a' },
  { id: '6', name: 'Alexandre Oliveira', role: 'Analista Pleno', avatar: 'AO', phone: '(11) 99999-2002', team: 'l1a' },
  { id: '7', name: 'Jorge Andrade', role: 'Analista Júnior', avatar: 'JA', phone: '(11) 99999-2003', team: 'l1a' },
  { id: '8', name: 'Henrique Almeida', role: 'Analista Júnior', avatar: 'HA', phone: '(11) 99999-2004', team: 'l1a' },
  // Layer 1 B
  { id: '9', name: 'Gleison Rocha', role: 'Analista Pleno', avatar: 'GR', phone: '(11) 99999-3001', team: 'l1b' },
  { id: '10', name: 'Bruno Vicente', role: 'Analista Júnior', avatar: 'BV', phone: '(11) 99999-3002', team: 'l1b' },
  { id: '11', name: 'Daniel Polat', role: 'Analista Júnior', avatar: 'DP', phone: '(11) 99999-3003', team: 'l1b' },
  { id: '12', name: 'Priscila Santos', role: 'Analista Pleno', avatar: 'PS', phone: '(11) 99999-3004', team: 'l1b' },
  // Layer 2
  { id: '13', name: 'Adriano Brigatto', role: 'Especialista', avatar: 'AB', phone: '(11) 99999-4001', team: 'l2' },
  { id: '14', name: 'Alexander Victor', role: 'Analista Sênior', avatar: 'AV', phone: '(11) 99999-4002', team: 'l2' },
  { id: '15', name: 'Diogo Caldeira', role: 'Analista Sênior', avatar: 'DC', phone: '(11) 99999-4003', team: 'l2' },
  { id: '16', name: 'José Calimenero', role: 'Analista Pleno', avatar: 'JCa', phone: '(11) 99999-4004', team: 'l2' },
  // EMS Rotinas
  { id: '17', name: 'Fábio Rodrigues', role: 'Analista Pleno', avatar: 'FR', phone: '(11) 99999-5001', team: 'ems-rotinas' },
  { id: '18', name: 'Osvaldo Delfino', role: 'Analista Sênior', avatar: 'OD', phone: '(11) 99999-5002', team: 'ems-rotinas', isTeamLeader: true },
  { id: '19', name: 'Marco Rosina', role: 'Analista Júnior', avatar: 'MR', phone: '(11) 99999-5003', team: 'ems-rotinas' },
  { id: '20', name: 'Diego Leite', role: 'Analista Júnior', avatar: 'DL', phone: '(11) 99999-5004', team: 'ems-rotinas' },
  { id: '21', name: 'Leonardo Trigo', role: 'Analista Pleno', avatar: 'LT', phone: '(11) 99999-5005', team: 'ems-rotinas' },
  { id: '22', name: 'Sidnei Oliveira', role: 'Analista Pleno', avatar: 'SO', phone: '(11) 99999-5006', team: 'ems-rotinas' },
  { id: '23', name: 'Jefferson Souza', role: 'Analista Júnior', avatar: 'JS', phone: '(11) 99999-5007', team: 'ems-rotinas' },
  { id: '24', name: 'Thercio Costa', role: 'Analista Pleno', avatar: 'TC', phone: '(11) 99999-5008', team: 'ems-rotinas' },
  { id: '25', name: 'Ygor Soares', role: 'Analista Pleno', avatar: 'YS', phone: '(11) 99999-5009', team: 'ems-rotinas' },
  { id: '26', name: 'Tiago Garcia', role: 'Analista Júnior', avatar: 'TG', phone: '(11) 99999-5010', team: 'ems-rotinas' },
];

const today = new Date();
const getDateStr = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

// Generate shifts for each team
function generateTeamShifts(team: TeamGroup): Shift[] {
  const members = teamMembers.filter(m => m.team === team);
  const result: Shift[] = [];
  const types: Array<'morning' | 'afternoon' | 'night'> = ['morning', 'afternoon', 'night'];
  
  for (let day = 0; day < 7; day++) {
    types.forEach((type, typeIdx) => {
      const memberIdx = (day + typeIdx) % members.length;
      if (members[memberIdx]) {
        result.push({
          id: `${team}-s-${day}-${type}`,
          memberId: members[memberIdx].id,
          date: getDateStr(day),
          type,
          startTime: type === 'morning' ? '06:00' : type === 'afternoon' ? '14:00' : '22:00',
          endTime: type === 'morning' ? '14:00' : type === 'afternoon' ? '22:00' : '06:00',
        });
      }
    });
  }
  return result;
}

export const shifts: Shift[] = [
  ...generateTeamShifts('l1l2-msoc'),
  ...generateTeamShifts('l1a'),
  ...generateTeamShifts('l1b'),
  ...generateTeamShifts('l2'),
  ...generateTeamShifts('ems-rotinas'),
];

// On-call entries - timeline entries per person
// Weekday on-call: typically evening hours (e.g. 0:00-6:00 or 18:00-0:00)
// Weekend on-call: different blocks, includes Team Leaders
export const onCallEntries: OnCallEntry[] = [
  // Bruno Figueiredo
  { id: 'oc1', memberId: '1', startDate: getDateStr(1), endDate: getDateStr(1), startTime: '0:00', endTime: '6:00', type: 'work', label: 'WFN' },
  { id: 'oc2', memberId: '1', startDate: getDateStr(5), endDate: getDateStr(5), startTime: '12:00', endTime: '0:00', type: 'work', label: 'WFN' },
  // Fábio Brasil
  { id: 'oc3', memberId: '2', startDate: getDateStr(3), endDate: getDateStr(3), startTime: '0:00', endTime: '6:00', type: 'work', label: 'WFN' },
  { id: 'oc4', memberId: '2', startDate: getDateStr(6), endDate: getDateStr(6), startTime: '0:00', endTime: '12:00', type: 'work', label: 'WFN' },
  // Laylla Rangel
  { id: 'oc5', memberId: '3', startDate: getDateStr(5), endDate: getDateStr(5), startTime: '0:00', endTime: '12:00', type: 'work', label: 'WFN/BKP' },
  { id: 'oc6', memberId: '3', startDate: getDateStr(6), endDate: getDateStr(6), startTime: '0:00', endTime: '12:00', type: 'work', label: 'INFRA/BKP' },
  // Eduardo de A. - medical leave
  { id: 'oc7', memberId: '4', startDate: getDateStr(1), endDate: getDateStr(3), startTime: '0:00', endTime: '0:00', type: 'medical-leave', label: 'Dia de Licença Médica' },
  // José Couto - vacation
  { id: 'oc8', memberId: '5', startDate: getDateStr(-3), endDate: getDateStr(2), startTime: '0:00', endTime: '0:00', type: 'vacation', label: 'Férias' },
  // Alexandre Oliveira - vacation
  { id: 'oc9', memberId: '6', startDate: getDateStr(-2), endDate: getDateStr(1), startTime: '0:00', endTime: '0:00', type: 'vacation', label: 'Férias' },
  // Jorge Andrade
  { id: 'oc10', memberId: '7', startDate: getDateStr(0), endDate: getDateStr(0), startTime: '0:00', endTime: '6:00', type: 'work', label: 'WFN/COEL' },
  // Gleison Rocha
  { id: 'oc11', memberId: '9', startDate: getDateStr(4), endDate: getDateStr(4), startTime: '0:00', endTime: '6:00', type: 'work', label: 'WFN' },
  // Bruno Vicente
  { id: 'oc12', memberId: '10', startDate: getDateStr(6), endDate: getDateStr(6), startTime: '0:00', endTime: '22:00', type: 'work', label: 'BANCO' },
  { id: 'oc19b', memberId: '10', startDate: getDateStr(6), endDate: getDateStr(6), startTime: '12:00', endTime: '0:00', type: 'work', label: 'WFN' },
  // Daniel Polat
  { id: 'oc13', memberId: '11', startDate: getDateStr(0), endDate: getDateStr(0), startTime: '0:00', endTime: '6:00', type: 'work', label: 'WFN' },
  // Priscila Santos
  { id: 'oc14', memberId: '12', startDate: getDateStr(3), endDate: getDateStr(3), startTime: '22:00', endTime: '6:00', type: 'work', label: 'REDES - OC' },
  // Adriano Brigatto - vacation
  { id: 'oc15', memberId: '13', startDate: getDateStr(0), endDate: getDateStr(0), startTime: '0:00', endTime: '0:00', type: 'vacation', label: 'Férias' },
  // Alexander Victor
  { id: 'oc16', memberId: '14', startDate: getDateStr(5), endDate: getDateStr(5), startTime: '12:00', endTime: '0:00', type: 'work', label: 'REDES' },
  // Diogo Caldeira
  { id: 'oc17', memberId: '15', startDate: getDateStr(6), endDate: getDateStr(6), startTime: '0:00', endTime: '12:00', type: 'work', label: 'REDES' },
  // Fábio Rodrigues
  { id: 'oc18', memberId: '17', startDate: getDateStr(2), endDate: getDateStr(2), startTime: '22:00', endTime: '6:00', type: 'work', label: 'REDES - OC' },
  // Osvaldo Delfino (TL)
  { id: 'oc19', memberId: '18', startDate: getDateStr(0), endDate: getDateStr(0), startTime: '22:00', endTime: '6:00', type: 'work', label: 'REDES' },
  { id: 'oc20', memberId: '18', startDate: getDateStr(5), endDate: getDateStr(5), startTime: '6:00', endTime: '12:00', type: 'work', label: 'REDES' },
  // Sidnei Oliveira
  { id: 'oc21', memberId: '22', startDate: getDateStr(5), endDate: getDateStr(5), startTime: '6:00', endTime: '22:00', type: 'work', label: 'BANCO' },
  // Thercio Costa
  { id: 'oc22', memberId: '24', startDate: getDateStr(5), endDate: getDateStr(5), startTime: '12:00', endTime: '0:00', type: 'work', label: 'BKP' },
  { id: 'oc23', memberId: '24', startDate: getDateStr(6), endDate: getDateStr(6), startTime: '12:00', endTime: '0:00', type: 'work', label: 'BKP' },
  // Ygor Soares
  { id: 'oc24', memberId: '25', startDate: getDateStr(1), endDate: getDateStr(1), startTime: '22:00', endTime: '6:00', type: 'work', label: 'REDES OC' },
  { id: 'oc25', memberId: '25', startDate: getDateStr(4), endDate: getDateStr(4), startTime: '22:00', endTime: '6:00', type: 'work', label: 'REDES - OC' },
];

export const shiftTypeLabels: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  night: 'Noite',
};

export const getShiftTypeColor = (type: string) => {
  switch (type) {
    case 'morning': return 'shift-badge-morning';
    case 'afternoon': return 'shift-badge-afternoon';
    case 'night': return 'shift-badge-night';
    default: return '';
  }
};

export const getMemberById = (id: string) => teamMembers.find(m => m.id === id);

export const getTeamMembers = (team: TeamGroup) => teamMembers.filter(m => m.team === team);

export const getShiftsByTeam = (team: TeamGroup) => {
  const memberIds = getTeamMembers(team).map(m => m.id);
  return shifts.filter(s => memberIds.includes(s.memberId));
};
