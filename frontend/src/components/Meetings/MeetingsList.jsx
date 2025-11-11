import { useState } from 'react';
import useStore from '../../stores/useStore';
import { meetingsAPI } from '../../services/api';

const MeetingsList = () => {
  const {
    meetings,
    projects,
    selectedMeeting,
    selectMeeting,
    updateMeeting,
    deleteMeeting,
    setStatus,
  } = useStore();

  const [filterProjectId, setFilterProjectId] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'Unknown Project';
  };

  const filteredMeetings = filterProjectId
    ? meetings.filter(m => m.project_id === parseInt(filterProjectId))
    : meetings;

  const handleMeetingClick = async (meeting) => {
    try {
      setStatus('processing', 'Loading meeting details...');
      const response = await meetingsAPI.getById(meeting.id);
      const fullMeeting = response.meeting || response;

      // Update the meeting in the store with latest data
      updateMeeting(fullMeeting.id, fullMeeting);

      // Select the meeting
      selectMeeting(fullMeeting);
      setStatus('idle');
    } catch (error) {
      setStatus('error', error.message);
    }
  };

  const handleDelete = async (meetingId) => {
    try {
      setStatus('processing', 'Deleting meeting...');
      await meetingsAPI.delete(meetingId);
      deleteMeeting(meetingId);
      setShowDeleteConfirm(null);
      setStatus('success', 'Meeting deleted successfully');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      setStatus('error', error.message);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #dee2e6',
        background: '#f8f9fa'
      }}>
        <h2 style={{ margin: '0 0 15px 0', fontSize: '20px', fontWeight: 'bold' }}>
          📋 Meetings
        </h2>

        {/* Filter */}
        <select
          value={filterProjectId}
          onChange={(e) => setFilterProjectId(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '14px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            background: '#fff'
          }}
        >
          <option value="">All Projects</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {/* Meetings List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px'
      }}>
        {filteredMeetings.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#6c757d'
          }}>
            <p style={{ fontSize: '48px', margin: '0 0 10px 0' }}>📭</p>
            <p style={{ margin: 0 }}>No meetings found</p>
          </div>
        ) : (
          filteredMeetings.map(meeting => (
            <div
              key={meeting.id}
              style={{
                padding: '15px',
                marginBottom: '10px',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                cursor: 'pointer',
                background: selectedMeeting?.id === meeting.id ? '#e7f3ff' : '#fff',
                borderColor: selectedMeeting?.id === meeting.id ? '#007bff' : '#dee2e6',
                transition: 'all 0.2s',
                position: 'relative'
              }}
              onClick={() => handleMeetingClick(meeting)}
            >
              {/* Meeting Title */}
              <div style={{
                fontWeight: 'bold',
                fontSize: '15px',
                marginBottom: '8px',
                paddingRight: '30px'
              }}>
                {meeting.title}
              </div>

              {/* Project Badge */}
              <div style={{
                display: 'inline-block',
                background: '#e9ecef',
                color: '#495057',
                padding: '3px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                marginBottom: '8px'
              }}>
                {getProjectName(meeting.project_id)}
              </div>

              {/* Metadata */}
              <div style={{
                fontSize: '13px',
                color: '#6c757d',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <span>📅 {formatDate(meeting.date)}</span>
                {meeting.duration && (
                  <span>⏱️ {formatDuration(meeting.duration)}</span>
                )}
              </div>

              {/* Delete Button */}
              {showDeleteConfirm === meeting.id ? (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  display: 'flex',
                  gap: '5px'
                }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(meeting.id);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(null);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(meeting.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    padding: '4px 8px',
                    fontSize: '18px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0.5
                  }}
                  title="Delete meeting"
                >
                  🗑️
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid #dee2e6',
        background: '#f8f9fa',
        fontSize: '13px',
        color: '#6c757d',
        textAlign: 'center'
      }}>
        {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default MeetingsList;
