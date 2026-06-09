const fs = require('fs');
const log = fs.readFileSync('C:\\Users\\natta\\.gemini\\antigravity\\brain\\c1acc020-a864-41dd-a51f-bd0f143981c0\\.system_generated\\tasks\\task-331.log', 'utf8');
const lines = log.split('\n');
const idx = lines.findIndex(l => l.includes('PAGE CONTENT:'));
if (idx !== -1) {
  const bodyIdx = lines.findIndex((l, index) => index > idx && l.includes('<body'));
  if (bodyIdx !== -1) {
    console.log(lines.slice(bodyIdx, bodyIdx + 150).join('\n'));
  } else {
    console.log('body tag not found after PAGE CONTENT:');
  }
}
