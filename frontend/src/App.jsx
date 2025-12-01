import { useEffect, useState, useRef, useCallback } from 'react';
import useStore from './stores/useStore';
import { projectsAPI, meetingsAPI, healthCheck } from './services/api';
import TranscriptUploader from './components/Meetings/TranscriptUploader';
import RecordingStatus from './components/Recording/RecordingStatus';
import MeetingsList from './components/Meetings/MeetingsList';
import MeetingDetails from './components/Meetings/MeetingDetails';
import WikiEditor from './components/Wiki/WikiEditor';
import GlobalSearch from './components/Search/GlobalSearch';
import ProjectManager from './components/Projects/ProjectManager';
import SkillsManager from './components/Skills/SkillsManager';
import ChatSidebar from './components/Chat/ChatSidebar';
import SettingsModal from './components/Settings/SettingsModal';
import TabButton from './components/UI/TabButton';
import Skeleton, { SkeletonCard } from './components/UI/Skeleton';
import './App.css';

const TABS = [
  { id: 'transcript', icon: '📝', label: 'Add Meeting' },
  { id: 'meetings', icon: '📋', label: 'Meetings', countKey: 'meetings' },
  { id: 'wiki', icon: '📚', label: 'Wiki' },
  { id: 'skills', icon: '🎯', label: 'Skills' },
  { id: 'projects', icon: '📁', label: 'Projects', countKey: 'projects' },
];

function App() {
  const {
    projects = [],
    meetings = [],
    setProjects,
    setMeetings,
    setStatus,
  } = useStore();

  const [appTab, setAppTab] = useState('transcript');
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const tabRefs = useRef([]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await healthCheck();
        const projectsData = await projectsAPI.getAll();
        setProjects(projectsData);
        const meetingsData = await meetingsAPI.getAll();
        setMeetings(meetingsData);
      } catch (error) {
        console.error('Error loading data:', error.message);
        setStatus('error', error.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [setProjects, setMeetings, setStatus]);

  // Keyboard navigation for tabs
  const handleTabKeyDown = useCallback((e, index) => {
    let newIndex = index;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      newIndex = (index + 1) % TABS.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      newIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = TABS.length - 1;
    } else {
      return;
    }

    setAppTab(TABS[newIndex].id);
    tabRefs.current[newIndex]?.focus();
  }, []);

  const getCounts = (key) => {
    if (key === 'meetings') return meetings.length;
    if (key === 'projects') return projects.length;
    return undefined;
  };

  return (
    <div style={{ minHeight: '100vh' }} className="page-transition">
      {/* Header */}
      <header className="glass-card app-header">
        <div className="app-header__content">
          <div className="app-header__top">
            <div>
              <h1 className="gradient-text app-header__title">
                🎙️ Aiba PM
              </h1>
            </div>
            <GlobalSearch onMeetingSelect={() => setAppTab('meetings')} />
            <button
              onClick={() => setShowSettings(true)}
              className="settings-button"
            >
              <span className="settings-button__icon">⚙️</span>
              <span>Settings</span>
            </button>
          </div>
          <p className="app-header__subtitle">
            AI-Powered Meeting Transcription & Project Management
          </p>
        </div>
      </header>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Main Content */}
      <div className="main-content">
        <RecordingStatus />

        {/* Tab Navigation */}
        <div className="glass-card tab-navigation" role="tablist" aria-label="Main navigation">
          {TABS.map((tab, index) => (
            <TabButton
              key={tab.id}
              ref={(el) => (tabRefs.current[index] = el)}
              active={appTab === tab.id}
              onClick={() => setAppTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              icon={tab.icon}
              label={tab.label}
              count={tab.countKey ? getCounts(tab.countKey) : undefined}
              tabIndex={appTab === tab.id ? 0 : -1}
            />
          ))}
        </div>

        {/* Transcript Upload Tab */}
        {appTab === 'transcript' && (
          <>
            <div className="glass-card card-hover" style={{ marginBottom: '30px', padding: 0, overflow: 'hidden' }}>
              <TranscriptUploader />
            </div>

            {/* Stats Section */}
            {isLoading ? (
              <div className="stats-grid">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : (
              <div className="stats-grid">
                <div className="glass-card card-hover stat-card">
                  <div className="stat-card__bg-circle stat-card__bg-circle--purple" />
                  <h3 className="stat-card__label">Total Projects</h3>
                  <p className="gradient-text stat-card__value">{projects.length}</p>
                </div>

                <div className="glass-card card-hover stat-card">
                  <div className="stat-card__bg-circle stat-card__bg-circle--purple" />
                  <h3 className="stat-card__label">Total Meetings</h3>
                  <p className="gradient-text stat-card__value">{meetings.length}</p>
                </div>

                <div className="glass-card card-hover stat-card">
                  <div className="stat-card__bg-circle stat-card__bg-circle--purple" />
                  <h3 className="stat-card__label">Recent Meeting</h3>
                  <p className="stat-card__text">
                    {meetings.length > 0 ? meetings[0].title : 'No meetings yet'}
                  </p>
                </div>
              </div>
            )}

            {/* Getting Started */}
            {!isLoading && projects.length === 0 && (
              <div className="getting-started">
                <div className="getting-started__icon">👋</div>
                <h3 className="getting-started__title">Welcome to Aiba PM!</h3>
                <p className="getting-started__text">
                  Get started by creating your first project.<br />
                  Then you can add meeting transcripts and let AI do the heavy lifting.
                </p>
                <button
                  onClick={() => setAppTab('projects')}
                  className="btn-gradient getting-started__button"
                >
                  <span>📁</span>
                  <span>Create Your First Project</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Meetings Tab */}
        {appTab === 'meetings' && (
          <div className="meetings-layout">
            <MeetingsList />
            <MeetingDetails />
          </div>
        )}

        {/* Wiki Tab */}
        {appTab === 'wiki' && <WikiEditor />}

        {/* Skills Tab */}
        {appTab === 'skills' && <SkillsManager />}

        {/* Projects Tab */}
        {appTab === 'projects' && <ProjectManager />}
      </div>

      {/* Chat Sidebar */}
      <ChatSidebar />
    </div>
  );
}

export default App;
