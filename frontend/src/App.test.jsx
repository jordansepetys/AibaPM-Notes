import { useEffect, useState } from 'react';
import useStore from './stores/useStore';
import { projectsAPI, meetingsAPI, healthCheck } from './services/api';

function App() {
  const { projects, meetings, setProjects, setMeetings, setStatus, status, errorMessage } = useStore();
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Starting health check...');
        await healthCheck();
        console.log('✅ Backend connection successful');

        console.log('Loading projects...');
        const projectsData = await projectsAPI.getAll();
        console.log('Projects data received:', projectsData);
        setProjects(projectsData);
        console.log('✅ Projects set in store');

        console.log('Loading meetings...');
        const meetingsData = await meetingsAPI.getAll();
        console.log('Meetings data received:', meetingsData);
        setMeetings(meetingsData);
        console.log('✅ Meetings set in store');
      } catch (error) {
        console.error('❌ Error loading data:', error);
        setLoadError(error.message);
        setStatus('error', error.message);
      }
    };

    loadData();
  }, []);

  if (loadError) {
    return (
      <div style={{ padding: '40px', fontFamily: 'sans-serif', color: 'red' }}>
        <h1>❌ Load Error</h1>
        <p>{loadError}</p>
        <p>Check browser console for details</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>🎙️ Aiba PM - Test 4</h1>
      <p>If you can see this, React + Zustand + API is working!</p>

      <p>Status: <strong>{status}</strong></p>
      {errorMessage && <p style={{ color: 'red' }}>Store Error: {errorMessage}</p>}

      <p>Environment check:</p>
      <ul>
        <li>API URL: {import.meta.env.VITE_API_URL || 'NOT SET'}</li>
        <li>Mode: {import.meta.env.MODE}</li>
        <li>Projects type: {typeof projects}</li>
        <li>Projects in store: {Array.isArray(projects) ? projects.length : 'NOT AN ARRAY'}</li>
        <li>Meetings type: {typeof meetings}</li>
        <li>Meetings in store: {Array.isArray(meetings) ? meetings.length : 'NOT AN ARRAY'}</li>
      </ul>

      <p>Projects list:</p>
      {Array.isArray(projects) ? (
        <ul>
          {projects.map(p => <li key={p.id}>{p.name} (ID: {p.id})</li>)}
        </ul>
      ) : (
        <p style={{ color: 'red' }}>Projects is not an array!</p>
      )}
    </div>
  );
}

export default App;
