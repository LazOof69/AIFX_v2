import api from './api';

export const adminService = {
  // System monitoring
  getHealth: async () => {
    const response = await api.get('/admin/health');
    return response.data;
  },

  getOverviewStats: async () => {
    const response = await api.get('/admin/stats/overview');
    return response.data;
  },

  getLogs: async (limit = 50) => {
    const response = await api.get(`/admin/logs?limit=${limit}`);
    return response.data;
  },

  // User management
  getUsers: async (page = 1, limit = 20) => {
    const response = await api.get(`/admin/users?page=${page}&limit=${limit}`);
    return response.data;
  },

  getDiscordUsers: async (page = 1, limit = 20) => {
    const response = await api.get(`/admin/users/discord?page=${page}&limit=${limit}`);
    return response.data;
  },

  getLineUsers: async (page = 1, limit = 20) => {
    const response = await api.get(`/admin/users/line?page=${page}&limit=${limit}`);
    return response.data;
  },

  getSubscriptions: async (page = 1, limit = 20) => {
    const response = await api.get(`/admin/subscriptions?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Signal management
  getSignals: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await api.get(`/admin/signals?${params}`);
    return response.data;
  },

  getSignalStats: async () => {
    const response = await api.get('/admin/signals/stats');
    return response.data;
  },

  deleteSignal: async (signalId) => {
    const response = await api.delete(`/admin/signals/${signalId}`);
    return response.data;
  },

  // ML model management
  getModels: async () => {
    const response = await api.get('/admin/ml/models');
    return response.data;
  },

  switchModel: async (version) => {
    const response = await api.post(`/admin/ml/models/${version}/switch`);
    return response.data;
  },

  getPredictionStats: async () => {
    const response = await api.get('/admin/ml/predictions/stats');
    return response.data;
  },

  getTrainingStatus: async () => {
    const response = await api.get('/admin/ml/training/status');
    return response.data;
  },
};

export default adminService;
