import { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';

const SettingsModal = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState({
    'ai.meeting_analysis': 'anthropic',
    'ai.chat': 'anthropic',
    'ai.wiki_updates': 'anthropic',
    'ai.mentor_feedback': 'anthropic',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const loadedSettings = await settingsAPI.getAll();
      setSettings(loadedSettings);
    } catch (error) {
      setMessage(`Error loading settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsAPI.update(settings);
      setMessage('Settings saved successfully!');
      setTimeout(() => {
        setMessage('');
        onClose();
      }, 1500);
    } catch (error) {
      setMessage(`Error saving settings: ${error.message}`);
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const features = [
    {
      key: 'ai.meeting_analysis',
      label: 'Meeting Analysis',
      icon: '📊',
      description: 'AI model for processing and analyzing meeting transcripts'
    },
    {
      key: 'ai.chat',
      label: 'Chat Assistant',
      icon: '💬',
      description: 'AI model for the project mentor chat'
    },
    {
      key: 'ai.wiki_updates',
      label: 'Wiki Updates',
      icon: '📝',
      description: 'AI model for generating wiki update suggestions'
    },
    {
      key: 'ai.mentor_feedback',
      label: 'Mentor Feedback',
      icon: '🎯',
      description: 'AI model for generating meeting feedback'
    }
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          width: '90%',
          maxWidth: '600px',
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: 'white' }}>
              ⚙️ AI Model Settings
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)' }}>
              Choose which AI model to use for each feature
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '20px',
              color: 'white',
              transition: 'background 0.2s'
            }}
            onMouseOver={e => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseOut={e => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
              <p>Loading settings...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {features.map(feature => (
                <div
                  key={feature.key}
                  style={{
                    padding: '20px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    border: '2px solid #e9ecef'
                  }}
                >
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '20px' }}>{feature.icon}</span>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                        {feature.label}
                      </h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#6c757d' }}>
                      {feature.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => handleChange(feature.key, 'anthropic')}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        background: settings[feature.key] === 'anthropic'
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : 'white',
                        color: settings[feature.key] === 'anthropic' ? 'white' : '#495057',
                        border: '2px solid',
                        borderColor: settings[feature.key] === 'anthropic' ? '#667eea' : '#dee2e6',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>🤖 Claude Sonnet 4.5</span>
                      <span style={{
                        fontSize: '11px',
                        opacity: 0.8,
                        fontWeight: 'normal'
                      }}>
                        (Anthropic)
                      </span>
                    </button>

                    <button
                      onClick={() => handleChange(feature.key, 'openai')}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        background: settings[feature.key] === 'openai'
                          ? 'linear-gradient(135deg, #10a37f 0%, #0e8c6a 100%)'
                          : 'white',
                        color: settings[feature.key] === 'openai' ? 'white' : '#495057',
                        border: '2px solid',
                        borderColor: settings[feature.key] === 'openai' ? '#10a37f' : '#dee2e6',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>🤖 GPT-4o</span>
                      <span style={{
                        fontSize: '11px',
                        opacity: 0.8,
                        fontWeight: 'normal'
                      }}>
                        (OpenAI)
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Message */}
          {message && (
            <div style={{
              marginTop: '20px',
              padding: '12px 16px',
              background: message.includes('Error') ? '#f8d7da' : '#d4edda',
              color: message.includes('Error') ? '#721c24' : '#155724',
              borderRadius: '6px',
              fontSize: '14px',
              textAlign: 'center',
              border: '1px solid',
              borderColor: message.includes('Error') ? '#f5c6cb' : '#c3e6cb'
            }}>
              {message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid #e9ecef',
          background: '#f8f9fa',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'white',
              color: '#495057',
              border: '2px solid #dee2e6',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 24px',
              background: saving ? '#6c757d' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </>
  );
};

export default SettingsModal;
