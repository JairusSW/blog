import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Jairus' Blog",
  description:
    "Notes on building tools, shipping software, and learning in public.",
  lang: "en-US",
  appearance: "dark",
  base: "/",
  cleanUrls: true,
  lastUpdated: true,
  sitemap: {
    hostname: "https://blog.jairus.dev",
  },
  head: [["link", { rel: "icon", type: "image/png", href: "/logo.png" }]],
  transformHead({ pageData }) {
    const canonical =
      "https://blog.jairus.dev/" +
      pageData.relativePath
        .replace(/(^|\/)index\.md$/, "$1")
        .replace(/\.md$/, "");
    return [["link", { rel: "canonical", href: canonical }]];
  },
  themeConfig: {
    logo: "/logo.png",
    nav: [
      { text: "Home", link: "/" },
      { text: "Archive", link: "/posts/" },
      { text: "Tags", link: "/tags/" },
      { text: "Docs", link: "https://docs.jairus.dev" },
      { text: "About", link: "/about" },
      { text: "GitHub", link: "https://github.com/JairusSW" },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/JairusSW" },
      {
        icon: {
          svg: '<svg fill="#ffffff" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>npm</title><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z"/></svg>',
        },
        link: "https://www.npmjs.com/~jairussw/",
      },
      {
        icon: {
          svg: '<svg fill="#ffffff" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>LinkedIn</title><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
        },
        link: "https://www.linkedin.com/in/jairussw/",
      },
      {
        icon: {
          svg: '<svg fill="#ffffff" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Email</title><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12c2.43 0 4.69-.722 6.586-1.962l-.989-1.526A9.93 9.93 0 0 1 12 22.071C6.45 22.071 1.929 17.55 1.929 12S6.45 1.929 12 1.929 22.071 6.45 22.071 12v1.286a1.929 1.929 0 0 1-3.857 0V12a6.214 6.214 0 1 0-1.985 4.553 3.857 3.857 0 0 0 6.985-2.267V12c0-6.627-5.373-12-12-12zm0 16.286A4.286 4.286 0 1 1 12 7.714a4.286 4.286 0 0 1 0 8.572z"/></svg>',
        },
        link: "mailto:me@jairus.dev",
      },
    ],
    giscus: {
      repo: "JairusSW/blog",
      repoId: "R_kgDORw_POw",
      category: "General",
      categoryId: "DIC_kwDORw_PO84C5TJm",
      mapping: "pathname",
      strict: "0",
      reactionsEnabled: "1",
      emitMetadata: "0",
      inputPosition: "bottom",
      lang: "en",
      loading: "lazy",
    },
    tagColors: {
      performance: "#5eead4",
      json: "#f59e0b",
      swar: "#60a5fa",
      assemblyscript: "#2563eb",
      webassembly: "#7c3aed",
      testing: "#34d399",
      fuzzing: "#f87171",
    },
    sidebar: {
      "/posts/": [
        {
          text: "Posts",
          items: [
            { text: "Archive", link: "/posts/" },
            { text: "Validating UTF-8 at Gigabytes per Second", link: "/posts/validating-utf8-at-gigabytes-per-second" },
            { text: "Quickly detecting Escapes with SWAR", link: "/posts/quickly-detecting-escapes-with-swar" },
            { text: "Testing in AssemblyScript", link: "/posts/testing-in-assemblyscript" },
            { text: "Quickly parsing Unicode Escapes with SWAR", link: "/posts/quickly-parsing-unicode-escapes-with-swar" },
            { text: "Fuzzing in AssemblyScript", link: "/posts/fuzzing-in-assemblyscript" },
          ],
        },
      ],
    },
    footer: {
      message: "Built with ♡",
      copyright: "Copyright © 2026 Jairus",
    },
  },
});
