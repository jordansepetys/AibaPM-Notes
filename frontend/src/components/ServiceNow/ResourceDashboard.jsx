import { useState, useEffect } from 'react';
import { serviceNowAPI } from '../../services/api';
import './ServiceNow.css';

export default function ResourceDashboard() {
  const [summary, setSummary] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [workItems, setWorkItems] = useState({ projects: [], demands: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [editingAllocation, setEditingAllocation] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryData, allocationsData, workItemsData] = await Promise.all([
        serviceNowAPI.getResourceSummary(),
        serviceNowAPI.getResources(),
        serviceNowAPI.getWorkItems()
      ]);

      setSummary(summaryData);
      setAllocations(allocationsData);
      setWorkItems(workItemsData);
    } catch (err) {
      console.error('Failed to load ServiceNow data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateHours = async (sysId, currentHours) => {
    const newHours = prompt(`Update allocated hours (current: ${currentHours}):`, currentHours);
    if (newHours === null) return;

    const hours = parseFloat(newHours);
    if (isNaN(hours) || hours < 0) {
      alert('Please enter a valid number of hours');
      return;
    }

    try {
      setEditingAllocation(sysId);
      await serviceNowAPI.updateAllocationHours(sysId, hours);
      alert('Hours updated successfully');
      loadData(); // Refresh data
    } catch (error) {
      alert('Failed to update hours: ' + error.message);
    } finally {
      setEditingAllocation(null);
    }
  };

  if (loading) {
    return (
      <div className="resource-dashboard">
        <h2>Resource Dashboard</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="resource-dashboard">
        <h2>Resource Dashboard</h2>
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="resource-dashboard">
      <div className="dashboard-header">
        <h2>ServiceNow Resource Dashboard</h2>
        <button className="refresh-button" onClick={loadData}>
          ↻ Refresh
        </button>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <button
          className={`tab ${activeTab === 'allocations' ? 'active' : ''}`}
          onClick={() => setActiveTab('allocations')}
        >
          Allocations ({allocations.length})
        </button>
        <button
          className={`tab ${activeTab === 'work-items' ? 'active' : ''}`}
          onClick={() => setActiveTab('work-items')}
        >
          Work Items ({workItems.total})
        </button>
      </div>

      {activeTab === 'summary' && (
        <div className="tab-content">
          <div className="summary-grid">
            <div className="summary-card">
              <h3>Total Hours</h3>
              <div className="stat-value">{summary?.totalHours?.toFixed(1) || 0}</div>
            </div>
            <div className="summary-card">
              <h3>Hard Commitments</h3>
              <div className="stat-value hard">{summary?.hardCommitments?.toFixed(1) || 0}</div>
            </div>
            <div className="summary-card">
              <h3>Soft Commitments</h3>
              <div className="stat-value soft">{summary?.softCommitments?.toFixed(1) || 0}</div>
            </div>
            <div className="summary-card">
              <h3>Allocations</h3>
              <div className="stat-value">{summary?.allocationCount || 0}</div>
            </div>
          </div>

          {summary?.dateRange?.earliest && (
            <div className="date-range">
              <p>
                <strong>Date Range:</strong> {summary.dateRange.earliest} to {summary.dateRange.latest}
              </p>
            </div>
          )}

          {summary?.byProject && Object.keys(summary.byProject).length > 0 && (
            <div className="projects-summary">
              <h3>Hours by Project</h3>
              <div className="projects-list">
                {Object.values(summary.byProject).map((project) => (
                  <div key={project.number} className="project-item">
                    <div className="project-info">
                      <strong>{project.number}</strong> - {project.description}
                    </div>
                    <div className="project-hours">
                      {project.totalHours.toFixed(1)} hours
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'allocations' && (
        <div className="tab-content">
          {allocations.length === 0 ? (
            <p className="no-data">No resource allocations found.</p>
          ) : (
            <div className="allocations-list">
              {allocations.map((allocation) => (
                <div key={allocation.sysId} className="allocation-card">
                  <div className="allocation-header">
                    <span className={`booking-type ${allocation.bookingType.toLowerCase()}`}>
                      {allocation.bookingType}
                    </span>
                    <span className="allocation-hours">{allocation.allocatedHours} hours</span>
                  </div>
                  <div className="allocation-dates">
                    {allocation.startDate} → {allocation.endDate}
                  </div>
                  {allocation.project && (
                    <div className="allocation-project">
                      <strong>{allocation.project.number}</strong> - {allocation.project.description}
                    </div>
                  )}
                  {allocation.resourcePlan?.description && (
                    <div className="allocation-plan">
                      Plan: {allocation.resourcePlan.description}
                    </div>
                  )}
                  <button
                    className="edit-hours-button"
                    onClick={() => handleUpdateHours(allocation.sysId, allocation.allocatedHours)}
                    disabled={editingAllocation === allocation.sysId}
                  >
                    {editingAllocation === allocation.sysId ? 'Updating...' : 'Update Hours'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'work-items' && (
        <div className="tab-content">
          {workItems.projects.length > 0 && (
            <div className="work-items-section">
              <h3>Projects ({workItems.projects.length})</h3>
              <div className="work-items-list">
                {workItems.projects.map((project) => (
                  <div key={project.sysId} className="work-item-card project">
                    <div className="work-item-header">
                      <strong>{project.number}</strong>
                      <span className="work-item-state">{project.state}</span>
                    </div>
                    <div className="work-item-title">{project.title}</div>
                    {project.description && (
                      <div className="work-item-description">{project.description}</div>
                    )}
                    {project.startDate && (
                      <div className="work-item-dates">
                        {project.startDate} → {project.endDate}
                      </div>
                    )}
                    {project.percentComplete !== undefined && (
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${project.percentComplete}%` }}
                        />
                        <span className="progress-label">{project.percentComplete}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {workItems.demands.length > 0 && (
            <div className="work-items-section">
              <h3>Demands ({workItems.demands.length})</h3>
              <div className="work-items-list">
                {workItems.demands.map((demand) => (
                  <div key={demand.sysId} className="work-item-card demand">
                    <div className="work-item-header">
                      <strong>{demand.number}</strong>
                      <span className="work-item-state">{demand.state}</span>
                    </div>
                    <div className="work-item-title">{demand.title}</div>
                    {demand.description && (
                      <div className="work-item-description">{demand.description}</div>
                    )}
                    {demand.requestedBy && (
                      <div className="work-item-meta">
                        Requested by: {demand.requestedBy}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {workItems.total === 0 && (
            <p className="no-data">No projects or demands found.</p>
          )}
        </div>
      )}
    </div>
  );
}
