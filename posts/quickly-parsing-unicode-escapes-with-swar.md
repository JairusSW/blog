---
id: 2
createdAt: '2026-03-26'
updatedAt: '2026-03-26'
title: Quickly parsing Unicode Escapes with SWAR
description: >-
  Parsing JSON unicode escape sequences with SWAR instead of branches or lookup
  tables.
category: Performance
tags:
  - performance
  - swar
  - assemblyscript
banner: /images/unicode-escapes-swar-banner.jpg
bannerAlt: Abstract banner image for unicode parsing post
head:
  - - meta
    - property: 'og:title'
      content: Quickly parsing Unicode Escapes with SWAR
  - - meta
    - property: 'og:description'
      content: >-
        Parsing JSON unicode escape sequences with SWAR instead of branches or
        lookup tables.
  - - meta
    - property: 'og:image'
      content: >-
        https://blog.jairus.dev/social/quickly-parsing-unicode-escapes-with-swar.png
  - - meta
    - property: 'og:url'
      content: 'https://blog.jairus.dev/posts/quickly-parsing-unicode-escapes-with-swar'
  - - meta
    - property: 'og:type'
      content: article
  - - meta
    - name: 'twitter:card'
      content: summary_large_image
  - - meta
    - name: 'twitter:title'
      content: Quickly parsing Unicode Escapes with SWAR
  - - meta
    - name: 'twitter:description'
      content: >-
        Parsing JSON unicode escape sequences with SWAR instead of branches or
        lookup tables.
  - - meta
    - name: 'twitter:image'
      content: >-
        https://blog.jairus.dev/social/quickly-parsing-unicode-escapes-with-swar.png
socialImage: /social/quickly-parsing-unicode-escapes-with-swar.png
---

# Quickly parsing Unicode Escapes with SWAR

Last night I went down a rabbit hole optimizing Unicode escape decoding in a JSON parser using [SWAR](https://en.wikipedia.org/wiki/SWAR) (SIMD Within A Register) techniques.

Even though unicode escapes don't occur often on average, making it a cold path, I still wanted to see how far a purely arithmetic approach could be pushed. I considered using a [LUT](https://en.wikipedia.org/wiki/Lookup_table) (LookUp Table), but it took more cpu cycles than ideal. Eventually though I stumbled upon this stunningly beautiful little function:

```ts
(c & 0xF) + 9 * (c >> 6)
```

It may seem insignificant, but this function maps ASCII hex characters (`0-9`, `A-F`, `a-f`) to their numeric values without branches or tables.

My use case though, was parsing unicode escape sequences in JSON. Each escape has four hex characters, so the obvious approach is to run that conversion once per character and then combine the results.

That works, but it still thinks about the input one piece at a time. At the end of the process, all we really want is those four nibbles packed into a single `u16`:

Say the four hex characters are named `a`, `b`, `c`, and `d`. Once they have been converted to nibble values, the final shape should look like this:

```ts
const a = 0x01;
const b = 0x02;
const c = 0x03;
const d = 0x04;

const packed = (a << 12) | (b << 8) | (c << 4) | d;
//  a b c d
//  ↓ ↓ ↓ ↓
// 0x1_2_3_4 = 4660
```

The useful SIMD-ish shift is realizing we do not need to convert `a`, then `b`, then `c`, then `d` as separate operations. Before that final pack, we can keep the characters spread out inside a wider integer and treat each little chunk as a lane.

Once values are arranged into lanes, one operation can act across the whole register. The operation is scalar machine code, but the layout makes it behave like a tiny vector operation:

```ts
const a = 0x01_02_03_04_05_06_07_08;
const b = 0x10_10_10_10_10_10_10_10;

const c = a + b;
// 0x01 0x02 0x03 0x04 0x05 0x06 0x07 0x08
//  +    +    +    +    +    +    +    +
// 0x10 0x10 0x10 0x10 0x10 0x10 0x10 0x10
//  =    =    =    =    =    =    =    =
// 0x11 0x12 0x13 0x14 0x15 0x16 0x17 0x18
```

That is the basic SWAR idea: choose a representation where the same arithmetic can be applied to several values at once, while keeping enough space between the values that they do not interfere with each other.

For `\\uXXXX`, that means the branchless hex conversion from earlier can run across all four characters in parallel inside a single 64-bit register. After that, the remaining work is just packing the converted nibbles into the final `u16`:

```ts
// Convert a single \uXXXX -> u16. Assume UTF/WTF-16
@inline function hex4_to_u16_swar(block: u64): u16 {
  // (c & 0xF) + 9 * (c >> 6)
  // Perform the above function for all nibbles in parallel
  block = (block & 0x000F_000F_000F_000F)
    + ((block >> 6) & 0x0003_0003_0003_0003) * 9;

  // Pack each nibble into a u16
  return <u16>(
    ((block >> 0)) << 12 |
    ((block >> 16)) << 8 |
    ((block >> 32)) << 4 |
    ((block >> 48))
  );
}
```

For a concrete example, `"1aF0"` starts as four UTF-16 lanes packed into one `u64`. Written as a hex literal, the least-significant lane is on the right, so the characters appear right-to-left here. The low nibble of each ASCII character gets extracted first:

```ts
0x0030 0x0046 0x0061 0x0031
  &      &      &      &
0x000F 0x000F 0x000F 0x000F
  =      =      =      =
0x0000 0x0006 0x0001 0x0001
```

The low nibble is enough for digits. For example, `'0' & 0xF` is already `0`.

You can think of the formula as a branchless version of `lowNibble + (isLetter ? 9 : 0)`. Digits already have the right value after `c & 0xF`, but letters are `9` too small. For example, `'a' & 0xF` gives `1`, so it needs `+9` to become `10`.

The `block >> 6` part gives us the `isLetter` bit. In ASCII, digits start with `0b0011`, so shifting right by 6 gives `0`. Letters start with `0b0100` or `0b0110`, so shifting right by 6 gives `1`. The mask keeps that result inside each 16-bit lane:

```ts
0x0030 0x0046 0x0061 0x0031
 >> 6   >> 6   >> 6   >> 6
  =      =      =      =
0x0000 0x0001 0x0001 0x0000
```
```ts
0x0000 0x0001 0x0001 0x0000
  &      &      &      &
0x0003 0x0003 0x0003 0x0003
  =      =      =      =
0x0000 0x0001 0x0001 0x0000
```

Then multiplying by `9` turns that `isLetter` bit into the adjustment we need:

```ts
0x0000 0x0001 0x0001 0x0000
  *      *      *      *
0x0009 0x0009 0x0009 0x0009
  =      =      =      =
0x0000 0x0009 0x0009 0x0000
```

Now the two pieces can be added together:

```ts
0x0000 0x0006 0x0001 0x0001
  +      +      +      +
0x0000 0x0009 0x0009 0x0000
  =      =      =      =
0x0000 0x000F 0x000A 0x0001
```

The lanes are still spread out, so the final step pulls each nibble into its position:

```ts
0x0001 << 12
0x000A <<  8
0x000F <<  4
0x0000
  =
0x1AF0
```

Now, I can parse JSON strings at over 7GB/s. Hooray! 🎉

Low-level tricks aren't always necessary, given the excess of computing power we live in today, but when they do apply, they sure are hard to beat.

You can view the source here: [https://github.com/JairusSW/json-as](https://github.com/JairusSW/json-as/blob/main/assembly/util/swar.ts#L3)
