import { useState } from 'react';
import useStore from '../../stores/useStore';

const MentorFeedback = ({ meeting }) => {
  const { setStatus, setChatSidebarOpen, projects } = useStore();
  const [feedback, setFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Open chat with meeting context
  const handleDiscussMeeting = () => {
    // Set the project context in localStorage so AIChat picks it up
    if (meeting.project_id) {
      localStorage.setItem('chatProjectId', meeting.project_id.toString());

      // Store a flag to indicate we want to discuss this specific meeting
      const meetingContext = {
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        meetingDate: meeting.date,
      };
      localStorage.setItem('chatMeetingContext', JSON.stringify(meetingContext));
    }

    // Open the chat sidebar
    setChatSidebarOpen(true);
  };

  // Cache feedback in component state to avoid duplicate requests
  const requestFeedback = async () => {
    if (feedback || isLoading) return;

    setIsLoading(true);
    setStatus('processing', 'Generating mentor feedback...');

    try {
      // Simulated mentor feedback - in real implementation, this would call an AI endpoint
      // For now, we'll generate a placeholder
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockFeedback = {
        strengths: [
          'Clear articulation of project goals and milestones',
          'Good identification of potential risks early in the process',
          'Effective delegation of action items with clear ownership'
        ],
        improvements: [
          'Consider adding more specific timelines to action items',
          'Technical details could benefit from more concrete examples',
          'Consider scheduling follow-up meetings to track progress on open questions'
        ],
        suggestions: [
          'Document key decisions in a centralized location (e.g., wiki)',
          'Set up regular check-ins for high-risk items identified',
          'Consider creating a technical design document for complex features discussed'
        ],
        overall: 'This was a productive meeting with clear outcomes. The team demonstrated good awareness of both opportunities and challenges ahead. To maximize impact, focus on converting the identified action items into trackable tasks with concrete deadlines.'
      };

      setFeedback(mockFeedback);
      setIsExpanded(true);
      setStatus('idle');
    } catch (error) {
      setStatus('error', 'Failed to generate mentor feedback: ' + error.message);
      setIsLoading(false);
    }
  };

  if (!isExpanded && !feedback) {
    return (
      <div style={{
        padding: '20px',
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ margin: '0 0 5px 0', fontSize: '16px', fontWeight: 'bold' }}>
              🎓 AI Mentor Feedback
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#6c757d' }}>
              Get AI-powered insights and suggestions for this meeting
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleDiscussMeeting}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#4f46e5';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#6366f1';
                e.target.style.transform = 'translateY(0)';
              }}
              title="Open AI chat to discuss this meeting in detail"
            >
              💬 Discuss Meeting
            </button>
            <button
              onClick={requestFeedback}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              {isLoading ? '⏳ Analyzing...' : '✨ Get Feedback'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!feedback) return null;

  return (
    <div style={{
      padding: '20px',
      background: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      marginTop: '20px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
          🎓 AI Mentor Feedback
        </h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isExpanded && (
            <button
              onClick={handleDiscussMeeting}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#4f46e5';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#6366f1';
                e.target.style.transform = 'translateY(0)';
              }}
              title="Open AI chat to discuss this meeting in detail"
            >
              💬 Discuss
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '0'
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div>
          {/* Overall Assessment */}
          {feedback.overall && (
            <div style={{ marginBottom: '20px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#495057' }}>
                📊 Overall Assessment
              </h5>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#495057' }}>
                {feedback.overall}
              </p>
            </div>
          )}

          {/* Strengths */}
          {feedback.strengths && feedback.strengths.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#28a745' }}>
                ✅ Strengths
              </h5>
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
                {feedback.strengths.map((strength, idx) => (
                  <li key={idx} style={{ fontSize: '14px', color: '#495057' }}>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for Improvement */}
          {feedback.improvements && feedback.improvements.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#ffc107' }}>
                💡 Areas for Improvement
              </h5>
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
                {feedback.improvements.map((improvement, idx) => (
                  <li key={idx} style={{ fontSize: '14px', color: '#495057' }}>
                    {improvement}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {feedback.suggestions && feedback.suggestions.length > 0 && (
            <div style={{ marginBottom: '0' }}>
              <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#007bff' }}>
                🚀 Suggestions
              </h5>
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
                {feedback.suggestions.map((suggestion, idx) => (
                  <li key={idx} style={{ fontSize: '14px', color: '#495057' }}>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{
            marginTop: '15px',
            padding: '10px',
            background: '#fff',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#6c757d',
            fontStyle: 'italic'
          }}>
            💡 This feedback is AI-generated and cached. It won't change unless you reprocess the meeting.
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorFeedback;
