// Draws the app icons (poster sun over a dark hill) and writes them as PNG.
// No image library needed: a small rasterizer with anti-aliasing and Node's zlib.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../docs/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const BANDS = ['#E8503F', '#F0663B', '#F67E38', '#FA9537', '#FDAD3A', '#FEC447', '#FFD762'].map(rgb);
const SUN = rgb('#FFF7CC');
const HILL_FAR = rgb('#7A2A56');
const HILL_NEAR = rgb('#1A1130');

/** Color of the artwork at (x, y), both 0..1. `zoom` < 1 keeps it inside the mask's safe zone. */
function shade(x, y, zoom) {
  const u = (x - 0.5) / zoom + 0.5;
  const v = (y - 0.5) / zoom + 0.5;
  const nearY = 0.74 + 0.028 * Math.sin(u * 5.2 + 0.6) + 0.012 * Math.sin(u * 13);
  if (v > nearY) return HILL_NEAR;
  const farY = 0.655 + 0.04 * Math.sin(u * 4.1 + 3.4) + 0.012 * Math.sin(u * 11 + 1);
  if (v > farY) return HILL_FAR;
  const d = Math.hypot(u - 0.5, v - 0.55);
  if (d < 0.17) return SUN;
  const radii = [0.235, 0.31, 0.4, 0.5, 0.62, 0.78];
  for (let i = 0; i < radii.length; i++) if (d < radii[i]) return BANDS[BANDS.length - 1 - i];
  return BANDS[0];
}

function draw(size, zoom, rounded) {
  const ss = 4;
  const px = Buffer.alloc(size * size * 4);
  const radius = 0.225;
  for (let py = 0; py < size; py++) {
    for (let pxx = 0; pxx < size; pxx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (pxx + (sx + 0.5) / ss) / size;
          const y = (py + (sy + 0.5) / ss) / size;
          if (rounded) {
            const dx = Math.max(Math.abs(x - 0.5) - (0.5 - radius), 0);
            const dy = Math.max(Math.abs(y - 0.5) - (0.5 - radius), 0);
            if (Math.hypot(dx, dy) > radius) continue;
          }
          const c = shade(x, y, zoom);
          r += c[0];
          g += c[1];
          b += c[2];
          a++;
        }
      }
      const i = (py * size + pxx) * 4;
      if (a) {
        px[i] = Math.round(r / a);
        px[i + 1] = Math.round(g / a);
        px[i + 2] = Math.round(b / a);
      }
      px[i + 3] = Math.round((a / (ss * ss)) * 255);
    }
  }
  return px;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const FILES = [
  ['icon-192.png', 192, 1, true],
  ['icon-512.png', 512, 1, true],
  ['icon-maskable-512.png', 512, 0.82, false],
  ['apple-touch-icon.png', 180, 1, false],
  ['favicon.png', 64, 1, true],
];
for (const [name, size, zoom, rounded] of FILES) {
  writeFileSync(new URL(name, OUT), png(size, draw(size, zoom, rounded)));
}
console.log(`${FILES.length} Icons geschrieben`);
