import { useEffect, useState, useRef } from 'react';
import useStore from '../../stores/useStore';
import AIChat from './AIChat';

const ChatSidebar = () => {
  const { isChatSidebarOpen, setChatSidebarOpen } = useStore();

  // Get initial width from localStorage or default to 33%
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('chatPanelWidth');
    return saved ? parseInt(saved) : Math.floor(window.innerWidth * 0.33);
  });

  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);

  // Save width to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('chatPanelWidth', panelWidth.toString());
  }, [panelWidth]);

  // Handle resize drag
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;

      // Calculate new width (mouse X position = panel width)
      const newWidth = e.clientX;

      // Constrain between 250px and 60% of screen width
      const minWidth = 250;
      const maxWidth = window.innerWidth * 0.6;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Collapse to narrow bar when closed
  const effectiveWidth = isChatSidebarOpen ? panelWidth : 50;

  return (
    <>
      {/* Semi-transparent backdrop when chat is open (optional dimming) */}
      {isChatSidebarOpen && (
        <div
          onClick={() => {
            // Optional: click backdrop to close chat
            // setChatSidebarOpen(false);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.15)',
            zIndex: 998,
            transition: 'opacity 0.3s ease-out',
            pointerEvents: 'none', // Allow clicking through to content behind
          }}
        />
      )}

      {/* Permanent Left Panel - Overlay with Glassmorphism */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: `${effectiveWidth}px`,
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '4px 0 32px rgba(99, 102, 241, 0.15)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          transition: isResizing ? 'none' : 'width 0.3s ease-out',
          borderRight: '2px solid rgba(99, 102, 241, 0.1)',
        }}
      >
        {/* Header with New Gradient */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
        }}>
          {isChatSidebarOpen ? (
            <>
              <div style={{ overflow: 'hidden' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  🤖 AI Mentor
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.9, whiteSpace: 'nowrap' }}>
                  Your project companion
                </p>
              </div>
              <button
                onClick={() => setChatSidebarOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.25)',
                  border: 'none',
                  color: 'white',
                  fontSize: '24px',
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.4)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                  e.target.style.transform = 'scale(1)';
                }}
                title="Collapse chat panel"
              >
                ‹
              </button>
            </>
          ) : (
            <button
              onClick={() => setChatSidebarOpen(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '24px',
                cursor: 'pointer',
                padding: 0,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Expand chat panel"
            >
              ›
            </button>
          )}
        </div>

        {/* Chat Content */}
        {isChatSidebarOpen && (
          <div style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <AIChat isSidebar={true} />
          </div>
        )}

        {/* Vertical Text when Collapsed */}
        {!isChatSidebarOpen && (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontSize: '14px',
            fontWeight: '600',
            color: '#667eea',
            letterSpacing: '2px',
            cursor: 'pointer',
          }}
          onClick={() => setChatSidebarOpen(true)}
          >
            AI MENTOR
          </div>
        )}

        {/* Resize Handle */}
        {isChatSidebarOpen && (
          <div
            onMouseDown={() => setIsResizing(true)}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '5px',
              cursor: 'col-resize',
              background: 'transparent',
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)';
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
            title="Drag to resize"
          />
        )}
      </div>

      {/* CSS for hover effects */}
      <style>{`
        @media (max-width: 768px) {
          /* On mobile, make collapsed panel even narrower */
        }
      `}</style>
    </>
  );
};

export default ChatSidebar;
