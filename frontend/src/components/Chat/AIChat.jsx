import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import useStore from '../../stores/useStore';
import { chatAPI } from '../../services/api';

const AIChat = ({ isSidebar = false }) => {
  const { projects, selectedProject, selectProject, setStatus } = useStore();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [aiModel, setAiModel] = useState('Loading...');
  const [activeSkills, setActiveSkills] = useState([]);
  const [disableSkills, setDisableSkills] = useState(false);

  // Persist project selection in localStorage
  const [currentProjectId, setCurrentProjectId] = useState(() => {
    const saved = localStorage.getItem('chatProjectId');
    return saved ? parseInt(saved) : null;
  });

  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceMediaRecorder, setVoiceMediaRecorder] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const voiceChunksRef = useRef([]);

  // Load chat history when component mounts or project changes
  useEffect(() => {
    loadChatHistory();
  }, [currentProjectId]);

  // Check for meeting context and pre-populate message
  useEffect(() => {
    const meetingContextStr = localStorage.getItem('chatMeetingContext');
    if (meetingContextStr) {
      try {
        const meetingContext = JSON.parse(meetingContextStr);
        const meetingDate = new Date(meetingContext.meetingDate).toLocaleDateString();
        const suggestedMessage = `Let's discuss the "${meetingContext.meetingTitle}" meeting from ${meetingDate}. What insights can you provide?`;
        setInputMessage(suggestedMessage);

        // Clear the flag so we don't do this again
        localStorage.removeItem('chatMeetingContext');

        // Focus the input field
        setTimeout(() => inputRef.current?.focus(), 300);
      } catch (error) {
        console.error('Error parsing meeting context:', error);
      }
    }
  }, [currentProjectId]); // Re-run when project changes

  // Fetch AI model info on mount
  useEffect(() => {
    fetchModelInfo();
  }, []);

  const fetchModelInfo = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health');
      const data = await response.json();

      if (data.modelName) {
        setAiModel(data.modelName);
        // Store backend info for future reference
        localStorage.setItem('aiBackend', data.aiBackend);
      } else {
        setAiModel('Claude Sonnet 4.5'); // Fallback
      }
    } catch (error) {
      console.error('Failed to fetch model info:', error);
      setAiModel('Claude Sonnet 4.5'); // Default fallback
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async () => {
    try {
      const response = await chatAPI.getHistory(currentProjectId);
      setMessages(response.messages || []);
    } catch (error) {
      console.error('Error loading chat history:', error);
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Add user message to UI immediately
    const tempUserMessage = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      setIsLoading(true);
      const response = await chatAPI.sendMessage(userMessage, currentProjectId, { disableSkills });

      // Update active skills from response
      if (response.activeSkills) {
        setActiveSkills(response.activeSkills);
      }

      // Reset disable skills toggle after sending
      setDisableSkills(false);

      // Add AI response to messages
      const aiMessage = {
        id: response.messageId,
        role: 'assistant',
        content: response.message,
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      setStatus('error', 'Failed to get AI response: ' + error.message);
      setIsLoading(false);

      // Add error message
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '❌ Sorry, I encountered an error. Please try again.',
        createdAt: new Date().toISOString(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear the chat history?')) return;

    try {
      await chatAPI.clearHistory(currentProjectId);
      setMessages([]);
      setStatus('success', 'Chat history cleared');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      setStatus('error', 'Failed to clear history: ' + error.message);
    }
  };

  const handleProjectChange = (projectId) => {
    const newProjectId = projectId ? parseInt(projectId) : null;
    setCurrentProjectId(newProjectId);

    // Save to localStorage to persist across panel open/close
    if (newProjectId) {
      localStorage.setItem('chatProjectId', newProjectId.toString());
    } else {
      localStorage.removeItem('chatProjectId');
    }

    // Also update global selected project if a project is chosen
    if (newProjectId) {
      const project = projects.find(p => p.id === newProjectId);
      if (project) {
        selectProject(project);
      }
    }
  };

  const startVoiceInput = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          voiceChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });
        voiceChunksRef.current = [];

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Send to backend for transcription
        try {
          setIsTranscribing(true);
          const result = await chatAPI.transcribeVoice(audioBlob);

          // Append transcribed text to input (or replace if empty)
          setInputMessage(prev => {
            const separator = prev.trim() ? ' ' : '';
            return prev + separator + result.text;
          });

          setIsTranscribing(false);
          inputRef.current?.focus();
        } catch (error) {
          console.error('Transcription error:', error);
          setStatus('error', 'Voice transcription failed: ' + error.message);
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setVoiceMediaRecorder(recorder);
      setIsRecordingVoice(true);
    } catch (error) {
      console.error('Microphone access error:', error);
      setStatus('error', 'Microphone access denied. Please allow microphone access and try again.');
    }
  };

  const stopVoiceInput = () => {
    if (voiceMediaRecorder && voiceMediaRecorder.state === 'recording') {
      voiceMediaRecorder.stop();
      setIsRecordingVoice(false);
      setVoiceMediaRecorder(null);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Render message content with markdown for AI messages
  const renderMessageContent = (msg) => {
    if (msg.role === 'user') {
      // User messages are plain text
      return msg.content;
    } else {
      // AI messages render as markdown
      const html = marked(msg.content, {
        breaks: true, // Convert line breaks to <br>
        gfm: true, // GitHub Flavored Markdown
      });
      return <div className="chat-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
    }
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: isSidebar ? '0' : '8px',
      boxShadow: isSidebar ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      height: isSidebar ? '100%' : 'calc(100vh - 200px)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header - Only show in standalone mode */}
      {!isSidebar && (<div style={{
        padding: '15px 20px',
        borderBottom: '1px solid #dee2e6',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            🤖 AI Mentor & Companion
          </h2>
          <button
            onClick={handleClearHistory}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            🗑️ Clear History
          </button>
        </div>

        {/* Project Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '13px', fontWeight: '500' }}>
            Project Context:
          </label>
          <select
            value={currentProjectId || ''}
            onChange={(e) => handleProjectChange(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              color: '#495057',
              minWidth: '200px',
            }}
          >
            <option value="">General Chat (No Project)</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>)}

      {/* Sidebar Header - Only show in sidebar mode */}
      {isSidebar && (
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid #dee2e6',
          background: '#f8f9fa',
        }}>
          {/* Model Name Display */}
          <div style={{
            marginBottom: '12px',
            padding: '8px 12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}>
            <span style={{ fontSize: '16px' }}>✨</span>
            <span style={{
              fontSize: '13px',
              fontWeight: '600',
              color: 'white',
              letterSpacing: '0.3px',
            }}>
              {aiModel}
            </span>
          </div>

          {/* Project Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '13px', fontWeight: '500', color: '#495057' }}>
              Project:
            </label>
            <select
              value={currentProjectId || ''}
              onChange={(e) => handleProjectChange(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '13px',
                background: '#fff',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                color: '#495057',
              }}
            >
              <option value="">General Chat</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleClearHistory}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                background: '#fff',
                color: '#6c757d',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="Clear chat history"
            >
              🗑️
            </button>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        background: '#f8f9fa',
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#6c757d',
          }}>
            <p style={{ fontSize: '48px', margin: '0 0 20px 0' }}>👋</p>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>
              Hey there! I'm your AI mentor.
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.6' }}>
              Ask me anything about your projects, get advice on technical decisions,<br />
              or just chat about what's on your mind. I'm here to help!
            </p>
            {currentProjectId && (
              <div style={{
                background: '#e7f3ff',
                border: '1px solid #b3d9ff',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '13px',
                color: '#004085',
                maxWidth: '400px',
                margin: '0 auto',
              }}>
                💡 I have access to your project's meetings, wiki, and summaries.<br />
                Try asking: "What have we discussed about authentication?"
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div
                key={msg.id || index}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '15px',
                }}
              >
                <div style={{
                  maxWidth: '70%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  {/* Message Bubble */}
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.isError
                      ? '#f8d7da'
                      : msg.role === 'user'
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : '#fff',
                    color: msg.isError
                      ? '#721c24'
                      : msg.role === 'user'
                        ? '#fff'
                        : '#495057',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    whiteSpace: msg.role === 'user' ? 'pre-wrap' : 'normal',
                    wordBreak: 'break-word',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    border: msg.role === 'user' ? 'none' : '1px solid #dee2e6',
                    textAlign: 'left',
                  }}>
                    {renderMessageContent(msg)}
                  </div>

                  {/* Timestamp */}
                  <div style={{
                    fontSize: '11px',
                    color: '#6c757d',
                    marginTop: '4px',
                    paddingLeft: msg.role === 'user' ? '0' : '8px',
                    paddingRight: msg.role === 'user' ? '8px' : '0',
                  }}>
                    {formatTime(msg.createdAt)}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
                marginBottom: '15px',
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '18px 18px 18px 4px',
                  background: '#fff',
                  border: '1px solid #dee2e6',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                  }}>
                    <div className="typing-dot" style={{ animationDelay: '0s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Active Skills Indicator */}
      {(activeSkills.length > 0 || disableSkills) && (
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid #dee2e6',
          background: '#f8f9fa',
          fontSize: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', color: '#666' }}>
              🎯 Active Skills:
            </span>
            {activeSkills.length > 0 ? (
              activeSkills.map((skill, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '3px 8px',
                    background: disableSkills ? '#e0e0e0' : '#8b5cf6',
                    color: disableSkills ? '#999' : 'white',
                    borderRadius: '4px',
                    fontSize: '11px',
                    textDecoration: disableSkills ? 'line-through' : 'none',
                  }}
                  title={`${skill.name} (${skill.scope}, score: ${skill.score})`}
                >
                  {skill.name}
                </span>
              ))
            ) : (
              <span style={{ color: '#999' }}>None</span>
            )}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div style={{
        padding: '15px 20px',
        borderTop: '1px solid #dee2e6',
        background: '#fff',
      }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message... (Shift+Enter for new line)"
            disabled={isLoading || isRecordingVoice || isTranscribing}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '14px',
              border: '1px solid #ced4da',
              borderRadius: '8px',
              resize: 'none',
              fontFamily: 'inherit',
              minHeight: '50px',
              maxHeight: '120px',
              outline: 'none',
            }}
            rows={2}
          />
          <button
            onClick={isRecordingVoice ? stopVoiceInput : startVoiceInput}
            disabled={isLoading || isTranscribing}
            style={{
              padding: '12px 20px',
              fontSize: '20px',
              background: isRecordingVoice
                ? 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'
                : '#f8f9fa',
              color: isRecordingVoice ? 'white' : '#495057',
              border: isRecordingVoice ? 'none' : '1px solid #ced4da',
              borderRadius: '8px',
              cursor: (isLoading || isTranscribing) ? 'not-allowed' : 'pointer',
              opacity: (isLoading || isTranscribing) ? 0.6 : 1,
              whiteSpace: 'nowrap',
              transition: 'all 0.3s ease',
              animation: isRecordingVoice ? 'pulse 1.5s infinite' : 'none',
            }}
            title={isRecordingVoice ? 'Stop recording' : 'Record voice message'}
          >
            {isTranscribing ? '⏳' : (isRecordingVoice ? '⏹️' : '🎤')}
          </button>
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || isRecordingVoice || isTranscribing}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 'bold',
              background: !inputMessage.trim() || isLoading || isRecordingVoice || isTranscribing
                ? '#6c757d'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: !inputMessage.trim() || isLoading || isRecordingVoice || isTranscribing ? 'not-allowed' : 'pointer',
              opacity: !inputMessage.trim() || isLoading || isRecordingVoice || isTranscribing ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {isTranscribing ? '⏳ Transcribing...' : (isLoading ? '⏳ Thinking...' : '📤 Send')}
          </button>
        </div>
        <div style={{
          marginTop: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <label style={{
            fontSize: '12px',
            color: '#6c757d',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            gap: '5px',
          }}>
            <input
              type="checkbox"
              checked={disableSkills}
              onChange={(e) => setDisableSkills(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Disable skills for this message
          </label>
          <div style={{
            fontSize: '12px',
            color: '#6c757d',
            textAlign: 'right',
          }}>
            {isRecordingVoice ? '🎤 Recording... Click stop when done' : 'Press Enter to send • Shift+Enter for new line'}
          </div>
        </div>
      </div>

      {/* Typing Animation CSS + Markdown Styling */}
      <style>{`
        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #6c757d;
          animation: typing 1.4s infinite;
        }

        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.6;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
          }
        }

        /* Markdown styling for chat messages */
        .chat-markdown {
          text-align: left;
        }

        .chat-markdown p {
          margin: 0 0 0.8em 0;
          text-align: left;
        }

        .chat-markdown p:last-child {
          margin-bottom: 0;
        }

        .chat-markdown h1,
        .chat-markdown h2,
        .chat-markdown h3,
        .chat-markdown h4,
        .chat-markdown h5,
        .chat-markdown h6 {
          margin: 0.8em 0 0.5em 0;
          font-weight: 600;
          text-align: left;
        }

        .chat-markdown h1 {
          font-size: 1.4em;
          border-bottom: 2px solid #dee2e6;
          padding-bottom: 0.3em;
        }

        .chat-markdown h2 {
          font-size: 1.3em;
          border-bottom: 1px solid #dee2e6;
          padding-bottom: 0.3em;
        }

        .chat-markdown h3 {
          font-size: 1.2em;
        }

        .chat-markdown h4,
        .chat-markdown h5,
        .chat-markdown h6 {
          font-size: 1.1em;
        }

        .chat-markdown code {
          background: #f8f9fa;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 0.9em;
          color: #e83e8c;
        }

        .chat-markdown pre {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 12px;
          overflow-x: auto;
          margin: 0.8em 0;
        }

        .chat-markdown pre code {
          background: transparent;
          padding: 0;
          color: #495057;
          font-size: 0.85em;
        }

        .chat-markdown ul,
        .chat-markdown ol {
          margin: 0.8em 0;
          padding-left: 2em;
          text-align: left;
        }

        .chat-markdown li {
          margin: 0.3em 0;
        }

        .chat-markdown blockquote {
          margin: 0.8em 0;
          padding-left: 1em;
          border-left: 4px solid #667eea;
          color: #6c757d;
          font-style: italic;
        }

        .chat-markdown a {
          color: #667eea;
          text-decoration: none;
        }

        .chat-markdown a:hover {
          text-decoration: underline;
        }

        .chat-markdown table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.8em 0;
        }

        .chat-markdown table th,
        .chat-markdown table td {
          border: 1px solid #dee2e6;
          padding: 8px 12px;
          text-align: left;
        }

        .chat-markdown table th {
          background: #f8f9fa;
          font-weight: 600;
        }

        .chat-markdown table tr:nth-child(even) {
          background: #f8f9fa;
        }

        .chat-markdown hr {
          border: none;
          border-top: 1px solid #dee2e6;
          margin: 1em 0;
        }

        .chat-markdown strong {
          font-weight: 600;
        }

        .chat-markdown em {
          font-style: italic;
        }

        .chat-markdown img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default AIChat;
