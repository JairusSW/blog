---
id: 1
createdAt: '2026-03-26'
updatedAt: '2026-03-26'
title: Fuzzing in AssemblyScript
description: >-
  How to add practical property-based fuzzing to an AssemblyScript project with
  as-test.
category: Testing
tags:
  - testing
  - fuzzing
  - assemblyscript
  - webassembly
banner: /images/fuzzing-in-assemblyscript-banner.png
bannerAlt: Abstract banner image for fuzzing in AssemblyScript
head:
  - - meta
    - property: 'og:title'
      content: Fuzzing in AssemblyScript
  - - meta
    - property: 'og:description'
      content: >-
        How to add practical property-based fuzzing to an AssemblyScript project
        with as-test.
  - - meta
    - property: 'og:image'
      content: 'https://blog.jairus.dev/social/fuzzing-in-assemblyscript.png'
  - - meta
    - property: 'og:url'
      content: 'https://blog.jairus.dev/posts/fuzzing-in-assemblyscript'
  - - meta
    - property: 'og:type'
      content: article
  - - meta
    - name: 'twitter:card'
      content: summary_large_image
  - - meta
    - name: 'twitter:title'
      content: Fuzzing in AssemblyScript
  - - meta
    - name: 'twitter:description'
      content: >-
        How to add practical property-based fuzzing to an AssemblyScript project
        with as-test.
  - - meta
    - name: 'twitter:image'
      content: 'https://blog.jairus.dev/social/fuzzing-in-assemblyscript.png'
socialImage: /social/fuzzing-in-assemblyscript.png
---

When I write normal tests, I usually already know which examples I care about.

That is useful, but it also means I am guiding the code toward the paths I expect it to take. If the bug only shows up for a weird string, an empty array, a repeated value, or some unpleasant numeric edge case, a small handwritten test suite might never touch it.

That is where fuzzing helps.

Instead of writing one or two examples, you describe the shape of the input and the property that should always hold. Then the test runner keeps generating data and trying to break your assumptions.

In AssemblyScript, that is especially useful because you are often writing code close to the data:

- parsers
- serializers
- byte manipulation
- text handling
- numeric logic
- low-level runtime helpers

Those are exactly the places where "works for the obvious example" is not enough.

## What I want from fuzzing

I do not want a giant framework or a very academic setup.

I want something that lets me say:

- here is the kind of input I want
- here is the property that should hold
- run it a lot
- tell me the seed if it fails

That is the model `as-test` uses.

## A simple fuzz test

Here is a small AssemblyScript fuzzer that checks a string round-trip:

```ts
import { expect, FuzzSeed, fuzz } from "as-test";

function encode(input: string): string {
  return input;
}

function decode(input: string): string {
  return input;
}

fuzz("decode(encode(x)) returns the original string", (value: string): void => {
  expect(decode(encode(value))).toBe(value);
}).generate((seed: FuzzSeed, run: (value: string) => void): void => {
  run(seed.string({ min: 0, max: 64 }));
});
```

That is the whole idea:

- `fuzz(...)` defines the property
- `.generate(...)` describes how to create inputs
- `run(...)` executes one fuzz iteration

If any expectation fails, that fuzz target fails.

## Running it

You can run fuzzers directly:

```bash
npx ast fuzz
```

Or run them after your normal tests:

```bash
npx ast test --fuzz
```

That second mode is nice when you want one command for the whole project.

## Why this is better than one test case

Imagine you are testing byte logic with one example:

```ts
expect(hexToBytes("FF")).toEqual([255]);
```

That test is still worth having. But it does not tell you much about:

- empty strings
- odd lengths
- lowercase input
- repeated separators
- embedded control characters
- very long values

A fuzzer can hit all of those much more easily.

For example:

```ts
import { FuzzSeed, fuzz } from "as-test";

function clamp(value: i32, min: i32, max: i32): i32 {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

fuzz("clamp stays inside bounds", (value: i32): bool => {
  const out = clamp(value, -10, 10);
  return out >= -10 && out <= 10;
}).generate((seed: FuzzSeed, run: (value: i32) => bool): void => {
  run(seed.i32({ min: -1000, max: 1000 }));
});
```

That is a much stronger test than checking `0`, `5`, and `100` manually.

## `bool` or `expect(...)`

`as-test` supports both styles:

```ts
import { FuzzSeed, fuzz } from "as-test";

fuzz("result is non-negative", (value: i32): bool => {
  return value * value >= 0;
}).generate((seed: FuzzSeed, run: (value: i32) => bool): void => {
  run(seed.i32({ min: -100, max: 100 }));
});
```

Or:

```ts
import { expect, FuzzSeed, fuzz } from "as-test";

fuzz("reversing twice gives the original bytes", (value: Array<u8>): void => {
  const reversed = value.slice().reverse();
  expect(reversed.reverse()).toEqual(value);
}).generate((seed: FuzzSeed, run: (value: Array<u8>) => void): void => {
  run(seed.array<u8>(seed.u8(), { min: 0, max: 32 }));
});
```

I usually prefer `expect(...)` when I want better failure messages, and `bool` when the property is very small and obvious.

## The useful part is the failure

A good fuzzing setup is not just about generating random data. It is about making failures easy to reproduce.

That means:

- the failure should tell you which fuzz target failed
- it should tell you the mode
- it should tell you the seed
- it should give you a command you can run again

That is the difference between "something random failed once" and "I can actually fix this."

## Where fuzzing pays off the most

In AssemblyScript, I think fuzzing is especially valuable for:

- parsers
- encoders and decoders
- string escaping
- UTF handling
- byte transforms
- hashing
- sorting and comparison logic
- anything that touches boundaries, lengths, or indexes

Basically, if a function takes structured input and claims some invariant should always hold, it is probably a good fuzzing candidate.

## Keep the property simple

The best fuzzers usually test very plain rules:

- decoding after encoding returns the original value
- sorting preserves length and order
- escaping then unescaping round-trips
- a parser never reads out of bounds
- a clamp never leaves the allowed range
- a serializer always produces valid output

The input can be messy. The property should be easy to state.

That is what makes fuzzing useful instead of mysterious.

## Final thought

I do not think fuzzing replaces normal tests.

You still want clear example-based tests for behavior people can read and understand quickly.

But fuzzing is extremely good at finding the cases you would not have thought to write down.

That is why I like having it in the same workflow as the rest of my AssemblyScript tests. It makes it much easier to use before a bug happens, instead of only wishing I had it after one.
