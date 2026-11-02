// Draws build/icon.png (1024x1024): notes falling onto a lit key.
// Pure Node so the icon can be regenerated anywhere: `node scripts/make-icon.mjs`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZE = 1024;
const SS = 3; // supersamples per axis

const hex = (h, a = 1) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const BG = hex('#16161c');
const WHITE = hex('#f2f1ec');
const BLACK = hex('#1b1b1f');
const AMBER = hex('#ffb74d');
const CYAN = hex('#4fc3f7');

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// Keyboard: one octave, C to B.
const KB = { x0: 0.14, x1: 0.86, top: 0.64, bottom: 0.86 };
const WW = (KB.x1 - KB.x0) / 7;
const GAP = 0.008;
const whiteKey = (i) => ({ x0: KB.x0 + i * WW + GAP / 2, x1: KB.x0 + (i + 1) * WW - GAP / 2 });
const BW = WW * 0.58;
const blackKey = (afterWhite) => ({ x0: KB.x0 + (afterWhite + 1) * WW - BW / 2, x1: KB.x0 + (afterWhite + 1) * WW + BW / 2 });
const BLACKS = [0, 1, 3, 4, 5].map(blackKey);
const BLACK_BOTTOM = KB.top + (KB.bottom - KB.top) * 0.6;

const LIT = 4; // G, landing now
const lit = whiteKey(LIT);
const litCx = (lit.x0 + lit.x1) / 2;
const inset = WW * 0.12;

// Bars: [key x-range, top, bottom, colour]
const BARS = [
  [{ x0: lit.x0 + inset, x1: lit.x1 - inset }, 0.3, KB.top, AMBER],
  [{ x0: whiteKey(2).x0 + inset, x1: whiteKey(2).x1 - inset }, 0.12, 0.34, AMBER],
  [BLACKS[0], 0.2, 0.5, CYAN],
];

function over(dst, [r, g, b, a]) {
  const k = a * (1 - dst[3]);
  const out = dst[3] + k;
  if (out === 0) return [0, 0, 0, 0];
  return [(dst[0] * dst[3] + r * k) / out, (dst[1] * dst[3] + g * k) / out, (dst[2] * dst[3] + b * k) / out, out];
}

// Layers are listed top-most first and composited front to back with `over`.
function sample(x, y) {
  if (!inRoundRect(x, y, 0.04, 0.04, 0.96, 0.96, 0.2)) return [0, 0, 0, 0];
  let c = [0, 0, 0, 0];
  const inKbRow = y >= KB.top && y <= KB.bottom;
  for (const k of BLACKS) {
    if (inKbRow && y <= BLACK_BOTTOM && x >= k.x0 && x <= k.x1) c = over(c, BLACK);
  }
  for (let i = 0; i < 7; i++) {
    const k = whiteKey(i);
    if (inKbRow && x >= k.x0 && x <= k.x1) c = over(c, i === LIT ? over([...AMBER.slice(0, 3), 0.85], WHITE) : WHITE);
  }
  for (const [k, top, bottom, colour] of BARS) {
    if (inRoundRect(x, y, k.x0, top, k.x1, bottom, 0.018)) c = over(c, colour);
  }
  // Glow where the note lands.
  const d = Math.hypot((x - litCx) / 1.6, y - KB.top);
  if (d < 0.22) c = over(c, [...AMBER.slice(0, 3), 0.55 * (1 - d / 0.22) ** 2]);
  return over(c, BG);
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let py = 0; py < SIZE; py++) {
  raw[py * (SIZE * 4 + 1)] = 0; // filter: none
  for (let px = 0; px < SIZE; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const s = sample((px + (sx + 0.5) / SS) / SIZE, (py + (sy + 0.5) / SS) / SIZE);
        r += s[0] * s[3]; g += s[1] * s[3]; b += s[2] * s[3]; a += s[3];
      }
    }
    const o = py * (SIZE * 4 + 1) + 1 + px * 4;
    raw[o] = a ? Math.round(r / a) : 0;
    raw[o + 1] = a ? Math.round(g / a) : 0;
    raw[o + 2] = a ? Math.round(b / a) : 0;
    raw[o + 3] = Math.round((a / (SS * SS)) * 255);
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
writeFileSync(new URL('../build/icon.png', import.meta.url), png);
console.log(`build/icon.png ${png.length} bytes`);
