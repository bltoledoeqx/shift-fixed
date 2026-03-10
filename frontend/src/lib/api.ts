import type { Member, Shift, OnCallEntry, Team, AppConfig } from './types';

// Auth token — lê do localStorage (viewer/admin compartilham o mesmo token)
function getStoredToken() { return localStorage.getItem('auth_token'); }

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem('auth_token', token);
  else localStorage.removeItem('auth_token');
}

export function getAuthToken() { return getStoredToken(); }
export function isAuthenticated() { return !!getStoredToken(); }

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { ...options, headers: { ...headers, ...options?.headers } });
  if (res.status === 401) { setAuthToken(null); throw new Error('UNAUTHORIZED'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth
export const login = (username: string, password: string) =>
  apiFetch<{ success: boolean; token: string }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ username, password }),
  });

// Teams
export const getTeams = () => apiFetch<Team[]>('/teams');

// Members
export const getMembers = (teamId?: string) =>
  apiFetch<Member[]>(`/members${teamId ? `?team_id=${encodeURIComponent(teamId)}` : ''}`);
export const getMemberById = (id: string) => apiFetch<Member>(`/members/${id}`);
export const getManagers = () => apiFetch<Member[]>('/members/managers');
export const createMember = (data: Partial<Member>) =>
  apiFetch<Member>('/members', { method: 'POST', body: JSON.stringify(data) });
export const updateMember = (id: string, data: Partial<Member>) =>
  apiFetch('/members/' + id, { method: 'PUT', body: JSON.stringify(data) });
export const deleteMember = (id: string) =>
  apiFetch('/members/' + id, { method: 'DELETE' });

// Shifts
export const getShifts = (params: Record<string, string> = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return apiFetch<Shift[]>(`/shifts${q ? '?' + q : ''}`);
};
export const createShift = (data: Record<string, unknown>) =>
  apiFetch('/shifts', { method: 'POST', body: JSON.stringify(data) });
export const deleteShift = (id: string) =>
  apiFetch('/shifts/' + id, { method: 'DELETE' });

// On-call
export const getOnCall = (params: Record<string, string> = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return apiFetch<OnCallEntry[]>(`/oncall${q ? '?' + q : ''}`);
};
export const getCurrentOnCall = () => apiFetch<OnCallEntry[]>('/oncall/current');
export const getCurrentShifts = () => apiFetch<Shift[]>("/shifts/current");
export const createOnCall = (data: Partial<OnCallEntry>) =>
  apiFetch<OnCallEntry>('/oncall', { method: 'POST', body: JSON.stringify(data) });
export const updateOnCall = (id: string, data: Partial<OnCallEntry>) =>
  apiFetch('/oncall/' + id, { method: 'PUT', body: JSON.stringify(data) });
export const deleteOnCall = (id: string) =>
  apiFetch('/oncall/' + id, { method: 'DELETE' });

// Config (protected)
export const getConfig = () => apiFetch<AppConfig>('/config');
export const updateConfig = (data: Partial<AppConfig>) =>
  apiFetch('/config', { method: 'PUT', body: JSON.stringify(data) });
export const testTelegram = (chatId: string) =>
  apiFetch<{ success: boolean; error?: string }>('/config/test-telegram', {
    method: 'POST', body: JSON.stringify({ chat_id: chatId }),
  });

// Import XLSX (protected)
export const importXlsx = async (file: File): Promise<Record<string, unknown>> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/import', {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: formData,
  });
  if (res.status === 401) { setAuthToken(null); throw new Error('UNAUTHORIZED'); }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
