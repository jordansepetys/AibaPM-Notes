import { useState, useEffect } from 'react';
import useStore from '../../stores/useStore';
import { milestonesAPI, meetingsAPI } from '../../services/api';

const MILESTONE_TYPES = {
  demo: { icon: '🎯', label: 'Demo', color: '#667eea' },
  deadline: { icon: '📍', label: 'Deadline', color: '#e74c3c' },
  launch: { icon: '🚀', label: 'Launch', color: '#27ae60' },
  meeting: { icon: '📅', label: 'Meeting', color: '#3498db' },
  checkpoint: { icon: '📋', label: 'Checkpoint', color: '#9b59b6' },
};

const RoadmapTimeline = () => {
  const { projects, selectedProject, selectProject, meetings, setStatus, milestones, setMilestones, addMilestone, updateMilestone, deleteMilestone } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'calendar'
  const [calendarDate, setCalendarDate] = useState(new Date()); // Current month being viewed
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    milestoneDate: '',
    milestoneType: 'deadline',
    status: 'upcoming',
  });

  // Load milestones when project changes
  useEffect(() => {
    if (selectedProject) {
      loadMilestones(selectedProject.id);
    }
  }, [selectedProject]);

  const loadMilestones = async (projectId) => {
    try {
      setIsLoading(true);
      const data = await milestonesAPI.getAll(projectId);
      setMilestones(data);
    } catch (error) {
      console.error('Error loading milestones:', error);
      setStatus('error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      if (editingMilestone) {
        const result = await milestonesAPI.update(editingMilestone.id, formData);
        updateMilestone(editingMilestone.id, result.milestone);
      } else {
        const result = await milestonesAPI.create({
          ...formData,
          projectId: selectedProject.id,
        });
        addMilestone(result.milestone);
      }
      resetForm();
    } catch (error) {
      console.error('Error saving milestone:', error);
      setStatus('error', error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this milestone?')) return;
    try {
      await milestonesAPI.delete(id);
      deleteMilestone(id);
    } catch (error) {
      console.error('Error deleting milestone:', error);
      setStatus('error', error.message);
    }
  };

  const handleEdit = (milestone) => {
    setEditingMilestone(milestone);
    setFormData({
      title: milestone.title,
      description: milestone.description || '',
      milestoneDate: milestone.milestone_date,
      milestoneType: milestone.milestone_type,
      status: milestone.status,
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      milestoneDate: '',
      milestoneType: 'deadline',
      status: 'upcoming',
    });
    setEditingMilestone(null);
    setShowAddForm(false);
  };

  const toggleStatus = async (milestone) => {
    const newStatus = milestone.status === 'completed' ? 'upcoming' : 'completed';
    try {
      const result = await milestonesAPI.update(milestone.id, { status: newStatus });
      updateMilestone(milestone.id, result.milestone);
    } catch (error) {
      console.error('Error updating milestone:', error);
    }
  };

  // Combine milestones with past meetings for timeline
  const getTimelineItems = () => {
    const items = [];

    // Add milestones
    milestones.forEach((m) => {
      items.push({
        id: `milestone-${m.id}`,
        type: 'milestone',
        data: m,
        date: new Date(m.milestone_date),
        icon: MILESTONE_TYPES[m.milestone_type]?.icon || '📍',
        color: MILESTONE_TYPES[m.milestone_type]?.color || '#667eea',
        title: m.title,
        status: m.status,
      });
    });

    // Add past meetings from this project
    const projectMeetings = meetings.filter((m) => m.project_id === selectedProject?.id);
    projectMeetings.forEach((m) => {
      items.push({
        id: `meeting-${m.id}`,
        type: 'meeting',
        data: m,
        date: new Date(m.date),
        icon: '📅',
        color: '#3498db',
        title: m.title,
        status: 'completed',
      });
    });

    // Sort by date
    items.sort((a, b) => a.date - b.date);
    return items;
  };

  const timelineItems = selectedProject ? getTimelineItems() : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the "today" position in the timeline
  const pastItems = timelineItems.filter((item) => item.date < today);
  const futureItems = timelineItems.filter((item) => item.date >= today);

  if (!selectedProject) {
    return (
      <div className="glass-card" style={{
        padding: '60px 20px',
        textAlign: 'center',
        color: '#6c757d'
      }}>
        <p style={{ fontSize: '64px', margin: '0 0 20px 0' }}>🗺️</p>
        <h3 style={{ margin: '0 0 20px 0' }}>No Project Selected</h3>
        <p style={{ margin: '0 0 20px 0' }}>Select a project to view its roadmap</p>

        {projects.length > 0 && (
          <select
            onChange={(e) => {
              const project = projects.find(p => p.id === parseInt(e.target.value));
              if (project) selectProject(project);
            }}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              background: '#fff',
              minWidth: '250px'
            }}
          >
            <option value="">Select a project...</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card" style={{
      overflow: 'hidden',
      height: 'calc(100vh - 250px)',
      minHeight: '600px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '15px 20px',
        borderBottom: '1px solid #dee2e6',
        background: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '15px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            🗺️ Roadmap
          </h2>

          {/* Project Selector */}
          {projects.length > 0 && (
            <select
              value={selectedProject?.id || ''}
              onChange={(e) => {
                const project = projects.find(p => p.id === parseInt(e.target.value));
                if (project) selectProject(project);
              }}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                background: '#fff',
                minWidth: '200px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View Mode Toggle */}
          <div style={{
            display: 'flex',
            gap: '4px',
            background: '#fff',
            borderRadius: '6px',
            padding: '4px',
            border: '1px solid #ced4da'
          }}>
            <button
              onClick={() => setViewMode('timeline')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                border: 'none',
                borderRadius: '4px',
                background: viewMode === 'timeline' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                color: viewMode === 'timeline' ? '#fff' : '#6c757d',
                cursor: 'pointer',
                fontWeight: viewMode === 'timeline' ? 'bold' : 'normal',
                transition: 'all 0.2s ease'
              }}
            >
              📋 Timeline
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                border: 'none',
                borderRadius: '4px',
                background: viewMode === 'calendar' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                color: viewMode === 'calendar' ? '#fff' : '#6c757d',
                cursor: 'pointer',
                fontWeight: viewMode === 'calendar' ? 'bold' : 'normal',
                transition: 'all 0.2s ease'
              }}
            >
              📅 Calendar
            </button>
          </div>

          <button
            onClick={() => setShowAddForm(true)}
            className="btn-gradient"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            + Add Milestone
          </button>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ margin: '0 0 20px 0' }}>
              {editingMilestone ? 'Edit Milestone' : 'Add Milestone'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                  placeholder="e.g., Beta Launch, Demo with Client"
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Date</label>
                <input
                  type="date"
                  value={formData.milestoneDate}
                  onChange={(e) => setFormData({ ...formData, milestoneDate: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Type</label>
                <select
                  value={formData.milestoneType}
                  onChange={(e) => setFormData({ ...formData, milestoneType: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  {Object.entries(MILESTONE_TYPES).map(([key, { icon, label }]) => (
                    <option key={key} value={key}>{icon} {label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Description (optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                  placeholder="Add notes or details..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gradient"
                  style={{ padding: '10px 20px' }}
                >
                  {editingMilestone ? 'Update' : 'Add'} Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
            Loading...
          </div>
        ) : timelineItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6c757d' }}>
            <p style={{ fontSize: '48px', margin: '0 0 15px 0' }}>🗺️</p>
            <h3 style={{ margin: '0 0 10px 0' }}>No milestones yet</h3>
            <p>Add milestones to track your project's journey</p>
            <p style={{ fontSize: '13px', marginTop: '20px' }}>
              Tip: Use the chat to add milestones naturally!<br />
              Try: "Add demo with client on January 15th"
            </p>
          </div>
        ) : viewMode === 'timeline' ? (
          /* Timeline View */
          <div style={{ position: 'relative' }}>
            {/* Timeline Line */}
            <div style={{
              position: 'absolute',
              left: '20px',
              top: '0',
              bottom: '0',
              width: '3px',
              background: 'linear-gradient(to bottom, #dee2e6, #667eea, #dee2e6)',
              borderRadius: '3px',
            }} />

            {/* Past Items */}
            {pastItems.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  marginLeft: '50px',
                  marginBottom: '15px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#6c757d',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}>
                  Past
                </div>
                {pastItems.map((item) => (
                  <TimelineItem
                    key={item.id}
                    item={item}
                    onEdit={item.type === 'milestone' ? () => handleEdit(item.data) : null}
                    onDelete={item.type === 'milestone' ? () => handleDelete(item.data.id) : null}
                    onToggleStatus={item.type === 'milestone' ? () => toggleStatus(item.data) : null}
                    isPast={true}
                  />
                ))}
              </div>
            )}

            {/* Today Marker */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '25px 0',
              position: 'relative',
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                zIndex: 1,
              }}>
                📍
              </div>
              <div style={{
                marginLeft: '15px',
                fontWeight: 'bold',
                color: '#667eea',
                fontSize: '14px',
              }}>
                TODAY - {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
            </div>

            {/* Future Items */}
            {futureItems.length > 0 && (
              <div>
                <div style={{
                  marginLeft: '50px',
                  marginBottom: '15px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#6c757d',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}>
                  Upcoming
                </div>
                {futureItems.map((item) => (
                  <TimelineItem
                    key={item.id}
                    item={item}
                    onEdit={item.type === 'milestone' ? () => handleEdit(item.data) : null}
                    onDelete={item.type === 'milestone' ? () => handleDelete(item.data.id) : null}
                    onToggleStatus={item.type === 'milestone' ? () => toggleStatus(item.data) : null}
                    isPast={false}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Calendar/Gantt View */
          <CalendarView
            items={timelineItems}
            calendarDate={calendarDate}
            setCalendarDate={setCalendarDate}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleStatus={toggleStatus}
          />
        )}
      </div>

      {/* Legend */}
      <div style={{
        padding: '12px 20px',
        background: '#f8f9fa',
        borderTop: '1px solid #dee2e6',
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap',
        fontSize: '12px',
        color: '#6c757d',
      }}>
        {Object.entries(MILESTONE_TYPES).map(([key, { icon, label, color }]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: color,
            }} />
            {icon} {label}
          </span>
        ))}
      </div>
    </div>
  );
};

// Timeline Item Component
const TimelineItem = ({ item, onEdit, onDelete, onToggleStatus, isPast }) => {
  const [showActions, setShowActions] = useState(false);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const isCompleted = item.status === 'completed';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        marginBottom: '20px',
        position: 'relative',
        opacity: isPast && !isCompleted ? 0.6 : 1,
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Icon */}
      <div
        onClick={onToggleStatus}
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          background: isCompleted ? '#27ae60' : item.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0,
          cursor: onToggleStatus ? 'pointer' : 'default',
          transition: 'transform 0.2s, box-shadow 0.2s',
          boxShadow: isCompleted ? '0 2px 8px rgba(39, 174, 96, 0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 1,
        }}
        title={onToggleStatus ? 'Click to toggle status' : undefined}
      >
        {isCompleted ? '✓' : item.icon}
      </div>

      {/* Content */}
      <div style={{
        marginLeft: '15px',
        flex: 1,
        background: '#fff',
        borderRadius: '8px',
        padding: '12px 15px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        border: isCompleted ? '1px solid #27ae60' : '1px solid #dee2e6',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontWeight: 'bold',
              fontSize: '14px',
              textDecoration: isCompleted ? 'line-through' : 'none',
              color: isCompleted ? '#6c757d' : '#212529',
            }}>
              {item.title}
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
              {formatDate(item.date)}
              {item.type === 'meeting' && <span style={{ marginLeft: '8px', color: '#3498db' }}>• Meeting</span>}
            </div>
            {item.data?.description && (
              <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '8px' }}>
                {item.data.description}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {showActions && onEdit && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={onEdit}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
              <button
                onClick={onDelete}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  border: '1px solid #e74c3c',
                  borderRadius: '4px',
                  background: '#fff',
                  color: '#e74c3c',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Calendar/Gantt View Component
const CalendarView = ({ items, calendarDate, setCalendarDate, onEdit, onDelete, onToggleStatus }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get days in month
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  // Create array of days
  const days = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null); // Empty slots before first day
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  // Get items for a specific day
  const getItemsForDay = (day) => {
    if (!day) return [];
    const date = new Date(year, month, day);
    return items.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate.getFullYear() === date.getFullYear() &&
             itemDate.getMonth() === date.getMonth() &&
             itemDate.getDate() === date.getDate();
    });
  };

  // Navigate months
  const prevMonth = () => {
    setCalendarDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCalendarDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCalendarDate(new Date());
  };

  const isToday = (day) => {
    if (!day) return false;
    return today.getFullYear() === year &&
           today.getMonth() === month &&
           today.getDate() === day;
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      {/* Calendar Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        padding: '10px 0',
      }}>
        <button
          onClick={prevMonth}
          style={{
            padding: '8px 16px',
            border: '1px solid #ced4da',
            borderRadius: '6px',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          ‹ Prev
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={goToToday}
            style={{
              padding: '6px 12px',
              border: '1px solid #667eea',
              borderRadius: '4px',
              background: '#fff',
              color: '#667eea',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            Today
          </button>
        </div>

        <button
          onClick={nextMonth}
          style={{
            padding: '8px 16px',
            border: '1px solid #ced4da',
            borderRadius: '6px',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Next ›
        </button>
      </div>

      {/* Calendar Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        background: '#dee2e6',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #dee2e6',
      }}>
        {/* Week day headers */}
        {weekDays.map(day => (
          <div key={day} style={{
            padding: '12px 8px',
            background: '#f8f9fa',
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '12px',
            color: '#6c757d',
            textTransform: 'uppercase',
          }}>
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((day, index) => {
          const dayItems = getItemsForDay(day);
          const dayIsToday = isToday(day);

          return (
            <div
              key={index}
              style={{
                minHeight: '100px',
                padding: '8px',
                background: dayIsToday ? '#f0f4ff' : '#fff',
                position: 'relative',
                borderLeft: dayIsToday ? '3px solid #667eea' : 'none',
              }}
            >
              {day && (
                <>
                  {/* Day number */}
                  <div style={{
                    fontSize: '14px',
                    fontWeight: dayIsToday ? 'bold' : 'normal',
                    color: dayIsToday ? '#667eea' : '#495057',
                    marginBottom: '6px',
                  }}>
                    {day}
                    {dayIsToday && (
                      <span style={{
                        marginLeft: '6px',
                        fontSize: '10px',
                        background: '#667eea',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '10px',
                      }}>
                        TODAY
                      </span>
                    )}
                  </div>

                  {/* Items for this day */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {dayItems.map(item => (
                      <CalendarItem
                        key={item.id}
                        item={item}
                        onEdit={item.type === 'milestone' ? () => onEdit(item.data) : null}
                        onDelete={item.type === 'milestone' ? () => onDelete(item.data.id) : null}
                        onToggleStatus={item.type === 'milestone' ? () => onToggleStatus(item.data) : null}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Upcoming items summary */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: '#f8f9fa',
        borderRadius: '8px',
      }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#6c757d' }}>
          This Month's Events ({items.filter(item => {
            const d = new Date(item.date);
            return d.getMonth() === month && d.getFullYear() === year;
          }).length})
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {items
            .filter(item => {
              const d = new Date(item.date);
              return d.getMonth() === month && d.getFullYear() === year;
            })
            .sort((a, b) => a.date - b.date)
            .map(item => (
              <span
                key={item.id}
                style={{
                  padding: '4px 10px',
                  background: item.status === 'completed' ? '#e8f5e9' : item.color + '20',
                  border: `1px solid ${item.status === 'completed' ? '#27ae60' : item.color}`,
                  borderRadius: '20px',
                  fontSize: '12px',
                  color: item.status === 'completed' ? '#27ae60' : item.color,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {item.icon} {item.title} ({new Date(item.date).getDate()})
              </span>
            ))
          }
        </div>
      </div>
    </div>
  );
};

// Calendar Item Component (compact for calendar cells)
const CalendarItem = ({ item, onEdit, onDelete, onToggleStatus }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isCompleted = item.status === 'completed';

  return (
    <div
      style={{
        padding: '4px 8px',
        borderRadius: '4px',
        background: isCompleted ? '#e8f5e9' : item.color + '20',
        borderLeft: `3px solid ${isCompleted ? '#27ae60' : item.color}`,
        fontSize: '11px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onToggleStatus}
      title={`${item.title}${item.data?.description ? '\n' + item.data.description : ''}`}
    >
      <span style={{
        textDecoration: isCompleted ? 'line-through' : 'none',
        color: isCompleted ? '#6c757d' : '#495057',
      }}>
        {item.icon} {item.title}
      </span>

      {/* Tooltip on hover */}
      {showTooltip && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          zIndex: 100,
          background: '#fff',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          padding: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          minWidth: '180px',
          marginTop: '4px',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{item.title}</div>
          {item.data?.description && (
            <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '8px' }}>
              {item.data.description}
            </div>
          )}
          {onEdit && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '3px',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  border: '1px solid #e74c3c',
                  borderRadius: '3px',
                  background: '#fff',
                  color: '#e74c3c',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RoadmapTimeline;
