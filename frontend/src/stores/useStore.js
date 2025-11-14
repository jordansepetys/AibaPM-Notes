import { create } from 'zustand';

const useStore = create((set, get) => ({
  // Projects
  projects: [],
  selectedProject: null,

  // Meetings
  meetings: [],
  selectedMeeting: null,

  // UI
  activeTab: 'meetings',
  searchQuery: '',
  isChatSidebarOpen: false,

  // Status
  status: 'idle', // idle, processing, error, success
  errorMessage: null,

  // Actions - Projects
  setProjects: (projects) => set({ projects }),

  addProject: (project) => set((state) => ({
    projects: [...state.projects, project]
  })),

  updateProject: (id, updates) => set((state) => ({
    projects: state.projects.map(p =>
      p.id === id ? { ...p, ...updates } : p
    )
  })),

  deleteProject: (id) => set((state) => ({
    projects: state.projects.filter(p => p.id !== id),
    selectedProject: state.selectedProject?.id === id ? null : state.selectedProject
  })),

  selectProject: (project) => set({ selectedProject: project }),

  // Actions - Meetings
  setMeetings: (meetings) => set({ meetings }),

  addMeeting: (meeting) => set((state) => ({
    meetings: [meeting, ...state.meetings]
  })),

  updateMeeting: (id, updates) => set((state) => ({
    meetings: state.meetings.map(m =>
      m.id === id ? { ...m, ...updates } : m
    ),
    selectedMeeting: state.selectedMeeting?.id === id
      ? { ...state.selectedMeeting, ...updates }
      : state.selectedMeeting
  })),

  deleteMeeting: (id) => set((state) => ({
    meetings: state.meetings.filter(m => m.id !== id),
    selectedMeeting: state.selectedMeeting?.id === id ? null : state.selectedMeeting
  })),

  selectMeeting: (meeting) => {
    console.log('🏪 Store: selectMeeting called with:', meeting?.id, meeting?.title);
    set({ selectedMeeting: meeting });
  },

  // Actions - UI
  setActiveTab: (tab) => set({ activeTab: tab }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleChatSidebar: () => set((state) => ({ isChatSidebarOpen: !state.isChatSidebarOpen })),

  setChatSidebarOpen: (isOpen) => set({ isChatSidebarOpen: isOpen }),

  // Actions - Status
  setStatus: (status, errorMessage = null) => set({
    status,
    errorMessage
  }),

  clearError: () => set({
    status: 'idle',
    errorMessage: null
  }),

  // Computed getters
  getMeetingsByProject: (projectId) => {
    const { meetings } = get();
    return projectId
      ? meetings.filter(m => m.project_id === projectId)
      : meetings;
  },

  getProjectById: (id) => {
    const { projects } = get();
    return projects.find(p => p.id === id);
  },
}));

export default useStore;
