import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import { corsMiddleware, authMiddleware, rateLimitMiddleware } from './middleware';
import okfRoutes from './okfRoutes';
import { getScheduledWorkflowParams } from './scheduler';
import userAuth from './routes/userAuth';
import system from './routes/system';
import content from './routes/content';
import watchlist from './routes/watchlist';
import market from './routes/market';
import alerts from './routes/alerts';
import gmail from './routes/gmail';
import facebook from './routes/facebook';
import holdings from './routes/portfolio/holdings';
import transactions from './routes/portfolio/transactions';
import reference from './routes/portfolio/reference';
import brokers from './routes/portfolio/brokers';
import analysis from './routes/analysis';
import theses from './routes/theses';

export type { Env } from './env';
export { OaktreeSyncWorkflow } from './workflow';

const app = new Hono<AppEnv>();

app.use('*', corsMiddleware);
app.use('/api/*', authMiddleware);
app.use('/api/*', rateLimitMiddleware);

// OKF Knowledge Base API
app.route('/api/knowledge', okfRoutes);

app.route('/', userAuth);
app.route('/', system);
app.route('/', content);
app.route('/', watchlist);
app.route('/', market);
app.route('/', alerts);
app.route('/', gmail);
app.route('/', facebook);
app.route('/', holdings);
app.route('/', transactions);
app.route('/', reference);
app.route('/', brokers);
app.route('/', analysis);
app.route('/', theses);

// Fallback for non-matching API routes
app.notFound((c) => {
  return c.text("Oaktree Agent Backend Running");
});

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const decision = getScheduledWorkflowParams(event);
    console.log(`[Scheduled] Target minute: ${decision.targetMinute} - ${decision.description}`);

    ctx.waitUntil((async () => {
      try {
        await env.OAKTREE_SYNC_WORKFLOW.create({
          id: decision.workflowId,
          params: decision.params,
        });
        console.log(`Workflow instance ${decision.workflowId} triggered successfully.`);
      } catch (e) {
        console.error(`Failed to trigger workflow instance ${decision.workflowId}:`, e);
      }
    })());
  },
};

