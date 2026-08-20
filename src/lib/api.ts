import axios from 'axios';

// The frontend calls the standalone Neon-backed API through Vite locally or
// through the configured API host in production.
const api = axios.create({ baseURL: '' });

function getToken(): string {
  return localStorage.getItem('star_token') || '';
}

function withToken(params: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...params, token: getToken() };
}

function toQueryString(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
  });
  return usp.toString();
}

export const apiClient = {
  get: (url: string, params: Record<string, unknown> = {}) => {
    const qs = toQueryString(withToken(params));
    const sep = url.includes('?') ? '&' : '?';
    return api.get(`${url}${sep}${qs}`);
  },
  post: (url: string, body: Record<string, unknown> = {}) => api.post(url, withToken(body)),
  put: (url: string, body: Record<string, unknown> = {}) => api.put(url, withToken(body)),
  del: (url: string, params: Record<string, unknown> = {}) => {
    const qs = toQueryString(withToken(params));
    const sep = url.includes('?') ? '&' : '?';
    return api.delete(`${url}${sep}${qs}`);
  },
};

export function setToken(t: string): void {
  localStorage.setItem('star_token', t);
}
export function clearToken(): void {
  localStorage.removeItem('star_token');
}
export function getStoredToken(): string {
  return getToken();
}
