// Generates src-tauri/icons/icon.png (1024×1024) from Luna's 16×16 pixel
// grid — the same sprite the app renders. No dependencies: the PNG is
// encoded by hand (zlib ships with Node).
//
//   bun scripts/generate-icon.mjs
//   bunx tauri icon src-tauri/icons/icon.png   # derive .ico/.icns/… set

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const SIZE = 1024;
const SCALE = SIZE / 16;

const ROWS = [
  "...##......##...",
  "..PPPP....PPPP..",
  "..#############.",
  ".##############.",
  ".##############.",
  ".##############.",
  ".####EE##EE####.",
  ".####EE##EE####.",
  ".##############.",
  ".######PP######.",
  ".##############.",
  "..#############..",
  "..###########....",
  "..###CCCC###.....",
  "..######.........",
  "................",
];

const COLORS = {
  "#": [0x3f, 0x41, 0x47], // warm charcoal body
  P: [0xf2, 0xa6, 0xb8], // pink ears / nose
  E: [0xfd, 0xf6, 0xee], // cream eyes
  C: [0x0f, 0x76, 0x6e], // teal collar
};

// --- draw the sprite, scaled up, on a transparent canvas ---
const pixels = new Uint8Array(SIZE * SIZE * 4);
for (let y = 0; y < 16; y++) {
  for (let x = 0; x < 16; x++) {
    const cell = ROWS[y][x];
    if (cell === "." || cell === " ") continue;
    const [r, g, b] = COLORS[cell];
    if (!r && !g && !b) continue;
    for (let dy = 0; dy < SCALE; dy++) {
      for (let dx = 0; dx < SCALE; dx++) {
        const i = ((y * SCALE + dy) * SIZE + (x * SCALE + dx)) * 4;
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
        pixels[i + 3] = 255;
      }
    }
  }
}

// --- minimal PNG encoder ---
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); // width
ihdr.writeUInt32BE(SIZE, 4); // height
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type: RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// each scanline is prefixed with filter byte 0 (None)
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (SIZE * 4 + 1);
  raw[rowStart] = 0;
  Buffer.from(pixels.buffer, y * SIZE * 4, SIZE * 4).copy(raw, rowStart + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync("src-tauri/icons/icon.png", png);
console.log(`wrote src-tauri/icons/icon.png (${SIZE}×${SIZE}, ${png.length} bytes)`);
