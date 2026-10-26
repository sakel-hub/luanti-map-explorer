import pako from 'pako';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32BE(out: Uint8Array, offset: number, val: number): void {
  out[offset] = (val >>> 24) & 0xff;
  out[offset + 1] = (val >>> 16) & 0xff;
  out[offset + 2] = (val >>> 8) & 0xff;
  out[offset + 3] = val & 0xff;
}

function makeChunk(typeAscii: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const chunk = new Uint8Array(12 + len);
  writeUint32BE(chunk, 0, len);
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = typeAscii.charCodeAt(i);
  }
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  writeUint32BE(chunk, 8 + len, crc);
  return chunk;
}

/**
 * Ultra-fast synchronous RGBA to PNG ArrayBuffer encoder (< 1ms per tile).
 * Works identically inside Web Workers, all browsers, and Vitest unit tests.
 */
export function encodeRgbaToPngBuffer(width: number, height: number, rgba: Uint8Array): ArrayBuffer {
  const rowBytes = width * 4;
  const rawScanlines = new Uint8Array((rowBytes + 1) * height);

  for (let y = 0; y < height; y++) {
    const outOffset = y * (rowBytes + 1);
    rawScanlines[outOffset] = 0; // Filter type 0 (None)
    const srcOffset = y * rowBytes;
    rawScanlines.set(rgba.subarray(srcOffset, srcOffset + rowBytes), outOffset + 1);
  }

  // Use level: 1 (fast compression) for high-performance in-memory WebGL tile decoding
  const compressedIdat = pako.deflate(rawScanlines, { level: 1 });

  const ihdrData = new Uint8Array(13);
  writeUint32BE(ihdrData, 0, width);
  writeUint32BE(ihdrData, 4, height);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressedIdat);
  const iendChunk = makeChunk('IEND', new Uint8Array(0));

  const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const totalLen = pngSignature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const output = new Uint8Array(totalLen);

  let cursor = 0;
  output.set(pngSignature, cursor);
  cursor += pngSignature.length;
  output.set(ihdrChunk, cursor);
  cursor += ihdrChunk.length;
  output.set(idatChunk, cursor);
  cursor += idatChunk.length;
  output.set(iendChunk, cursor);

  return output.buffer;
}
