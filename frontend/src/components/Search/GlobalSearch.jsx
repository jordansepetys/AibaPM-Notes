import { useState, useEffect, useRef } from 'react';
import useStore from '../../stores/useStore';
import { searchAPI, meetingsAPI } from '../../services/api';

const GlobalSearch = ({ onMeetingSelect }) => {
  const { projects, setSearchQuery, selectMeeting } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [filterProjectId, setFilterProjectId] = useState('');
  const searchTimeoutRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      await performSearch(query, filterProjectId);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, filterProjectId]);

  const performSearch = async (searchQuery, projectId) => {
    try {
      const searchResults = await searchAPI.search(searchQuery, projectId || null);
      setResults(searchResults.results || []);
      setShowResults(true);
      setIsSearching(false);
      console.log(`🔍 Found ${searchResults.count} results for "${searchQuery}"`);
    } catch (error) {
      console.error('Search error:', error);
      setIsSearching(false);
      setResults([]);
    }
  };

  const handleResultClick = async (result) => {
    try {
      // Load full meeting data
      const meeting = await meetingsAPI.getById(result.meeting_id);
      selectMeeting(meeting);
      setShowResults(false);
      setQuery('');

      // Notify parent to switch to meetings tab
      if (onMeetingSelect) {
        onMeetingSelect(meeting);
      }
    } catch (error) {
      console.error('Error loading meeting:', error);
    }
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'Unknown';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const highlightMatch = (text, maxLength = 150) => {
    if (!text) return '';

    // Truncate if too long
    let truncated = text.length > maxLength
      ? text.substring(0, maxLength) + '...'
      : text;

    // Simple highlight (could be improved with regex)
    return truncated;
  };

  return (
    <div ref={searchContainerRef} style={{ position: 'relative', flex: 1, maxWidth: '500px' }}>
      <div style={{ display: 'flex', gap: '10px' }}>
        {/* Search Input */}
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length >= 2 && setShowResults(true)}
            placeholder="🔍 Search meetings..."
            style={{
              width: '100%',
              padding: '10px 40px 10px 15px',
              fontSize: '14px',
              border: '1px solid #ced4da',
              borderRadius: '6px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
          />

          {isSearching && (
            <div style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '16px',
              height: '16px',
              border: '2px solid #007bff',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          )}

          {query && !isSearching && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
                setShowResults(false);
              }}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#6c757d'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Project Filter */}
        {projects.length > 1 && (
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            style={{
              padding: '10px',
              fontSize: '14px',
              border: '1px solid #ced4da',
              borderRadius: '6px',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            <option value="">All Projects</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '5px',
          background: '#fff',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxHeight: '400px',
          overflowY: 'auto',
          zIndex: 1000
        }}>
          {results.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#6c757d'
            }}>
              {query.length < 2 ? 'Type at least 2 characters to search' : 'No results found'}
            </div>
          ) : (
            <>
              <div style={{
                padding: '10px 15px',
                background: '#f8f9fa',
                borderBottom: '1px solid #dee2e6',
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#495057'
              }}>
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </div>
              {results.map((result, index) => (
                <div
                  key={index}
                  onClick={() => handleResultClick(result)}
                  style={{
                    padding: '12px 15px',
                    borderBottom: index < results.length - 1 ? '1px solid #f0f0f0' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    fontWeight: '500',
                    fontSize: '14px',
                    marginBottom: '4px',
                    color: '#212529'
                  }}>
                    {result.title}
                  </div>

                  <div style={{
                    fontSize: '12px',
                    color: '#6c757d',
                    marginBottom: '6px',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    <span>📁 {getProjectName(result.project_id)}</span>
                    <span>📅 {formatDate(result.date)}</span>
                    <span>🎯 Score: {result.rank}</span>
                  </div>

                  {result.content && (
                    <div style={{
                      fontSize: '13px',
                      color: '#495057',
                      lineHeight: '1.4',
                      fontStyle: 'italic'
                    }}>
                      "{highlightMatch(result.content)}"
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: translateY(-50%) rotate(0deg); }
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default GlobalSearch;
