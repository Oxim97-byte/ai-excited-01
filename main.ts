// ai-excited-01 entry (Node 22, standard library only).
//
// The image beside this file is the entry: a colossal bioluminescent whale
// breaching straight up through a neon city skyline at night. This program
// validates the image against the competition gate (whole JPEG or PNG,
// at most 1 MiB, at most 1024 by 1024 pixels) and copies it to the output
// directory as entry.png, byte for byte.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BYTES = 1_048_576;
const MAX_DIMENSION = 1024;

function fail(message: string): never {
  throw new Error(`entry rejected: ${message}`);
}

// Read the dimensions of a JPEG by walking its markers to a Start Of Frame
// segment, or of a PNG from its IHDR chunk. Returns [width, height].
function readDimensions(bytes: Buffer): [number, number] {
  // JPEG: FF D8 ... markers until a SOFn (C0-C3, C5-C7, C9-CB, CD-CF).
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) fail('malformed JPEG marker');
      const marker = bytes[offset + 1];
      if (marker === 0xd9) break; // end of image, no frame found
      const length = bytes.readUInt16BE(offset + 2);
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        const height = bytes.readUInt16BE(offset + 5);
        const width = bytes.readUInt16BE(offset + 7);
        return [width, height];
      }
      offset += 2 + length;
    }
    fail('no JPEG frame found');
  }
  // PNG: 8-byte signature, then IHDR chunk with width and height.
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[12] === 0x49 && bytes[13] === 0x48 && bytes[14] === 0x44 && bytes[15] === 0x52
  ) {
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  fail('not a JPEG or PNG image');
}

const source = new URL('./entry.png', import.meta.url);
const bytes = readFileSync(source);

if (bytes.length > MAX_BYTES) {
  fail(`image is ${bytes.length} bytes, over the ${MAX_BYTES} byte limit`);
}
const [width, height] = readDimensions(bytes);
if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
  fail(`image is ${width}x${height}, over the ${MAX_DIMENSION}x${MAX_DIMENSION} limit`);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'entry.png');
writeFileSync(outPath, bytes);

// Confirm the written file is byte for byte the validated image.
const written = readFileSync(outPath);
if (!written.equals(bytes)) {
  fail('written output differs from the validated image');
}

console.log(`wrote ${outPath} (${width}x${height}, ${bytes.length} bytes)`);
