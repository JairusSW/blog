---
title: Validating UTF-8 at Gigabytes per Second
description: >-
  Porting simdutf's lookup-table UTF-8 validator to 128-bit WebAssembly SIMD,
  plus an ASCII fast path that pushes mostly-ASCII text past 58 GB/s.
category: Performance
tags:
  - performance
  - assemblyscript
  - webassembly
createdAt: '2026-06-01'
updatedAt: '2026-06-01'
id: 5
banner: /images/validating-utf8-at-gigabytes-per-second-banner.jpg
socialImage: /social/validating-utf8-at-gigabytes-per-second.png
head:
  - - meta
    - property: 'og:title'
      content: Validating UTF-8 at Gigabytes per Second
  - - meta
    - property: 'og:description'
      content: >-
        Porting simdutf's lookup-table UTF-8 validator to 128-bit WebAssembly
        SIMD, plus an ASCII fast path that pushes mostly-ASCII text past 58
        GB/s.
  - - meta
    - property: 'og:image'
      content: >-
        https://blog.jairus.dev/social/validating-utf8-at-gigabytes-per-second.png
  - - meta
    - property: 'og:url'
      content: 'https://blog.jairus.dev/posts/validating-utf8-at-gigabytes-per-second'
  - - meta
    - property: 'og:type'
      content: article
  - - meta
    - name: 'twitter:card'
      content: summary_large_image
  - - meta
    - name: 'twitter:title'
      content: Validating UTF-8 at Gigabytes per Second
  - - meta
    - name: 'twitter:description'
      content: >-
        Porting simdutf's lookup-table UTF-8 validator to 128-bit WebAssembly
        SIMD, plus an ASCII fast path that pushes mostly-ASCII text past 58
        GB/s.
  - - meta
    - name: 'twitter:image'
      content: >-
        https://blog.jairus.dev/social/validating-utf8-at-gigabytes-per-second.png
---

Anything coming off the network, off disk, or out of a wasm module is supposed to be checked for valid UTF-8 before you use it. Most of the time the bytes are fine. Usually they're plain ASCII, so validation is a tax you'd like to pay as cheaply as possible.

UTF-8 validity is local: whether a byte is legal depends only on it and the two or three bytes before it. The [Keiser–Lemire algorithm](https://arxiv.org/abs/2010.03090) (the one in [simdutf](https://github.com/simdutf/simdutf)) turns every rule into a table lookup - and `i8x16.swizzle` does sixteen lookups in one instruction.

Classify each byte by its high and low nibble, and the previous byte by its high nibble. Each indexes a constant table of error-bit flags. AND the three together; any non-zero lane broke a rule:

```ts
function check_special_cases(input: v128, prev1: v128): v128 {
  const b1h = i8x16.swizzle(BYTE_1_HIGH, shr4_u8(prev1));
  const b1l = i8x16.swizzle(BYTE_1_LOW,  v128.and(prev1, MASK_0x0F));
  const b2h = i8x16.swizzle(BYTE_2_HIGH, shr4_u8(input));
  return v128.and(v128.and(b1h, b1l), b2h);
}
```

A second cheap step catches wrong sequence *lengths* (a 3-byte lead needs two continuations, a 4-byte lead three) with a saturating subtraction. OR the error vectors across the whole input, then check once at the end. No per-byte branches.

Wasm SIMD is 128-bit only - SSE4 on x86, NEON on ARM, no AVX - so I ported westmere from simdutf, though it barely matters since validation is memory-bound long before it's ALU-bound.

Real text is mostly ASCII, and ASCII is valid UTF-8 by definition. So before any of the lookup work, ask one question of each 64-byte window: any byte ≥ 0x80? If not, there's nothing to check - skip it. That alone is why ASCII markup hits 58 GB/s.

One window is all-or-nothing, though: a single `é` makes 64 bytes "dirty" even if three of its four 16-byte chunks are still pure ASCII. So inside a dirty window I use `i8x16.bitmask` to find which chunks actually have high bits, and only run the lookup on those:

```ts
const d0 = i8x16.bitmask(b0) != 0; // any high bit in chunk 0?
const d1 = i8x16.bitmask(b1) != 0;
const d2 = i8x16.bitmask(b2) != 0;
const d3 = i8x16.bitmask(b3) != 0;

if (d0) error = check_chunk(b0, prevInput, error); // only the dirty chunks pay
if (d1) error = check_chunk(b1, b0, error);
if (d2) error = check_chunk(b2, b1, error);
if (d3) error = check_chunk(b3, b2, error);
```

On mostly-ASCII markup that recovered another **13–29%**.

V8 / Apple Silicon, over simdutf's `wikipedia_mars` fixtures:

| Payload | `UTF8.validate` |
|---|---:|
| english.html | **59.6 GB/s** |
| french.html | 24.6 GB/s |
| chinese.html | 17.5 GB/s |
| russian.html | 14.0 GB/s |
| emoji.txt | 6.6 GB/s |

The gradient is the algorithm showing through: the more multibyte the text, the fewer chunks take the free path. `emoji.txt` (all four-byte sequences) is the floor - and still several times faster than the scalar loop.

Full source is in [`assembly/utf/validate.ts`](https://github.com/JairusSW/utf-as/blob/main/assembly/utf/validate.ts).
