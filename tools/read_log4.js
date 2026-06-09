const fs = require('fs');
const log = fs.readFileSync('C:\\Users\\natta\\.gemini\\antigravity\\brain\\c1acc020-a864-41dd-a51f-bd0f143981c0\\.system_generated\\tasks\\task-331.log', 'utf8');
const startIdx = log.indexOf('PAGE CONTENT:');
if (startIdx !== -1) {
  const html = log.substring(startIdx);
  const bodyIdx = html.toLowerCase().indexOf('<body');
  if (bodyIdx !== -1) {
    console.log(html.substring(bodyIdx, bodyIdx + 1500));
  } else {
    console.log('No <body> found in HTML');
  }
}
