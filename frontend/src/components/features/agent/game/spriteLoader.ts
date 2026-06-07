export class SpriteLoader {
  private static instance: SpriteLoader | null = null;
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private cacheName = 'poke-sprites-v1';
  private constructor() {}
  public static getInstance(): SpriteLoader {
    if (!SpriteLoader.instance) {
      SpriteLoader.instance = new SpriteLoader();
    }
    return SpriteLoader.instance;
  }
  public async load(url: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => {
        this.imageCache.set(url, img);
        resolve(img);
      };
      img.onerror = (e) => {
        reject(new Error(`Failed to load image at: ${url}`));
      };
    });
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await caches.open(this.cacheName);
        const cachedResponse = await cache.match(url);
        if (cachedResponse) {
          const blob = await cachedResponse.blob();
          img.src = URL.createObjectURL(blob);
          return loadPromise;
        } else {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response.clone());
            const blob = await response.blob();
            img.src = URL.createObjectURL(blob);
            return loadPromise;
          }
        }
      } catch (err) {
        console.warn('Cache storage API failed, falling back to standard image load:', err);
      }
    }
    img.src = url;
    return loadPromise;
  }
  public destroy() {
    this.imageCache.clear();
  }
}
export function drawProceduralSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  timeSec: number,
  animType: 'breathing' | 'waddle' | 'bounce' | 'squish',
  label?: string
) {
  ctx.save();
  let targetX = x;
  let targetY = y;
  let targetW = w;
  let targetH = h;
  let rotation = 0;
  const pulse = timeSec * 6;
  switch (animType) {
    case 'breathing':
      const breath = Math.sin(pulse) * 0.05;
      targetH = h * (1 + breath);
      targetY = y - (targetH - h);
      break;
    case 'waddle':
      rotation = Math.sin(pulse) * 0.15;
      ctx.translate(x + w / 2, y + h);
      ctx.rotate(rotation);
      targetX = -w / 2;
      targetY = -h;
      break;
    case 'bounce':
      const bounce = Math.abs(Math.sin(pulse)) * 12;
      targetY = y - bounce;
      if (bounce < 2) {
        targetW = w * 1.1;
        targetH = h * 0.9;
        targetX = x - (targetW - w) / 2;
        targetY = y - (targetH - h);
      }
      break;
    case 'squish':
      const squishVal = Math.sin(pulse) * 0.08;
      targetW = w * (1 + squishVal);
      targetH = h * (1 - squishVal);
      targetX = x - (targetW - w) / 2;
      targetY = y - (targetH - h);
      break;
  }
  if (img) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, targetX, targetY, targetW, targetH);
  } else {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
    ctx.beginPath();
    ctx.arc(targetX + targetW / 2, targetY + targetH / 2, targetW / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
  if (label) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y - 8);
  }
}
