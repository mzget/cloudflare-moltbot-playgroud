const fs = require('fs');
const file = 'frontend/src/components/features/agent/DatabaseChat.tsx';
let content = fs.readFileSync(file, 'utf8');
const target = 'const isLoading = status === \'submitted\' || status === \'streaming\';';
const insertion = 'const isLoading = status === \'submitted\' || status === \'streaming\';\r\n  React.useEffect(() => {\r\n    console.log(\"CLIENT MESSAGES:\", JSON.stringify(messages, null, 2));\r\n  }, [messages]);';
if (content.includes(target)) {
  content = content.replace(target, insertion);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Patched DatabaseChat.tsx successfully');
} else {
  console.log('Target not found');
}
