import React, { useState, useContext } from 'react';
import { AuthContext } from '../../common/AuthContext';
import { Box, Typography, Input, Button, Card, Stack, Sheet, CircularProgress } from '@mui/joy';
import { Send, Bot } from 'lucide-react';
import { useAgent } from 'agents/react';
import { useAgentChat } from '@cloudflare/ai-chat/react';
import { MCP_WORKER_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';
import MarkdownRenderer from '../../common/MarkdownRenderer';

export default function KnowledgeChat() {
  const [input, setInput] = useState('');
  const { user } = useContext(AuthContext);
  const sessionId = user?.email || 'default';

  // Extract host from MCP_WORKER_URL (remove http/https protocol prefix)
  const host = MCP_WORKER_URL.replace(/^https?:\/\//, '');

  const agent = useAgent({
    agent: 'OaktreeChat',
    name: sessionId.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 64),
    host,
    query: async () => {
      const token = localStorage.getItem('auth_token') || '';
      return { token };
    }
  });

  const { messages, sendMessage, status } = useAgentChat({
    agent,
    experimental_throttle: 50,
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: input }]
    });
    setInput('');
  };

  return (
    <Card sx={{ ...glassStyle, height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', p: 0, overflow: 'hidden', border: 'none' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'rgba(0,0,0,0.05)' }}>
        <Typography level="h4">Oaktree Knowledge Agent</Typography>
        <Typography level="body-sm" sx={{ opacity: 0.7 }}>Ask about your portfolio, history, or investment frameworks.</Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {messages.length === 0 && (
          <Sheet variant="soft" color="neutral" sx={{ p: 2, borderRadius: 'md', textAlign: 'center' }}>
            <Typography>Hello! I am your portfolio agent. Try asking:</Typography>
            <Typography level="body-sm" sx={{ mt: 1 }}>"What is my current portfolio?"</Typography>
            <Typography level="body-sm">"What is my history for 2024?"</Typography>
            <Typography level="body-sm">"Tell me about the Five Forces framework."</Typography>
          </Sheet>
        )}

        {messages.map((m) => (
          <Box
            key={m.id}
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'flex-start',
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.5 }}>
              {m.role !== 'user' && <Bot size={20} style={{ color: 'var(--joy-palette-success-plainColor, #10b981)' }} />}
            </Box>
            <Sheet
              variant="solid"
              color={m.role === 'user' ? 'primary' : 'neutral'}
              sx={{
                p: 1.5,
                borderRadius: 'lg',
                maxWidth: '80%',
              }}
            >
              <Box sx={{ color: m.role === 'user' ? 'common.white' : 'text.primary' }}>
                {m.parts.map((part, i) =>
                  part.type === 'text' ? (
                    <MarkdownRenderer key={i} text={part.text} themeColor={m.role === 'user' ? 'primary' : 'neutral'} />
                  ) : null
                )}
                {m.parts.map((part, i) => {
                  const isTool = part.type === 'tool-invocation' || part.type.startsWith('tool-');
                  if (!isTool) return null;
                  const toolInvocation = part.type === 'tool-invocation'
                    ? (part as any).toolInvocation
                    : {
                        toolName: part.type.slice(5),
                        result: (part as any).output,
                        state: (part as any).state === 'output-available' ? 'result' : (part as any).state
                      };
                  return (
                    <Box key={i} sx={{ mt: 1, p: 1, bgcolor: 'background.surface', borderRadius: 'sm', opacity: 0.8 }}>
                      <Typography level="body-xs" color="primary">
                        Calling: {toolInvocation?.toolName}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Sheet>
          </Box>
        ))}

        {isLoading && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <CircularProgress size="sm" />
            <Typography level="body-sm" color="neutral">Thinking...</Typography>
          </Box>
        )}
      </Box>

      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1}>
          <Input
            fullWidth
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send size={18} />
          </Button>
        </Stack>
      </Box>
    </Card>
  );
}


