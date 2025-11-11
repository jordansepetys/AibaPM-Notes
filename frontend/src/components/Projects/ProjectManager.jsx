import { useState } from 'react';
import useStore from '../../stores/useStore';
import { projectsAPI } from '../../services/api';

const ProjectManager = () => {
  const { projects, setProjects, addProject, setStatus } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProject = async (e) => {
    e.preventDefault();

    if (!newProjectName.trim()) {
      setStatus('error', 'Please enter a project name');
      return;
    }

    try {
      setIsCreating(true);
      const result = await projectsAPI.create(newProjectName);
      addProject(result.project);
      setNewProjectName('');
      setShowForm(false);
      setStatus('success', 'Project created successfully!');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      setStatus('error', error.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
          📁 Projects
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showForm ? '✕ Cancel' : '+ New Project'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreateProject} style={{
          background: '#f8f9fa',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Enter project name..."
            autoFocus
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              marginBottom: '10px'
            }}
          />
          <button
            type="submit"
            disabled={isCreating || !newProjectName.trim()}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 'bold',
              background: isCreating ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              opacity: isCreating || !newProjectName.trim() ? 0.6 : 1
            }}
          >
            {isCreating ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      )}

      {/* Projects List */}
      {projects.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#6c757d'
        }}>
          <p style={{ fontSize: '48px', margin: '0 0 10px 0' }}>📁</p>
          <p style={{ margin: 0, fontSize: '14px' }}>
            No projects yet. Click "New Project" to create one!
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '10px'
        }}>
          {projects.map((project) => (
            <div
              key={project.id}
              style={{
                padding: '15px',
                background: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {project.name}
                </div>
                <div style={{ fontSize: '12px', color: '#6c757d' }}>
                  Created: {new Date(project.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectManager;
