---
layout: home
hero:
  name: Jairus' Blog
  tagline: >-
    Writing about tooling, software design, performance, and whatever I learn
    the hard way.
  actions:
    - theme: brand
      text: Read the latest
      link: /posts/fuzzing-in-assemblyscript
    - theme: alt
      text: Browse archive
      link: /posts/
    - theme: alt
      text: Browse tags
      link: /tags/
    - theme: alt
      text: About
      link: /about
features:
  - title: Build Logs
    details: 'Short write-ups on what shipped, what broke, and what changed in the code.'
  - title: Tooling Notes
    details: >-
      Opinions on docs, testing, release workflows, and pragmatic engineering
      tradeoffs.
  - title: Project Context
    details: Background on the packages I maintain and the decisions behind them.
description: 'Build notes, release notes, and opinions with receipts.'
head:
  - - meta
    - property: 'og:title'
      content: Jairus' Blog
  - - meta
    - property: 'og:description'
      content: 'Build notes, release notes, and opinions with receipts.'
  - - meta
    - property: 'og:image'
      content: 'https://blog.jairus.dev/social/site.png'
  - - meta
    - property: 'og:url'
      content: 'https://blog.jairus.dev/'
  - - meta
    - property: 'og:type'
      content: website
  - - meta
    - name: 'twitter:card'
      content: summary_large_image
  - - meta
    - name: 'twitter:title'
      content: Jairus' Blog
  - - meta
    - name: 'twitter:description'
      content: 'Build notes, release notes, and opinions with receipts.'
  - - meta
    - name: 'twitter:image'
      content: 'https://blog.jairus.dev/social/site.png'
---

<PostCards
  :limit="4"
  title="Recent Posts"
/>
