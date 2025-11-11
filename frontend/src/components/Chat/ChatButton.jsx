import { useState } from 'react';
import useStore from '../../stores/useStore';

const ChatButton = () => {
  const { isChatSidebarOpen, toggleChatSidebar } = useStore();
  const [isHovered, setIsHovered] = useState(false);

  // Don't show button when sidebar is open
  if (isChatSidebarOpen) return null;

  return (
    <button
      onClick={toggleChatSidebar}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        fontSize: '28px',
        cursor: 'pointer',
        boxShadow: isHovered
          ? '0 8px 24px rgba(102, 126, 234, 0.5)'
          : '0 4px 16px rgba(102, 126, 234, 0.4)',
        zIndex: 997,
        transition: 'all 0.3s ease',
        transform: isHovered ? 'scale(1.1) translateY(-2px)' : 'scale(1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      title="Open AI Chat"
    >
      🤖

      {/* Pulse animation ring */}
      <div style={{
        position: 'absolute',
        top: '-4px',
        left: '-4px',
        right: '-4px',
        bottom: '-4px',
        borderRadius: '50%',
        border: '2px solid rgba(102, 126, 234, 0.5)',
        animation: 'pulse 2s infinite',
      }} />

      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.5;
          }
        }
      `}</style>
    </button>
  );
};

export default ChatButton;
