---
layout: home

hero:
  name: Jairus' Blog
  text: Build notes, release notes, and opinions with receipts
  tagline: Writing about tooling, software design, performance, and whatever I learn the hard way.
  actions:
    - theme: brand
      text: Read the latest
      link: /posts/quickly-parsing-unicode-escapes-with-swar
    - theme: alt
      text: Browse archive
      link: /posts/
    - theme: alt
      text: About
      link: /about

features:
  - title: Build Logs
    details: Short write-ups on what shipped, what broke, and what changed in the code.
  - title: Tooling Notes
    details: Opinions on docs, testing, release workflows, and pragmatic engineering tradeoffs.
  - title: Project Context
    details: Background on the packages I maintain and the decisions behind them.
---

<PostCards
  :limit="4"
  title="Recent Posts"
  intro="The newest writing from the blog, rendered from post metadata instead of hand-maintained links."
/>
