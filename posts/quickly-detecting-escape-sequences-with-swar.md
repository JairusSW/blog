---
title: Quickly detecting Escape Sequences with SWAR
description: >-
  A compact SWAR trick for detecting quotes, backslashes, control characters,
  and non-ASCII UTF-16 lanes while serializing JSON strings.
category: Performance
tags:
  - performance
  - swar
  - assemblyscript
createdAt: '2026-03-30'
updatedAt: '2026-03-30'
banner: /images/quickly-detecting-escape-sequences-with-swar.png
socialImage: /social/quickly-detecting-escape-sequences-with-swar2.png
head:
  - - meta
    - property: 'og:title'
      content: Quickly detecting Escape Sequences with SWAR
  - - meta
    - property: 'og:description'
      content: >-
        A compact SWAR trick for detecting quotes, backslashes, control
        characters, and non-ASCII UTF-16 lanes while serializing JSON strings.
  - - meta
    - property: 'og:image'
      content: >-
        https://blog.jairus.dev/social/quickly-detecting-escape-sequences-with-swar.png
  - - meta
    - property: 'og:url'
      content: >-
        https://blog.jairus.dev/posts/quickly-detecting-escape-sequences-with-swar
  - - meta
    - property: 'og:type'
      content: article
  - - meta
    - name: 'twitter:card'
      content: summary_large_image
  - - meta
    - name: 'twitter:title'
      content: Quickly detecting Escape Sequences with SWAR
  - - meta
    - name: 'twitter:description'
      content: >-
        A compact SWAR trick for detecting quotes, backslashes, control
        characters, and non-ASCII UTF-16 lanes while serializing JSON strings.
  - - meta
    - name: 'twitter:image'
      content: >-
        https://blog.jairus.dev/social/quickly-detecting-escape-sequences-with-swar.png
id: 4
---

Most JSON string data is boring.

It is just ASCII text that does not contain `"` or `\`, does not dip below `0x20`, and does not force any special-case escaping at all.

The annoying part is that a serializer still has to prove that.

The naive loop is obvious:

```ts
for (let i = 0; i < src.length; i++) {
  const code = src.charCodeAt(i);
  if (code == 34 || code == 92 || code < 32) {
    // escape
  }
}
```

That is correct, but it is also one branch per code unit in the hottest part of the serializer.

For `json-as`, I wanted the fast path to ask a cheaper question:

> Does this whole chunk contain anything interesting at all?

That is where [SWAR](https://en.wikipedia.org/wiki/SWAR) fits nicely.

For this post, the companion code is here:

- [`00-detector-functions`](https://github.com/JairusSW/blog/tree/main/code/quickly-detecting-escape-sequences-with-swar/00-detector-functions)
- [`01-c-and-wasm-benchmark`](https://github.com/JairusSW/blog/tree/main/code/quickly-detecting-escape-sequences-with-swar/01-c-and-wasm-benchmark)
- [`02-assemblyscript-inspection`](https://github.com/JairusSW/blog/tree/main/code/quickly-detecting-escape-sequences-with-swar/02-assemblyscript-inspection)

## What needs detecting?

When serializing a JSON string, these are the lanes that matter:

- `"` because it must become `\"`
- `\` because it must become `\\`
- control characters `< 0x20`
- non-ASCII UTF-16 code units, because they cannot stay on the pure ASCII copy path

If I can classify four UTF-16 lanes at once inside one `u64`, then the common case becomes:

1. load 8 bytes
2. compute a mask
3. copy directly if the mask is zero

That is the whole job of this helper written in the [AssemblyScript Language](https://assemblyscript.org/)

```ts
@inline function detect_escapable_u64_swar_safe(block: u64): u64 {
  const lo = block & 0x00ff_00ff_00ff_00ff;
  const ascii_mask =
    ((lo - 0x0020_0020_0020_0020)
      | ((lo ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001)
      | ((lo ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001))
    & (0x0080_0080_0080_0080 & ~lo);

  const hi_mask =
    ((block - 0x0100_0100_0100_0100) & ~block & 0x8000_8000_8000_8000)
    ^ 0x8000_8000_8000_8000;

  return (ascii_mask & (~hi_mask >> 8)) | hi_mask;
}
```

It looks cryptic, but it is just two independent predicates packed into one result.

## Why UTF-16 makes this convenient

AssemblyScript strings are UTF-16, and that matters a lot here.

For plain ASCII text:

- the low byte of each 16-bit lane contains the character
- the high byte is zero

That gives a very convenient layout. I can inspect the low bytes for JSON escape cases, and separately inspect the high bytes to notice when the block is no longer plain ASCII.

So this is not a universal string trick. It is a particularly good fit for UTF-16 data.

## The low-byte test

First, isolate the low byte of each UTF-16 lane:

```ts
const lo = block & 0x00ff_00ff_00ff_00ff;
```

Now I only care about three low-byte predicates:

- `< 0x20`
- `== 0x22`
- `== 0x5c`

The detector builds those without branches:

```ts
const ascii_mask =
  ((lo - 0x0020_0020_0020_0020)
    | ((lo ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001)
    | ((lo ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001))
  & (0x0080_0080_0080_0080 & ~lo);
```

This is standard SWAR arithmetic:

- subtraction to manufacture per-lane underflow or equality signals
- masking to collapse those signals into lane-local high bits
- no per-character branch in the hot path

If one of the four low bytes looks special, its lane gets marked in `ascii_mask`.

## The high-byte test

That still leaves non-ASCII code units.

The ASCII trick only works when every high byte is zero, so the detector also asks:

> Is any UTF-16 high byte non-zero?

That is what this part does:

```ts
const hi_mask =
  ((block - 0x0100_0100_0100_0100) & ~block & 0x8000_8000_8000_8000)
  ^ 0x8000_8000_8000_8000;
```

The result is a mask over the high bytes of the four lanes. If a lane is not plain ASCII, that lane is marked.

Then the final merge is:

```ts
return (ascii_mask & (~hi_mask >> 8)) | hi_mask;
```

That means:

- keep the ASCII escape hits for truly ASCII lanes
- also mark any lane whose high byte is non-zero

The serializer now has exactly the answer it needs:

> Which lanes force me off the pure ASCII copy path?

## The unsafe variant

There is also a cheaper detector:

```ts
@inline export function detect_escapable_u64_swar_unsafe(block: u64): u64 {
  const lo = block & 0x00ff_00ff_00ff_00ff;
  const ascii_mask =
    ((lo - 0x0020_0020_0020_0020)
      | ((lo ^ 0x0022_0022_0022_0022) - 0x0001_0001_0001_0001)
      | ((lo ^ 0x005c_005c_005c_005c) - 0x0001_0001_0001_0001))
    & (0x0080_0080_0080_0080 & ~lo);

  return ascii_mask | (block & 0xff00_ff00_ff00_ff00);
}
```

This one does not prove that a non-ASCII lane is really dangerous. It just marks any lane with a non-zero high byte and lets the later slow path sort it out.

That means more false positives, but a smaller and faster detector.

So the tradeoff is simple:

- `safe`: do more proof up front
- `unsafe`: bail out faster and prove less on the hot path

If your strings are mostly ASCII, that is often a good deal.

## What the serializer gets from this

Once you have the mask, the fast path becomes tiny:

```ts
let block = load<u64>(srcStart);
store<u64>(bs.offset, block);

let mask = detect_escapable_u64_swar_safe(block);

if (mask === 0) {
  srcStart += 8;
  bs.offset += 8;
  continue;
}
```

That is the payoff.

For ordinary ASCII blocks with no escapes, the serializer just copies 8 bytes and moves on.

Only when the mask is non-zero does it need to identify the exact lane and expand the escape sequence.

That shifts the cost model in the right direction. Instead of repeatedly asking “does this character need escaping?”, the hot path asks “is there anything interesting in this whole block?”

## Benchmarking safe vs unsafe

I reran the detector-only benchmark with matching harness shapes in both implementations:

- AssemblyScript compiled to Wasm and run with `wasmer --llvm --enable-pass-params-opt`
- native C compiled with aggressive host-tuned flags and LTO

Both versions use the same payload size, warmup policy, operation count, and logging structure. The benchmark code is here:

- [`wasm-bench.ts`](https://github.com/JairusSW/blog/blob/main/code/quickly-detecting-escape-sequences-with-swar/01-c-and-wasm-benchmark/wasm-bench.ts)
- [`bench.c`](https://github.com/JairusSW/blog/blob/main/code/quickly-detecting-escape-sequences-with-swar/01-c-and-wasm-benchmark/bench.c)
- [`bench-lib.h`](https://github.com/JairusSW/blog/blob/main/code/quickly-detecting-escape-sequences-with-swar/01-c-and-wasm-benchmark/bench-lib.h)

The two payload shapes are:

- plain ASCII text with no escapes
- escape-heavy text with quotes, backslashes, and control characters

Here are the current numbers from that harness:

| Case | Wasm / `wasmer --llvm --enable-pass-params-opt` | Native C |
| --- | ---: | ---: |
| safe / plain | 5030 MB/s | 6824 MB/s |
| unsafe / plain | 6355 MB/s | 8562 MB/s |
| safe / escaped | 4908 MB/s | 6295 MB/s |
| unsafe / escaped | 7093 MB/s | 8331 MB/s |

The shape is the important part:

- the unsafe detector wins in both environments
- native C is still faster overall on this machine
- Wasm is close enough that the same design decision still matters
- tuning the Wasmer runner mattered more here than trying to force extra post-link optimization passes onto the module

That is exactly what I wanted to know. The unsafe detector is not just theoretically smaller. It buys measurable throughput in the actual runtime I care about.

If you want to rerun it, the example folder is here:

- [`01-c-and-wasm-benchmark`](https://github.com/JairusSW/blog/tree/main/code/quickly-detecting-escape-sequences-with-swar/01-c-and-wasm-benchmark)

And the commands are just:

```bash
make run-wasm
make run-c
```

## Looking at the generated code

The throughput numbers tell you the tradeoff is real, but the code shape explains why.

The unsafe detector compiles to a smaller body because it skips the extra high-byte proof/merge logic from the safe version. That is easiest to see in the inspection example:

- [`02-assemblyscript-inspection`](https://github.com/JairusSW/blog/tree/main/code/quickly-detecting-escape-sequences-with-swar/02-assemblyscript-inspection)

There is nothing magical there. The unsafe version is just doing less work.

That is why I like this optimization. It is not a “benchmark trick” in the bad sense. The source is smaller, the emitted code is smaller, and the measured throughput moves in the same direction.

If you want to see the real implementation in context, these are the relevant `json-as` sources:

- [json-as `assembly/serialize/swar/string.ts`](https://github.com/JairusSW/json-as/blob/main/assembly/serialize/swar/string.ts)
- [json-as `assembly/util/swar.ts`](https://github.com/JairusSW/json-as/blob/main/assembly/util/swar.ts)
