import { useState } from 'react';
import { wikiAPI } from '../../services/api';

function WikiUpdateSuggestions({ meeting }) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleGetSuggestions = async () => {
    if (!meeting || !meeting.project_id) {
      setError('Meeting or project information not available');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await wikiAPI.getSuggestions(meeting.project_id, meeting.id);
      setSuggestions(response.suggestions);
      setExpanded(true);
    } catch (err) {
      setError(err.message || 'Failed to generate suggestions');
      setSuggestions(null);
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestions = async () => {
    if (!suggestions || !meeting) return;

    setApplying(true);
    setError(null);

    try {
      await wikiAPI.applySuggestions(meeting.project_id, meeting.id, suggestions);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to apply suggestions');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      marginTop: '20px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px 20px',
        background: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        cursor: 'pointer'
      }}
      onClick={() => setExpanded(!expanded)}
      >
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
          📝 Wiki Update Suggestions
        </h3>
        <span style={{ fontSize: '18px' }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {/* Content */}
      {expanded && (
        <div style={{ padding: '20px' }}>
          {!suggestions && !loading && (
            <button
              onClick={handleGetSuggestions}
              disabled={loading}
              style={{
                padding: '12px 24px',
                background: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Generate Wiki Suggestions
            </button>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
              <div style={{
                display: 'inline-block',
                width: '24px',
                height: '24px',
                border: '3px solid #f3f3f3',
                borderTop: '3px solid #007bff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '10px'
              }}></div>
              <p>Analyzing meeting and generating suggestions...</p>
            </div>
          )}

          {error && (
            <div style={{
              background: '#f8d7da',
              color: '#721c24',
              padding: '15px',
              borderRadius: '6px',
              marginTop: '10px'
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              background: '#d4edda',
              color: '#155724',
              padding: '15px',
              borderRadius: '6px',
              marginBottom: '15px'
            }}>
              ✓ Wiki updated successfully! Check the Wiki tab to see changes.
            </div>
          )}

          {suggestions && !loading && (
            <div>
              {!suggestions.has_updates ? (
                <div style={{
                  background: '#fff3cd',
                  color: '#856404',
                  padding: '15px',
                  borderRadius: '6px',
                  marginBottom: '15px'
                }}>
                  No updates needed. The wiki is up to date with this meeting's content.
                </div>
              ) : (
                <>
                  {/* Overview Updates */}
                  {suggestions.overview_updates && suggestions.overview_updates.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#6366f1' }}>🎯</span>
                        Project Overview Updates ({suggestions.overview_updates.length})
                      </h4>
                      {suggestions.overview_updates.map((update, idx) => (
                        <div key={idx} style={{
                          background: '#f0f9ff',
                          border: '2px solid #6366f1',
                          borderRadius: '6px',
                          padding: '15px',
                          marginBottom: '10px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '13px', color: '#6366f1' }}>Overview</strong>
                            <span style={{
                              padding: '2px 8px',
                              background: update.action === 'add' ? '#d4edda' : update.action === 'update' ? '#fff3cd' : '#ffc107',
                              color: update.action === 'add' ? '#155724' : update.action === 'update' ? '#856404' : '#000',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}>
                              {update.action.toUpperCase()}
                            </span>
                          </div>
                          <p style={{ fontSize: '12px', color: '#6c757d', marginBottom: '10px', fontStyle: 'italic' }}>
                            📌 {update.reason}
                          </p>
                          <div style={{
                            background: '#fff',
                            padding: '12px',
                            borderRadius: '4px',
                            fontSize: '13px',
                            lineHeight: '1.6',
                            color: '#1f2937'
                          }}>
                            {update.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Changes Detected */}
                  {suggestions.changes_detected && suggestions.changes_detected.length > 0 && (
                    <div style={{
                      background: '#fff3cd',
                      border: '1px solid #ffc107',
                      borderRadius: '6px',
                      padding: '15px',
                      marginBottom: '20px'
                    }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>
                        ⚠️ Changes Detected
                      </h4>
                      {suggestions.changes_detected.map((change, idx) => (
                        <div key={idx} style={{
                          padding: '8px 12px',
                          background: '#fff',
                          borderRadius: '4px',
                          marginBottom: '8px'
                        }}>
                          <strong>{change.context}:</strong>{' '}
                          <span style={{ color: '#dc3545', textDecoration: 'line-through' }}>
                            {change.from}
                          </span>
                          {' → '}
                          <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                            {change.to}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* User Guide Updates */}
                  {suggestions.user_guide_updates && suggestions.user_guide_updates.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#007bff' }}>📖</span>
                        User Guide Updates ({suggestions.user_guide_updates.length})
                      </h4>
                      {suggestions.user_guide_updates.map((update, idx) => (
                        <div key={idx} style={{
                          background: '#f8f9fa',
                          border: '1px solid #dee2e6',
                          borderRadius: '6px',
                          padding: '15px',
                          marginBottom: '10px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '13px' }}>{update.section}</strong>
                            <span style={{
                              padding: '2px 8px',
                              background: update.action === 'add' ? '#d4edda' : '#fff3cd',
                              color: update.action === 'add' ? '#155724' : '#856404',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}>
                              {update.action.toUpperCase()}
                            </span>
                          </div>
                          <p style={{ fontSize: '12px', color: '#6c757d', marginBottom: '10px' }}>
                            {update.reason}
                          </p>
                          <div style={{
                            background: '#fff',
                            padding: '10px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            whiteSpace: 'pre-wrap',
                            overflowX: 'auto'
                          }}>
                            {update.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Technical Updates */}
                  {suggestions.technical_updates && suggestions.technical_updates.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#6c757d' }}>🔧</span>
                        Technical Documentation Updates ({suggestions.technical_updates.length})
                      </h4>
                      {suggestions.technical_updates.map((update, idx) => (
                        <div key={idx} style={{
                          background: '#f8f9fa',
                          border: '1px solid #dee2e6',
                          borderRadius: '6px',
                          padding: '15px',
                          marginBottom: '10px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '13px' }}>{update.section}</strong>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              {update.is_change && (
                                <span style={{
                                  padding: '2px 8px',
                                  background: '#ffc107',
                                  color: '#000',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold'
                                }}>
                                  CHANGE
                                </span>
                              )}
                              <span style={{
                                padding: '2px 8px',
                                background: update.action === 'add' ? '#d4edda' : '#fff3cd',
                                color: update.action === 'add' ? '#155724' : '#856404',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}>
                                {update.action.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <p style={{ fontSize: '12px', color: '#6c757d', marginBottom: '10px' }}>
                            {update.reason}
                          </p>
                          <div style={{
                            background: '#fff',
                            padding: '10px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            whiteSpace: 'pre-wrap',
                            overflowX: 'auto'
                          }}>
                            {update.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Changelog Entry */}
                  {suggestions.changelog_entry && (
                    <div style={{
                      background: '#e7f3ff',
                      border: '1px solid #b3d9ff',
                      borderRadius: '6px',
                      padding: '15px',
                      marginBottom: '20px'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
                        📝 Changelog Entry
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px' }}>
                        {suggestions.changelog_entry}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                      onClick={handleApplySuggestions}
                      disabled={applying || success}
                      style={{
                        padding: '12px 24px',
                        background: success ? '#28a745' : '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: applying || success ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        opacity: applying || success ? 0.6 : 1
                      }}
                    >
                      {applying ? 'Applying...' : success ? '✓ Applied' : '✓ Apply to Wiki'}
                    </button>
                    <button
                      onClick={handleGetSuggestions}
                      disabled={loading}
                      style={{
                        padding: '12px 24px',
                        background: '#6c757d',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      Regenerate
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default WikiUpdateSuggestions;
