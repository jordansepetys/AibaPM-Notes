import { useState, useEffect } from 'react';
import useStore from '../../stores/useStore';
import { skillsAPI, projectsAPI } from '../../services/api';
import SkillEditor from './SkillEditor';

const SkillsManager = () => {
  const { projects, setStatus } = useStore();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'global' | projectId
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);

  useEffect(() => {
    loadSkills();
  }, [filter]);

  const loadSkills = async () => {
    try {
      setLoading(true);
      let filters = {};

      if (filter === 'global') {
        filters.global = true;
      } else if (filter !== 'all' && !isNaN(filter)) {
        filters.projectId = filter;
      }

      const data = await skillsAPI.getAll(filters);
      setSkills(data);
    } catch (error) {
      setStatus('error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSkill = () => {
    setEditingSkill(null);
    setShowEditor(true);
  };

  const handleEditSkill = (skill) => {
    setEditingSkill(skill);
    setShowEditor(true);
  };

  const handleDeleteSkill = async (skillId, skillName) => {
    if (!confirm(`Are you sure you want to delete "${skillName}"?`)) {
      return;
    }

    try {
      await skillsAPI.delete(skillId);
      setStatus('success', 'Skill deleted successfully');
      setTimeout(() => setStatus('idle'), 3000);
      loadSkills();
    } catch (error) {
      setStatus('error', error.message);
    }
  };

  const handleSaveSkill = async () => {
    setShowEditor(false);
    setEditingSkill(null);
    loadSkills();
  };

  const handleCancelEdit = () => {
    setShowEditor(false);
    setEditingSkill(null);
  };

  // Filter skills by search query
  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group skills by scope
  const globalSkills = filteredSkills.filter(s => s.isGlobal);
  const projectSkillsGrouped = {};
  filteredSkills.filter(s => !s.isGlobal).forEach(skill => {
    const projectId = skill.project_id;
    if (!projectSkillsGrouped[projectId]) {
      projectSkillsGrouped[projectId] = [];
    }
    projectSkillsGrouped[projectId].push(skill);
  });

  return (
    <>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '20px',
        marginBottom: '20px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            🎯 Skills Manager
          </h2>
          <button
            onClick={handleCreateSkill}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 'bold',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + New Skill
          </button>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              background: filter === 'all' ? '#8b5cf6' : '#e0e0e0',
              color: filter === 'all' ? 'white' : '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            All Skills
          </button>
          <button
            onClick={() => setFilter('global')}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              background: filter === 'global' ? '#8b5cf6' : '#e0e0e0',
              color: filter === 'global' ? 'white' : '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Global Only
          </button>
          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => setFilter(project.id)}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                background: filter === project.id ? '#8b5cf6' : '#e0e0e0',
                color: filter === project.id ? 'white' : '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {project.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search skills..."
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            marginBottom: '20px'
          }}
        />

        {/* Skills List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            Loading skills...
          </div>
        ) : filteredSkills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            No skills found. Create your first skill to get started!
          </div>
        ) : (
          <div>
            {/* Global Skills */}
            {globalSkills.length > 0 && (
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', color: '#666' }}>
                  📚 Global Skills ({globalSkills.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {globalSkills.map(skill => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onEdit={handleEditSkill}
                      onDelete={handleDeleteSkill}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Project Skills */}
            {Object.entries(projectSkillsGrouped).map(([projectId, projectSkills]) => {
              const project = projects.find(p => p.id === parseInt(projectId));
              return (
                <div key={projectId} style={{ marginBottom: '30px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', color: '#666' }}>
                    📁 {project?.name || `Project ${projectId}`} Skills ({projectSkills.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {projectSkills.map(skill => (
                      <SkillCard
                        key={skill.id}
                        skill={skill}
                        onEdit={handleEditSkill}
                        onDelete={handleDeleteSkill}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <SkillEditor
          skill={editingSkill}
          onSave={handleSaveSkill}
          onCancel={handleCancelEdit}
        />
      )}
    </>
  );
};

// Skill Card Component
const SkillCard = ({ skill, onEdit, onDelete }) => {
  return (
    <div style={{
      background: '#f8f9fa',
      border: '1px solid #e0e0e0',
      borderRadius: '6px',
      padding: '15px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>
            {skill.name}
          </h4>
          {skill.isGlobal && (
            <span style={{
              fontSize: '11px',
              padding: '2px 6px',
              background: '#8b5cf6',
              color: 'white',
              borderRadius: '3px'
            }}>
              GLOBAL
            </span>
          )}
          {!skill.autoActivate && (
            <span style={{
              fontSize: '11px',
              padding: '2px 6px',
              background: '#fbbf24',
              color: '#78350f',
              borderRadius: '3px'
            }}>
              MANUAL
            </span>
          )}
        </div>
        {skill.description && (
          <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
            {skill.description}
          </p>
        )}
        <div style={{ marginTop: '8px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {skill.triggerKeywords && skill.triggerKeywords.length > 0 && (
            <>
              <span style={{ fontSize: '12px', color: '#999' }}>Keywords:</span>
              {skill.triggerKeywords.map((keyword, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    background: '#e0e0e0',
                    color: '#555',
                    borderRadius: '3px'
                  }}
                >
                  {keyword}
                </span>
              ))}
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '5px', marginLeft: '15px' }}>
        <button
          onClick={() => onEdit(skill)}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ⚙️ Edit
        </button>
        <button
          onClick={() => onDelete(skill.id, skill.name)}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  );
};

export default SkillsManager;
