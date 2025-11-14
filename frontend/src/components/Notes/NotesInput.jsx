import { useState } from 'react';
import useStore from '../../stores/useStore';
import { meetingsAPI } from '../../services/api';

const NotesInput = () => {
  const { projects, selectedProject, selectProject, addMeeting, setStatus } = useStore();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProject) {
      setStatus('error', 'Please select a project first');
      return;
    }

    if (!title.trim()) {
      setStatus('error', 'Please enter a meeting title');
      return;
    }

    if (!notes.trim()) {
      setStatus('error', 'Please enter some notes');
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus('processing', 'Creating meeting and analyzing notes...');

      // Call the API to create the meeting
      const meeting = await meetingsAPI.create({
        projectId: selectedProject.id,
        title: title.trim(),
        notes: notes.trim(),
      });

      // Add the meeting to the store
      addMeeting(meeting);

      // Reset form
      setTitle('');
      setNotes('');
      setStatus('success', 'Meeting created successfully! AI analysis in progress...');

      // Clear success message after 3 seconds
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error('Error creating meeting:', error);
      setStatus('error', error.message || 'Failed to create meeting');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '30px' }}>
      <form onSubmit={handleSubmit}>
        {/* Project Selection */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '10px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#495057',
          }}>
            📁 Project
          </label>
          <select
            value={selectedProject?.id || ''}
            onChange={(e) => {
              const project = projects.find(p => p.id === parseInt(e.target.value));
              selectProject(project);
            }}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '14px',
              border: '2px solid #e0e7ff',
              borderRadius: '8px',
              background: '#fff',
              color: '#495057',
              outline: 'none',
              transition: 'border-color 0.2s',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e0e7ff'}
          >
            <option value="">Select a project...</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Meeting Title */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '10px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#495057',
          }}>
            📝 Meeting Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g., Sprint Planning - Week 45"
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '14px',
              border: '2px solid #e0e7ff',
              borderRadius: '8px',
              background: '#fff',
              color: '#495057',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e0e7ff'}
          />
        </div>

        {/* Notes Textarea */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '10px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#495057',
          }}>
            📄 Meeting Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
            placeholder="Type your meeting notes here...

Tips for better AI analysis:
• Include key decisions and why they were made
• Note action items and owners
• Capture technical details and implementation plans
• Mention any risks or concerns discussed
• Document the context and background"
            style={{
              width: '100%',
              minHeight: '400px',
              padding: '16px',
              fontSize: '14px',
              border: '2px solid #e0e7ff',
              borderRadius: '8px',
              background: '#fff',
              color: '#495057',
              outline: 'none',
              transition: 'border-color 0.2s',
              fontFamily: 'inherit',
              resize: 'vertical',
              lineHeight: '1.6',
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e0e7ff'}
          />
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#6c757d',
            textAlign: 'right',
          }}>
            {notes.length} characters
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!selectedProject || !title.trim() || !notes.trim() || isSubmitting}
          className="btn-gradient"
          style={{
            width: '100%',
            padding: '16px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: (!selectedProject || !title.trim() || !notes.trim() || isSubmitting) ? 'not-allowed' : 'pointer',
            opacity: (!selectedProject || !title.trim() || !notes.trim() || isSubmitting) ? 0.6 : 1,
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting && selectedProject && title.trim() && notes.trim()) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
          }}
        >
          {isSubmitting ? '⏳ Creating Meeting...' : '🚀 Create Meeting & Analyze'}
        </button>

        {/* Helper Text */}
        {!selectedProject && (
          <div style={{
            marginTop: '15px',
            padding: '12px 16px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#856404',
          }}>
            💡 <strong>Tip:</strong> Select a project first to organize your meeting notes
          </div>
        )}
      </form>
    </div>
  );
};

export default NotesInput;
