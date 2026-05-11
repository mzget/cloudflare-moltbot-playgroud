import React, { useState } from 'react';
import { Box, Typography, Input, Button, Card, Stack, Sheet, CircularProgress } from '@mui/joy';
import { Send, Bot } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { MCP_WORKER_URL } from '../config';
import { glassStyle } from '../styles/glass';

export default function KnowledgeChat() {
  const [input, setInput] = useState('');

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${MCP_WORKER_URL}/chat`,
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
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
            <Sheet
              variant="solid"
              color={m.role === 'user' ? 'primary' : 'neutral'}
              sx={{
                p: 1.5,
                borderRadius: 'lg',
                maxWidth: '80%',
                whiteSpace: 'pre-wrap',
              }}
            >
              <Typography textColor={m.role === 'user' ? 'common.white' : 'text.primary'}>
                {m.parts.map((part, i) =>
                  part.type === 'text' ? <span key={i}>{part.text}</span> : null
                )}
                {m.parts.map((part, i) =>
                  part.type === 'tool-invocation' ? (
                    <Box key={i} sx={{ mt: 1, p: 1, bgcolor: 'background.surface', borderRadius: 'sm', opacity: 0.8 }}>
                      <Typography level="body-xs" color="primary">
                        Calling: {part.toolInvocation.toolName}
                      </Typography>
                    </Box>
                  ) : null
                )}
              </Typography>
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
