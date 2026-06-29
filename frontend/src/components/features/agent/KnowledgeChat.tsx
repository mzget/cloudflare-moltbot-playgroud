import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../common/AuthContext';
import {
  Box,
  Typography,
  Input,
  Button,
  Card,
  Stack,
  Sheet,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
} from '@mui/joy';
import { Send, Bot, Trash2, Plus, ChevronLeft, MessageSquare } from 'lucide-react';
import { useAgent } from 'agents/react';
import { useAgentChat } from '@cloudflare/ai-chat/react';
import { MCP_WORKER_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';
import MarkdownRenderer from '../../common/MarkdownRenderer';

interface ChatSession {
  id: string;
  title: string;
  created_at: number;
}

export default function KnowledgeChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useContext(AuthContext);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(`${MCP_WORKER_URL}/chat/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { sessions: ChatSession[] };
      setSessions(data.sessions);
      
      // If there are sessions and no active session is selected, select the first one
      if (data.sessions.length > 0 && !activeSessionId) {
        setActiveSessionId(data.sessions[0].id);
      } else if (data.sessions.length === 0) {
        // Automatically create a default session if list is empty
        await handleCreateSession("General Chat");
      }
    } catch (e) {
      console.error("Failed to fetch sessions:", e);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSessions();
    }
  }, [user]);

  const handleCreateSession = async (titleToUse?: string) => {
    const finalTitle = titleToUse || newTitle;
    if (!finalTitle.trim() && !titleToUse) return;
    
    setIsCreating(true);
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(`${MCP_WORKER_URL}/chat/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: finalTitle.trim() || 'New Chat' })
      });
      if (!res.ok) throw new Error(await res.text());
      const newSession = await res.json() as ChatSession;
      
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setNewTitle('');
    } catch (e) {
      console.error("Failed to create session:", e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the session when deleting
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(`${MCP_WORKER_URL}/chat/sessions/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error(await res.text());
      
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) {
        const remaining = sessions.filter(s => s.id !== id);
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
        } else {
          setActiveSessionId(null);
          // Auto create a new one if list becomes empty
          await handleCreateSession("General Chat");
        }
      }
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <Card
      sx={{
        ...glassStyle,
        height: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'row',
        p: 0,
        overflow: 'hidden',
        border: 'none',
      }}
    >
      {/* Sessions Sidebar */}
      <Box
        sx={{
          width: { xs: '100%', sm: '280px' },
          display: { xs: activeSessionId ? 'none' : 'flex', sm: 'flex' },
          flexDirection: 'column',
          borderRight: '1px solid',
          borderColor: 'rgba(0,0,0,0.08)',
          bgcolor: 'background.surface',
          height: '100%',
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'rgba(0,0,0,0.05)' }}>
          <Typography level="h4" sx={{ mb: 1 }}>Oaktree Agent</Typography>
          <Typography level="body-xs" sx={{ opacity: 0.7, mb: 2 }}>
            Manage and switch between chat sessions.
          </Typography>
          
          <Stack direction="row" spacing={1}>
            <Input
              size="sm"
              placeholder="New chat title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={isCreating}
              sx={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateSession();
                }
              }}
            />
            <Button
              size="sm"
              variant="solid"
              color="success"
              onClick={() => handleCreateSession()}
              disabled={isCreating || !newTitle.trim()}
              sx={{ minWidth: '40px', px: 1 }}
            >
              <Plus size={16} />
            </Button>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
          {isLoadingSessions ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size="sm" />
            </Box>
          ) : sessions.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography level="body-sm" color="neutral">No sessions found.</Typography>
            </Box>
          ) : (
            <List size="sm" sx={{ '--List-gap': '4px' }}>
              {sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <ListItem key={session.id}>
                    <ListItemButton
                      selected={isActive}
                      onClick={() => setActiveSessionId(session.id)}
                      sx={{
                        borderRadius: 'md',
                        transition: 'all 0.2s ease-out',
                        bgcolor: isActive ? 'primary.softBg' : 'transparent',
                        '&:hover': {
                          bgcolor: isActive ? 'primary.softBg' : 'background.level1',
                        },
                        '&:hover .delete-session-btn': {
                          opacity: 0.8,
                        },
                      }}
                    >
                      <MessageSquare size={16} style={{ opacity: 0.7, marginRight: '8px' }} />
                      <ListItemContent sx={{ minWidth: 0 }}>
                        <Typography
                          level="title-sm"
                          noWrap
                          sx={{
                            color: isActive ? 'primary.solidBg' : 'text.primary',
                            fontWeight: isActive ? 'bold' : 'normal',
                          }}
                        >
                          {session.title}
                        </Typography>
                      </ListItemContent>
                      <IconButton
                        className="delete-session-btn"
                        size="sm"
                        variant="plain"
                        color="danger"
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        sx={{
                          opacity: isActive ? 0.6 : 0,
                          transition: 'opacity 0.2s',
                          '&:hover': { opacity: '1 !important' },
                        }}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </Box>

      {/* Chat Area */}
      <Box
        sx={{
          flex: 1,
          display: { xs: activeSessionId ? 'flex' : 'none', sm: 'flex' },
          flexDirection: 'column',
          height: '100%',
          bgcolor: 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {activeSessionId ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Box
              sx={{
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <IconButton
                size="sm"
                variant="outlined"
                onClick={() => setActiveSessionId(null)}
                sx={{ display: { xs: 'flex', sm: 'none' } }}
              >
                <ChevronLeft size={18} />
              </IconButton>
              <Box>
                <Typography level="h4">{activeSession?.title}</Typography>
                <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                  Ask about your portfolio, history, or investment frameworks.
                </Typography>
              </Box>
            </Box>

            {/* Chat Window Component (remounts when activeSessionId changes) */}
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <ChatWindow key={activeSessionId} sessionId={activeSessionId} />
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', p: 4, textAlign: 'center' }}>
            <Box>
              <Bot size={48} style={{ color: 'var(--joy-palette-success-plainColor, #10b981)', marginBottom: '16px', opacity: 0.6 }} />
              <Typography level="h4" color="neutral" sx={{ mb: 1 }}>Welcome to Oaktree Agent</Typography>
              <Typography level="body-sm" color="neutral" sx={{ opacity: 0.8 }}>
                Select a chat session from the list or start a new one to begin.
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Card>
  );
}

function ChatWindow({ sessionId }: { sessionId: string }) {
  const [input, setInput] = useState('');
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
    </Box>
  );
}
