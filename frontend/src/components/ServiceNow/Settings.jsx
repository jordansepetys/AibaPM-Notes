import { useState, useEffect } from 'react';
import { serviceNowAPI } from '../../services/api';
import './ServiceNow.css';

export default function Settings() {
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await serviceNowAPI.getStatus();
      setStatus(data);
    } catch (error) {
      console.error('Failed to load ServiceNow status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await serviceNowAPI.testConnection();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error.message || 'Connection test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClearCache = async () => {
    try {
      await serviceNowAPI.clearCache();
      alert('Cache cleared successfully');
    } catch (error) {
      alert('Failed to clear cache: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="servicenow-settings">
        <h2>ServiceNow Settings</h2>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="servicenow-settings">
      <h2>ServiceNow Integration Settings</h2>

      <div className="settings-section">
        <h3>Configuration Status</h3>
        <div className="status-card">
          <div className="status-row">
            <span className="status-label">Status:</span>
            <span className={`status-value ${status?.configured ? 'configured' : 'not-configured'}`}>
              {status?.configured ? '✓ Configured' : '✗ Not Configured'}
            </span>
          </div>

          {status?.configured && (
            <>
              <div className="status-row">
                <span className="status-label">Instance URL:</span>
                <span className="status-value">{status.instanceUrl}</span>
              </div>
              <div className="status-row">
                <span className="status-label">Username:</span>
                <span className="status-value">{status.username}</span>
              </div>
            </>
          )}

          {!status?.configured && (
            <div className="setup-instructions">
              <p>ServiceNow is not configured. To set up:</p>
              <ol>
                <li>Add the following to your <code>backend/.env</code> file:</li>
                <pre>
                  {`SERVICENOW_INSTANCE_URL=your_instance.service-now.com
SERVICENOW_CLIENT_ID=your_oauth_client_id
SERVICENOW_CLIENT_SECRET=your_oauth_client_secret
SERVICENOW_USERNAME_FIELD=your.username`}
                </pre>
                <li>Restart the backend server</li>
                <li>Refresh this page</li>
              </ol>
              <p className="help-text">
                Need help? See the <a href="https://developer.servicenow.com" target="_blank" rel="noopener noreferrer">
                  ServiceNow Developer Portal
                </a> for setting up OAuth and API access.
              </p>
            </div>
          )}
        </div>
      </div>

      {status?.configured && (
        <>
          <div className="settings-section">
            <h3>Connection Test</h3>
            <button
              className="test-button"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>

            {testResult && (
              <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                <p className="test-message">
                  {testResult.success ? '✓' : '✗'} {testResult.message}
                </p>
                {testResult.error && (
                  <pre className="error-details">{JSON.stringify(testResult.error, null, 2)}</pre>
                )}
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3>Cache Management</h3>
            <p className="help-text">
              Resource data is cached for 15 minutes to improve performance and reduce API calls.
            </p>
            <button
              className="clear-cache-button"
              onClick={handleClearCache}
            >
              Clear Cache
            </button>
          </div>

          <div className="settings-section">
            <h3>Features</h3>
            <ul className="features-list">
              <li>✓ View resource allocations and commitments</li>
              <li>✓ View assigned projects and demands</li>
              <li>✓ Link meetings to ServiceNow projects/demands</li>
              <li>✓ Update resource hours directly from the app</li>
              <li>✓ AI mentor with ServiceNow context (coming soon)</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
