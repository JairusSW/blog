import fs from "node:fs";
import path from "node:path";

const root = "/home/port/Code/blog/.vitepress/dist";
const pages = [
  "index.html",
  "about.html",
  "posts/index.html",
  "posts/quickly-parsing-unicode-escapes-with-swar.html",
  "tags/index.html",
];

function readMeta(html, attr, value) {
  const rx = new RegExp(`<meta[^>]+${attr}=["']${value}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${value}["']`, "i");
  const match = html.match(rx);
  return match?.[1] || match?.[2] || "";
}

for (const rel of pages) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.log(`MISSING ${rel}`);
    continue;
  }
  const html = fs.readFileSync(full, "utf8");
  console.log(`\nPAGE ${rel}`);
  console.log(`  og:title = ${readMeta(html, "property", "og:title")}`);
  console.log(`  og:description = ${readMeta(html, "property", "og:description")}`);
  console.log(`  og:image = ${readMeta(html, "property", "og:image")}`);
  console.log(`  og:url = ${readMeta(html, "property", "og:url")}`);
  console.log(`  og:type = ${readMeta(html, "property", "og:type")}`);
  console.log(`  twitter:card = ${readMeta(html, "name", "twitter:card")}`);
  console.log(`  twitter:title = ${readMeta(html, "name", "twitter:title")}`);
  console.log(`  twitter:image = ${readMeta(html, "name", "twitter:image")}`);
}
