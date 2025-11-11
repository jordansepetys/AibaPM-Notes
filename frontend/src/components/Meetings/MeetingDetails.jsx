import { useState, useEffect } from 'react';
import useStore from '../../stores/useStore';
import { meetingsAPI, settingsAPI } from '../../services/api';
import MentorFeedback from './MentorFeedback';
import WikiUpdateSuggestions from './WikiUpdateSuggestions';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const MeetingDetails = () => {
  const { selectedMeeting, updateMeeting, setStatus } = useStore();
  const [activeTab, setActiveTab] = useState('summary');
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [settings, setSettings] = useState(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await settingsAPI.getAll();
        setSettings(loadedSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (selectedMeeting) {
      console.log('🔄 Meeting changed to:', selectedMeeting.id, selectedMeeting.title);

      // IMMEDIATELY reset ALL state when switching meetings
      setTranscript('');
      setSummary(null);
      setMetadata(null);
      setIsProcessing(false);
      setProcessingMessage('');
      setActiveTab('summary'); // Reset to summary tab

      // Then load new content
      loadMeetingContent();
    } else {
      // No meeting selected - clear everything
      console.log('🔄 No meeting selected, clearing state');
      setTranscript('');
      setSummary(null);
      setMetadata(null);
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [selectedMeeting?.id]); // Only re-run when meeting ID changes

  // Auto-polling for background processing
  useEffect(() => {
    if (!selectedMeeting) return;

    let pollInterval = null;
    let pollCount = 0;
    const MAX_POLLS = 900; // Poll for max 45 minutes (900 * 3s = 2700s) to match backend adaptive timeout for huge files

    const checkProcessingStatus = async () => {
      try {
        const response = await meetingsAPI.getById(selectedMeeting.id);
        const meeting = response.meeting || response;

        // Update the store with latest meeting data
        updateMeeting(meeting.id, meeting);

        // Check for error state (transcript_path starts with "ERROR:")
        if (meeting.transcript_path && meeting.transcript_path.startsWith('ERROR:')) {
          const errorMessage = meeting.transcript_path.substring(7); // Remove "ERROR: " prefix
          console.error('❌ Meeting processing failed:', errorMessage);
          setIsProcessing(false);
          setProcessingMessage(`❌ Processing failed: ${errorMessage}`);
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          return;
        }

        // Check if processing is complete
        const hasTranscript = !!meeting.transcript_path;
        const hasSummary = !!meeting.summary_path;

        if (hasTranscript && hasSummary) {
          // Processing complete! Load the content
          console.log('✅ Processing complete, loading content...');
          setIsProcessing(false);
          setProcessingMessage('');
          await loadMeetingContent();
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        } else {
          // Still processing
          if (!isProcessing) {
            setIsProcessing(true);
            if (!hasTranscript) {
              setProcessingMessage('🎙️ Transcribing audio with OpenAI Whisper...');
            } else if (!hasSummary) {
              // Show which AI backend is being used from settings
              const aiBackend = settings?.['ai.meeting_analysis'] || 'anthropic';
              const modelName = aiBackend === 'anthropic' ? 'Claude Sonnet 4.5' : 'GPT-4o';
              setProcessingMessage(`🤖 Generating AI summary with ${modelName}...`);
            }
          }
          console.log(`⏳ Still processing... (${pollCount}/${MAX_POLLS})`);
        }

        pollCount++;
        if (pollCount >= MAX_POLLS) {
          console.warn('⚠️ Polling timeout reached');
          setIsProcessing(false);
          setProcessingMessage('⚠️ Processing is taking longer than expected. Try refreshing.');
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      } catch (error) {
        console.error('Error checking processing status:', error);
      }
    };

    // Start polling immediately if no transcript/summary
    const initialCheck = async () => {
      if (!selectedMeeting.transcript_path || !selectedMeeting.summary_path) {
        setIsProcessing(true);
        const aiBackend = settings?.['ai.meeting_analysis'] || 'anthropic';
        const modelName = aiBackend === 'anthropic' ? 'Claude Sonnet 4.5' : 'GPT-4o';
        setProcessingMessage(`🎙️ Starting processing (using ${modelName})...`);
        await checkProcessingStatus();

        // Set up interval for continuous polling
        pollInterval = setInterval(checkProcessingStatus, 3000); // Poll every 3 seconds
      }
    };

    initialCheck();

    // Cleanup on unmount
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [selectedMeeting?.id, selectedMeeting?.transcript_path, selectedMeeting?.summary_path, settings]);

  const loadMeetingContent = async () => {
    if (!selectedMeeting) return;

    try {
      // Fetch full meeting data if needed
      const response = await meetingsAPI.getById(selectedMeeting.id);
      const fullMeeting = response.meeting || response;

      console.log('📥 Loaded meeting:', fullMeeting);

      // Check for error state
      if (fullMeeting.transcript_path && fullMeeting.transcript_path.startsWith('ERROR:')) {
        const errorMessage = fullMeeting.transcript_path.substring(7);
        console.error('❌ Meeting has error status:', errorMessage);
        setIsProcessing(false);
        setProcessingMessage(`❌ Processing failed: ${errorMessage}`);
        return;
      }

      // Load transcript
      if (fullMeeting.transcript_path) {
        console.log('📄 Loading transcript from:', fullMeeting.transcript_path);
        const transcriptResponse = await fetch(`${API_URL}${fullMeeting.transcript_path}`);
        const transcriptText = await transcriptResponse.text();
        setTranscript(transcriptText);
        console.log('✅ Transcript loaded');
      } else {
        console.log('⚠️ No transcript path');
      }

      // Load summary
      if (fullMeeting.summary_path) {
        console.log('📊 Loading summary from:', fullMeeting.summary_path);
        const summaryResponse = await fetch(`${API_URL}${fullMeeting.summary_path}`);
        const summaryData = await summaryResponse.json();
        setSummary(summaryData);
        console.log('✅ Summary loaded:', summaryData);
      } else {
        console.log('⚠️ No summary path');
      }

      // Set metadata from meeting
      const meetingMetadata = response.metadata || fullMeeting.metadata || null;
      setMetadata(meetingMetadata);
      console.log('📋 Metadata:', meetingMetadata);
    } catch (error) {
      console.error('❌ Error loading meeting content:', error);
    }
  };

  const handleReprocess = async () => {
    if (!selectedMeeting) return;

    try {
      console.log('🔄 Starting reprocess for meeting:', selectedMeeting.id);

      // Clear existing content and error state IMMEDIATELY
      setTranscript('');
      setSummary(null);
      setMetadata(null);
      setIsProcessing(true);
      const aiBackend = settings?.['ai.meeting_analysis'] || 'anthropic';
      const modelName = aiBackend === 'anthropic' ? 'Claude Sonnet 4.5' : 'GPT-4o';
      setProcessingMessage(`🔄 Reprocessing started - transcribing audio (using ${modelName})...`);
      setStatus('processing', 'Starting reprocessing...');

      // Call reprocess API (backend clears ERROR status in database)
      const response = await meetingsAPI.reprocess(selectedMeeting.id);
      const clearedMeeting = response.meeting || response;

      console.log('✅ Reprocess API call successful, meeting status cleared');

      // Update the meeting in store with cleared status from backend
      updateMeeting(selectedMeeting.id, {
        ...clearedMeeting,
        transcript_path: null,
        summary_path: null
      });

      setStatus('success', 'Reprocessing started! Watch for updates...');
      setTimeout(() => setStatus('idle'), 3000);

      // The auto-polling useEffect will handle checking for completion
    } catch (error) {
      console.error('❌ Reprocess failed:', error);
      setStatus('error', error.message);
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  if (!selectedMeeting) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '60px 20px',
        textAlign: 'center',
        color: '#6c757d'
      }}>
        <p style={{ fontSize: '64px', margin: '0 0 20px 0' }}>📄</p>
        <h3 style={{ margin: '0 0 10px 0' }}>No Meeting Selected</h3>
        <p style={{ margin: 0 }}>Select a meeting from the list to view details</p>
      </div>
    );
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
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
        <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 'bold' }}>
          {selectedMeeting.title}
        </h2>
        <div style={{ fontSize: '14px', color: '#6c757d' }}>
          {formatDate(selectedMeeting.date)}
        </div>
        <button
          onClick={handleReprocess}
          style={{
            marginTop: '10px',
            padding: '6px 12px',
            fontSize: '13px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Reprocess Meeting
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #dee2e6',
        background: '#f8f9fa'
      }}>
        {['summary', 'transcript', 'actions'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '14px',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              background: activeTab === tab ? '#fff' : 'transparent',
              color: activeTab === tab ? '#007bff' : '#6c757d',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #007bff' : 'none',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'summary' && '📊 '}
            {tab === 'transcript' && '📝 '}
            {tab === 'actions' && '✅ '}
            {tab}
          </button>
        ))}
      </div>

      {/* Processing Status Banner */}
      {(isProcessing || processingMessage) && (
        <div style={{
          padding: '15px 20px',
          background: processingMessage.startsWith('❌')
            ? 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontSize: '14px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderBottom: '1px solid #dee2e6'
        }}>
          {!processingMessage.startsWith('❌') && (
            <div style={{
              width: '20px',
              height: '20px',
              border: '3px solid rgba(255,255,255,0.3)',
              borderTop: '3px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          )}
          {processingMessage}
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        textAlign: 'left'
      }}>
        {activeTab === 'summary' && (
          <div style={{ textAlign: 'left' }}>
            {summary ? (
              <>
                {/* AI Model Info Badge */}
                {metadata?.ai_model_info && (() => {
                  try {
                    const modelInfo = JSON.parse(metadata.ai_model_info);
                    return (
                      <div style={{
                        marginBottom: '20px',
                        padding: '12px 16px',
                        background: modelInfo.fallbackOccurred
                          ? 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)'
                          : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: '500',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        <span style={{ fontSize: '18px' }}>
                          {modelInfo.fallbackOccurred ? '🔄' : '🤖'}
                        </span>
                        <div>
                          {modelInfo.fallbackOccurred ? (
                            <>
                              <div style={{ fontWeight: 'bold' }}>Analyzed with {modelInfo.usedModel} (Fallback)</div>
                              <div style={{ fontSize: '11px', opacity: 0.9 }}>
                                Primary API unavailable, automatically switched from {modelInfo.usedBackend === 'openai' ? 'Anthropic' : 'OpenAI'}
                              </div>
                            </>
                          ) : (
                            <div>Analyzed with {modelInfo.usedModel}</div>
                          )}
                        </div>
                      </div>
                    );
                  } catch (e) {
                    return null;
                  }
                })()}

                {/* Overview */}
                {summary.overview && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                      📋 Overview
                    </h3>
                    <p style={{ lineHeight: '1.6', color: '#495057' }}>
                      {summary.overview}
                    </p>
                  </div>
                )}

                {/* Context */}
                {summary.context && (
                  <div style={{ marginBottom: '30px', background: '#f8f9fa', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #007bff' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#007bff' }}>
                      🔗 Context & Background
                    </h3>
                    <p style={{ lineHeight: '1.6', color: '#495057', margin: 0 }}>
                      {summary.context}
                    </p>
                  </div>
                )}

                {/* Discussion Topics */}
                {summary.discussion_topics && summary.discussion_topics.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                      💬 Discussion Topics
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {summary.discussion_topics.map((topic, idx) => {
                        // Handle both string and object formats
                        const isObject = typeof topic === 'object' && topic !== null;
                        const topicText = isObject ? (topic.topic || topic.name || JSON.stringify(topic)) : topic;

                        return (
                          <span key={idx} style={{
                            padding: '6px 12px',
                            background: '#e7f3ff',
                            color: '#0056b3',
                            borderRadius: '16px',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            {topicText}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Detailed Discussion */}
                {summary.detailed_discussion && summary.detailed_discussion.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                      📝 Detailed Discussion
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {summary.detailed_discussion.map((point, idx) => {
                        // Handle both string and object formats
                        const isObject = typeof point === 'object' && point !== null;
                        const topic = isObject ? point.topic : null;
                        const details = isObject ? point.details : point;

                        return (
                          <div key={idx} style={{
                            padding: '15px',
                            background: '#f8f9fa',
                            borderRadius: '6px',
                            borderLeft: '3px solid #28a745'
                          }}>
                            <div style={{
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: '#28a745',
                              marginBottom: '8px'
                            }}>
                              {topic || `Point ${idx + 1}`}
                            </div>
                            <p style={{ lineHeight: '1.8', color: '#495057', margin: 0 }}>
                              {details}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Key Decisions */}
                {summary.key_decisions && summary.key_decisions.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                      🎯 Key Decisions
                    </h3>
                    <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                      {summary.key_decisions.map((decision, idx) => {
                        // Handle both string and object formats
                        const isObject = typeof decision === 'object' && decision !== null;
                        const decisionText = isObject ? (decision.decision || decision.text || JSON.stringify(decision)) : decision;

                        return (
                          <li key={idx} style={{ marginBottom: '8px', color: '#495057' }}>
                            {decisionText}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Technical Details */}
                {summary.technical_details && summary.technical_details.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                      🔧 Technical Details
                    </h3>
                    <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                      {summary.technical_details.map((detail, idx) => {
                        // Handle both string and object formats
                        const isObject = typeof detail === 'object' && detail !== null;
                        const detailText = isObject ? (detail.detail || detail.content || JSON.stringify(detail)) : detail;
                        const reason = isObject && detail.reason ? ` (${detail.reason})` : '';

                        return (
                          <li key={idx} style={{ marginBottom: '8px', color: '#495057' }}>
                            {detailText}{reason}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Mentor Feedback */}
                <MentorFeedback meeting={selectedMeeting} />

                {/* Wiki Update Suggestions */}
                <WikiUpdateSuggestions meeting={selectedMeeting} />
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                <p>⏳ Summary not yet generated or processing...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'transcript' && (
          <div style={{ textAlign: 'left' }}>
            {transcript ? (
              <pre style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                lineHeight: '1.8',
                color: '#495057',
                margin: 0
              }}>
                {transcript}
              </pre>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                <p>⏳ Transcript not yet generated or processing...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'actions' && (
          <div style={{ textAlign: 'left' }}>
            {summary?.action_items && summary.action_items.length > 0 ? (
              <div>
                {summary.action_items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '15px',
                      marginBottom: '15px',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      background: '#f8f9fa'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '15px' }}>
                      {item.task || item}
                    </div>
                    {item.owner && (
                      <div style={{ fontSize: '13px', color: '#6c757d' }}>
                        👤 Assigned to: {item.owner}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                <p>✅ No action items identified</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingDetails;
