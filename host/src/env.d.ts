/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_URL?: string;
  readonly PUBLIC_MCP_WORKER_URL?: string;
  readonly PUBLIC_CONNECT_TO_PROD?: string;
  readonly PUBLIC_SIMPLICITY_REMOTE_URL?: string;
  readonly PUBLIC_SIMPLICITY_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

