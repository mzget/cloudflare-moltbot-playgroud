const fs = require('fs');
const log = fs.readFileSync('C:\\Users\\natta\\.gemini\\antigravity\\brain\\c1acc020-a864-41dd-a51f-bd0f143981c0\\.system_generated\\tasks\\task-331.log', 'utf8');
const lines = log.split('\n');
const idx = lines.findIndex(l => l.includes('PAGE CONTENT:'));
if (idx !== -1) {
  console.log(lines.slice(idx + 180, idx + 350).join('\n'));
}
