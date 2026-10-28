"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const output = path.join(__dirname, "..", "assets");
fs.mkdirSync(output, { recursive: true });
const size = 256;
const scale = size / 64;
const rgba = Buffer.alloc(size * size * 4);
const glyphs = {
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"]
};

function roundedDistance(x, y, left, top, right, bottom, radius) {
  const qx = Math.abs(x - (left + right) / 2) - ((right - left) / 2 - radius);
  const qy = Math.abs(y - (top + bottom) / 2) - ((bottom - top) / 2 - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function coverage(fn, x, y) {
  let total = 0;
  const samples = 4;
  for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
    if (fn((x + (sx + 0.5) / samples) / scale, (y + (sy + 0.5) / samples) / scale)) total++;
  }
  return total / (samples * samples);
}

function paint(x, y, color, amount) {
  const index = (y * size + x) * 4;
  const previousAlpha = rgba[index + 3] / 255;
  const combined = amount + previousAlpha * (1 - amount);
  if (!combined) return;
  const oldWeight = previousAlpha * (1 - amount) / combined;
  rgba[index] = Math.round(color[0] * (1 - oldWeight) + rgba[index] * oldWeight);
  rgba[index + 1] = Math.round(color[1] * (1 - oldWeight) + rgba[index + 1] * oldWeight);
  rgba[index + 2] = Math.round(color[2] * (1 - oldWeight) + rgba[index + 2] * oldWeight);
  rgba[index + 3] = Math.round(combined * 255);
}

for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const px = (x + 0.5) / scale, py = (y + 0.5) / scale;
  const outer = roundedDistance(px, py, 4, 4, 60, 60, 15);
  const fill = coverage((sx, sy) => roundedDistance(sx, sy, 4, 4, 60, 60, 15) <= 0, x, y);
  paint(x, y, [11, 14, 16], fill);
  const border = coverage((sx, sy) => { const d = roundedDistance(sx, sy, 4, 4, 60, 60, 15); return d <= 0 && d >= -1.3; }, x, y);
  paint(x, y, [145, 132, 107], border * 0.78);
  const ellipse = Math.abs(Math.hypot((px - 32) / 16, (py - 30) / 12) - 1);
  if (ellipse < 0.055) paint(x, y, [124, 147, 140], coverage((sx, sy) => Math.abs(Math.hypot((sx - 32) / 16, (sy - 30) / 12) - 1) < 0.055, x, y) * 0.72);
  const diagonalX = 32 + (py - 15) * 0.64;
  if (py >= 15 && py <= 37 && Math.abs(px - diagonalX) < 1.05) paint(x, y, [228, 221, 205], coverage((sx, sy) => Math.abs(sx - (32 + (sy - 15) * 0.64)) < 1.05 && sy >= 15 && sy <= 37, x, y));
  const dot = Math.hypot(px - 49, py - 16);
  if (dot < 2.4) paint(x, y, [185, 154, 111], coverage((sx, sy) => Math.hypot(sx - 49, sy - 16) < 2.4, x, y));
  for (const [letter, left] of [["D", 13], ["F", 26], ["C", 39]]) {
    const gx = Math.floor((px - left) / 2.35), gy = Math.floor((py - 40) / 2.35);
    if (gx >= 0 && gx < 5 && gy >= 0 && gy < 7 && glyphs[letter][gy][gx] === "1") {
      paint(x, y, [225, 221, 211], coverage((sx, sy) => {
        const bx = Math.floor((sx - left) / 2.35), by = Math.floor((sy - 40) / 2.35);
        return bx >= 0 && bx < 5 && by >= 0 && by < 7 && glyphs[letter][by][bx] === "1";
      }, x, y));
    }
  }
  void outer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

const scanlines = Buffer.alloc(size * (size * 4 + 1));
for (let y = 0; y < size; y++) rgba.copy(scanlines, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header), pngChunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]);
fs.writeFileSync(path.join(output, "tray.png"), png);

const iconHeader = Buffer.alloc(22);
iconHeader.writeUInt16LE(0, 0); iconHeader.writeUInt16LE(1, 2); iconHeader.writeUInt16LE(1, 4);
iconHeader[6] = size === 256 ? 0 : size; iconHeader[7] = size === 256 ? 0 : size; iconHeader[8] = 0; iconHeader[9] = 0;
iconHeader.writeUInt16LE(1, 10); iconHeader.writeUInt16LE(32, 12); iconHeader.writeUInt32LE(png.length, 14); iconHeader.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(output, "qg.ico"), Buffer.concat([iconHeader, png]));

