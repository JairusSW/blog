# Inspecting the emitted Wasm

This folder is the smallest possible AssemblyScript wrapper around the two SWAR
detectors so you can compare the emitted Wasm directly.

## Compile to Wasm and WAT

From the `json-as` repo root:

```bash
cat > ./build/swar-detect-inspect.ts <<'EOF'
import {
  detect_escapable_u64_swar_safe,
  detect_escapable_u64_swar_unsafe,
} from "../assembly/serialize/swar/string";

export function safe(block: u64): u64 {
  return detect_escapable_u64_swar_safe(block);
}

export function unsafe(block: u64): u64 {
  return detect_escapable_u64_swar_unsafe(block);
}
EOF

JSON_MODE=SWAR npx asc ./build/swar-detect-inspect.ts \
  --transform ./transform \
  -O3 \
  --converge \
  --noAssert \
  --uncheckedBehavior always \
  --runtime incremental \
  --textFile ./build/swar-detect-inspect.wat \
  -o ./build/swar-detect-inspect.wasm
```

## Inspect the WAT

```bash
sed -n '/(func $build\\/swar-detect-inspect\\/safe/,/^(func/p' ./build/swar-detect-inspect.wat
sed -n '/(func $build\\/swar-detect-inspect\\/unsafe/,/^(func/p' ./build/swar-detect-inspect.wat
```

Or disassemble the `.wasm` after the fact:

```bash
wasm2wat ./build/swar-detect-inspect.wasm | less
wasm-objdump -d ./build/swar-detect-inspect.wasm | less
```

## What to expect

- The `unsafe` detector compiles to a smaller function body.
- The `safe` detector carries extra work for the high-byte mask and final merge.
- That extra code matches the throughput gap in the benchmark: safer semantics,
  slightly more work.
