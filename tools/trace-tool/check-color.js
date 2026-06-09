const fs = require('fs');
const PNG = require('pngjs').PNG;

fs.createReadStream('../screenshot.png')
  .pipe(new PNG())
  .on('parsed', function() {
    const colors = new Map();
    for (let y = 0; y < this.height; y += 4) {
      for (let x = 0; x < this.width; x += 4) {
        const idx = (this.width * y + x) << 2;
        const r = this.data[idx];
        const g = this.data[idx+1];
        const b = this.data[idx+2];
        const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
        colors.set(hex, (colors.get(hex) || 0) + 1);
      }
    }
    const sorted = [...colors.entries()].sort((a, b) => b[1] - a[1]);
    console.log('Top colors (hex: count):', sorted.slice(0, 10));
  });
