import { useEffect, useState } from 'react';
import useStore from './stores/useStore';
import { projectsAPI, meetingsAPI, healthCheck } from './services/api';
import NotesInput from './components/Notes/NotesInput';
import MeetingsList from './components/Meetings/MeetingsList';
import MeetingDetails from './components/Meetings/MeetingDetails';
import WikiEditor from './components/Wiki/WikiEditor';
import GlobalSearch from './components/Search/GlobalSearch';
import ProjectManager from './components/Projects/ProjectManager';
import SkillsManager from './components/Skills/SkillsManager';
import ChatSidebar from './components/Chat/ChatSidebar';
import SettingsModal from './components/Settings/SettingsModal';
import ServiceNowSettings from './components/ServiceNow/Settings';
import ResourceDashboard from './components/ServiceNow/ResourceDashboard';
import './App.css';

function App() {
  const {
    projects = [],
    meetings = [],
    setProjects,
    setMeetings,
    setStatus,
    activeTab,
    setActiveTab,
  } = useStore();

  const [appTab, setAppTab] = useState('meetings');
  const [showSettings, setShowSettings] = useState(false);
  const [serviceNowTab, setServiceNowTab] = useState('dashboard'); // 'dashboard' or 'settings'

  useEffect(() => {
    // Load projects and meetings on mount
    const loadData = async () => {
      try {
        // Health check
        await healthCheck();
        console.log('✅ Backend connection successful');

        // Load projects
        const projectsData = await projectsAPI.getAll();
        setProjects(projectsData);
        console.log('✅ Projects loaded:', projectsData);

        // Load meetings
        const meetingsData = await meetingsAPI.getAll();
        setMeetings(meetingsData);
        console.log('✅ Meetings loaded:', meetingsData);
      } catch (error) {
        console.error('❌ Error loading data:', error.message);
        setStatus('error', error.message);
      }
    };

    loadData();
  }, [setProjects, setMeetings, setStatus]);

  return (
    <div style={{ minHeight: '100vh' }} className="page-transition">
      {/* Header - Glassmorphism */}
      <header className="glass-card" style={{
        padding: '20px 30px',
        marginBottom: '30px',
        boxShadow: '0 8px 32px rgba(31, 38, 135, 0.15)',
        border: 'none',
        borderRadius: '0',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginBottom: '15px' }}>
            <div style={{ flex: '0 0 auto' }}>
              <h1 className="gradient-text" style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>
                📝 Aiba PM Notes
              </h1>
            </div>
            <GlobalSearch
              onMeetingSelect={(meeting) => {
                setAppTab('meetings');
              }}
            />
            <button
              onClick={() => setShowSettings(true)}
              style={{
                padding: '10px 16px',
                background: 'rgba(102, 126, 234, 0.1)',
                border: '2px solid rgba(102, 126, 234, 0.3)',
                borderRadius: '10px',
                color: '#667eea',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={e => {
                e.target.style.background = 'rgba(102, 126, 234, 0.2)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={e => {
                e.target.style.background = 'rgba(102, 126, 234, 0.1)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ fontSize: '18px' }}>⚙️</span>
              <span>Settings</span>
            </button>
          </div>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>
            AI-Powered Meeting Notes & Project Management
          </p>
        </div>
      </header>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
        {/* Tab Navigation - Enhanced Design */}
        <div className="glass-card" style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '30px',
          padding: '8px',
        }}>
          <button
            onClick={() => setAppTab('notes')}
            className={appTab === 'notes' ? 'btn-gradient' : ''}
            style={{
              flex: 1,
              padding: '14px 20px',
              fontSize: '15px',
              fontWeight: '600',
              background: appTab === 'notes' ? undefined : 'transparent',
              color: appTab === 'notes' ? '#fff' : '#6b7280',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: appTab === 'notes' ? undefined : 'none',
            }}
            onMouseEnter={(e) => {
              if (appTab !== 'notes') {
                e.target.style.background = 'rgba(99, 102, 241, 0.1)';
                e.target.style.color = '#6366f1';
              }
            }}
            onMouseLeave={(e) => {
              if (appTab !== 'notes') {
                e.target.style.background = 'transparent';
                e.target.style.color = '#6b7280';
              }
            }}
          >
            ✍️ New Meeting
          </button>
          <button
            onClick={() => setAppTab('meetings')}
            className={appTab === 'meetings' ? 'btn-gradient' : ''}
            style={{
              flex: 1,
              padding: '14px 20px',
              fontSize: '15px',
              fontWeight: '600',
              background: appTab === 'meetings' ? undefined : 'transparent',
              color: appTab === 'meetings' ? '#fff' : '#6b7280',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: appTab === 'meetings' ? undefined : 'none',
            }}
            onMouseEnter={(e) => {
              if (appTab !== 'meetings') {
                e.target.style.background = 'rgba(99, 102, 241, 0.1)';
                e.target.style.color = '#6366f1';
              }
            }}
            onMouseLeave={(e) => {
              if (appTab !== 'meetings') {
                e.target.style.background = 'transparent';
                e.target.style.color = '#6b7280';
              }
            }}
          >
            📋 Meetings <span className="badge" style={{ marginLeft: '8px', fontSize: '11px' }}>{meetings.length}</span>
          </button>
          <button
            onClick={() => setAppTab('wiki')}
            className={appTab === 'wiki' ? 'btn-gradient' : ''}
            style={{
              flex: 1,
              padding: '14px 20px',
              fontSize: '15px',
              fontWeight: '600',
              background: appTab === 'wiki' ? undefined : 'transparent',
              color: appTab === 'wiki' ? '#fff' : '#6b7280',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: appTab === 'wiki' ? undefined : 'none',
            }}
            onMouseEnter={(e) => {
              if (appTab !== 'wiki') {
                e.target.style.background = 'rgba(99, 102, 241, 0.1)';
                e.target.style.color = '#6366f1';
              }
            }}
            onMouseLeave={(e) => {
              if (appTab !== 'wiki') {
                e.target.style.background = 'transparent';
                e.target.style.color = '#6b7280';
              }
            }}
          >
            📚 Wiki
          </button>
          <button
            onClick={() => setAppTab('skills')}
            className={appTab === 'skills' ? 'btn-gradient' : ''}
            style={{
              flex: 1,
              padding: '14px 20px',
              fontSize: '15px',
              fontWeight: '600',
              background: appTab === 'skills' ? undefined : 'transparent',
              color: appTab === 'skills' ? '#fff' : '#6b7280',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: appTab === 'skills' ? undefined : 'none',
            }}
            onMouseEnter={(e) => {
              if (appTab !== 'skills') {
                e.target.style.background = 'rgba(99, 102, 241, 0.1)';
                e.target.style.color = '#6366f1';
              }
            }}
            onMouseLeave={(e) => {
              if (appTab !== 'skills') {
                e.target.style.background = 'transparent';
                e.target.style.color = '#6b7280';
              }
            }}
          >
            🎯 Skills
          </button>
          <button
            onClick={() => setAppTab('projects')}
            className={appTab === 'projects' ? 'btn-gradient' : ''}
            style={{
              flex: 1,
              padding: '14px 20px',
              fontSize: '15px',
              fontWeight: '600',
              background: appTab === 'projects' ? undefined : 'transparent',
              color: appTab === 'projects' ? '#fff' : '#6b7280',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: appTab === 'projects' ? undefined : 'none',
            }}
            onMouseEnter={(e) => {
              if (appTab !== 'projects') {
                e.target.style.background = 'rgba(99, 102, 241, 0.1)';
                e.target.style.color = '#6366f1';
              }
            }}
            onMouseLeave={(e) => {
              if (appTab !== 'projects') {
                e.target.style.background = 'transparent';
                e.target.style.color = '#6b7280';
              }
            }}
          >
            📁 Projects <span className="badge" style={{ marginLeft: '8px', fontSize: '11px' }}>{projects.length}</span>
          </button>
          <button
            onClick={() => setAppTab('servicenow')}
            className={appTab === 'servicenow' ? 'btn-gradient' : ''}
            style={{
              flex: 1,
              padding: '14px 20px',
              fontSize: '15px',
              fontWeight: '600',
              background: appTab === 'servicenow' ? undefined : 'transparent',
              color: appTab === 'servicenow' ? '#fff' : '#6b7280',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: appTab === 'servicenow' ? undefined : 'none',
            }}
            onMouseEnter={(e) => {
              if (appTab !== 'servicenow') {
                e.target.style.background = 'rgba(99, 102, 241, 0.1)';
                e.target.style.color = '#6366f1';
              }
            }}
            onMouseLeave={(e) => {
              if (appTab !== 'servicenow') {
                e.target.style.background = 'transparent';
                e.target.style.color = '#6b7280';
              }
            }}
          >
            🔗 ServiceNow
          </button>
        </div>

        {/* New Meeting Tab */}
        {appTab === 'notes' && (
          <div className="glass-card card-hover" style={{
            marginBottom: '30px',
            padding: '0',
            overflow: 'hidden',
          }}>
            <NotesInput />
          </div>
        )}

        {/* Meetings Tab */}
        {appTab === 'meetings' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '400px 1fr',
            gap: '20px',
            height: 'calc(100vh - 250px)',
            minHeight: '600px'
          }}>
            {/* Meetings List Sidebar */}
            <MeetingsList />

            {/* Meeting Details */}
            <MeetingDetails />
          </div>
        )}

        {/* Wiki Tab */}
        {appTab === 'wiki' && (
          <WikiEditor />
        )}

        {/* Skills Tab */}
        {appTab === 'skills' && (
          <SkillsManager />
        )}

        {/* Projects Tab */}
        {appTab === 'projects' && (
          <ProjectManager />
        )}

        {/* ServiceNow Tab */}
        {appTab === 'servicenow' && (
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px' }}>
              <button
                onClick={() => setServiceNowTab('dashboard')}
                style={{
                  padding: '10px 20px',
                  background: serviceNowTab === 'dashboard' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                  color: serviceNowTab === 'dashboard' ? '#6366f1' : '#6b7280',
                  border: 'none',
                  borderBottom: serviceNowTab === 'dashboard' ? '3px solid #6366f1' : '3px solid transparent',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '600',
                  transition: 'all 0.3s',
                }}
              >
                Dashboard
              </button>
              <button
                onClick={() => setServiceNowTab('settings')}
                style={{
                  padding: '10px 20px',
                  background: serviceNowTab === 'settings' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                  color: serviceNowTab === 'settings' ? '#6366f1' : '#6b7280',
                  border: 'none',
                  borderBottom: serviceNowTab === 'settings' ? '3px solid #6366f1' : '3px solid transparent',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '600',
                  transition: 'all 0.3s',
                }}
              >
                Settings
              </button>
            </div>
            {serviceNowTab === 'dashboard' && <ResourceDashboard />}
            {serviceNowTab === 'settings' && <ServiceNowSettings />}
          </div>
        )}
      </div>

      {/* Chat Sidebar - Always rendered as left panel */}
      <ChatSidebar />
    </div>
  );
}

export default App;
