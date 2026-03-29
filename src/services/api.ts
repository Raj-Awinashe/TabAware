import axios, { AxiosHeaders } from 'axios';

const TOKEN_KEY = 'tabaware_token';

const client = axios.create({
  baseURL: 'http://localhost:3000/api',
  withCredentials: false,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = AxiosHeaders.from(config.headers ?? {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  config.headers = headers;
  return config;
});

export const api = {
  signup: async (email: string, password: string) => {
    const res = await client.post('/auth/signup', { email, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    return res.data;
  },

  login: async (email: string, password: string) => {
    const res = await client.post('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    return res.data;
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
  },

  getMe: () => client.get('/auth/me'),
  getCurrentSession: () => client.get('/session/current'),
  resetSession: () => client.post('/session/reset'),

  getEvents: () => client.get('/events/recent'),
  getSummary: () => client.get('/summary'),
  getStatus: () => client.get('/status'),

  getBlockedSites: () => client.get('/blocked-sites'),
  addBlockedSite: (domain: string) => client.post('/blocked-sites', { domain }),
  removeBlockedSite: (id: number) => client.delete(`/blocked-sites/${id}`),
};