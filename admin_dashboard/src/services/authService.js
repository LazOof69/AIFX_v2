import api from './api';

export const authService = {
  login: async (username, password) => {
    const response = await api.post('/admin/login', { username, password });
    if (response.data.success && response.data.data?.token) {
      localStorage.setItem('adminToken', response.data.data.token);
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('adminToken');
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('adminToken');
  },

  getToken: () => {
    return localStorage.getItem('adminToken');
  },
};

export default authService;
