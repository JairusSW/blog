---
title: A new WebAssembly runtime enters the arena... Is it worthy?
description: >-
  Introducing Wago, a new Go WebAssembly runtime built for fast compilation, low
  memory usage, and full control over your runtime.
createdAt: '2026-09-10'
updatedAt: '2026-09-10'
category: WebAssembly
tags:
  - webassembly
  - performance
banner: /images/wago-banner.png
bannerAlt: 'Wago — WebAssembly, made for Go.'
socialImage: /social/a-new-webassembly-runtime-enters-the-arena.png
head:
  - - meta
    - property: 'og:title'
      content: A new WebAssembly runtime enters the arena... Is it worthy?
  - - meta
    - property: 'og:description'
      content: >-
        Introducing Wago, a new Go WebAssembly runtime built for fast
        compilation, low memory usage, and full control over your runtime.
  - - meta
    - property: 'og:image'
      content: >-
        https://blog.jairus.dev/social/a-new-webassembly-runtime-enters-the-arena.png
  - - meta
    - property: 'og:url'
      content: 'https://blog.jairus.dev/posts/a-new-webassembly-runtime-enters-the-arena'
  - - meta
    - property: 'og:type'
      content: article
  - - meta
    - name: 'twitter:card'
      content: summary_large_image
  - - meta
    - name: 'twitter:title'
      content: A new WebAssembly runtime enters the arena... Is it worthy?
  - - meta
    - name: 'twitter:description'
      content: >-
        Introducing Wago, a new Go WebAssembly runtime built for fast
        compilation, low memory usage, and full control over your runtime.
  - - meta
    - name: 'twitter:image'
      content: >-
        https://blog.jairus.dev/social/a-new-webassembly-runtime-enters-the-arena.png
id: 6
---

A few minutes ago, I released my brand-new WebAssembly runtime, [**Wago**](https://wago.sh/).

There's one massive problem though.

[Wasmtime](https://wasmtime.dev/) is mature, fast, and backed by the [Bytecode Alliance](https://bytecodealliance.org/). Wasmer has been around for years, V8 speaks wasm fluently, and if you're writing Go, [wazero](https://wazero.io/) is already the de-facto answer.

So why would I be _stupid_ enough to make a new wasm runtime?

Seems like all the bases are already covered, right?

...right..????

Well, _kind of._

The existing runtimes are **really** good, don't get me wrong. I don't think Wago exists because Wasmtime or wazero are bad. In fact, I've spent _way_ too many hours of my life staring at their codebases while building this thing.

But there were a few things that still bugged me.

Let me give you some backstory.

The past two companies I've worked at, [Hypermode](https://hypermode.com/) and [Impart Security](https://impart.security/), both use the venerable [wazero](https://wazero.io/) to run isolated, secure wasm applications.

And it's great!

We don't need to boot thousands of Docker containers, spin up micro-VMs, or do anything crazy like that. We can use a few kilobytes of RAM to run some wasm here and a megabyte there.

Wazero though...

# wazero is slow as _hell_.

When I compare it to Wasmtime, it runs _much_ slower.

This isn't _really_ wazero's fault though.

Wasmtime gets to use [Cranelift](https://cranelift.dev/), a proper optimizing compiler that outputs excellent machine code. Wazero is meant to be simple and "just work." It doesn't aggressively chase peak performance; it chooses to ride the middle ground.

Maybe I'm crazy, but I deem that _laziness_.

A quote stuck with me, and I forget who said it. It went something like:

> Fast hardware should bring excellence, not reason to waste it.

I'll answer you myself.

I _am_ crazy. I'm _GREEDY_.

I want unreasonably excellent performance while using tiny amounts of RAM. I want something that steps so lightly you barely notice it. The only thing you notice is the results--a runtime that used **kilobytes of RAM to compile**, generated **less machine code than wazero**, runs **substantially faster**, and somehow remains a **single-pass compiler**.

So, I started experimenting.

At work, we can deal with poor performance by scaling, but that has a limit. More CPU costs money. More memory costs money. Eventually, _"just add another machine"_ stops being a satisfying answer.

I thought,

> Hey, if i can reduce memory usage by 10x and improve performance by 50%, *surely* I can cut our costs in half, right?

Compilation was especially painful for us. On some of our larger workloads, wazero could peak at **hundreds of megabytes of memory** just to compile a module.

That was unacceptable.

So I set myself some slightly unreasonable goals.

I wanted a compiler that:

- used **kilobytes** of memory to compile
- generated **less machine code**
- compiled **several times faster**
- produced code **substantially faster than wazero**
- and was still **single-pass**

Oh, and I wanted it to eventually run on **embedded systems**.

Totally reasonable, right?

## Okay, okay, ideas are nice and all... but did you actually accomplish anything?

My experiments eventually became **Railshot**, Wago's compiler.

Railshot doesn't build some enormous IR, optimize it tens of different ways, and then _finally_ spit out pristine machine code.

It mostly just goes:

```text
.wasm → analyze → compile → machine code
```

That sounds horribly naïve. And, traditionally, it is.

Single-pass compilers are incredibly fast to compile with, but they generally produce worse code. Optimizing compilers get to look at the entire function, analyze it, shuffle things around, run optimization passes, and make globally better decisions.

Railshot doesn't get that luxury.

> **But scarcity brings excellence, because to overcome your limitations, you _must_ become more than you ever imagined.**

The wonderful thing about WebAssembly is that binaries often arrive **already optimized**.

If your `.wasm` came out of LLVM, Rust, TinyGo, or another optimizing compiler, a whole bunch of work has already happened before Wago ever sees it.

I don't necessarily need Railshot to rediscover everything the frontend compiler already figured out.

WebAssembly is also beautifully structured! Blocks, loops, branches, types, and the operand stack give the compiler a surprising amount of information basically _for free_.

So, instead of building a giant IR, I tried to exploit that structure directly, which led me to something called **Valent Blocks** (go read the [research paper](https://ieeexplore.ieee.org/document/9231154) about it if you want to go down that rabbit hole).

The basic idea is to maintain small, temporary views of the program that give Railshot just enough information to make smarter decisions **while it is compiling**.

Things like:

- register pinning
- bounds-check elimination
- instruction combining
- constant folding
- branch simplification
- avoiding unnecessary loads and stores

...all without turning Railshot into a traditional (fat) optimizing compiler.

In other words:

> Cheat as much as possible while remaining single-pass.

I suppose there's some tipping point where cheating becomes more _smart_ than it is lazy.

And somehow...

**it worked.**

## Let's see those numbers though...

Here's the obligatory disclaimer:

> **I wrote Wago. I also ran these benchmarks.**

Please go run them yourself.

Seriously. Please.

That said... Here's a few corpora

**Execution Latency**

![Image description](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/zt302htxi4w9xr2395wi.png)

**Compile Latency**

![Image description](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/rd1l3o7xc98z2r1jy4d7.png)

**Compile Heap**

![Image description](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/0vp4zc6bh245ubw58ovf.png)

The full benchmark tables are [here](https://wago.sh/#performance)

Across my current corpus, Wago is roughly:

- **5.7×** faster to compile
- **11×** less memory-hungry during compilation
- **70%** faster at execution
- **52%** smaller in generated machine code

Not bad for a compiler that's _supposed_ to be generating bad code.

The compilation memory is probably the result I'm happiest with.

I wanted running wasm to be cheap enough that you just...

**don't need to worry about it.**

## Ooh, but can it run real stuff?

A fast compiler isn't much use if it can only run Fibonacci and some compression algorithms.

So Wago has grown into quite a bit more than Railshot.

Today, Wago has:

- support for **modern WebAssembly** (3.0+!)
- extremely cheap instance creation
- standalone native executables
- a cool plugin system
- AMD64 and ARM64 native backends (risc-v in the works!)
- macos, linux, and windows support

And here's where things start getting a little weird.

Wago's plugin system can extend the runtime itself.

Not just add _another_ host function.

I mean **custom WebAssembly instructions and types**.

I've even implemented wider SIMD support including **512-bit vectors backed by AVX-512 where available** as a [_plugin_](https://plugins.wago.sh/JairusSW/wide)

![Image description](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/dwzr9ja8yc1u8nav3nzm.png)

That's the kind of insanity I wanted Wago's architecture to allow. A runtime that belongs to you. A runtime that doesn't worry you. A runtime that gives you all the freedom you could imagine.

I mean, wasmer is like some cloud-container-pass thing right now. I don't want that.

> rather than paying wasmer, you can always [sponsor](https://github.com/sponsors/JairusSW) me :) :P :O :D <3

Want WASI?

```sh
wago add wago-org/wasi
```

Don't want WASI?

No biggie. You're in control.
You don't pay for it.

I want users to have _full_ control over _**their**_ WebAssembly runtime.

That's basically the philosophy behind this whole project:

> **Do as little work as possible, but do that work extremely well.**

## So... is it worthy?

Honestly?

I don't know yet.

Wago is brand new.

Wasmtime and wazero have years of production use and thousands of people finding increasingly creative ways to break them.

No benchmark chart can fake that kind of maturity.

There are bugs in Wago.

There will be breaking changes.

Somebody is probably going to read this post, download it, and immediately find a `.wasm` file that makes Railshot do something incredibly stupid.

**I genuinely hope you do.**

I've spent the past few months testing Wago against workloads that _I_ chose.

Now I want yours.

Run your weirdest wasm.

Benchmark it.

Throw Rust at it.

Throw Go at it.

Throw C and C++ at it.

Try it on a microcontroller.

Find somewhere wazero demolishes it.

Make it panic.

Make it segfault.

Make it generate absolutely atrocious machine code.

Then [**open an issue**](https://github.com/wago-org/wago/issues).

Let's see how far we can take this.

**Together.**

Please give it a try :)

```sh
go run github.com/wago-org/wago/cli/wago-installer@main
```

> P.S. please join our [Discord](https://wago.sh/discord) to discuss stuff, mull over features, and test new releases!
