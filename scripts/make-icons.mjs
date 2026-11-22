// Draws the app icon (a smiling pawn) to public/ as SVG and PNG, with no
// dependencies. Run: node scripts/make-icons.mjs
// Pattern from word-bots. Shapes sit inside the maskable safe zone
// (a circle of radius 205 around the centre), so tablets can crop it.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const GREEN = '#5d9948', CREAM = '#fdf8ee', INK = '#312e2b', PINK = '#f2a7a0';

// Shapes in a 512 coordinate space, drawn in order (later wins).
const shapes = [
  { kind: 'rect', x: 0, y: 0, w: 512, h: 512, r: 0, fill: GREEN },
  { kind: 'poly', points: [[212, 250], [300, 250], [342, 372], [170, 372]], fill: CREAM },
  { kind: 'rect', x: 184, y: 226, w: 144, h: 32, r: 16, fill: CREAM },
  { kind: 'rect', x: 136, y: 360, w: 240, h: 56, r: 22, fill: CREAM },
  { kind: 'circle', cx: 256, cy: 168, r: 64, fill: CREAM },
  // Smile: an ink circle with a cream circle over its top half.
  { kind: 'circle', cx: 256, cy: 184, r: 18, fill: INK },
  { kind: 'circle', cx: 256, cy: 176, r: 19, fill: CREAM },
  { kind: 'circle', cx: 234, cy: 154, r: 9, fill: INK },
  { kind: 'circle', cx: 278, cy: 154, r: 9, fill: INK },
  { kind: 'circle', cx: 218, cy: 182, r: 10, fill: PINK },
  { kind: 'circle', cx: 294, cy: 182, r: 10, fill: PINK },
];

function inside(s, px, py) {
  if (s.kind === 'circle') return (px - s.cx) ** 2 + (py - s.cy) ** 2 <= s.r * s.r;
  if (s.kind === 'rect') {
    if (px < s.x || px > s.x + s.w || py < s.y || py > s.y + s.h) return false;
    const dx = Math.max(s.x + s.r - px, 0, px - (s.x + s.w - s.r));
    const dy = Math.max(s.y + s.r - py, 0, py - (s.y + s.h - s.r));
    return dx * dx + dy * dy <= s.r * s.r;
  }
  let hit = false; // even-odd ray cast
  for (let i = 0, j = s.points.length - 1; i < s.points.length; j = i++) {
    const [xi, yi] = s.points[i], [xj, yj] = s.points[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function svg() {
  const body = shapes.map((s) => {
    if (s.kind === 'circle') return `  <circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${s.fill}"/>`;
    if (s.kind === 'rect') return `  <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${s.fill}"/>`;
    return `  <polygon points="${s.points.map((p) => p.join(',')).join(' ')}" fill="${s.fill}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n${body.join('\n')}\n</svg>\n`;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const SS = 4; // supersamples per axis, for smooth edges
  const colours = shapes.map((s) => rgb(s.fill));
  const row = size * 3 + 1;
  const raw = Buffer.alloc(size * row);
  const scale = 512 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) * scale, py = (y + (sy + 0.5) / SS) * scale;
          let col = colours[0];
          shapes.forEach((s, i) => { if (inside(s, px, py)) col = colours[i]; });
          for (let k = 0; k < 3; k++) sum[k] += col[k];
        }
      }
      raw.set(sum.map((v) => Math.round(v / (SS * SS))), y * row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/icon.svg', svg());
for (const size of [180, 192, 512]) writeFileSync(`public/icon-${size}.png`, png(size));
console.log('icons written');
