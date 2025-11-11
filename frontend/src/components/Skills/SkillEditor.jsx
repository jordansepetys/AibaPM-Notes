import { useState, useEffect } from 'react';
import useStore from '../../stores/useStore';
import { skillsAPI } from '../../services/api';

const SkillEditor = ({ skill, onSave, onCancel }) => {
  const { projects, setStatus } = useStore();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    isGlobal: true,
    projectId: null,
    triggerKeywords: [],
    autoActivate: true,
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (skill) {
      setFormData({
        name: skill.name || '',
        description: skill.description || '',
        content: skill.content || '',
        isGlobal: skill.isGlobal,
        projectId: skill.project_id,
        triggerKeywords: skill.triggerKeywords || [],
        autoActivate: skill.autoActivate !== false,
      });
    }
  }, [skill]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddKeyword = (e) => {
    e.preventDefault();
    const keyword = keywordInput.trim();
    if (keyword && !formData.triggerKeywords.includes(keyword)) {
      setFormData(prev => ({
        ...prev,
        triggerKeywords: [...prev.triggerKeywords, keyword]
      }));
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword) => {
    setFormData(prev => ({
      ...prev,
      triggerKeywords: prev.triggerKeywords.filter(k => k !== keyword)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      setStatus('error', 'Skill name is required');
      return;
    }

    if (!formData.content.trim()) {
      setStatus('error', 'Skill content is required');
      return;
    }

    if (!formData.isGlobal && !formData.projectId) {
      setStatus('error', 'Please select a project for project-specific skills');
      return;
    }

    if (formData.triggerKeywords.length === 0) {
      setStatus('error', 'Please add at least one trigger keyword');
      return;
    }

    try {
      setSaving(true);

      const skillData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        content: formData.content.trim(),
        isGlobal: formData.isGlobal,
        projectId: formData.isGlobal ? null : parseInt(formData.projectId),
        triggerKeywords: formData.triggerKeywords,
        autoActivate: formData.autoActivate,
      };

      if (skill) {
        // Update existing skill
        await skillsAPI.update(skill.id, skillData);
        setStatus('success', 'Skill updated successfully!');
      } else {
        // Create new skill
        await skillsAPI.create(skillData);
        setStatus('success', 'Skill created successfully!');
      }

      setTimeout(() => setStatus('idle'), 3000);
      onSave();
    } catch (error) {
      setStatus('error', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        maxWidth: '700px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            {skill ? 'Edit Skill' : 'Create New Skill'}
          </h2>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {/* Name */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Status Update Format"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              required
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of this skill..."
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>

          {/* Scope */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Scope *
            </label>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={formData.isGlobal}
                  onChange={() => {
                    handleChange('isGlobal', true);
                    handleChange('projectId', null);
                  }}
                  style={{ marginRight: '5px' }}
                />
                Global (all projects)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={!formData.isGlobal}
                  onChange={() => handleChange('isGlobal', false)}
                  style={{ marginRight: '5px' }}
                />
                Project-specific
              </label>
            </div>
            {!formData.isGlobal && (
              <select
                value={formData.projectId || ''}
                onChange={(e) => handleChange('projectId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
                required
              >
                <option value="">Select a project...</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Content (Markdown) */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Content (Markdown) *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => handleChange('content', e.target.value)}
              placeholder="# Skill Instructions&#10;&#10;When the user asks about [topic], respond with...&#10;&#10;## Format&#10;- Use bullet points&#10;- Be concise"
              style={{
                width: '100%',
                minHeight: '200px',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
              required
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              Use Markdown formatting. This content will be injected into the AI's system prompt when activated.
            </div>
          </div>

          {/* Trigger Keywords */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Trigger Keywords *
            </label>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddKeyword(e);
                  }
                }}
                placeholder="Enter a keyword or phrase..."
                style={{
                  flex: 1,
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
              <button
                type="button"
                onClick={handleAddKeyword}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  background: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                + Add
              </button>
            </div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {formData.triggerKeywords.map((keyword, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '5px 10px',
                    background: '#e0e0e0',
                    borderRadius: '4px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(keyword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: '#666',
                      padding: 0,
                      lineHeight: 1
                    }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              Add keywords or phrases that will trigger this skill in chat conversations.
            </div>
          </div>

          {/* Auto-activate */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.autoActivate}
                onChange={(e) => handleChange('autoActivate', e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontWeight: 'bold' }}>Auto-activate when keywords match</span>
            </label>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px', marginLeft: '24px' }}>
              If unchecked, this skill will only activate when manually selected.
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                background: '#e0e0e0',
                color: '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 'bold',
                background: saving ? '#ccc' : '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Saving...' : (skill ? 'Update Skill' : 'Create Skill')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SkillEditor;
