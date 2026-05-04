const isProd = import.meta.env.PROD;
export const API_BASE_URL = import.meta.env.PUBLIC_API_URL || (isProd ? 'https://oaktree-backend.nattapon-r.workers.dev' : 'http://127.0.0.1:8787');
export const MCP_WORKER_URL = import.meta.env.PUBLIC_MCP_WORKER_URL || (isProd ? 'https://oaktree-backend.nattapon-r.workers.dev' : 'http://127.0.0.1:8789');
