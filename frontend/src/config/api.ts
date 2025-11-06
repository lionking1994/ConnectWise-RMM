/**
 * API Configuration
 * Dynamically determines the API URL based on environment and current location
 */

// Get the API URL from environment variable or detect automatically
export function getApiUrl(): string {
  // If explicitly set in environment, use that
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // Check if we're accessing from an external IP or domain (not localhost)
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // If not accessing from localhost, use the current hostname
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}:3001`;
  }

  // Default to localhost for local development
  return 'http://localhost:3001';
}

// Get the WebSocket URL
function getSocketUrl(): string {
  const apiUrl = getApiUrl();
  // Convert http to ws, https to wss
  return apiUrl.replace(/^http/, 'ws');
}

export const API_CONFIG = {
  API_URL: getApiUrl(),
  SOCKET_URL: getSocketUrl(),
  
  // API endpoints
  endpoints: {
    auth: {
      login: '/api/auth/login',
      refresh: '/api/auth/refresh',
      logout: '/api/auth/logout',
      me: '/api/auth/me'
    },
    tickets: {
      base: '/api/tickets',
      sync: '/api/tickets/sync',
      realtime: '/api/tickets/realtime'
    },
    automation: {
      base: '/api/automation',
      rules: '/api/automation/rules',
      history: '/api/automation/history'
    },
    credentials: {
      base: '/api/credentials',
      test: (id: string) => `/api/credentials/${id}/test`,
      toggle: (id: string) => `/api/credentials/${id}/toggle`
    },
    analytics: {
      base: '/api/analytics',
      metrics: '/api/analytics/metrics',
      trends: '/api/analytics/ticket-trends'
    },
    notifications: {
      base: '/api/notifications'
    },
    webhooks: {
      base: '/api/webhooks'
    }
  }
};

// Helper function to build full URL
export function buildApiUrl(endpoint: string): string {
  return `${API_CONFIG.API_URL}${endpoint}`;
}

// Export for debugging
if (process.env.NODE_ENV === 'development') {
  console.log('API Configuration:', {
    API_URL: API_CONFIG.API_URL,
    SOCKET_URL: API_CONFIG.SOCKET_URL,
    hostname: window.location.hostname
  });
}
