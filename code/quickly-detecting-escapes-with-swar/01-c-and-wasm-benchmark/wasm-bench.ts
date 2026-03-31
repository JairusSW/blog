// WASI-style AssemblyScript detector benchmark for the blog example.

const PAYLOAD_BYTES: i32 = 512 * 1024;
const PAYLOAD_CODE_UNITS: i32 = PAYLOAD_BYTES >> 1;
const ITERATIONS: i32 = 60000;
let plainPayload: StaticArray<u16> | null = null;
let escapedPayload: StaticArray<u16> | null = null;
let currentPayload: StaticArray<u16> | null = null;
let currentUnsafe: bool = false;

class BenchResult {
  language: string = "assemblyscript";
  description: string = "";
  elapsed: f64 = 0.0;
  bytes: u64 = 0;
  operations: u64 = 0;
  mbps: f64 = 0.0;
  gbps: f64 = 0.0;
}

let result: BenchResult | null = null;

export function detectSafe(block: u64): u64 {
  const lo = block & 0x00ff_00ff_00ff_00ff;
  const asciiMask =
    ((lo - 0x0020_0020_0020_0020) |
      ((lo ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
      ((lo ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
    (0x0080_0080_0080_0080 & ~lo);

  const hiMask =
    ((block - 0x0100_0100_0100_0100) & ~block & 0x8000_8000_8000_8000) ^
    0x8000_8000_8000_8000;

  return (asciiMask & (~hiMask >> 8)) | hiMask;
}

export function detectUnsafe(block: u64): u64 {
  const lo = block & 0x00ff_00ff_00ff_00ff;
  const asciiMask =
    ((lo - 0x0020_0020_0020_0020) |
      ((lo ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001) |
      ((lo ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001)) &
    (0x0080_0080_0080_0080 & ~lo);

  return asciiMask | (block & 0xff00_ff00_ff00_ff00);
}

function ensurePayloads(): void {
  if (plainPayload !== null && escapedPayload !== null) return;

  plainPayload = new StaticArray<u16>(PAYLOAD_CODE_UNITS);
  escapedPayload = new StaticArray<u16>(PAYLOAD_CODE_UNITS);
  const plain = plainPayload!;
  const escaped = escapedPayload!;

  const plainBase =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-+=/., ";
  const escapedBase =
    'abcdefgh"ijklmnop\\\\qrstuvwx\nyz\t\b\f\r' + "\u0001" + "\u001f";

  for (let i = 0; i < PAYLOAD_CODE_UNITS; i++) {
    plain[i] = <u16>plainBase.charCodeAt(i % plainBase.length);
    escaped[i] = <u16>escapedBase.charCodeAt(i % escapedBase.length);
  }
}

function scanEscapes(payload: StaticArray<u16>, unsafe: bool): u32 {
  const ptr = changetype<usize>(payload);
  const blockCount = PAYLOAD_CODE_UNITS >> 2;
  let hits: u32 = 0;

  for (let i = 0; i < blockCount; i++) {
    const block = load<u64>(ptr + <usize>(i << 3));
    hits += <u32>popcnt(unsafe ? detectUnsafe(block) : detectSafe(block));
  }

  for (let i = blockCount << 2; i < PAYLOAD_CODE_UNITS; i++) {
    const code = unchecked(payload[i]);
    if (code == 34 || code == 92 || code < 32 || code > 0x7f) hits += 1;
  }

  return hits;
}

function nowMs(): f64 {
  return performance.now();
}

const blackBoxArea = memory.data(64);
function blackbox<T>(value: T): T {
  store<T>(blackBoxArea, value);
  return load<T>(blackBoxArea);
}

function routine(): void {
  blackbox(scanEscapes(currentPayload!, currentUnsafe));
}

function bench(
  description: string,
  routine: () => void,
  ops: u64 = 1_000_000,
  bytesPerOp: u64 = 0,
): void {
  console.log(" - Benchmarking " + description);
  let warmup = ops / 10;
  while (--warmup) {
    routine();
  }

  const start = nowMs();
  let count = ops;
  while (count--) {
    routine();
  }
  const end = nowMs();
  const elapsed = Math.max(1, end - start);
  const opsPerSecond = f64(ops * 1000) / elapsed;

  let log = `   Completed benchmark in ${formatNumber(u64(Math.round(elapsed)))}ms at ${formatNumber(u64(Math.round(opsPerSecond)))} ops/s`;

  let mbPerSec: f64 = 0;
  if (bytesPerOp > 0) {
    const totalBytes = bytesPerOp * ops;
    mbPerSec = f64(totalBytes) / (elapsed / 1000.0) / (1000 * 1000);
    log += ` @ ${formatNumber(u64(Math.round(mbPerSec)))}MB/s`;
  }

  result = {
    language: "assemblyscript",
    description,
    elapsed,
    bytes: bytesPerOp,
    operations: ops,
    mbps: mbPerSec,
    gbps: mbPerSec / 1000,
  };

  console.log(log + "\n");
}

function formatNumber(n: u64): string {
  let str = n.toString();
  let len = str.length;
  let result = "";
  let commaOffset = len % 3;
  for (let i = 0; i < len; i++) {
    if (i > 0 && (i - commaOffset) % 3 == 0) result += ",";
    result += str.charAt(i);
  }
  return result;
}

ensurePayloads();

console.log("AssemblyScript / Wasm SWAR detector throughput");
currentPayload = plainPayload!;
currentUnsafe = false;
bench("safe / plain", routine, ITERATIONS, PAYLOAD_BYTES);

currentPayload = plainPayload!;
currentUnsafe = true;
bench("unsafe / plain", routine, ITERATIONS, PAYLOAD_BYTES);

currentPayload = escapedPayload!;
currentUnsafe = false;
bench("safe / escaped", routine, ITERATIONS, PAYLOAD_BYTES);

currentPayload = escapedPayload!;
currentUnsafe = true;
bench("unsafe / escaped", routine, ITERATIONS, PAYLOAD_BYTES);
