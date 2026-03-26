import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Resvg } from "@resvg/resvg-js";

const root = process.cwd();
const siteUrl = "https://blog.jairus.dev";
const defaultSocialImage = "/social/site.png";
const githubToken = process.env.GH_DISCUSSIONS_TOKEN || process.env.GITHUB_TOKEN || "";
const githubRepoOwner = "JairusSW";
const githubRepoName = "blog";
const postsDir = path.join(root, "posts");
const tagsDir = path.join(root, "tags");
const socialDir = path.join(root, "public", "social");
const dataPath = path.join(root, ".vitepress", "theme", "posts.data.json");
const tagsDataPath = path.join(root, ".vitepress", "theme", "tags.data.json");
const configPath = path.join(root, ".vitepress", "config.mts");
const homePath = path.join(root, "index.md");
const aboutPath = path.join(root, "about.md");
const archivePath = path.join(postsDir, "index.md");

fs.mkdirSync(socialDir, { recursive: true });

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

function absoluteUrl(input) {
  if (!input) return `${siteUrl}${defaultSocialImage}`;
  if (/^https?:\/\//.test(input)) return input;
  return `${siteUrl}${input.startsWith("/") ? input : `/${input}`}`;
}

async function fetchDiscussionCounts(posts) {
  if (!githubToken) {
    return new Map();
  }

  const query = `
    query DiscussionCounts($owner: String!, $name: String!, $endCursor: String) {
      repository(owner: $owner, name: $name) {
        discussions(first: 100, after: $endCursor) {
          nodes {
            title
            comments {
              totalCount
            }
            reactions {
              totalCount
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `;

  const byPathname = new Map();
  for (const post of posts) {
    byPathname.set(`/posts/${post.slug}`, post.slug);
    byPathname.set(`posts/${post.slug}`, post.slug);
  }
  const counts = new Map();
  let endCursor = null;

  while (true) {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${githubToken}`,
      },
      body: JSON.stringify({
        query,
        variables: {
          owner: githubRepoOwner,
          name: githubRepoName,
          endCursor,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(`GitHub GraphQL error: ${payload.errors.map((error) => error.message).join("; ")}`);
    }

    const connection = payload.data?.repository?.discussions;
    const nodes = connection?.nodes || [];

    for (const discussion of nodes) {
      const title = String(discussion?.title || "");
      for (const [pathname, slug] of byPathname.entries()) {
        if (!title.includes(pathname)) continue;
        counts.set(slug, {
          comments: Number(discussion?.comments?.totalCount || 0),
          reactions: Number(discussion?.reactions?.totalCount || 0),
        });
      }
    }

    if (!connection?.pageInfo?.hasNextPage) {
      break;
    }
    endCursor = connection.pageInfo.endCursor;
  }

  return counts;
}

function buildHead({ title, description, image, url, type = "article" }) {
  return [
    ["meta", { property: "og:title", content: title }],
    ["meta", { property: "og:description", content: description }],
    ["meta", { property: "og:image", content: image }],
    ["meta", { property: "og:url", content: url }],
    ["meta", { property: "og:type", content: type }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: title }],
    ["meta", { name: "twitter:description", content: description }],
    ["meta", { name: "twitter:image", content: image }],
  ];
}

function updateMarkdownFile(filePath, mutate) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const next = mutate(parsed);
  fs.writeFileSync(filePath, matter.stringify(next.content, next.data));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapLines(text, maxChars) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function colorFromString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function getImageDataUri(input) {
  if (!input || /^https?:\/\//.test(input)) return "";

  const cleanPath = input.startsWith("/") ? input.slice(1) : input;
  const filePath = path.join(root, "public", cleanPath);
  if (!fs.existsSync(filePath)) return "";

  const extension = path.extname(filePath).toLowerCase();
  const mimeType = extension === ".png"
    ? "image/png"
    : extension === ".webp"
      ? "image/webp"
      : "image/jpeg";

  return `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;
}


function renderCard({
  title,
  description,
  eyebrow = "Jairus' Blog",
  banner = "",
  date = "",
  category = "",
}, outputName) {
  const hue = colorFromString(`${title}${category}${description}`);
  const titleLines = wrapLines(title, 28).slice(0, 3);
  const descLines = wrapLines(description, 60).slice(0, 3);
  const bannerImage = getImageDataUri(banner);
  const cardX = 120;
  const cardY = 48;
  const cardWidth = 960;
  const cardHeight = 534;
  const bannerHeight = 214;
  const bodyX = cardX + 44;
  const bodyY = cardY + bannerHeight + 46;
  const meta = [date, category].filter(Boolean).join(" · ");

  const svg = `
  <svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="frame-bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
        <stop stop-color="#0f172a"/>
        <stop offset="1" stop-color="#111827"/>
      </linearGradient>
      <radialGradient id="frame-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(960 60) rotate(140) scale(520 420)">
        <stop stop-color="hsla(${hue}, 90%, 60%, 0.34)"/>
        <stop offset="1" stop-color="hsla(${hue}, 90%, 60%, 0)"/>
      </radialGradient>
      <linearGradient id="banner-fallback" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="hsla(${hue}, 70%, 26%, 0.9)"/>
        <stop offset="1" stop-color="#172033"/>
      </linearGradient>
      <linearGradient id="banner-overlay" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="rgba(15,23,32,0.03)"/>
        <stop offset="1" stop-color="rgba(15,23,32,0.18)"/>
      </linearGradient>
      <clipPath id="card-clip">
        <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="24"/>
      </clipPath>
      <clipPath id="banner-clip">
        <path d="M${cardX + 24} ${cardY}H${cardX + cardWidth - 24}C${cardX + cardWidth - 10.745} ${cardY} ${cardX + cardWidth} ${cardY + 10.745} ${cardX + cardWidth} ${cardY + 24}V${cardY + bannerHeight}H${cardX}V${cardY + 24}C${cardX} ${cardY + 10.745} ${cardX + 10.745} ${cardY} ${cardX + 24} ${cardY}Z"/>
      </clipPath>
      <filter id="shadow" x="80" y="24" width="1040" height="590" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="rgba(15,23,42,0.45)"/>
      </filter>
    </defs>
    <rect width="1200" height="630" rx="36" fill="url(#frame-bg)"/>
    <rect width="1200" height="630" rx="36" fill="url(#frame-glow)"/>
    <g filter="url(#shadow)">
      <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="24" fill="#0f1720" stroke="rgba(148,163,184,0.18)"/>
      <g clip-path="url(#banner-clip)">
        ${bannerImage
          ? `<image href="${bannerImage}" x="${cardX}" y="${cardY}" width="${cardWidth}" height="${bannerHeight}" preserveAspectRatio="xMidYMid slice"/>`
          : `<rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${bannerHeight}" fill="url(#banner-fallback)"/>`
        }
        <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${bannerHeight}" fill="url(#banner-overlay)"/>
      </g>
      <line x1="${cardX}" x2="${cardX + cardWidth}" y1="${cardY + bannerHeight}" y2="${cardY + bannerHeight}" stroke="rgba(148,163,184,0.14)"/>
      <text x="${bodyX}" y="${bodyY}" fill="#94a3b8" font-size="20" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="0.8">${escapeXml(meta || eyebrow)}</text>
      ${titleLines.map((line, index) => `<text x="${bodyX}" y="${bodyY + 54 + index * 52}" fill="#f8fafc" font-size="42" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeXml(line)}</text>`).join("")}
      ${descLines.map((line, index) => `<text x="${bodyX}" y="${bodyY + 194 + index * 30}" fill="#cbd5e1" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="500">${escapeXml(line)}</text>`).join("")}
    </g>
  </svg>`;

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  });
  const png = resvg.render().asPng();
  fs.writeFileSync(path.join(socialDir, outputName), png);
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
    const title = parsed.data.title || slugToTitle(slug);
    const description = parsed.data.description || summarize(parsed.content, 140);
    const date = parsed.data.date || new Date(stat.mtime).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    return {
      slug,
      title,
      description,
      date,
      category: parsed.data.category || "Post",
      banner: parsed.data.banner || "",
      bannerAlt: parsed.data.bannerAlt || "",
      socialImage: parsed.data.socialImage || `/social/${slug}.png`,
      tags,
      commentCount: 0,
      reactionCount: 0,
      mtimeMs: stat.mtimeMs,
    };
  })
  .sort((a, b) => b.mtimeMs - a.mtimeMs);

try {
  const discussionCounts = await fetchDiscussionCounts(posts);
  for (const post of posts) {
    const counts = discussionCounts.get(post.slug);
    if (!counts) continue;
    post.commentCount = counts.comments;
    post.reactionCount = counts.reactions;
  }
} catch (error) {
  console.warn(`Unable to fetch GitHub discussion counts: ${error.message}`);
}

renderCard(
  {
    title: "Jairus' Blog",
    description: "Build notes, release notes, and opinions with receipts.",
    eyebrow: "Jairus' Blog",
  },
  "site.png"
);

for (const post of posts) {
  renderCard(
    {
      title: post.title,
      description: post.description,
      eyebrow: post.category || "Post",
      banner: post.banner,
      date: post.date,
      category: post.category,
    },
    `${post.slug}.png`
  );
}

for (const post of posts) {
  const filePath = path.join(postsDir, `${post.slug}.md`);
  updateMarkdownFile(filePath, ({ data, content }) => ({
    data: {
      ...data,
      socialImage: data.socialImage || post.socialImage,
      head: buildHead({
        title: post.title,
        description: post.description,
        image: absoluteUrl(data.socialImage || post.socialImage),
        url: `${siteUrl}/posts/${post.slug}`,
      }),
    },
    content,
  }));
}

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

const tagsIndex = matter.stringify(
  '# Tags\n\nBrowse posts by topic.\n\n<TagDirectory />\n',
  {
    title: 'Tags',
    description: 'Browse posts by topic on Jairus\' blog.',
    head: buildHead({
      title: 'Tags | Jairus\' Blog',
      description: 'Browse posts by topic on Jairus\' blog.',
      image: absoluteUrl(defaultSocialImage),
      url: `${siteUrl}/tags/`,
      type: 'website',
    }),
  }
);
fs.writeFileSync(path.join(tagsDir, 'index.md'), tagsIndex);

for (const tag of tags) {
  const content = matter.stringify(
    `<PostCards tag="${tag.slug}" title="Tagged: ${tag.name}" intro="Posts filed under ${tag.name}." />\n`,
    {
      title: tag.name,
      description: `Posts filed under ${tag.name}.`,
      head: buildHead({
        title: `${tag.name} | Jairus' Blog`,
        description: `Posts filed under ${tag.name}.`,
        image: absoluteUrl(defaultSocialImage),
        url: `${siteUrl}/tags/${tag.slug}`,
        type: 'website',
      }),
    }
  );
  fs.writeFileSync(path.join(tagsDir, `${tag.slug}.md`), content);
}

const archive = matter.stringify(
  '<PostCards title="All Posts" intro="Every post in one place. Add a new markdown file under `posts/`, run `npm run posts:sync`, and this page updates automatically." />\n',
  {
    title: 'Archive',
    description: 'Browse every post on Jairus\' blog.',
    head: buildHead({
      title: 'Archive | Jairus\' Blog',
      description: 'Browse every post on Jairus\' blog.',
      image: absoluteUrl(defaultSocialImage),
      url: `${siteUrl}/posts/`,
      type: 'website',
    }),
  }
);
fs.writeFileSync(archivePath, archive);

const config = fs.readFileSync(configPath, 'utf8');
const sidebarItems = posts
  .map((post) => `            { text: ${JSON.stringify(post.title)}, link: "/posts/${post.slug}" },`)
  .join('\n');
const postsSidebarStart = config.indexOf('"/posts/": [');
let nextConfig = config;
if (postsSidebarStart !== -1) {
  const itemsStart = config.indexOf('items: [', postsSidebarStart);
  const itemsEnd = config.indexOf('\n          ],', itemsStart);
  if (itemsStart !== -1 && itemsEnd !== -1) {
    const before = config.slice(0, itemsStart + 'items: ['.length);
    const after = config.slice(itemsEnd);
    nextConfig = `${before}\n            { text: "Archive", link: "/posts/" },\n${sidebarItems}${after}`;
  }
}
nextConfig = nextConfig.replace(/giscus: \{([\s\S]*?)loading: "lazy",\n\s*tagColors:/, 'giscus: {$1loading: "lazy",\n    },\n    tagColors:');
fs.writeFileSync(configPath, nextConfig);

const latest = posts[0];
if (latest) {
  updateMarkdownFile(homePath, ({ data, content }) => ({
    data: {
      ...data,
      description: data.description || 'Build notes, release notes, and opinions with receipts.',
      head: buildHead({
        title: `${data.hero?.name || "Jairus' Blog"}`,
        description: data.description || 'Build notes, release notes, and opinions with receipts.',
        image: absoluteUrl(defaultSocialImage),
        url: `${siteUrl}/`,
        type: 'website',
      }),
    },
    content: content.replace(/link: \/posts\/[A-Za-z0-9-]+/, `link: /posts/${latest.slug}`),
  }));
}

updateMarkdownFile(aboutPath, ({ data, content }) => ({
  data: {
    ...data,
    title: data.title || 'About',
    description: data.description || 'About Jairus Tanaka and the work behind this blog.',
    head: buildHead({
      title: 'About | Jairus\' Blog',
      description: data.description || 'About Jairus Tanaka and the work behind this blog.',
      image: absoluteUrl(defaultSocialImage),
      url: `${siteUrl}/about`,
      type: 'website',
    }),
  },
  content,
}));

console.log(`Synced ${posts.length} posts and ${tags.length} tags.`);
