const API_URL = import.meta.env.VITE_API_URL || 'https://alertodepinbackend.onrender.com/api';

// Helper function to get auth token
const getAuthToken = () => {
  const user = localStorage.getItem('user');
  if (user) {
    const userData = JSON.parse(user);
    return userData.token;
  }
  return null;
};

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    // Ensure object bodies are JSON-stringified when Content-Type is application/json
    const fetchOptions = {
      ...options,
      headers,
    };

    if (fetchOptions.body && typeof fetchOptions.body === 'object' && !(fetchOptions.body instanceof FormData)) {
      try {
        fetchOptions.body = JSON.stringify(fetchOptions.body);
      } catch (e) {
        // if stringify fails, leave as-is and let fetch/body-parser handle it
        console.warn('Failed to stringify request body:', e);
      }
    }

    const response = await fetch(`${API_URL}${endpoint}`, fetchOptions);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Auth API
export const authAPI = {
  login: async (email, password) => {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return data;
  },

  register: async (userData) => {
    const data = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    return data;
  },

  getCurrentUser: async () => {
    const data = await apiCall('/auth/me');
    return data;
  },
};

// Alerts API
export const alertsAPI = {
  getAll: async (filters = {}) => {
    const queryParams = new URLSearchParams(filters).toString();
    const data = await apiCall(`/alerts${queryParams ? `?${queryParams}` : ''}`);
    return data;
  },

  getById: async (id) => {
    const data = await apiCall(`/alerts/${id}`);
    return data;
  },

  create: async (alertData) => {
    const data = await apiCall('/alerts', {
      method: 'POST',
      body: JSON.stringify(alertData),
    });
    return data;
  },

  update: async (id, alertData) => {
    const data = await apiCall(`/alerts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(alertData),
    });
    return data;
  },

  respond: async (id) => {
    const data = await apiCall(`/alerts/${id}/respond`, {
      method: 'PUT',
    });
    return data;
  },

  resolve: async (id, notes) => {
    const data = await apiCall(`/alerts/${id}/resolve`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    });
    return data;
  },

  cancel: async (id) => {
    const data = await apiCall(`/alerts/${id}/cancel`, {
      method: 'PUT',
    });
    return data;
  },

  getNearby: async (type, lat, lng, radius = 10) => {
    const data = await apiCall(`/alerts/nearby/${type}?lat=${lat}&lng=${lng}&radius=${radius}`);
    return data;
  },
};

// Users API
export const usersAPI = {
  updateLocation: async (coordinates) => {
    const data = await apiCall('/users/location', {
      method: 'PUT',
      body: JSON.stringify({ 
        coordinates: Array.isArray(coordinates) ? coordinates : [coordinates[0], coordinates[1]]
      }),
    });
    return data;
  },

  updateProfile: async (userData) => {
    const data = await apiCall('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
    return data;
  },

  changePassword: async (passwordData) => {
    const data = await apiCall('/users/change-password', {
      method: 'PUT',
      body: JSON.stringify(passwordData),
    });
    return data;
  },

  getStats: async () => {
    const data = await apiCall('/users/stats');
    return data;
  },
};

// Notifications API
export const notificationsAPI = {
  getAll: async () => {
    const data = await apiCall('/notifications');
    return data;
  },

  markAsRead: async (id) => {
    const data = await apiCall(`/notifications/${id}/read`, {
      method: 'PUT',
    });
    return data;
  },

  markAllAsRead: async () => {
    const data = await apiCall('/notifications/read-all', {
      method: 'PUT',
    });
    return data;
  },

  delete: async (id) => {
    await apiCall(`/notifications/${id}`, {
      method: 'DELETE',
    });
  },
};

export default {
  auth: authAPI,
  alerts: alertsAPI,
  users: usersAPI,
  notifications: notificationsAPI,
};
