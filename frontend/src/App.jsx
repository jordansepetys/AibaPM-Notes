import { useEffect, useState } from 'react';
import useStore from './stores/useStore';
import { projectsAPI, meetingsAPI, healthCheck } from './services/api';
import AudioRecorder from './components/Recording/AudioRecorder';
import RecordingStatus from './components/Recording/RecordingStatus';
import MeetingsList from './components/Meetings/MeetingsList';
import MeetingDetails from './components/Meetings/MeetingDetails';
import WikiEditor from './components/Wiki/WikiEditor';
import GlobalSearch from './components/Search/GlobalSearch';
import ProjectManager from './components/Projects/ProjectManager';
import SkillsManager from './components/Skills/SkillsManager';
import ChatSidebar from './components/Chat/ChatSidebar';
import SettingsModal from './components/Settings/SettingsModal';
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

  const [appTab, setAppTab] = useState('recording');
  const [showSettings, setShowSettings] = useState(false);

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
                🎙️ Aiba PM
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
            AI-Powered Meeting Transcription & Project Management
          </p>
        </div>
      </header>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
        <RecordingStatus />

        {/* Tab Navigation - Enhanced Design */}
        <div className="glass-card" style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '30px',
          padding: '8px',
        }}>
          <button
            onClick={() => setAppTab('recording')}
            className={appTab === 'recording' ? 'btn-gradient' : ''}
            style={{
              flex: 1,
              padding: '14px 20px',
              fontSize: '15px',
              fontWeight: '600',
              background: appTab === 'recording' ? undefined : 'transparent',
              color: appTab === 'recording' ? '#fff' : '#6b7280',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: appTab === 'recording' ? undefined : 'none',
            }}
            onMouseEnter={(e) => {
              if (appTab !== 'recording') {
                e.target.style.background = 'rgba(99, 102, 241, 0.1)';
                e.target.style.color = '#6366f1';
              }
            }}
            onMouseLeave={(e) => {
              if (appTab !== 'recording') {
                e.target.style.background = 'transparent';
                e.target.style.color = '#6b7280';
              }
            }}
          >
            🎤 Record
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
        </div>

        {/* Recording Tab */}
        {appTab === 'recording' && (
          <>
            <div className="glass-card card-hover" style={{
              marginBottom: '30px',
              padding: '0',
              overflow: 'hidden',
            }}>
              <AudioRecorder />
            </div>

            {/* Stats Section - Glassmorphism Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '24px',
              marginTop: '30px'
            }}>
              <div className="glass-card card-hover" style={{
                padding: '24px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-20px',
                  right: '-20px',
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  borderRadius: '50%',
                  opacity: '0.1',
                }} />
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Projects
                </h3>
                <p className="gradient-text" style={{ margin: 0, fontSize: '42px', fontWeight: 'bold' }}>
                  {projects.length}
                </p>
              </div>

              <div className="glass-card card-hover" style={{
                padding: '24px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-20px',
                  right: '-20px',
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                  borderRadius: '50%',
                  opacity: '0.1',
                }} />
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Meetings
                </h3>
                <p style={{ margin: 0, fontSize: '42px', fontWeight: 'bold', background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {meetings.length}
                </p>
              </div>

              <div className="glass-card card-hover" style={{
                padding: '24px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-20px',
                  right: '-20px',
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                  borderRadius: '50%',
                  opacity: '0.1',
                }} />
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Recent Meeting
                </h3>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937', lineHeight: '1.4' }}>
                  {meetings.length > 0
                    ? meetings[0].title
                    : 'No meetings yet'}
                </p>
              </div>
            </div>

            {/* Quick Start Guide */}
            {projects.length === 0 && (
              <div style={{
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                padding: '20px',
                marginTop: '30px'
              }}>
                <h3 style={{ margin: '0 0 15px 0' }}>👋 Getting Started</h3>
                <ol style={{ margin: 0, paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '10px' }}>
                    First, create a project using the backend API:
                    <pre style={{ background: '#f8f9fa', padding: '10px', borderRadius: '4px', marginTop: '5px' }}>
                      {`curl -X POST http://localhost:3001/api/projects \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My First Project"}'`}
                    </pre>
                  </li>
                  <li style={{ marginBottom: '10px' }}>
                    Reload this page to see your project
                  </li>
                  <li style={{ marginBottom: '10px' }}>
                    Select your project from the dropdown above
                  </li>
                  <li>
                    Click "Start Recording" to record your first meeting!
                  </li>
                </ol>
              </div>
            )}
          </>
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
      </div>

      {/* Chat Sidebar - Always rendered as left panel */}
      <ChatSidebar />
    </div>
  );
}

export default App;
