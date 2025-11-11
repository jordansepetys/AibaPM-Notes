import useStore from '../../stores/useStore';

const RecordingStatus = () => {
  const { isRecording, status, errorMessage, clearError } = useStore();

  const getStatusConfig = () => {
    if (isRecording) {
      return {
        color: '#dc3545',
        bgColor: '#f8d7da',
        borderColor: '#f5c6cb',
        icon: '🔴',
        text: 'Recording in progress...',
        showSpinner: false,
      };
    }

    switch (status) {
      case 'processing':
        return {
          color: '#ffc107',
          bgColor: '#fff3cd',
          borderColor: '#ffeeba',
          icon: '⏳',
          text: errorMessage || 'Processing recording...',
          showSpinner: true,
        };
      case 'success':
        return {
          color: '#28a745',
          bgColor: '#d4edda',
          borderColor: '#c3e6cb',
          icon: '✅',
          text: errorMessage || 'Success!',
          showSpinner: false,
        };
      case 'error':
        return {
          color: '#dc3545',
          bgColor: '#f8d7da',
          borderColor: '#f5c6cb',
          icon: '❌',
          text: errorMessage || 'An error occurred',
          showSpinner: false,
        };
      default:
        return {
          color: '#28a745',
          bgColor: '#d4edda',
          borderColor: '#c3e6cb',
          icon: '✓',
          text: 'Ready to record',
          showSpinner: false,
        };
    }
  };

  const config = getStatusConfig();

  // Don't show status bar if idle and not recording
  if (status === 'idle' && !isRecording) {
    return null;
  }

  return (
    <div
      style={{
        padding: '15px 20px',
        background: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        borderRadius: '4px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: config.color,
        fontWeight: '500',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>{config.icon}</span>
        <span>{config.text}</span>
        {config.showSpinner && (
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid ' + config.color,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        )}
      </div>

      {status === 'error' && (
        <button
          onClick={clearError}
          style={{
            background: 'transparent',
            border: 'none',
            color: config.color,
            cursor: 'pointer',
            fontSize: '18px',
            padding: '0',
          }}
        >
          ✕
        </button>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default RecordingStatus;
