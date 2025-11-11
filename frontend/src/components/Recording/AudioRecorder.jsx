import { useState, useEffect, useRef } from 'react';
import useStore from '../../stores/useStore';
import { meetingsAPI } from '../../services/api';

const AudioRecorder = () => {
  const {
    isRecording,
    recordingDuration,
    audioChunks,
    projects,
    mediaRecorder,
    startRecording,
    stopRecording,
    setRecordingDuration,
    addAudioChunk,
    clearAudioChunks,
    setStatus,
    addMeeting,
    selectMeeting,
    setActiveTab,
  } = useStore();

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const timerRef = useRef(null);

  // Request microphone permission on mount
  useEffect(() => {
    const requestPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop immediately after permission
        setPermissionGranted(true);
        console.log('✅ Microphone permission granted');
      } catch (error) {
        console.error('❌ Microphone permission denied:', error);
        setStatus('error', 'Microphone permission denied. Please allow microphone access.');
      }
    };

    requestPermission();
  }, [setStatus]);

  // Start recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration(recordingDuration + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, recordingDuration, setRecordingDuration]);

  const handleStartRecording = async () => {
    if (!meetingTitle.trim()) {
      setStatus('error', 'Please enter a meeting title');
      return;
    }

    if (!selectedProjectId) {
      setStatus('error', 'Please select a project');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('📊 Audio chunk received:', event.data.size, 'bytes');
          addAudioChunk(event.data);
        }
      };

      recorder.onstop = async () => {
        console.log('🛑 MediaRecorder stopped');

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Small delay to ensure all chunks are processed
        await new Promise(resolve => setTimeout(resolve, 100));

        // Upload recording
        await handleUpload();
      };

      recorder.start(1000); // Collect data every second
      startRecording(recorder);
      console.log('🎤 Recording started');
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      setStatus('error', 'Failed to start recording: ' + error.message);
    }
  };

  const handleStopRecording = () => {
    console.log('🔍 Stop button clicked', {
      hasMediaRecorder: !!mediaRecorder,
      isRecording,
      recorderState: mediaRecorder?.state
    });

    if (!isRecording) {
      console.warn('⚠️ Not currently recording');
      return;
    }

    if (!mediaRecorder) {
      console.warn('⚠️ No media recorder in store');
      return;
    }

    // Request any remaining data before stopping
    if (mediaRecorder.state === 'recording') {
      console.log('📊 Requesting final data...');
      mediaRecorder.requestData();
    }

    console.log('⏹️ Stopping recorder...');
    stopRecording();
  };

  const handleUpload = async () => {
    try {
      setStatus('processing', 'Uploading and processing recording...');

      // Get fresh audio chunks from store
      const currentAudioChunks = useStore.getState().audioChunks;

      console.log('📤 Audio chunks count:', currentAudioChunks.length);

      // Validate we have audio data
      if (currentAudioChunks.length === 0) {
        throw new Error('No audio data recorded. Please check your microphone and try recording again.');
      }

      // Create blob from audio chunks
      const audioBlob = new Blob(currentAudioChunks, { type: 'audio/webm' });

      console.log('📤 Uploading recording:', {
        size: audioBlob.size,
        type: audioBlob.type,
        projectId: selectedProjectId,
        title: meetingTitle,
        chunksCount: currentAudioChunks.length,
      });

      // Validate blob size - must be at least 1KB to contain actual audio
      if (audioBlob.size === 0) {
        throw new Error('Audio recording is empty. Please check your microphone and try recording again.');
      }

      if (audioBlob.size < 1000) {
        throw new Error('Audio recording is too small (less than 1KB). Please check your microphone is plugged in and working.');
      }

      // Upload to backend
      const response = await meetingsAPI.create(audioBlob, selectedProjectId, meetingTitle);
      const meeting = response.meeting || response;

      console.log('✅ Recording uploaded:', meeting);
      console.log('📍 Meeting ID:', meeting.id);
      console.log('📍 Meeting title:', meeting.title);

      // Add to store and automatically select it
      addMeeting(meeting);
      console.log('🎯 Auto-selecting new meeting:', meeting.id);
      selectMeeting(meeting);

      // Switch to meetings tab so user can see processing
      setActiveTab('meetings');

      // Clear form and reset state
      setMeetingTitle('');
      clearAudioChunks();
      setRecordingDuration(0); // Reset timer

      setStatus('success', 'Recording uploaded! Processing started...');

      // Clear success message after 5 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 5000);
    } catch (error) {
      console.error('❌ Error uploading recording:', error);
      setStatus('error', 'Failed to upload recording: ' + error.message);
      clearAudioChunks();
      setRecordingDuration(0); // Reset timer on error too
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Record Meeting</h2>

      {!permissionGranted && (
        <div style={{
          padding: '15px',
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          ⚠️ Requesting microphone permission...
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Project *
        </label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          disabled={isRecording}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        >
          <option value="">Select a project...</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Meeting Title *
        </label>
        <input
          type="text"
          value={meetingTitle}
          onChange={(e) => setMeetingTitle(e.target.value)}
          disabled={isRecording}
          placeholder="e.g., Sprint Planning - Week 42"
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      </div>

      <div style={{
        marginBottom: '20px',
        padding: '30px',
        background: '#f5f5f5',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '48px',
          fontWeight: 'bold',
          fontFamily: 'monospace',
          marginBottom: '20px',
          color: isRecording ? '#dc3545' : '#6c757d'
        }}>
          {formatDuration(recordingDuration)}
        </div>

        {isRecording && (
          <div style={{
            display: 'inline-block',
            width: '20px',
            height: '20px',
            background: '#dc3545',
            borderRadius: '50%',
            animation: 'pulse 1.5s ease-in-out infinite',
            marginBottom: '20px'
          }} />
        )}

        <div>
          {!isRecording ? (
            <button
              onClick={handleStartRecording}
              disabled={!permissionGranted || !meetingTitle.trim() || !selectedProjectId}
              style={{
                padding: '15px 40px',
                fontSize: '18px',
                fontWeight: 'bold',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: permissionGranted && meetingTitle.trim() && selectedProjectId ? 'pointer' : 'not-allowed',
                opacity: permissionGranted && meetingTitle.trim() && selectedProjectId ? 1 : 0.5,
              }}
            >
              🎤 Start Recording
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              style={{
                padding: '15px 40px',
                fontSize: '18px',
                fontWeight: 'bold',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              ⏹️ Stop Recording
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default AudioRecorder;
