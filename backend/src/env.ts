import type { BrowserWorker } from '@cloudflare/puppeteer';

export interface Env {
  DB: D1Database;
  AI: any;
  BROWSER: BrowserWorker;
  EMAIL: {
    send: (raw: string) => Promise<void>;
    destination_address?: string;
  };
  ALERT_EMAIL?: string;
  DESTINATION_EMAIL?: string;
  FINNHUB_API_KEY?: string;
  FMP_API_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  JWT_SECRET?: string;
  ALLOWED_EMAILS?: string;
  FACEBOOK_PAGE_ID?: string;
  FACEBOOK_PAGE_ACCESS_TOKEN?: string;
  OAKTREE_SYNC_WORKFLOW: Workflow;
  IS_LOCAL?: string;
  KNOWLEDGE_BUCKET?: R2Bucket;
  NOTEBOOKLM_BRIDGE_URL?: string;
  NOTEBOOKLM_DEFAULT_NOTEBOOK_ID?: string;
  BRIDGE_SECRET?: string;
  facebook_summarize_model: string;
  default_ai_model: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: any;
  };
};
