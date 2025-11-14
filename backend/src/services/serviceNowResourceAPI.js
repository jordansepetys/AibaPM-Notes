import serviceNowService from './serviceNowService.js';

/**
 * ServiceNow Resource Planning API
 * High-level methods for resource management, projects, and demands
 */
class ServiceNowResourceAPI {
  /**
   * Get user's resource allocations
   * @param {string} username - ServiceNow username (optional, uses config default)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Resource allocations
   */
  async getUserAllocations(username = null, options = {}) {
    const user = username || serviceNowService.getUsername();

    if (!user) {
      throw new Error('Username not provided and SERVICENOW_USERNAME_FIELD not configured');
    }

    const {
      bookingType = null, // 'HARD', 'SOFT', or null for both
      startDate = null,
      endDate = null,
      includeDetails = true
    } = options;

    // Build query
    let query = `user.name=${user}`;
    if (bookingType) {
      query += `^booking_type=${bookingType}`;
    }
    if (startDate) {
      query += `^end_date>=${startDate}`;
    }
    if (endDate) {
      query += `^start_date<=${endDate}`;
    }

    const params = {
      sysparm_query: query,
      sysparm_display_value: 'true',
      sysparm_limit: options.limit || 100
    };

    if (includeDetails) {
      params.sysparm_fields = 'sys_id,allocated_hours,start_date,end_date,booking_type,resource_plan,resource_plan.short_description,resource_plan.task,resource_plan.task.number,resource_plan.task.short_description';
    }

    const allocations = await serviceNowService.get('resource_allocation', params);

    // Format response
    return allocations.map(allocation => ({
      sysId: allocation.sys_id,
      allocatedHours: parseFloat(allocation.allocated_hours) || 0,
      startDate: allocation.start_date,
      endDate: allocation.end_date,
      bookingType: allocation.booking_type,
      resourcePlan: {
        sysId: allocation.resource_plan?.value || null,
        description: allocation.resource_plan?.display_value || null
      },
      project: allocation['resource_plan.task']?.value ? {
        sysId: allocation['resource_plan.task'].value,
        number: allocation['resource_plan.task.number'],
        description: allocation['resource_plan.task.short_description']
      } : null
    }));
  }

  /**
   * Get user's assigned projects
   * @param {string} username - ServiceNow username (optional)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Projects
   */
  async getUserProjects(username = null, options = {}) {
    const user = username || serviceNowService.getUsername();

    if (!user) {
      throw new Error('Username not provided and SERVICENOW_USERNAME_FIELD not configured');
    }

    const {
      state = null, // Filter by state (e.g., 'active', 'closed')
      includeCompleted = false
    } = options;

    // Build query
    let query = `project_manager.name=${user}`;
    if (state) {
      query += `^state=${state}`;
    } else if (!includeCompleted) {
      query += `^state!=closed^state!=cancelled`;
    }

    const params = {
      sysparm_query: query,
      sysparm_display_value: 'true',
      sysparm_fields: 'sys_id,number,short_description,description,state,start_date,end_date,percent_complete,project_manager',
      sysparm_limit: options.limit || 100
    };

    const projects = await serviceNowService.get('pm_project', params);

    // Format response
    return projects.map(project => ({
      sysId: project.sys_id,
      number: project.number,
      title: project.short_description,
      description: project.description,
      state: project.state,
      startDate: project.start_date,
      endDate: project.end_date,
      percentComplete: parseFloat(project.percent_complete) || 0,
      projectManager: project.project_manager?.display_value || null,
      type: 'project'
    }));
  }

  /**
   * Get user's assigned demands
   * @param {string} username - ServiceNow username (optional)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Demands
   */
  async getUserDemands(username = null, options = {}) {
    const user = username || serviceNowService.getUsername();

    if (!user) {
      throw new Error('Username not provided and SERVICENOW_USERNAME_FIELD not configured');
    }

    const {
      state = null,
      includeCompleted = false
    } = options;

    // Build query
    let query = `assigned_to.name=${user}`;
    if (state) {
      query += `^state=${state}`;
    } else if (!includeCompleted) {
      query += `^state!=completed^state!=deferred`;
    }

    const params = {
      sysparm_query: query,
      sysparm_display_value: 'true',
      sysparm_fields: 'sys_id,number,short_description,description,state,assigned_to,requested_by',
      sysparm_limit: options.limit || 100
    };

    const demands = await serviceNowService.get('dmn_demand', params);

    // Format response
    return demands.map(demand => ({
      sysId: demand.sys_id,
      number: demand.number,
      title: demand.short_description,
      description: demand.description,
      state: demand.state,
      assignedTo: demand.assigned_to?.display_value || null,
      requestedBy: demand.requested_by?.display_value || null,
      type: 'demand'
    }));
  }

  /**
   * Get all user's work items (projects + demands combined)
   * @param {string} username - ServiceNow username (optional)
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Combined projects and demands
   */
  async getUserWorkItems(username = null, options = {}) {
    const [projects, demands] = await Promise.all([
      this.getUserProjects(username, options),
      this.getUserDemands(username, options)
    ]);

    return {
      projects,
      demands,
      total: projects.length + demands.length
    };
  }

  /**
   * Get resource summary for user
   * @param {string} username - ServiceNow username (optional)
   * @param {Object} options - Date range options
   * @returns {Promise<Object>} Resource summary
   */
  async getResourceSummary(username = null, options = {}) {
    const allocations = await this.getUserAllocations(username, options);

    const summary = {
      totalHours: 0,
      hardCommitments: 0,
      softCommitments: 0,
      allocationCount: allocations.length,
      dateRange: {
        earliest: null,
        latest: null
      },
      byProject: {}
    };

    allocations.forEach(allocation => {
      const hours = allocation.allocatedHours;
      summary.totalHours += hours;

      if (allocation.bookingType === 'HARD') {
        summary.hardCommitments += hours;
      } else if (allocation.bookingType === 'SOFT') {
        summary.softCommitments += hours;
      }

      // Track date range
      if (!summary.dateRange.earliest || allocation.startDate < summary.dateRange.earliest) {
        summary.dateRange.earliest = allocation.startDate;
      }
      if (!summary.dateRange.latest || allocation.endDate > summary.dateRange.latest) {
        summary.dateRange.latest = allocation.endDate;
      }

      // Group by project
      if (allocation.project) {
        const projectKey = allocation.project.number;
        if (!summary.byProject[projectKey]) {
          summary.byProject[projectKey] = {
            ...allocation.project,
            totalHours: 0,
            allocations: []
          };
        }
        summary.byProject[projectKey].totalHours += hours;
        summary.byProject[projectKey].allocations.push(allocation);
      }
    });

    return summary;
  }

  /**
   * Update resource allocation hours
   * @param {string} allocationSysId - Resource allocation sys_id
   * @param {number} hours - New allocated hours
   * @returns {Promise<Object>} Updated allocation
   */
  async updateAllocationHours(allocationSysId, hours) {
    if (!allocationSysId || typeof hours !== 'number') {
      throw new Error('Valid allocation sys_id and hours required');
    }

    const updated = await serviceNowService.patch('resource_allocation', allocationSysId, {
      allocated_hours: hours
    });

    return {
      sysId: updated.sys_id,
      allocatedHours: parseFloat(updated.allocated_hours) || 0,
      updatedAt: updated.sys_updated_on
    };
  }

  /**
   * Search for projects and demands by keyword
   * @param {string} keyword - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchWorkItems(keyword, options = {}) {
    if (!keyword || keyword.trim().length === 0) {
      return { projects: [], demands: [], total: 0 };
    }

    const searchTerm = keyword.trim();
    const limit = options.limit || 20;

    // Search projects
    const projectQuery = `short_descriptionLIKE${searchTerm}^ORnumberLIKE${searchTerm}`;
    const projectsPromise = serviceNowService.get('pm_project', {
      sysparm_query: projectQuery,
      sysparm_display_value: 'true',
      sysparm_fields: 'sys_id,number,short_description,state',
      sysparm_limit: limit
    });

    // Search demands
    const demandQuery = `short_descriptionLIKE${searchTerm}^ORnumberLIKE${searchTerm}`;
    const demandsPromise = serviceNowService.get('dmn_demand', {
      sysparm_query: demandQuery,
      sysparm_display_value: 'true',
      sysparm_fields: 'sys_id,number,short_description,state',
      sysparm_limit: limit
    });

    const [projects, demands] = await Promise.all([projectsPromise, demandsPromise]);

    return {
      projects: projects.map(p => ({
        sysId: p.sys_id,
        number: p.number,
        title: p.short_description,
        state: p.state,
        type: 'project'
      })),
      demands: demands.map(d => ({
        sysId: d.sys_id,
        number: d.number,
        title: d.short_description,
        state: d.state,
        type: 'demand'
      })),
      total: projects.length + demands.length
    };
  }
}

// Export singleton instance
export default new ServiceNowResourceAPI();
