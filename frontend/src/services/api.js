import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handler
const handleError = (error) => {
  if (error.response) {
    // Server responded with error
    throw new Error(error.response.data.error || error.response.data.message || 'Server error');
  } else if (error.request) {
    // Request made but no response
    throw new Error('No response from server. Please check if the backend is running.');
  } else {
    // Error setting up request
    throw new Error(error.message || 'Request failed');
  }
};

// Projects API
export const projectsAPI = {
  getAll: async () => {
    try {
      const response = await api.get('/api/projects');
      return response.data.projects || [];
    } catch (error) {
      handleError(error);
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/api/projects/${id}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  create: async (name) => {
    try {
      const response = await api.post('/api/projects', { name });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  update: async (id, name) => {
    try {
      const response = await api.put(`/api/projects/${id}`, { name });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/api/projects/${id}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

// Meetings API
export const meetingsAPI = {
  getAll: async (projectId = null) => {
    try {
      const params = projectId ? { projectId } : {};
      const response = await api.get('/api/meetings', { params });
      return response.data.meetings || [];
    } catch (error) {
      handleError(error);
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/api/meetings/${id}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  create: async (audioBlob, projectId, title) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('projectId', projectId);
      formData.append('title', title);
      formData.append('date', new Date().toISOString());

      const response = await api.post('/api/meetings', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.meeting || response.data;
    } catch (error) {
      handleError(error);
    }
  },

  reprocess: async (id) => {
    try {
      const response = await api.post(`/api/meetings/${id}/reprocess`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/api/meetings/${id}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

// Wiki API
export const wikiAPI = {
  get: async (projectId) => {
    try {
      const response = await api.get(`/api/wiki/${projectId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  update: async (projectId, content) => {
    try {
      const response = await api.put(`/api/wiki/${projectId}`, { content });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  autoUpdate: async (projectId, meetingId) => {
    try {
      const response = await api.post(`/api/wiki/${projectId}/auto-update`, {
        meetingId,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  getSuggestions: async (projectId, meetingId) => {
    try {
      const response = await api.post(`/api/wiki/${projectId}/suggestions`, {
        meetingId,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  applySuggestions: async (projectId, meetingId, suggestions) => {
    try {
      const response = await api.post(`/api/wiki/${projectId}/apply-suggestions`, {
        meetingId,
        suggestions,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

// Search API
export const searchAPI = {
  search: async (query, projectId = null) => {
    try {
      const params = { q: query };
      if (projectId) {
        params.project = projectId;
      }
      const response = await api.get('/api/search', { params });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  rebuild: async () => {
    try {
      const response = await api.post('/api/search/rebuild');
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

// Chat API
export const chatAPI = {
  sendMessage: async (message, projectId = null, options = {}) => {
    try {
      const response = await api.post('/api/chat', {
        message,
        projectId,
        ...options, // Includes disableSkills flag
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  getHistory: async (projectId = null) => {
    try {
      const params = projectId ? { projectId } : {};
      const response = await api.get('/api/chat', { params });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  clearHistory: async (projectId = null) => {
    try {
      const params = projectId ? { projectId } : {};
      const response = await api.delete('/api/chat', { params });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  transcribeVoice: async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-input.webm');

      const response = await api.post('/api/chat/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

// Skills API
export const skillsAPI = {
  getAll: async (filters = {}) => {
    try {
      const params = {};
      if (filters.projectId) params.projectId = filters.projectId;
      if (filters.global !== undefined) params.global = filters.global;

      const response = await api.get('/api/skills', { params });
      return response.data.skills || [];
    } catch (error) {
      handleError(error);
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/api/skills/${id}`);
      return response.data.skill;
    } catch (error) {
      handleError(error);
    }
  },

  create: async (skillData) => {
    try {
      const response = await api.post('/api/skills', skillData);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  update: async (id, skillData) => {
    try {
      const response = await api.put(`/api/skills/${id}`, skillData);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/api/skills/${id}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

// Settings API
export const settingsAPI = {
  getAll: async () => {
    try {
      const response = await api.get('/api/settings');
      return response.data.settings || {};
    } catch (error) {
      handleError(error);
    }
  },

  update: async (settings) => {
    try {
      const response = await api.put('/api/settings', { settings });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

// ServiceNow API
export const serviceNowAPI = {
  // Test connection to ServiceNow
  testConnection: async () => {
    try {
      const response = await api.get('/api/servicenow/test');
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Get ServiceNow configuration status
  getStatus: async () => {
    try {
      const response = await api.get('/api/servicenow/status');
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Get user's resource allocations
  getResources: async (params = {}) => {
    try {
      const response = await api.get('/api/servicenow/resources', { params });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Get resource summary
  getResourceSummary: async (params = {}) => {
    try {
      const response = await api.get('/api/servicenow/resources/summary', { params });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Get user's projects
  getProjects: async (params = {}) => {
    try {
      const response = await api.get('/api/servicenow/projects', { params });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Get user's demands
  getDemands: async (params = {}) => {
    try {
      const response = await api.get('/api/servicenow/demands', { params });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Get all work items (projects + demands)
  getWorkItems: async (params = {}) => {
    try {
      const response = await api.get('/api/servicenow/work-items', { params });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Search for projects and demands
  search: async (keyword, params = {}) => {
    try {
      const response = await api.get('/api/servicenow/search', {
        params: { q: keyword, ...params },
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Link a meeting to a ServiceNow item
  linkMeeting: async (meetingId, sysId, type, number, title) => {
    try {
      const response = await api.post('/api/servicenow/link-meeting', {
        meetingId,
        sysId,
        type,
        number,
        title,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Get ServiceNow link for a meeting
  getMeetingLink: async (meetingId) => {
    try {
      const response = await api.get(`/api/servicenow/link-meeting/${meetingId}`);
      return response.data;
    } catch (error) {
      // Return null if no link found instead of throwing
      if (error.response && error.response.status === 404) {
        return null;
      }
      handleError(error);
    }
  },

  // Remove ServiceNow link from a meeting
  unlinkMeeting: async (meetingId) => {
    try {
      const response = await api.delete(`/api/servicenow/link-meeting/${meetingId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Get all meetings linked to ServiceNow
  getLinkedMeetings: async () => {
    try {
      const response = await api.get('/api/servicenow/linked-meetings');
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Update resource allocation hours
  updateAllocationHours: async (sysId, hours) => {
    try {
      const response = await api.patch(`/api/servicenow/allocations/${sysId}`, {
        hours,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Clear cache
  clearCache: async () => {
    try {
      const response = await api.post('/api/servicenow/clear-cache');
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

// Health check
export const healthCheck = async () => {
  try {
    const response = await api.get('/api/health');
    return response.data;
  } catch (error) {
    handleError(error);
  }
};

export default api;
