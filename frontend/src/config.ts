const isProd = import.meta.env.PROD;

const getApiBaseUrl = () => {
  if (import.meta.env.PUBLIC_API_URL) {
    return import.meta.env.PUBLIC_API_URL;
  }
  if (isProd) {
    return 'https://oaktree-backend.nattapon-r.workers.dev';
  }
  if (import.meta.env.PUBLIC_CONNECT_TO_PROD === 'true') {
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4321';
  }
  return 'http://127.0.0.1:8787';
};

const getMcpWorkerUrl = () => {
  if (import.meta.env.PUBLIC_MCP_WORKER_URL) {
    return import.meta.env.PUBLIC_MCP_WORKER_URL;
  }
  if (isProd) {
    return 'https://oaktree-mcp.nattapon-r.workers.dev';
  }
  if (import.meta.env.PUBLIC_CONNECT_TO_PROD === 'true') {
    return typeof window !== 'undefined' ? `${window.location.origin}/mcp` : 'http://localhost:4321/mcp';
  }
  return 'http://127.0.0.1:8788';
};

export const API_BASE_URL = getApiBaseUrl();
export const MCP_WORKER_URL = getMcpWorkerUrl();
