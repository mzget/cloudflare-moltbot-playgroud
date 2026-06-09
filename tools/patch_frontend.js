const fs = require('fs');

// 1. Patch DatabaseChat.tsx
const dbFile = 'frontend/src/components/features/agent/DatabaseChat.tsx';
let dbContent = fs.readFileSync(dbFile, 'utf8');

// Remove debug useEffect hook
const debugHook = `  React.useEffect(() => {\r\n    console.log("CLIENT MESSAGES:", JSON.stringify(messages, null, 2));\r\n  }, [messages]);`;
if (dbContent.includes(debugHook)) {
  dbContent = dbContent.replace(debugHook, '');
  console.log('Removed debug useEffect hook from DatabaseChat.tsx');
} else {
  // Try with \n only
  const debugHookLF = `  React.useEffect(() => {\n    console.log("CLIENT MESSAGES:", JSON.stringify(messages, null, 2));\n  }, [messages]);`;
  if (dbContent.includes(debugHookLF)) {
    dbContent = dbContent.replace(debugHookLF, '');
    console.log('Removed debug useEffect hook (LF) from DatabaseChat.tsx');
  }
}

// Replace the parts.map block
const targetDb = `              {m.parts.map((part, i) =>
                part.type === 'tool-invocation' ? (
                  <Box key={i} sx={{ mt: 1.5 }}>
                    <Typography level="body-xs" sx={{ opacity: 0.6, display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <Terminal size={12} />
                      Tool call: {(part as any).toolInvocation?.toolName}
                    </Typography>
                    {renderToolResult((part as any).toolInvocation)}
                  </Box>
                ) : null
              )}`;

const replacementDb = `              {m.parts.map((part, i) => {
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
                  <Box key={i} sx={{ mt: 1.5 }}>
                    <Typography level="body-xs" sx={{ opacity: 0.6, display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <Terminal size={12} />
                      Tool call: {toolInvocation?.toolName}
                    </Typography>
                    {renderToolResult(toolInvocation)}
                  </Box>
                );
              })}`;

// Normalize line endings for comparison and replacement
const dbNormalized = dbContent.replace(/\r\n/g, '\n');
const targetDbNormalized = targetDb.replace(/\r\n/g, '\n');
const replacementDbNormalized = replacementDb.replace(/\r\n/g, '\n');

if (dbNormalized.includes(targetDbNormalized)) {
  dbContent = dbNormalized.replace(targetDbNormalized, replacementDbNormalized);
  fs.writeFileSync(dbFile, dbContent, 'utf8');
  console.log('Successfully patched DatabaseChat.tsx message parts mapping');
} else {
  console.error('Error: targetDb not found in DatabaseChat.tsx');
}

// 2. Patch KnowledgeChat.tsx
const kbFile = 'frontend/src/components/features/agent/KnowledgeChat.tsx';
let kbContent = fs.readFileSync(kbFile, 'utf8');

const targetKb = `                {m.parts.map((part, i) =>
                  part.type === 'tool-invocation' ? (
                    <Box key={i} sx={{ mt: 1, p: 1, bgcolor: 'background.surface', borderRadius: 'sm', opacity: 0.8 }}>
                      <Typography level="body-xs" color="primary">
                        Calling: {(part as any).toolInvocation?.toolName}
                      </Typography>
                    </Box>
                  ) : null
                )}`;

const replacementKb = `                {m.parts.map((part, i) => {
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
                })}`;

const kbNormalized = kbContent.replace(/\r\n/g, '\n');
const targetKbNormalized = targetKb.replace(/\r\n/g, '\n');
const replacementKbNormalized = replacementKb.replace(/\r\n/g, '\n');

if (kbNormalized.includes(targetKbNormalized)) {
  kbContent = kbNormalized.replace(targetKbNormalized, replacementKbNormalized);
  fs.writeFileSync(kbFile, kbContent, 'utf8');
  console.log('Successfully patched KnowledgeChat.tsx message parts mapping');
} else {
  console.error('Error: targetKb not found in KnowledgeChat.tsx');
}
