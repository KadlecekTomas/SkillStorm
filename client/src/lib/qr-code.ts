type Module = boolean | null;

type QrSpec = {
  version: 4 | 5;
  size: number;
  dataCodewords: number;
  eccCodewords: number;
  alignment: number[];
};

const SPECS: QrSpec[] = [
  { version: 4, size: 33, dataCodewords: 80, eccCodewords: 20, alignment: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, eccCodewords: 26, alignment: [6, 30] },
];

function bitLength(value: number): number {
  let length = 0;
  while (value !== 0) {
    length += 1;
    value >>>= 1;
  }
  return length;
}

function formatBits(mask = 0): number {
  const data = (1 << 3) | mask; // Error correction L = 01.
  let value = data << 10;
  const generator = 0x537;
  while (bitLength(value) - bitLength(generator) >= 0) {
    value ^= generator << (bitLength(value) - bitLength(generator));
  }
  return ((data << 10) | value) ^ 0x5412;
}

function gfTables(): { exp: number[]; log: number[] } {
  const exp = new Array<number>(512).fill(0);
  const log = new Array<number>(256).fill(0);
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    exp[i] = value;
    log[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255]!;
  return { exp, log };
}

const GF = gfTables();

function gfMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF.exp[GF.log[a]! + GF.log[b]!]!;
}

function generatorPolynomial(degree: number): number[] {
  let polynomial = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(polynomial.length + 1).fill(0);
    for (let j = 0; j < polynomial.length; j += 1) {
      next[j] = (next[j] ?? 0) ^ polynomial[j]!;
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMultiply(polynomial[j]!, GF.exp[i]!);
    }
    polynomial = next;
  }
  return polynomial;
}

function reedSolomon(data: number[], degree: number): number[] {
  const generator = generatorPolynomial(degree);
  const working = [...data, ...new Array<number>(degree).fill(0)];
  for (let i = 0; i < data.length; i += 1) {
    const factor = working[i]!;
    if (factor === 0) continue;
    for (let j = 0; j < generator.length; j += 1) {
      working[i + j] = (working[i + j] ?? 0) ^ gfMultiply(generator[j]!, factor);
    }
  }
  return working.slice(data.length);
}

function appendBits(target: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i -= 1) target.push((value >>> i) & 1);
}

function chooseSpec(byteLength: number): QrSpec {
  const spec = SPECS.find(({ dataCodewords }) => byteLength <= dataCodewords - 2);
  if (!spec) throw new Error('QR payload is too long for the classroom join code.');
  return spec;
}

function dataCodewords(text: string, spec: QrSpec): number[] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4); // Byte mode.
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) appendBits(bits, byte, 8);

  const capacity = spec.dataCodewords * 8;
  for (let i = 0; i < Math.min(4, capacity - bits.length); i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let offset = 0; offset < bits.length; offset += 8) {
    let byte = 0;
    for (let i = 0; i < 8; i += 1) byte = (byte << 1) | (bits[offset + i] ?? 0);
    codewords.push(byte);
  }
  let pad = 0;
  while (codewords.length < spec.dataCodewords) {
    codewords.push(pad % 2 === 0 ? 0xec : 0x11);
    pad += 1;
  }
  return codewords;
}

function createMatrix(size: number): Module[][] {
  return Array.from({ length: size }, () => new Array<Module>(size).fill(null));
}

function setFinder(matrix: Module[][], row: number, col: number): void {
  const size = matrix.length;
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const y = row + r;
      const x = col + c;
      if (y < 0 || x < 0 || y >= size || x >= size) continue;
      const dark =
        r >= 0 &&
        r <= 6 &&
        c >= 0 &&
        c <= 6 &&
        (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      matrix[y]![x] = dark;
    }
  }
}

function setAlignment(matrix: Module[][], centers: number[]): void {
  for (const row of centers) {
    for (const col of centers) {
      if (matrix[row]?.[col] !== null) continue;
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          matrix[row + r]![col + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        }
      }
    }
  }
}

function setTiming(matrix: Module[][]): void {
  const size = matrix.length;
  for (let i = 8; i < size - 8; i += 1) {
    if (matrix[i]![6] === null) matrix[i]![6] = i % 2 === 0;
    if (matrix[6]![i] === null) matrix[6]![i] = i % 2 === 0;
  }
}

function setFormat(matrix: Module[][]): void {
  const size = matrix.length;
  const bits = formatBits(0);
  for (let i = 0; i < 15; i += 1) {
    const dark = ((bits >>> i) & 1) === 1;
    if (i < 6) matrix[i]![8] = dark;
    else if (i < 8) matrix[i + 1]![8] = dark;
    else matrix[size - 15 + i]![8] = dark;

    if (i < 8) matrix[8]![size - i - 1] = dark;
    else if (i < 9) matrix[8]![15 - i] = dark;
    else matrix[8]![15 - i - 1] = dark;
  }
  matrix[size - 8]![8] = true;
}

function mask0(row: number, col: number): boolean {
  return (row + col) % 2 === 0;
}

function placeData(matrix: Module[][], codewords: number[]): void {
  const size = matrix.length;
  let row = size - 1;
  let direction = -1;
  let byteIndex = 0;
  let bitIndex = 7;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    while (true) {
      for (let offset = 0; offset < 2; offset += 1) {
        const x = col - offset;
        if (matrix[row]![x] !== null) continue;
        let dark = false;
        if (byteIndex < codewords.length) {
          dark = ((codewords[byteIndex]! >>> bitIndex) & 1) === 1;
        }
        if (mask0(row, x)) dark = !dark;
        matrix[row]![x] = dark;
        bitIndex -= 1;
        if (bitIndex < 0) {
          byteIndex += 1;
          bitIndex = 7;
        }
      }
      row += direction;
      if (row < 0 || row >= size) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }
}

export function qrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const spec = chooseSpec(bytes.length);
  const data = dataCodewords(text, spec);
  const ecc = reedSolomon(data, spec.eccCodewords);
  const matrix = createMatrix(spec.size);

  setFinder(matrix, 0, 0);
  setFinder(matrix, spec.size - 7, 0);
  setFinder(matrix, 0, spec.size - 7);
  setAlignment(matrix, spec.alignment);
  setTiming(matrix);
  setFormat(matrix);
  placeData(matrix, [...data, ...ecc]);

  return matrix.map((row) => row.map((cell) => Boolean(cell)));
}

export function classroomCodeFromSessionId(sessionId: string): string {
  const compact = sessionId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
}
