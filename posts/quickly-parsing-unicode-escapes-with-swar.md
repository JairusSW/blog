---
title: Quickly parsing Unicode Escapes with SWAR
description: Parsing JSON unicode escape sequences with SWAR instead of branches or lookup tables.
category: Performance
tags:
  - performance
  - swar
  - assemblyscript
banner: /images/unicode-escapes-swar-banner.jpg
bannerAlt: Abstract banner image for unicode parsing post
---

# Quickly parsing Unicode Escapes with SWAR

Last night I went down a rabbit hole optimizing Unicode escape decoding in a JSON parser using [SWAR](https://en.wikipedia.org/wiki/SWAR) (SIMD Within A Register) techniques.

Even though unicode escapes don't occur often on average, making it a cold path, I still wanted to see how far a purely arithmetic approach could be pushed. I considered using a [LUT](https://en.wikipedia.org/wiki/Lookup_table) (LookUp Table), but it took more cpu cycles than ideal. Eventually though I stumbled upon this stunningly beautiful little function:

```ts
(c & 0xF) + 9 * (c >> 6)
```

It may seem insignificant, but this function maps ASCII hex characters (`0-9`, `A-F`, `a-f`) to their numeric values without branches or tables.

My use case though, was to parse unicode escape sequences in JSON quickly and efficiently, meaning that I'd have to run this function for each nibble in `\\uXXXX`, which makes it a computational drain.

Instead of converting each character one-by-one with the previous function, I can utilize SIMD Within A Register. SWAR lets you run the same logic on all four nibbles in parallel inside a single 64-bit register, meaning that I can easily parallelize this to:

```ts
// Convert a single \uXXXX -> u16. Assume UTF/WTF-16
@inline function hex4_to_u16_swar(block: u64): u16 {
  // (c & 0xF) + 9 * (c >> 6)
  // Perform the above function for all nibbles in parallel
  block = (block & 0x0F000F000F000F)
    + ((block >> 6) & 0x03000300030003) * 9;

  // Pack each nibble into a u16
  return <u16>(
    ((block >> 0)) << 12 |
    ((block >> 16)) << 8 |
    ((block >> 32)) << 4 |
    ((block >> 48))
  );
}
```

Now, I can parse JSON strings at over 7GB/s. Hooray! 🎉

Low-level tricks aren't always necessary, given the excess of computing power we live in today, but when they do apply, they sure are hard to beat.

You can view the source here: [https://github.com/JairusSW/json-as](https://github.com/JairusSW/json-as/blob/main/assembly/util/swar.ts#L3)
