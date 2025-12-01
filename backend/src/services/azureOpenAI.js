/**
 * Azure OpenAI Client Module
 *
 * This module provides Azure OpenAI integration for the work version of AibaPM.
 * It uses the same OpenAI SDK but configured for Azure endpoints.
 *
 * CONFIGURATION:
 * Set these environment variables in your .env file:
 * - AZURE_OPENAI_ENDPOINT: Your Azure OpenAI resource endpoint (e.g., https://your-resource.openai.azure.com)
 * - AZURE_OPENAI_API_KEY: Your Azure OpenAI API key
 * - AZURE_OPENAI_DEPLOYMENT: Your deployment name (e.g., gpt-4o, gpt-5, etc.)
 * - AZURE_OPENAI_API_VERSION: API version (default: 2024-02-15-preview)
 */

import { AzureOpenAI } from 'openai';

let azureClient = null;

/**
 * Get or create the Azure OpenAI client
 * @returns {AzureOpenAI} Azure OpenAI client instance
 */
export function getAzureClient() {
  if (!azureClient) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

    if (!endpoint || !apiKey || !deployment) {
      throw new Error(
        'Azure OpenAI configuration missing. Required environment variables: ' +
        'AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT'
      );
    }

    azureClient = new AzureOpenAI({
      endpoint,
      apiKey,
      deployment,
      apiVersion
    });

    console.log(`Azure OpenAI client initialized for deployment: ${deployment}`);
  }

  return azureClient;
}

/**
 * Create a chat completion using Azure OpenAI
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Additional options (max_tokens, temperature, etc.)
 * @returns {Promise<Object>} Chat completion response
 */
export async function createChatCompletion(messages, options = {}) {
  const client = getAzureClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  try {
    const response = await client.chat.completions.create({
      model: deployment, // Azure uses deployment name as model
      messages,
      max_tokens: options.max_tokens || 4096,
      temperature: options.temperature ?? 0.7,
      response_format: options.response_format || undefined,
      ...options
    });

    return response;
  } catch (error) {
    console.error('Azure OpenAI API error:', error);

    // Provide helpful error messages
    if (error.status === 401) {
      throw new Error('Azure OpenAI authentication failed. Check your API key.');
    } else if (error.status === 404) {
      throw new Error(`Azure OpenAI deployment "${deployment}" not found. Check your deployment name.`);
    } else if (error.status === 429) {
      throw new Error('Azure OpenAI rate limit exceeded. Please try again later.');
    }

    throw error;
  }
}

/**
 * Check if Azure OpenAI is properly configured
 * @returns {boolean} True if all required environment variables are set
 */
export function isAzureConfigured() {
  return !!(
    process.env.AZURE_OPENAI_ENDPOINT &&
    process.env.AZURE_OPENAI_API_KEY &&
    process.env.AZURE_OPENAI_DEPLOYMENT
  );
}

/**
 * Get Azure OpenAI configuration info (for health checks)
 * @returns {Object} Configuration status
 */
export function getAzureConfig() {
  return {
    configured: isAzureConfigured(),
    endpoint: process.env.AZURE_OPENAI_ENDPOINT ? '***configured***' : null,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || null,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview'
  };
}

/**
 * Reset the client (useful for testing or config changes)
 */
export function resetClient() {
  azureClient = null;
}

export default {
  getAzureClient,
  createChatCompletion,
  isAzureConfigured,
  getAzureConfig,
  resetClient
};
