export interface Team { id: string; label: string; order_num: number; }

export interface Member {
  id: string; name: string; email: string; role: string; avatar: string;
  phone: string; telegram_chat_id: string; team_id: string;
  is_team_leader: number; technology: string;
  is_manager: number; manager_order: number;
  team_label?: string;
}

export interface Shift {
  id: string; member_id: string; date: string;
  type: 'morning' | 'afternoon' | 'night';
  start_time: string; end_time: string; label: string; color: string;
  name?: string; avatar?: string; member_team_id?: string;
}

export type OnCallType = 'work' | 'vacation' | 'medical-leave' | 'day-off' | 'comp-time';

export interface OnCallEntry {
  id: string; member_id: string; start_date: string; end_date: string;
  start_time: string; end_time: string; type: OnCallType; label: string; notified?: number;
  name?: string; avatar?: string; team_id?: string; technology?: string;
  phone?: string; is_team_leader?: number;
}

export interface AppConfig {
  telegram_token: string; telegram_group_chat_id: string;
  notification_template: string; push_notification_template: string; last_import_date: string; last_import_period: string;
}

export const SHIFT_TYPE_LABELS: Record<string, string> = { morning: 'Manhã', afternoon: 'Tarde', night: 'Noite' };

export const ONCALL_TYPE_LABELS: Record<OnCallType, string> = {
  work: 'Sobreaviso', vacation: 'Férias', 'medical-leave': 'Licença Médica',
  'day-off': 'Folga Alinhada', 'comp-time': 'Banco de Horas',
};

export const ROLES_ANALYST = [
  'Intern', 'Hosting Operations Associate', 'Hosting Operations Specialist',
  'Hosting Operations Senior Specialist', 'Hosting Operations Senior Expert',
];

export const ROLES_MANAGER = ['Team Lead', 'Assistant Manager', 'Manager', 'Manager Senior'];

export const SHIFT_DEFAULT_TIMES: Record<string, { start: string; end: string }> = {
  morning: { start: '06:00', end: '14:00' },
  afternoon: { start: '14:00', end: '22:00' },
  night: { start: '22:00', end: '06:00' },
};
