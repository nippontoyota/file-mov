// Pure TypeScript zero-dependency QR Code (Model 2) SVG generator
// Implements ISO/IEC 18004 Byte mode encoding, Reed-Solomon ECC, and SVG path rendering.

export type QrEccLevel = 'L' | 'M' | 'Q' | 'H';

// Galois Field GF(256) math
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_EXP[i + 255] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

function rsComputeRemainder(data: Uint8Array, numEcBytes: number): Uint8Array {
  // Generator polynomial for numEcBytes
  let gen = new Uint8Array([1]);
  for (let i = 0; i < numEcBytes; i++) {
    const next = new Uint8Array(gen.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gfMul(gen[j], factor);
      next[j + 1] ^= gen[j];
    }
    gen = next;
  }

  const remainder = new Uint8Array(numEcBytes);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    for (let j = 0; j < numEcBytes - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    remainder[numEcBytes - 1] = gfMul(gen[numEcBytes], factor);
  }
  return remainder;
}

// Version table: Total codewords, EC codewords per block, block counts
// [version, totalCodewords, ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsGroup1, numBlocksGroup2, dataCodewordsGroup2]
interface VersionSpec {
  version: number;
  size: number;
  totalCodewords: number;
  ecPerBlock: number;
  blocksG1: number;
  dataG1: number;
  blocksG2: number;
  dataG2: number;
}

// Specs for QR Version 1 to 10 with ECC Level 'M' (standard balance of size and error recovery)
const VERSION_SPECS_M: VersionSpec[] = [
  { version: 1, size: 21, totalCodewords: 26, ecPerBlock: 10, blocksG1: 1, dataG1: 16, blocksG2: 0, dataG2: 0 },
  { version: 2, size: 25, totalCodewords: 44, ecPerBlock: 16, blocksG1: 1, dataG1: 28, blocksG2: 0, dataG2: 0 },
  { version: 3, size: 29, totalCodewords: 70, ecPerBlock: 26, blocksG1: 1, dataG1: 44, blocksG2: 0, dataG2: 0 },
  { version: 4, size: 33, totalCodewords: 100, ecPerBlock: 18, blocksG1: 2, dataG1: 32, blocksG2: 0, dataG2: 0 },
  { version: 5, size: 37, totalCodewords: 134, ecPerBlock: 24, blocksG1: 2, dataG1: 43, blocksG2: 0, dataG2: 0 },
  { version: 6, size: 41, totalCodewords: 172, ecPerBlock: 16, blocksG1: 4, dataG1: 27, blocksG2: 0, dataG2: 0 },
  { version: 7, size: 45, totalCodewords: 196, ecPerBlock: 18, blocksG1: 4, dataG1: 31, blocksG2: 0, dataG2: 0 },
  { version: 8, size: 49, totalCodewords: 242, ecPerBlock: 22, blocksG1: 2, dataG1: 38, blocksG2: 2, dataG2: 39 },
  { version: 9, size: 53, totalCodewords: 292, ecPerBlock: 22, blocksG1: 3, dataG1: 36, blocksG2: 2, dataG2: 37 },
  { version: 10, size: 57, totalCodewords: 346, ecPerBlock: 26, blocksG1: 4, dataG1: 43, blocksG2: 1, dataG2: 44 },
];

const ALIGNMENT_PATTERN_POSITIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

function selectVersion(dataLength: number): VersionSpec {
  for (const spec of VERSION_SPECS_M) {
    const totalDataCapacity = spec.blocksG1 * spec.dataG1 + spec.blocksG2 * spec.dataG2;
    // Overhead: 4 bits mode + 8/16 bits character count + 4 bits terminator
    const charCountBits = spec.version < 10 ? 8 : 16;
    const maxDataBytes = Math.floor((totalDataCapacity * 8 - 4 - charCountBits) / 8);
    if (dataLength <= maxDataBytes) {
      return spec;
    }
  }
  return VERSION_SPECS_M[VERSION_SPECS_M.length - 1];
}

class BitBuffer {
  private bits: number[] = [];

  put(num: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((num >>> i) & 1);
    }
  }

  get length() {
    return this.bits.length;
  }

  getBytes(): Uint8Array {
    const bytes = new Uint8Array(Math.ceil(this.bits.length / 8));
    for (let i = 0; i < this.bits.length; i++) {
      if (this.bits[i]) {
        bytes[i >>> 3] |= 0x80 >>> (i & 7);
      }
    }
    return bytes;
  }
}

export function generateQrMatrix(text: string): boolean[][] {
  const utf8Encoder = new TextEncoder();
  const textBytes = utf8Encoder.encode(text);
  const spec = selectVersion(textBytes.length);
  const totalDataCapacity = spec.blocksG1 * spec.dataG1 + spec.blocksG2 * spec.dataG2;

  // 1. Encode into bitstream (Byte Mode: 0100)
  const bb = new BitBuffer();
  bb.put(0b0100, 4); // Byte mode indicator
  const charCountBits = spec.version < 10 ? 8 : 16;
  bb.put(textBytes.length, charCountBits);
  for (const b of textBytes) {
    bb.put(b, 8);
  }

  // Terminator (up to 4 zeroes)
  const remainingBits = totalDataCapacity * 8 - bb.length;
  const terminatorBits = Math.min(4, Math.max(0, remainingBits));
  bb.put(0, terminatorBits);

  // Byte align
  if (bb.length % 8 !== 0) {
    bb.put(0, 8 - (bb.length % 8));
  }

  // Pad bytes: alternating 0xEC, 0x11
  let padByte = 0xec;
  while (bb.length < totalDataCapacity * 8) {
    bb.put(padByte, 8);
    padByte = padByte === 0xec ? 0x11 : 0xec;
  }

  const dataBytes = bb.getBytes();

  // 2. Split into blocks and compute Reed-Solomon EC bytes
  const blocks: { data: Uint8Array; ec: Uint8Array }[] = [];
  let byteOffset = 0;

  for (let b = 0; b < spec.blocksG1; b++) {
    const slice = dataBytes.subarray(byteOffset, byteOffset + spec.dataG1);
    byteOffset += spec.dataG1;
    const ec = rsComputeRemainder(slice, spec.ecPerBlock);
    blocks.push({ data: slice, ec });
  }
  for (let b = 0; b < spec.blocksG2; b++) {
    const slice = dataBytes.subarray(byteOffset, byteOffset + spec.dataG2);
    byteOffset += spec.dataG2;
    const ec = rsComputeRemainder(slice, spec.ecPerBlock);
    blocks.push({ data: slice, ec });
  }

  // Interleave data codewords
  const interleaved = new Uint8Array(spec.totalCodewords);
  let writeIdx = 0;
  const maxDataLen = Math.max(spec.dataG1, spec.dataG2);
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of blocks) {
      if (i < blk.data.length) {
        interleaved[writeIdx++] = blk.data[i];
      }
    }
  }
  // Interleave EC codewords
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const blk of blocks) {
      interleaved[writeIdx++] = blk.ec[i];
    }
  }

  // 3. Construct Matrix
  const N = spec.size;
  const matrix: (boolean | null)[][] = Array.from({ length: N }, () => Array(N).fill(null));
  const isFunction: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

  const setModule = (r: number, c: number, val: boolean, isFunc = true) => {
    if (r >= 0 && r < N && c >= 0 && c < N) {
      matrix[r][c] = val;
      if (isFunc) isFunction[r][c] = true;
    }
  };

  // Finder patterns (3 corners: top-left, top-right, bottom-left)
  const drawFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = top + r;
        const nc = left + c;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        const isBorder = r === -1 || r === 7 || c === -1 || c === 7;
        const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setModule(nr, nc, !isBorder && (isOuter || isInner));
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, N - 7);
  drawFinder(N - 7, 0);

  // Timing patterns
  for (let i = 8; i < N - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const alignPos = ALIGNMENT_PATTERN_POSITIONS[spec.version] || [];
  for (const r of alignPos) {
    for (const c of alignPos) {
      // Don't draw if overlapping with finders
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= N - 9) || (r >= N - 9 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBlack = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setModule(r + dr, c + dc, isBlack);
        }
      }
    }
  }

  // Dark module
  setModule(N - 8, 8, true);

  // Reserve format info areas
  for (let i = 0; i < 9; i++) {
    setModule(8, i, false);
    setModule(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    setModule(8, N - 1 - i, false);
    setModule(N - 1 - i, 8, false);
  }

  // 4. Place Data Codewords (zigzag columns right to left)
  let bitIdx = 0;
  const totalBits = interleaved.length * 8;
  let upwards = true;

  for (let right = N - 1; right > 0; right -= 2) {
    if (right === 6) right = 5; // Skip vertical timing column
    const rows = upwards
      ? Array.from({ length: N }, (_, i) => N - 1 - i)
      : Array.from({ length: N }, (_, i) => i);

    for (const r of rows) {
      for (const col of [right, right - 1]) {
        if (!isFunction[r][col]) {
          let bit = false;
          if (bitIdx < totalBits) {
            const byte = interleaved[bitIdx >>> 3];
            bit = ((byte >>> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          // Mask pattern 000: (r + col) % 2 === 0
          const mask = (r + col) % 2 === 0;
          matrix[r][col] = bit !== mask;
        }
      }
    }
    upwards = !upwards;
  }

  // 5. Format info for ECC 'M' (00) and Mask 000 (000) -> 00000
  // Standard BCH(15,5) format for 00000 xor 101010000010010 = 101010000010010
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

  // Top-left format placement
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 0; i < 6; i++) matrix[5 - i][8] = formatBits[9 + i] === 1;

  // Split format placement (bottom-left and top-right)
  for (let i = 0; i < 7; i++) matrix[N - 1 - i][8] = formatBits[i] === 1;
  for (let i = 0; i < 8; i++) matrix[8][N - 8 + i] = formatBits[7 + i] === 1;

  return matrix.map(row => row.map(v => v === true));
}

export function renderQrSvg(text: string, size = 180): string {
  const matrix = generateQrMatrix(text);
  const n = matrix.length;
  const padding = 3;
  const total = n + padding * 2;
  const cellSize = size / total;

  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const x = (c + padding) * cellSize;
        const y = (r + padding) * cellSize;
        path += `M${x.toFixed(2)},${y.toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges" aria-label="QR Code">
    <rect width="${size}" height="${size}" fill="#ffffff" />
    <path d="${path.trim()}" fill="#000000" />
  </svg>`;
}
