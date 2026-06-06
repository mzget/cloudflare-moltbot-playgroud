import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Input, Button, Card, Stack, Sheet, CircularProgress, Chip, Tooltip, Divider } from '@mui/joy';
import { Send, Bot, Database, Terminal, Play, HelpCircle } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { MCP_WORKER_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';

export default function DatabaseChat() {
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${MCP_WORKER_URL}/database-chat`,
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`${MCP_WORKER_URL}/database-chat/status`);
        if (res.ok) {
          const data = await res.json() as { enabled: boolean };
          setIsEnabled(data.enabled);
        } else {
          setIsEnabled(false);
        }
      } catch (e) {
        console.error("Failed to fetch database chat status", e);
        setIsEnabled(false);
      } finally {
        setCheckingStatus(false);
      }
    }
    checkStatus();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !isEnabled) return;
    sendMessage({ text: input });
    setInput('');
  };

  const handleSuggestionClick = (text: string) => {
    if (isLoading || !isEnabled) return;
    sendMessage({ text });
  };

  const suggestions = [
    { text: 'List D1 tables', label: 'List Tables' },
    { text: 'Show schema of watchlist table', label: 'Inspect watchlist Schema' },
    { text: 'SELECT * FROM watchlist LIMIT 5;', label: 'Query watchlist' },
    { text: 'List objects in R2 bucket', label: 'List R2 Files' },
  ];

  const renderToolResult = (toolInvocation: any) => {
    const { toolName, result, state } = toolInvocation;
    if (state !== 'result' || !result) return null;

    if (toolName === 'execute_d1_sql') {
      if (!result.success) {
        return (
          <Sheet color="danger" variant="soft" sx={{ p: 1.5, borderRadius: 'sm', mt: 1, borderLeft: '3px solid var(--joy-palette-danger-solidBg)' }}>
            <Typography level="body-xs" fontWeight="bold">SQL Error:</Typography>
            <Typography level="body-sm" sx={{ fontStyle: 'italic', fontFamily: 'monospace', color: 'danger.plainColor' }}>
              {result.error}
            </Typography>
          </Sheet>
        );
      }
      if (result.results && Array.isArray(result.results)) {
        if (result.results.length === 0) {
          return (
            <Sheet color="neutral" variant="soft" sx={{ p: 1.5, borderRadius: 'sm', mt: 1 }}>
              <Typography level="body-sm">Query completed successfully. Empty result set.</Typography>
            </Sheet>
          );
        }
        const headers = Object.keys(result.results[0]);
        return (
          <Box sx={{ mt: 1.5, overflowX: 'auto', borderRadius: 'md', border: '1px solid', borderColor: 'divider', maxWidth: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', borderBottom: '1.5px solid var(--joy-palette-divider)' }}>
                  {headers.map(h => (
                    <th key={h} style={{ padding: '8px 12px', fontWeight: 'bold', borderRight: '1px solid var(--joy-palette-divider)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.results.map((row: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--joy-palette-divider)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    {headers.map(h => (
                      <td key={h} style={{ padding: '8px 12px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '250px', borderRight: '1px solid var(--joy-palette-divider)' }}>
                        {typeof row[h] === 'object' ? JSON.stringify(row[h]) : String(row[h])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.truncated && (
              <Box sx={{ p: 1, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.05)', borderTop: '1px solid var(--joy-palette-divider)' }}>
                <Typography level="body-xs" sx={{ fontStyle: 'italic' }}>Results truncated to 100 rows.</Typography>
              </Box>
            )}
          </Box>
        );
      }
      if (result.changes !== undefined) {
        return (
          <Sheet color="success" variant="soft" sx={{ p: 1.5, borderRadius: 'sm', mt: 1, borderLeft: '3px solid var(--joy-palette-success-solidBg)' }}>
            <Typography level="body-sm" fontWeight="bold">Query executed successfully:</Typography>
            <Typography level="body-xs">
              Changes: {result.changes} | Duration: {result.duration}ms {result.lastRowId ? `| Last Row ID: ${result.lastRowId}` : ''}
            </Typography>
          </Sheet>
        );
      }
    }

    if (toolName === 'list_d1_tables') {
      if (result.error) {
        return <Typography level="body-sm" color="danger" sx={{ mt: 1 }}>{result.error}</Typography>;
      }
      return (
        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {result.tables?.map((table: string) => (
            <Chip key={table} variant="soft" color="success" size="sm" startDecorator={<Database size={12} />}>
              {table}
            </Chip>
          ))}
        </Box>
      );
    }

    if (toolName === 'get_d1_table_schema') {
      if (result.error) {
        return <Typography level="body-sm" color="danger" sx={{ mt: 1 }}>{result.error}</Typography>;
      }
      return (
        <Box sx={{ mt: 1, overflowX: 'auto', borderRadius: 'md', border: '1px solid', borderColor: 'divider' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', borderBottom: '1.5px solid var(--joy-palette-divider)' }}>
                <th style={{ padding: '6px 10px', fontWeight: 'bold' }}>CID</th>
                <th style={{ padding: '6px 10px', fontWeight: 'bold' }}>Name</th>
                <th style={{ padding: '6px 10px', fontWeight: 'bold' }}>Type</th>
                <th style={{ padding: '6px 10px', fontWeight: 'bold' }}>NotNull</th>
                <th style={{ padding: '6px 10px', fontWeight: 'bold' }}>Default</th>
                <th style={{ padding: '6px 10px', fontWeight: 'bold' }}>PK</th>
              </tr>
            </thead>
            <tbody>
              {result.schema?.map((col: any) => (
                <tr key={col.cid} style={{ borderBottom: '1px solid var(--joy-palette-divider)' }}>
                  <td style={{ padding: '6px 10px' }}>{col.cid}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 'bold', color: 'var(--joy-palette-primary-plainColor)' }}>{col.name}</td>
                  <td style={{ padding: '6px 10px' }}>{col.type}</td>
                  <td style={{ padding: '6px 10px' }}>{col.notnull ? 'Yes' : 'No'}</td>
                  <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{col.dflt_value !== null ? String(col.dflt_value) : 'NULL'}</td>
                  <td style={{ padding: '6px 10px' }}>{col.pk ? '🔑' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      );
    }

    if (toolName === 'list_r2_objects') {
      if (result.error) {
        return (
          <Sheet color="warning" variant="soft" sx={{ p: 1.5, borderRadius: 'sm', mt: 1, borderLeft: '3px solid var(--joy-palette-warning-solidBg)' }}>
            <Typography level="body-xs" fontWeight="bold">R2 Bucket Info:</Typography>
            <Typography level="body-sm" sx={{ fontStyle: 'italic' }}>{result.error}</Typography>
          </Sheet>
        );
      }
      if (!result.objects || result.objects.length === 0) {
        return (
          <Sheet color="neutral" variant="soft" sx={{ p: 1.5, borderRadius: 'sm', mt: 1 }}>
            <Typography level="body-sm">The R2 bucket is empty or hasn't been initialized with files.</Typography>
          </Sheet>
        );
      }
      return (
        <Box sx={{ mt: 1, overflowX: 'auto', borderRadius: 'md', border: '1px solid', borderColor: 'divider' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', borderBottom: '1.5px solid var(--joy-palette-divider)' }}>
                <th style={{ padding: '6px 10px', fontWeight: 'bold' }}>Key</th>
                <th style={{ padding: '6px 10px', fontWeight: 'bold' }}>Size (bytes)</th>
                <th style={{ padding: '6px 10px', fontWeight: 'bold' }}>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {result.objects.map((obj: any) => (
                <tr key={obj.key} style={{ borderBottom: '1px solid var(--joy-palette-divider)' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 'bold' }}>{obj.key}</td>
                  <td style={{ padding: '6px 10px' }}>{obj.size}</td>
                  <td style={{ padding: '6px 10px' }}>{new Date(obj.uploaded).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      );
    }

    // Default JSON fallback for other tools (like get_r2_object, put_r2_object, delete_r2_object)
    return (
      <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 'sm', overflowX: 'auto' }}>
        <Typography level="body-xs" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(result, null, 2)}
        </Typography>
      </Box>
    );
  };

  return (
    <Card sx={{ ...glassStyle, height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', p: 0, overflow: 'hidden', border: 'none' }}>
      <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography level="h4" sx={{ fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Database size={24} color="#10b981" />
            Cloudflare Database Agent
          </Typography>
          <Typography level="body-sm" sx={{ opacity: 0.65, mt: 0.5 }}>
            Query D1 SQLite, manage R2 Buckets, or get professional Cloudflare developer advice.
          </Typography>
        </Box>
        {checkingStatus ? (
          <CircularProgress size="sm" />
        ) : isEnabled ? (
          <Chip variant="soft" color="success" size="sm" startDecorator={<Terminal size={12} />}>
            D1 & R2 Connected
          </Chip>
        ) : (
          <Chip variant="soft" color="danger" size="sm" startDecorator={<Terminal size={12} />}>
            Console Offline
          </Chip>
        )}
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {!isEnabled && !checkingStatus && (
          <Sheet
            variant="soft"
            color="danger"
            sx={{
              p: 2.5,
              borderRadius: 'lg',
              textAlign: 'center',
              borderLeft: '4px solid var(--joy-palette-danger-solidBg)',
            }}
          >
            <Typography level="title-md" color="danger" sx={{ fontWeight: 700 }}>Console Temporarily Offline</Typography>
            <Typography level="body-sm" sx={{ mt: 0.5, opacity: 0.8 }}>
              The database agent console has been temporarily disabled by the administrator via feature flags.
            </Typography>
          </Sheet>
        )}

        {messages.length === 0 && (
          <Sheet variant="soft" color="neutral" sx={{ p: 3, borderRadius: 'lg', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, bgcolor: 'rgba(255,255,255,0.01)' }}>
            <Box sx={{ p: 2, borderRadius: '50%', bgcolor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={36} color="#10b981" />
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography level="title-md" sx={{ mb: 1, fontWeight: 700 }}>Welcome to the Database Console</Typography>
              <Typography level="body-sm" sx={{ opacity: 0.7, maxWidth: '500px', mx: 'auto', lineHeight: 1.6 }}>
                I have direct access to execute SQL queries on your D1 database and list/inspect files in your R2 bucket. Tell me what you need, or pick a suggestion below.
              </Typography>
            </Box>

            <Divider sx={{ my: 1, width: '100%', opacity: 0.1 }} />

            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography level="body-xs" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5 }}>Quick Queries</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {suggestions.map((s, idx) => (
                  <Chip
                    key={idx}
                    variant="outlined"
                    color="primary"
                    onClick={() => handleSuggestionClick(s.text)}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 'md',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: 'rgba(16, 185, 129, 0.08)',
                        borderColor: 'primary.solidBg',
                      }
                    }}
                    startDecorator={<Play size={10} />}
                  >
                    {s.label}
                  </Chip>
                ))}
              </Box>
            </Box>
          </Sheet>
        )}

        {messages.map((m) => (
          <Box
            key={m.id}
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'flex-start',
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <Box sx={{
              p: 1,
              borderRadius: '50%',
              bgcolor: m.role === 'user' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {m.role === 'user' ? <Terminal size={16} color="#10b981" /> : <Bot size={16} color="#bbf7d0" />}
            </Box>

            <Sheet
              variant={m.role === 'user' ? 'solid' : 'soft'}
              color={m.role === 'user' ? 'primary' : 'neutral'}
              sx={{
                p: 2,
                borderRadius: 'xl',
                maxWidth: '85%',
                boxShadow: m.role === 'user' ? 'none' : '0 4px 20px rgba(0,0,0,0.1)',
                bgcolor: m.role === 'user' ? 'primary.solidBg' : 'rgba(255,255,255,0.02)',
                border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.03)',
              }}
            >
              <Typography textColor={m.role === 'user' ? 'common.white' : 'text.primary'} sx={{ lineHeight: 1.6, fontSize: '15px' }}>
                {m.parts.map((part, i) =>
                  part.type === 'text' ? <span key={i}>{part.text}</span> : null
                )}
              </Typography>

              {m.parts.map((part, i) =>
                part.type === 'tool-invocation' ? (
                  <Box key={i} sx={{ mt: 1.5 }}>
                    <Typography level="body-xs" sx={{ opacity: 0.6, display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <Terminal size={12} />
                      Tool call: {(part as any).toolInvocation?.toolName}
                    </Typography>
                    {renderToolResult((part as any).toolInvocation)}
                  </Box>
                ) : null
              )}
            </Sheet>
          </Box>
        ))}

        {isLoading && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', pl: 1 }}>
            <CircularProgress size="sm" variant="soft" color="success" />
            <Typography level="body-sm" color="neutral" sx={{ fontStyle: 'italic' }}>Database Agent is processing...</Typography>
          </Box>
        )}
        <div ref={chatEndRef} />
      </Box>

      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, borderTop: '1px solid', borderColor: 'rgba(255,255,255,0.05)', bgcolor: 'rgba(0,0,0,0.1)' }}>
        <Stack direction="row" spacing={1.5}>
          <Input
            fullWidth
            placeholder={isEnabled ? "Ask a question or enter a SQL query..." : "Console is temporarily disabled."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || !isEnabled || checkingStatus}
            autoFocus={isEnabled}
            sx={{
              borderRadius: 'lg',
              border: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(255,255,255,0.01)',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.02)',
              },
              '&.Mui-focused': {
                border: '1px solid var(--joy-palette-primary-solidBg)',
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.1)',
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim() || !isEnabled || checkingStatus}
            sx={{
              borderRadius: 'lg',
              px: 3,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
              transition: 'all 0.2s',
              '&:hover': {
                boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)',
              }
            }}
            endDecorator={<Send size={16} />}
          >
            Send
          </Button>
        </Stack>
      </Box>
    </Card>
  );
}
