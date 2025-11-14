import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * ServiceNow OAuth and API Client Service
 * Handles authentication, token management, and base API requests
 */
class ServiceNowService {
  constructor() {
    this.instanceUrl = process.env.SERVICENOW_INSTANCE_URL;
    this.clientId = process.env.SERVICENOW_CLIENT_ID;
    this.clientSecret = process.env.SERVICENOW_CLIENT_SECRET;
    this.usernameField = process.env.SERVICENOW_USERNAME_FIELD;

    // Token cache
    this.tokenCache = {
      accessToken: null,
      expiresAt: null
    };

    // Validate configuration
    this.isConfigured = !!(this.instanceUrl && this.clientId && this.clientSecret);
  }

  /**
   * Get OAuth access token (with caching and auto-refresh)
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    // Return cached token if still valid (with 5-minute buffer)
    if (this.tokenCache.accessToken && this.tokenCache.expiresAt) {
      const now = Date.now();
      const bufferMs = 5 * 60 * 1000; // 5 minutes
      if (now < this.tokenCache.expiresAt - bufferMs) {
        return this.tokenCache.accessToken;
      }
    }

    // Request new token
    try {
      const response = await axios.post(
        `https://${this.instanceUrl}/oauth_token.do`,
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          auth: {
            username: this.clientId,
            password: this.clientSecret
          }
        }
      );

      const { access_token, expires_in } = response.data;

      // Cache the token
      this.tokenCache.accessToken = access_token;
      this.tokenCache.expiresAt = Date.now() + (expires_in * 1000);

      return access_token;
    } catch (error) {
      console.error('ServiceNow OAuth error:', error.response?.data || error.message);
      throw new Error(`Failed to authenticate with ServiceNow: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Make an authenticated GET request to ServiceNow Table API
   * @param {string} table - Table name (e.g., 'pm_project', 'resource_allocation')
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} Array of records
   */
  async get(table, params = {}) {
    if (!this.isConfigured) {
      throw new Error('ServiceNow is not configured. Please set SERVICENOW_* environment variables.');
    }

    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.get(
        `https://${this.instanceUrl}/api/now/table/${table}`,
        {
          params,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      return response.data.result;
    } catch (error) {
      this.handleApiError(error, table);
    }
  }

  /**
   * Make an authenticated POST request to ServiceNow Table API
   * @param {string} table - Table name
   * @param {Object} data - Record data to create
   * @returns {Promise<Object>} Created record
   */
  async post(table, data) {
    if (!this.isConfigured) {
      throw new Error('ServiceNow is not configured. Please set SERVICENOW_* environment variables.');
    }

    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `https://${this.instanceUrl}/api/now/table/${table}`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      return response.data.result;
    } catch (error) {
      this.handleApiError(error, table);
    }
  }

  /**
   * Make an authenticated PATCH request to ServiceNow Table API
   * @param {string} table - Table name
   * @param {string} sysId - Record sys_id
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>} Updated record
   */
  async patch(table, sysId, data) {
    if (!this.isConfigured) {
      throw new Error('ServiceNow is not configured. Please set SERVICENOW_* environment variables.');
    }

    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.patch(
        `https://${this.instanceUrl}/api/now/table/${table}/${sysId}`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      return response.data.result;
    } catch (error) {
      this.handleApiError(error, table);
    }
  }

  /**
   * Test connection to ServiceNow
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    if (!this.isConfigured) {
      return {
        success: false,
        message: 'ServiceNow is not configured. Please set SERVICENOW_* environment variables.'
      };
    }

    try {
      // Try to get a token
      await this.getAccessToken();

      // Try to query a basic table with limit 1
      await this.get('sys_user', { sysparm_limit: 1 });

      return {
        success: true,
        message: 'Successfully connected to ServiceNow',
        instanceUrl: this.instanceUrl
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Handle API errors with detailed messaging
   * @param {Error} error - Axios error
   * @param {string} table - Table name being accessed
   * @throws {Error} Formatted error
   */
  handleApiError(error, table) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          throw new Error(`Authentication failed for ServiceNow. Please check credentials.`);
        case 403:
          throw new Error(`Access denied to table '${table}'. Please check ServiceNow user permissions.`);
        case 404:
          throw new Error(`Table '${table}' not found in ServiceNow instance.`);
        case 429:
          throw new Error(`ServiceNow rate limit exceeded. Please try again later.`);
        default:
          throw new Error(`ServiceNow API error (${status}): ${data.error?.message || data.error || 'Unknown error'}`);
      }
    } else if (error.request) {
      throw new Error(`Cannot reach ServiceNow instance at ${this.instanceUrl}. Please check the URL and network connection.`);
    } else {
      throw new Error(`ServiceNow request error: ${error.message}`);
    }
  }

  /**
   * Get the configured username for filtering user-specific data
   * @returns {string} Username
   */
  getUsername() {
    return this.usernameField;
  }

  /**
   * Check if ServiceNow is configured
   * @returns {boolean}
   */
  isEnabled() {
    return this.isConfigured;
  }
}

// Export singleton instance
export default new ServiceNowService();
