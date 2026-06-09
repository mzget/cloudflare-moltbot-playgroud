const fs = require('fs');
const code = `import type { Page } from '@playwright/test';

export type MockStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; id: string; name: string; args: any }
  | { type: 'tool_result'; id: string; result: any };

export class MockFactory {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Mocks the database-chat/status endpoint to return active or disabled state.
   */
  async mockDatabaseStatus(enabled: boolean) {
    await this.page.route('**/database-chat/status', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify({ enabled }),
      });
    });
  }

  /**
   * Mocks a streaming chat endpoint (/chat or /database-chat) with custom events.
   * Formats the stream chunks using the Server-Sent Events (SSE) JSON protocol
   * produced by Vercel AI SDK's \`toUIMessageStreamResponse\`.
   */
  async mockChatStream(endpointPattern: string, events: MockStreamEvent[]) {
    await this.page.route(endpointPattern, async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        await route.fulfill({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
        return;
      }

      let body = '';
      body += \`data: \${JSON.stringify({ type: 'start' })}\\n\\n\`;
      body += \`data: \${JSON.stringify({ type: 'start-step' })}\\n\\n\`;

      let textCount = 0;
      for (const event of events) {
        if (event.type === 'text') {
          textCount++;
          const textId = \`dext-\${textCount}\`;
          body += \`data: \${JSON.stringify({ type: 'text-start', id: textId })}\\n\\n\`;
          body += \`data: \${JSON.stringify({ type: 'text-delta', id: textId, delta: event.content })}\\n\\n\`;
          body += \`data: \${JSON.stringify({ type: 'text-end', id: textId })}\\n\\n\`;
        } else if (event.type === 'tool_call') {
          body += \`data: \${JSON.stringify({
            type: 'tool-input-available',
            toolCallId: event.id,
            toolName: event.name,
            input: event.args,
          })}\\n\\n\`;
        } else if (event.type === 'tool_result') {
          body += \`data: \${JSON.stringify({
            type: 'tool-output-available',
            toolCallId: event.id,
            output: event.result,
          })}\\n\\n\`;
        }
      }

      body += \`data: \${JSON.stringify({ type: 'finish-step' })}\\n\\n\`;
      body += \`data: \${JSON.stringify({ type: 'finish' })}\\n\\n\`;
      body += 'data: [DONE]\\n\\n';

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'x-vercel-ai-ui-message-stream': 'v1',
        },
        body,
      });
    });
  }
}
`;
fs.writeFileSync('frontend/e2e/helpers/mock-factory.ts', code);
console.log('Successfully wrote frontend/e2e/helpers/mock-factory.ts');
