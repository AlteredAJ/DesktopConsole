// Regenerates the listener tray/app icon: a console-gamepad glyph on a graphite
// plate, rendered analytically (anti-aliased signed-distance shapes) and encoded
// as a multi-size PNG-in-ICO — no browser or image library needed.
//
//   node tools/gen-icon.cjs   ->  listener/src-tauri/icons/icon.ico
//
// Original stylized controller silhouette, not a trademarked DualSense.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function pngEncode(S, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(S * (S * 4 + 1));
  for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; rgba.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, y * S * 4 + S * 4); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}
function icoEncode(entries) {
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
  let offset = 6 + entries.length * 16; const dir = []; const blobs = [];
  for (const e of entries) {
    const d = Buffer.alloc(16);
    d[0] = e.S >= 256 ? 0 : e.S; d[1] = e.S >= 256 ? 0 : e.S;
    d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6);
    d.writeUInt32LE(e.png.length, 8); d.writeUInt32LE(offset, 12);
    dir.push(d); blobs.push(e.png); offset += e.png.length;
  }
  return Buffer.concat([head, ...dir, ...blobs]);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function render(S) {
  const buf = new Float32Array(S * S * 4);
  const over = (i, r, g, b, a) => { if (a <= 0) return; const da = buf[i + 3], o = a + da * (1 - a); if (o <= 0) return; buf[i] = (r * a + buf[i] * da * (1 - a)) / o; buf[i + 1] = (g * a + buf[i + 1] * da * (1 - a)) / o; buf[i + 2] = (b * a + buf[i + 2] * da * (1 - a)) / o; buf[i + 3] = o; };
  const sdCircle = (px, py, cx, cy, r) => Math.hypot(px - cx * S, py - cy * S) - r * S;
  const sdRoundRect = (px, py, x, y, w, h, r) => { const hw = w * S / 2, hh = h * S / 2, rr = r * S, cx = x * S + hw, cy = y * S + hh, qx = Math.abs(px - cx) - hw + rr, qy = Math.abs(py - cy) - hh + rr; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr; };
  const fill = (sdf, colorFn) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const cov = clamp(0.5 - sdf(x + 0.5, y + 0.5), 0, 1); if (cov > 0) { const c = colorFn(x + 0.5, y + 0.5); over((y * S + x) * 4, c[0], c[1], c[2], cov * (c[3] === undefined ? 1 : c[3])); } } };
  const solid = (r, g, b, a) => () => [r, g, b, a];
  fill((px, py) => sdRoundRect(px, py, 0.06, 0.06, 0.88, 0.88, 0.22), (px, py) => { const t = clamp((py / S - 0.06) / 0.88, 0, 1); return [lerp(38, 11, t), lerp(50, 15, t), lerp(74, 23, t), 1]; });
  fill((px, py) => sdRoundRect(px, py, 0.06, 0.06, 0.88, 0.42, 0.22), solid(255, 255, 255, 0.05));
  const white = solid(238, 243, 251, 1);
  fill((px, py) => sdCircle(px, py, 0.335, 0.605, 0.145), white);
  fill((px, py) => sdCircle(px, py, 0.665, 0.605, 0.145), white);
  fill((px, py) => sdRoundRect(px, py, 0.215, 0.415, 0.57, 0.205, 0.10), white);
  const dark = solid(20, 28, 43, 1);
  fill((px, py) => sdRoundRect(px, py, 0.343, 0.475, 0.034, 0.11, 0.008), dark);
  fill((px, py) => sdRoundRect(px, py, 0.312, 0.508, 0.096, 0.034, 0.008), dark);
  fill((px, py) => sdCircle(px, py, 0.655, 0.487, 0.02), dark);
  fill((px, py) => sdCircle(px, py, 0.655, 0.567, 0.02), dark);
  fill((px, py) => sdCircle(px, py, 0.618, 0.527, 0.02), dark);
  fill((px, py) => sdCircle(px, py, 0.692, 0.527, 0.02), dark);
  fill((px, py) => sdRoundRect(px, py, 0.455, 0.44, 0.09, 0.055, 0.02), solid(15, 22, 34, 1));
  fill((px, py) => sdCircle(px, py, 0.44, 0.605, 0.05), dark);
  fill((px, py) => sdCircle(px, py, 0.56, 0.605, 0.05), dark);
  fill((px, py) => sdCircle(px, py, 0.44, 0.605, 0.028), solid(42, 53, 80, 1));
  fill((px, py) => sdCircle(px, py, 0.56, 0.605, 0.028), solid(42, 53, 80, 1));
  const out = Buffer.alloc(S * S * 4);
  for (let i = 0; i < S * S; i++) { out[i * 4] = clamp(Math.round(buf[i * 4]), 0, 255); out[i * 4 + 1] = clamp(Math.round(buf[i * 4 + 1]), 0, 255); out[i * 4 + 2] = clamp(Math.round(buf[i * 4 + 2]), 0, 255); out[i * 4 + 3] = clamp(Math.round(buf[i * 4 + 3] * 255), 0, 255); }
  return out;
}

const png = (S) => pngEncode(S, render(S));
const ico = icoEncode([16, 24, 32, 48, 64, 128, 256].map((S) => ({ S, png: png(S) })));
const dest = path.join(__dirname, "..", "listener", "src-tauri", "icons", "icon.ico");
fs.writeFileSync(dest, ico);
console.log("wrote " + dest + " (" + ico.length + " bytes, 7 sizes)");
