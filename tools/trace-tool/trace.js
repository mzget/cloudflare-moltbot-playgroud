const potrace = require('potrace');
const fs = require('fs');
const path = require('path');

const imagePath = path.join(__dirname, '../screenshot.png');
const outputPath = path.join(__dirname, '../screenshot.svg');

console.log('Tracing image:', imagePath);

potrace.trace(imagePath, {
  threshold: 180, // adjust threshold to catch green color perfectly
  turdSize: 10,
  optTolerance: 0.2
}, function(err, svg) {
  if (err) {
    console.error('Error tracing image:', err);
    process.exit(1);
  }
  fs.writeFileSync(outputPath, svg);
  console.log('SVG written to:', outputPath);
});
