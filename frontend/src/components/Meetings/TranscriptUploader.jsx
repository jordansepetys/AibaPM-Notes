import { useState, useRef, useCallback } from 'react';
import useStore from '../../stores/useStore';
import { meetingsAPI } from '../../services/api';

const TranscriptUploader = () => {
  const { projects, addMeeting, setStatus } = useStore();

  const [transcriptText, setTranscriptText] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  // Handle drag and drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    await processFile(file);
  }, []);

  // Process uploaded file
  const processFile = async (file) => {
    const fileName = file.name.toLowerCase();
    setError(null);

    if (fileName.endsWith('.txt')) {
      const text = await file.text();
      setTranscriptText(text);
      // Auto-set title from filename
      if (!meetingTitle) {
        setMeetingTitle(file.name.replace('.txt', '').replace(/_/g, ' '));
      }
    } else if (fileName.endsWith('.docx')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const text = await extractDocxText(arrayBuffer);
        setTranscriptText(text);
        if (!meetingTitle) {
          setMeetingTitle(file.name.replace('.docx', '').replace(/_/g, ' '));
        }
      } catch (err) {
        console.error('DOCX extraction error:', err);
        setError('Failed to read .docx file. Please try pasting the text directly.');
      }
    } else {
      setError('Unsupported file type. Please use .txt or .docx files.');
    }
  };

  // Extract text from .docx (uses mammoth library)
  const extractDocxText = async (arrayBuffer) => {
    try {
      // Dynamically import mammoth for .docx parsing
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (err) {
      console.error('Mammoth import/extraction error:', err);
      throw new Error('Could not parse .docx file');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!selectedProjectId) {
      setError('Please select a project');
      return;
    }
    if (!transcriptText.trim()) {
      setError('Please enter or upload a transcript');
      return;
    }
    if (!meetingTitle.trim()) {
      setError('Please enter a meeting title');
      return;
    }

    setIsSubmitting(true);
    setStatus('processing', 'Submitting transcript for analysis...');

    try {
      const result = await meetingsAPI.submitTranscript({
        projectId: parseInt(selectedProjectId),
        title: meetingTitle,
        date: meetingDate,
        transcript: transcriptText
      });

      // Add meeting to store
      if (result.id) {
        addMeeting({
          id: result.id,
          project_id: parseInt(selectedProjectId),
          title: meetingTitle,
          date: meetingDate,
          status: 'processing'
        });
      }

      setSuccess('Transcript submitted successfully! AI analysis is in progress.');
      setStatus('success', 'Transcript submitted for analysis');

      // Reset form on success
      setTranscriptText('');
      setMeetingTitle('');
      setMeetingDate(new Date().toISOString().split('T')[0]);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.message || 'Failed to submit transcript');
      setStatus('error', err.message || 'Failed to submit transcript');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    background: '#fff',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 'bold' }}>
        📝 Add Meeting Transcript
      </h2>
      <p style={{ margin: '0 0 24px 0', color: '#6c757d', fontSize: '14px' }}>
        Upload a transcript file or paste your meeting notes to generate AI analysis
      </p>

      {error && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '6px',
          color: '#721c24',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          background: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '6px',
          color: '#155724',
          fontSize: '14px'
        }}>
          {success}
        </div>
      )}

      {/* Meeting Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
            Project *
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select a project...</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
            Meeting Title *
          </label>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="Enter meeting title"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
            Date
          </label>
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? '#007bff' : '#ced4da'}`,
          borderRadius: '8px',
          padding: '32px',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: '20px',
          background: isDragging ? '#e7f3ff' : '#f8f9fa',
          transition: 'all 0.2s'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.docx"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📄</div>
        <div style={{ color: '#495057', fontWeight: '500', marginBottom: '4px' }}>
          Drop a transcript file here
        </div>
        <div style={{ color: '#6c757d', fontSize: '13px' }}>
          or click to browse (.txt, .docx)
        </div>
      </div>

      {/* Manual Text Entry */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
          Transcript Text {transcriptText && (
            <span style={{ fontWeight: 'normal', color: '#6c757d' }}>
              ({transcriptText.length.toLocaleString()} characters)
            </span>
          )}
        </label>
        <textarea
          value={transcriptText}
          onChange={(e) => setTranscriptText(e.target.value)}
          placeholder="Paste or type the meeting transcript here...

Example format:
- John: Let's discuss the new feature requirements
- Sarah: I think we should focus on user authentication first
- John: Agreed. We'll need to implement OAuth..."
          rows={14}
          style={{
            ...inputStyle,
            fontFamily: 'monospace',
            fontSize: '13px',
            lineHeight: '1.5',
            resize: 'vertical'
          }}
        />
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !transcriptText.trim() || !meetingTitle.trim() || !selectedProjectId}
        style={{
          width: '100%',
          padding: '14px 24px',
          fontSize: '16px',
          fontWeight: '600',
          border: 'none',
          borderRadius: '6px',
          cursor: isSubmitting || !transcriptText.trim() || !meetingTitle.trim() || !selectedProjectId
            ? 'not-allowed'
            : 'pointer',
          background: isSubmitting || !transcriptText.trim() || !meetingTitle.trim() || !selectedProjectId
            ? '#e9ecef'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: isSubmitting || !transcriptText.trim() || !meetingTitle.trim() || !selectedProjectId
            ? '#6c757d'
            : '#fff',
          transition: 'all 0.2s',
          boxShadow: isSubmitting || !transcriptText.trim() || !meetingTitle.trim() || !selectedProjectId
            ? 'none'
            : '0 4px 15px rgba(102, 126, 234, 0.4)'
        }}
      >
        {isSubmitting ? '⏳ Processing...' : '🚀 Submit Transcript for Analysis'}
      </button>

      <p style={{ marginTop: '12px', fontSize: '12px', color: '#6c757d', textAlign: 'center' }}>
        The AI will analyze your transcript and generate a summary, action items, and key decisions.
      </p>
    </div>
  );
};

export default TranscriptUploader;
