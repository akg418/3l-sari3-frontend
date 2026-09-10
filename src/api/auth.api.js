import { httpClient } from './httpClient.js';

export const authApi = {
  register: (payload) => httpClient.post('/auth/register', payload, { auth: false }),
  login: (credentials) => httpClient.post('/auth/login', credentials, { auth: false }),
  me: () => httpClient.get('/auth/me'),
};
