// Detects quotes, backslashes, control characters, and non-ASCII UTF-16 lanes.
export function detect_escapable_u64_swar_safe(block: bigint): bigint {
  const lo = block & 0x00ff_00ff_00ff_00ffn;
  const asciiMask =
    ((lo - 0x0020_0020_0020_0020n) |
      ((lo ^ 0x0022_0022_0022_0022n) - 0x0001_0001_0001_0001n) |
      ((lo ^ 0x005c_005c_005c_005cn) - 0x0001_0001_0001_0001n)) &
    (0x0080_0080_0080_0080n & ~lo);

  const hiMask =
    ((block - 0x0100_0100_0100_0100n) & ~block & 0x8000_8000_8000_8000n) ^
    0x8000_8000_8000_8000n;

  return (asciiMask & (~hiMask >> 8n)) | hiMask;
}

// Faster, but assumes the caller can tolerate false positives from non-ASCII lanes.
export function detect_escapable_u64_swar_unsafe(block: bigint): bigint {
  const lo = block & 0x00ff_00ff_00ff_00ffn;
  const asciiMask =
    ((lo - 0x0020_0020_0020_0020n) |
      ((lo ^ 0x0022_0022_0022_0022n) - 0x0001_0001_0001_0001n) |
      ((lo ^ 0x005c_005c_005c_005cn) - 0x0001_0001_0001_0001n)) &
    (0x0080_0080_0080_0080n & ~lo);

  const hi = block & 0xff00_ff00_ff00_ff00n;
  return asciiMask | hi;
}
