import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import useStore from '../../stores/useStore';
import { wikiAPI } from '../../services/api';

const WikiEditor = () => {
  const { projects, selectedProject, selectProject, setStatus } = useStore();
  const [content, setContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [viewMode, setViewMode] = useState('edit'); // 'edit' or 'view'
  const saveTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

  // Configure marked options
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  // Load wiki content when project changes
  useEffect(() => {
    if (selectedProject) {
      loadWiki(selectedProject.id);
    }
  }, [selectedProject]);

  const loadWiki = async (projectId) => {
    try {
      setStatus('processing', 'Loading wiki...');
      const wiki = await wikiAPI.get(projectId);
      setContent(wiki.content || '');
      setStatus('idle');
    } catch (error) {
      console.error('Error loading wiki:', error);
      setStatus('error', error.message);
    }
  };

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (2 seconds after last change)
    saveTimeoutRef.current = setTimeout(() => {
      saveWiki(newContent);
    }, 2000);
  };

  const saveWiki = async (contentToSave) => {
    if (!selectedProject) return;

    try {
      setIsSaving(true);
      await wikiAPI.update(selectedProject.id, contentToSave);
      setLastSaved(new Date());
      setIsSaving(false);
      console.log('✅ Wiki saved');
    } catch (error) {
      console.error('Error saving wiki:', error);
      setIsSaving(false);
      setStatus('error', 'Failed to save wiki: ' + error.message);
    }
  };

  const handleManualSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveWiki(content);
  };

  const highlightSearchTerm = (text) => {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  const getPreviewHtml = () => {
    const html = marked(content);
    return searchTerm ? highlightSearchTerm(html) : html;
  };

  const formatLastSaved = () => {
    if (!lastSaved) return '';
    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000);

    if (diff < 60) return 'Saved just now';
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;
    return lastSaved.toLocaleTimeString();
  };

  if (!selectedProject) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '60px 20px',
        textAlign: 'center',
        color: '#6c757d'
      }}>
        <p style={{ fontSize: '64px', margin: '0 0 20px 0' }}>📚</p>
        <h3 style={{ margin: '0 0 20px 0' }}>No Project Selected</h3>
        <p style={{ margin: '0 0 20px 0' }}>Select a project to view or edit its wiki</p>

        {projects.length > 0 && (
          <select
            onChange={(e) => {
              const project = projects.find(p => p.id === parseInt(e.target.value));
              if (project) selectProject(project);
            }}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              background: '#fff',
              minWidth: '250px'
            }}
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
    );
  }

  return (
    <div className="glass-card" style={{
      overflow: 'hidden',
      height: 'calc(100vh - 250px)',
      minHeight: '600px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '15px 20px',
        borderBottom: '1px solid #dee2e6',
        background: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '15px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1, minWidth: '300px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', fontWeight: 'bold' }}>
              📚 Wiki
            </h2>
            <div style={{ fontSize: '13px', color: '#6c757d' }}>
              {isSaving && '💾 Saving...'}
              {!isSaving && lastSaved && `✓ ${formatLastSaved()}`}
              {!isSaving && !lastSaved && 'Auto-saves 2 seconds after last change'}
            </div>
          </div>

          {/* Project Selector */}
          {projects.length > 0 && (
            <select
              value={selectedProject?.id || ''}
              onChange={(e) => {
                const project = projects.find(p => p.id === parseInt(e.target.value));
                if (project) {
                  selectProject(project);
                  setContent(''); // Clear content while loading
                }
              }}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                background: '#fff',
                minWidth: '200px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* View Mode Toggle */}
          <div style={{
            display: 'flex',
            gap: '5px',
            background: '#fff',
            borderRadius: '6px',
            padding: '4px',
            border: '1px solid #ced4da'
          }}>
            <button
              onClick={() => setViewMode('edit')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                border: 'none',
                borderRadius: '4px',
                background: viewMode === 'edit' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                color: viewMode === 'edit' ? '#fff' : '#6c757d',
                cursor: 'pointer',
                fontWeight: viewMode === 'edit' ? 'bold' : 'normal',
                transition: 'all 0.2s ease'
              }}
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => setViewMode('view')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                border: 'none',
                borderRadius: '4px',
                background: viewMode === 'view' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                color: viewMode === 'view' ? '#fff' : '#6c757d',
                cursor: 'pointer',
                fontWeight: viewMode === 'view' ? 'bold' : 'normal',
                transition: 'all 0.2s ease'
              }}
            >
              👁️ View
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search in wiki..."
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              border: '1px solid #ced4da',
              borderRadius: '6px',
              width: '180px'
            }}
          />

          {/* Save Button */}
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className="btn-gradient"
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1
            }}
          >
            💾 Save Now
          </button>
        </div>
      </div>

      {/* Split Screen Editor / Full Preview */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: viewMode === 'edit' ? '1fr 1fr' : '1fr',
        overflow: 'hidden',
        minHeight: 0, // Important for flex scrolling
      }}>
        {/* Editor Panel - only shown in edit mode */}
        {viewMode === 'edit' && (
          <div style={{
            borderRight: '1px solid #dee2e6',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
          }}>
            <div style={{
              padding: '10px 15px',
              background: '#f8f9fa',
              borderBottom: '1px solid #dee2e6',
              fontWeight: 'bold',
              fontSize: '14px',
              flexShrink: 0,
            }}>
              ✏️ Editor
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="Write your project wiki in Markdown..."
              style={{
                flex: 1,
                padding: '20px',
                border: 'none',
                fontSize: '14px',
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                lineHeight: '1.6',
                resize: 'none',
                outline: 'none',
                overflowY: 'auto', // Enable scrolling
                minHeight: 0,
              }}
            />
          </div>
        )}

        {/* Preview Panel */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#fafbfc',
          overflow: 'hidden',
          minHeight: 0,
        }}>
          <div style={{
            padding: '10px 15px',
            background: '#f8f9fa',
            borderBottom: '1px solid #dee2e6',
            fontWeight: 'bold',
            fontSize: '14px',
            flexShrink: 0,
          }}>
            👁️ Preview
          </div>
          <div
            className="wiki-preview"
            style={{
              flex: 1,
              padding: '20px',
              overflowY: 'auto',
              fontSize: '14px',
              lineHeight: '1.8',
              textAlign: 'left',
              minHeight: 0,
            }}
            dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
          />
        </div>
      </div>

      {/* Helper Text */}
      <div style={{
        padding: '10px 20px',
        background: '#f8f9fa',
        borderTop: '1px solid #dee2e6',
        fontSize: '12px',
        color: '#6c757d',
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        <span><strong>**bold**</strong></span>
        <span><em>*italic*</em></span>
        <span>[link](url)</span>
        <span># Heading</span>
        <span>- List item</span>
        <span>`code`</span>
      </div>

      <style>{`
        mark {
          background-color: #ffeb3b;
          padding: 2px 4px;
          border-radius: 2px;
        }

        /* Markdown Preview Styles */
        .wiki-preview {
          text-align: left;
        }

        .wiki-preview h1 {
          font-size: 2em;
          font-weight: bold;
          margin: 0.67em 0;
          padding-bottom: 0.3em;
          border-bottom: 1px solid #dee2e6;
        }

        .wiki-preview h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.75em 0 0.5em 0;
          padding-bottom: 0.3em;
          border-bottom: 1px solid #eaecef;
        }

        .wiki-preview h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin: 0.75em 0 0.5em 0;
        }

        .wiki-preview h4 {
          font-size: 1em;
          font-weight: bold;
          margin: 0.75em 0 0.5em 0;
        }

        .wiki-preview h5 {
          font-size: 0.875em;
          font-weight: bold;
          margin: 0.75em 0 0.5em 0;
        }

        .wiki-preview h6 {
          font-size: 0.85em;
          font-weight: bold;
          color: #6c757d;
          margin: 0.75em 0 0.5em 0;
        }

        .wiki-preview p {
          margin: 0 0 1em 0;
        }

        .wiki-preview ul,
        .wiki-preview ol {
          margin: 0 0 1em 0;
          padding-left: 2em;
        }

        .wiki-preview li {
          margin: 0.25em 0;
        }

        .wiki-preview ul ul,
        .wiki-preview ul ol,
        .wiki-preview ol ul,
        .wiki-preview ol ol {
          margin: 0.25em 0;
        }

        .wiki-preview code {
          background: #f6f8fa;
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.9em;
          color: #e83e8c;
        }

        .wiki-preview pre {
          background: #f6f8fa;
          padding: 16px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 0 0 1em 0;
          border: 1px solid #dee2e6;
        }

        .wiki-preview pre code {
          background: none;
          padding: 0;
          color: inherit;
        }

        .wiki-preview blockquote {
          margin: 0 0 1em 0;
          padding: 0 1em;
          color: #6c757d;
          border-left: 4px solid #dee2e6;
        }

        .wiki-preview blockquote p {
          margin: 0.5em 0;
        }

        .wiki-preview a {
          color: #007bff;
          text-decoration: none;
        }

        .wiki-preview a:hover {
          text-decoration: underline;
        }

        .wiki-preview hr {
          border: none;
          border-top: 2px solid #dee2e6;
          margin: 2em 0;
        }

        .wiki-preview table {
          border-collapse: collapse;
          margin: 0 0 1em 0;
          width: 100%;
        }

        .wiki-preview table th,
        .wiki-preview table td {
          border: 1px solid #dee2e6;
          padding: 8px 12px;
          text-align: left;
        }

        .wiki-preview table th {
          background: #f8f9fa;
          font-weight: bold;
        }

        .wiki-preview table tr:nth-child(even) {
          background: #f8f9fa;
        }

        .wiki-preview img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 1em 0;
        }

        .wiki-preview strong {
          font-weight: bold;
        }

        .wiki-preview em {
          font-style: italic;
        }

        .wiki-preview del {
          text-decoration: line-through;
        }

        .wiki-preview input[type="checkbox"] {
          margin-right: 0.5em;
        }
      `}</style>
    </div>
  );
};

export default WikiEditor;
