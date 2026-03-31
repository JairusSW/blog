# C and Wasm benchmark

This folder contains a self-contained side-by-side benchmark for the SWAR
detector in:

- native C
- AssemblyScript compiled to a WASI-style Wasm module

Files:

- `bench.c`
  Native C throughput benchmark
- `wasm-bench.ts`
  AssemblyScript throughput benchmark using `@assemblyscript/wasi-shim`, `performance.now()`, and `console.log()`

## Install dependencies

```bash
make install
```

That installs the local AssemblyScript compiler and `@assemblyscript/wasi-shim`.

You still need these tools on your machine:

- `cc`
- `wasmer`
- optionally `wasm2wat` for inspection

## Build everything

```bash
make build
```

## Run both benchmarks

```bash
make run
```

Or run each side separately:

```bash
make run-c
make run-wasm
```

The C and Wasm harnesses intentionally use the same payload sizes, warmup policy,
iteration count, and output labels so the comparison stays as close as possible.

The default build targets are intentionally aggressive:

- C uses host-tuned native flags plus LTO
- AssemblyScript uses `-O3`, `--converge`, and the incremental runtime
- Wasmer runs with LLVM plus `--enable-pass-params-opt`

## Inspect native assembly

```bash
make inspect-c
sed -n '/detect_escapable_u64_swar_safe/,/ret/p' build/bench.s
sed -n '/detect_escapable_u64_swar_unsafe/,/ret/p' build/bench.s
```

If your compiler inlines everything away, temporarily remove `inline` or add
`__attribute__((noinline))` to the detector functions before regenerating
`build/bench.s`.

## Inspect Wasm

```bash
make inspect-wasm
less build/wasm-bench.wat
wasm-objdump -d build/wasm-bench.wasm | less
```
