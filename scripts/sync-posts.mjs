import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = "/home/port/Code/blog";
const postsDir = path.join(root, "posts");
const tagsDir = path.join(root, "tags");
const dataPath = path.join(root, ".vitepress", "theme", "posts.data.json");
const tagsDataPath = path.join(root, ".vitepress", "theme", "tags.data.json");
const configPath = path.join(root, ".vitepress", "config.mts");
const homePath = path.join(root, "index.md");
const archivePath = path.join(postsDir, "index.md");

function slugToTitle(slug) {
  return slug
    .split("-")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

function summarize(text, max = 120) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1).trimEnd()}…`;
}

function slugifyTag(tag) {
  return String(tag)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const posts = fs.readdirSync(postsDir)
  .filter((file) => file.endsWith(".md") && file !== "index.md")
  .map((file) => {
    const fullPath = path.join(postsDir, file);
    const stat = fs.statSync(fullPath);
    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed = matter(raw);
    const slug = file.replace(/\.md$/, "");
    const tags = Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [];
    return {
      slug,
      title: parsed.data.title || slugToTitle(slug),
      description: parsed.data.description || summarize(parsed.content, 140),
      date: parsed.data.date || new Date(stat.mtime).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      }),
      category: parsed.data.category || "Post",
      banner: parsed.data.banner || "",
      bannerAlt: parsed.data.bannerAlt || "",
      tags,
      mtimeMs: stat.mtimeMs
    };
  })
  .sort((a, b) => b.mtimeMs - a.mtimeMs);

const tagMap = new Map();
for (const post of posts) {
  for (const tag of post.tags) {
    const key = slugifyTag(tag);
    if (!key) continue;
    const current = tagMap.get(key) || { slug: key, name: tag, count: 0 };
    current.count += 1;
    tagMap.set(key, current);
  }
}
const tags = [...tagMap.values()].sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(dataPath, JSON.stringify(posts, null, 2) + "\n");
fs.writeFileSync(tagsDataPath, JSON.stringify(tags, null, 2) + "\n");

fs.mkdirSync(tagsDir, { recursive: true });
for (const entry of fs.readdirSync(tagsDir)) {
  if (entry.endsWith(".md")) fs.unlinkSync(path.join(tagsDir, entry));
}

const tagsIndex = [
  "# Tags",
  "",
  "Browse posts by topic.",
  "",
  '<TagDirectory />',
  ""
].join("\n");
fs.writeFileSync(path.join(tagsDir, "index.md"), tagsIndex);

for (const tag of tags) {
  const content = [
    `# ${tag.name}`,
    "",
    `<PostCards tag=\"${tag.slug}\" title=\"Tagged: ${tag.name}\" intro=\"Posts filed under ${tag.name}.\" />`,
    ""
  ].join("\n");
  fs.writeFileSync(path.join(tagsDir, `${tag.slug}.md`), content);
}

const archive = [
  "# Archive",
  "",
  '<PostCards title="All Posts" intro="Every post in one place. Add a new markdown file under `posts/`, run `npm run posts:sync`, and this page updates automatically." />',
  ""
].join("\n");
fs.writeFileSync(archivePath, archive);

const config = fs.readFileSync(configPath, "utf8");
const sidebarItems = posts
  .map((post) => `            { text: ${JSON.stringify(post.title)}, link: "/posts/${post.slug}" },`)
  .join("\n");
const nextConfig = config.replace(
  /(\/posts\/": \[\n\s*\{\n\s*text: "Posts",\n\s*items: \[\n)([\s\S]*?)(\n\s*\]\n\s*\}\n\s*\])/, 
  `$1            { text: "Archive", link: "/posts/" },\n${sidebarItems}$3`
);
fs.writeFileSync(configPath, nextConfig);

const latest = posts[0];
if (latest) {
  const home = fs.readFileSync(homePath, "utf8");
  const nextHome = home.replace(/link: \/posts\/[A-Za-z0-9-]+/, `link: /posts/${latest.slug}`);
  fs.writeFileSync(homePath, nextHome);
}

console.log(`Synced ${posts.length} posts and ${tags.length} tags.`);
