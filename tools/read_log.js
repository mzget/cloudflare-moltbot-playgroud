const fs = require('fs');
const log = fs.readFileSync('C:\\Users\\natta\\.gemini\\antigravity\\brain\\c1acc020-a864-41dd-a51f-bd0f143981c0\\.system_generated\\tasks\\task-331.log', 'utf8');
const lines = log.split('\n');
console.log('Total log lines:', lines.length);
// Find where PAGE CONTENT is
const idx = lines.findIndex(l => l.includes('PAGE CONTENT:'));
if (idx !== -1) {
  console.log('Found PAGE CONTENT at line:', idx);
  console.log(lines.slice(idx + 1, idx + 80).join('\n'));
} else {
  console.log('PAGE CONTENT: not found');
}
