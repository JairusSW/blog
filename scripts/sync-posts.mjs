import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const root = process.cwd();
const siteUrl = "https://blog.jairus.dev";
const defaultSocialImage = "/logo.png";
const githubToken =
  process.env.GH_DISCUSSIONS_TOKEN || process.env.GITHUB_TOKEN || "";
const githubRepoOwner = "JairusSW";
const githubRepoName = "blog";
const postsDir = path.join(root, "posts");
const tagsDir = path.join(root, "tags");
const socialDir = path.join(root, "public", "social");
const socialFontDir = path.join(root, ".vitepress", "theme", "fonts");
const socialImageMaxBytes = 600 * 1024;
const vpDividerDark = { r: 46, g: 46, b: 50 };
const white = { r: 255, g: 255, b: 255 };
const dataPath = path.join(root, ".vitepress", "theme", "posts.data.json");
const tagsDataPath = path.join(root, ".vitepress", "theme", "tags.data.json");
const configPath = path.join(root, ".vitepress", "config.mts");
const homePath = path.join(root, "index.md");
const aboutPath = path.join(root, "about.md");
const archivePath = path.join(postsDir, "index.md");

function readTagColorOverrides() {
  const config = fs.readFileSync(configPath, "utf8");
  const match = config.match(/tagColors:\s*\{([\s\S]*?)\n\s*\},\n\s*sidebar:/);
  if (!match) return {};

  const overrides = {};
  const entryPattern = /(\w+)\s*:\s*["']([^"']+)["']/g;
  for (const entry of match[1].matchAll(entryPattern)) {
    overrides[entry[1].toLowerCase()] = entry[2];
  }
  return overrides;
}

const tagColorOverrides = readTagColorOverrides();

fs.mkdirSync(socialDir, { recursive: true });
fs.mkdirSync(socialFontDir, { recursive: true });

function slugToTitle(slug) {
  return slug
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function summarize(text, max = 120) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= max
    ? compact
    : `${compact.slice(0, max - 1).trimEnd()}…`;
}

function parseFrontmatterDate(value, fieldName, slug) {
  let raw;
  if (value instanceof Date) {
    raw = value.toISOString().slice(0, 10);
  } else if (typeof value === "string") {
    raw = value;
  }

  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(
      `Post ${slug} must define ${fieldName} in YYYY-MM-DD format.`,
    );
  }

  const date = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Post ${slug} has an invalid ${fieldName}: ${raw}`);
  }

  return {
    raw,
    display: new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(date),
    sortValue: date.getTime(),
  };
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
      throw new Error(
        `GitHub GraphQL request failed: ${response.status} ${response.statusText}`,
      );
    }

    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(
        `GitHub GraphQL error: ${payload.errors.map((error) => error.message).join("; ")}`,
      );
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
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "").trim();
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => part + part)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function mixRgb(a, b, weightA) {
  const weightB = 1 - weightA;
  return {
    r: Math.round(a.r * weightA + b.r * weightB),
    g: Math.round(a.g * weightA + b.g * weightB),
    b: Math.round(a.b * weightA + b.b * weightB),
  };
}

function resolveTagPalette(tag) {
  const key = String(tag).toLowerCase();
  const override = tagColorOverrides[key];
  if (override) {
    const rgb = hexToRgb(override);
    if (rgb) {
      return {
        background: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.26)`,
        text: "rgb(248, 250, 252)",
      };
    }
  }

  const hue = colorFromString(key);
  return {
    background: `hsla(${hue}, 78%, 52%, 0.12)`,
    text: "rgb(248, 250, 252)",
  };
}

function getImageDataUri(input) {
  if (!input || /^https?:\/\//.test(input)) return "";

  const cleanPath = input.startsWith("/") ? input.slice(1) : input;
  const filePath = path.join(root, "public", cleanPath);
  if (!fs.existsSync(filePath)) return "";

  const extension = path.extname(filePath).toLowerCase();
  const mimeType =
    extension === ".png"
      ? "image/png"
      : extension === ".webp"
        ? "image/webp"
        : "image/jpeg";

  return `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function renderTagPills(tags, startX, y) {
  let offsetX = startX;
  return tags
    .slice(0, 4)
    .map((tag, index) => {
      const width = Math.max(112, 40 + tag.length * 13);
      const x = offsetX;
      offsetX += width + 14;
      const palette = resolveTagPalette(tag);
      return `
      <rect x="${x}" y="${y}" width="${width}" height="44" rx="22" fill="${palette.background}"/>
      <text x="${x + width / 2}" y="${y + 24}" fill="${palette.text}" font-size="20" font-family="League Spartan" font-weight="600" text-anchor="middle" dominant-baseline="middle">${escapeXml(tag)}</text>
    `;
    })
    .join("");
}

function formatCountLabel(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function compressSocialPng(filePath) {
  const originalSize = fs.statSync(filePath).size;
  if (originalSize <= socialImageMaxBytes) {
    return Promise.resolve(originalSize);
  }

  const attempts = [
    { colors: 32, quality: 96 },
    { colors: 48, quality: 92 },
    { colors: 64, quality: 88 },
    { colors: 96, quality: 84 },
    { colors: 128, quality: 82 },
  ];

  let bestSize = originalSize;
  let bestBuffer = fs.readFileSync(filePath);

  return sharp(filePath)
    .png()
    .toBuffer()
    .then(async (sourceBuffer) => {
      for (const { colors, quality } of attempts) {
        const output = await sharp(sourceBuffer)
          .png({
            compressionLevel: 9,
            progressive: false,
            palette: true,
            quality,
            colours: colors,
            effort: 10,
          })
          .toBuffer();

        if (output.length < bestSize) {
          bestSize = output.length;
          bestBuffer = output;
        }

        if (output.length <= socialImageMaxBytes) {
          fs.writeFileSync(filePath, output);
          return output.length;
        }
      }

      fs.writeFileSync(filePath, bestBuffer);
      return bestSize;
    });
}

async function renderCard(
  {
    title,
    tags = [],
    eyebrow = "Jairus' Blog",
    banner = "",
    date = "",
    category = "",
    reactionCount = 0,
    commentCount = 0,
  },
  outputName,
) {
  const hue = colorFromString(`${title}${category}${eyebrow}`);
  const titleLines = wrapLines(title, 24).slice(0, 3);
  const bannerImage = getImageDataUri(banner);
  const cardWidth = 1200;
  const cardHeight = 630;
  const meta = [date, category].filter(Boolean).join(" · ");
  const metaLabel = meta || eyebrow;
  const statsLabel =
    reactionCount || commentCount
      ? `${formatCountLabel(reactionCount, "reaction")}   ${formatCountLabel(commentCount, "comment")}`
      : "";
  const framePad = 0;
  const bodyX = 52;
  const bannerX = framePad;
  const bannerY = framePad;
  const bannerWidth = cardWidth - framePad * 2;
  const bannerHeight = 350;
  const metaY = bannerY + bannerHeight + 52;
  const titleY = metaY + 72;
  const titleLineHeight = 68;
  const footerY = cardHeight - 60;
  const tagsSvg = renderTagPills(tags, bodyX, footerY);

  const svg = `
  <svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="card-bg" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#07111a"/>
        <stop offset="0.62" stop-color="#0d1726"/>
        <stop offset="1" stop-color="#121c2b"/>
      </linearGradient>
      <linearGradient id="accent-wash" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="hsla(${hue}, 78%, 56%, 0.18)"/>
        <stop offset="1" stop-color="hsla(${(hue + 52) % 360}, 72%, 54%, 0.06)"/>
      </linearGradient>
      <linearGradient id="banner-fallback" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="hsla(${hue}, 70%, 28%, 0.96)"/>
        <stop offset="1" stop-color="#1b2940"/>
      </linearGradient>
      <linearGradient id="bottom-fade" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="rgba(8,15,24,0)"/>
        <stop offset="1" stop-color="rgba(8,15,24,0.5)"/>
      </linearGradient>
      <pattern id="blueprint-grid" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M48 0H0V48" fill="none" stroke="rgba(147,197,253,0.08)" stroke-width="1"/>
        <circle cx="0" cy="0" r="1.4" fill="rgba(125,211,252,0.18)"/>
      </pattern>
      <pattern id="blueprint-grid-fine" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M16 0H0V16" fill="none" stroke="rgba(148,163,184,0.045)" stroke-width="1"/>
      </pattern>
      <clipPath id="banner-clip">
        <path d="M${bannerX + 26} ${bannerY}H${bannerX + bannerWidth - 26}C${bannerX + bannerWidth - 11.64} ${bannerY} ${bannerX + bannerWidth} ${bannerY + 11.64} ${bannerX + bannerWidth} ${bannerY + 26}V${bannerY + bannerHeight}H${bannerX}V${bannerY + 26}C${bannerX} ${bannerY + 11.64} ${bannerX + 11.64} ${bannerY} ${bannerX + 26} ${bannerY}Z"/>
      </clipPath>
    </defs>
    <rect x="0" y="0" width="${cardWidth}" height="${cardHeight}" rx="28" fill="url(#card-bg)"/>
    <rect x="${framePad}" y="${framePad}" width="${cardWidth - framePad * 2}" height="${cardHeight - framePad * 2}" rx="28" fill="rgba(9,15,24,0.7)" stroke="rgba(148,163,184,0.16)"/>
    <circle cx="196" cy="112" r="190" fill="url(#accent-wash)"/>
    <circle cx="962" cy="56" r="220" fill="hsla(${(hue + 34) % 360}, 80%, 54%, 0.08)"/>
    <circle cx="1028" cy="620" r="196" fill="hsla(${(hue + 12) % 360}, 80%, 54%, 0.07)"/>
    <rect x="0" y="${bannerHeight}" width="${cardWidth}" height="${cardHeight - bannerHeight}" fill="url(#blueprint-grid-fine)"/>
    <rect x="0" y="${bannerHeight}" width="${cardWidth}" height="${cardHeight - bannerHeight}" fill="url(#blueprint-grid)"/>
    <path d="M0 ${bannerHeight + 42}H264L304 ${bannerHeight + 86}H612L654 ${bannerHeight + 132}H1200" fill="none" stroke="rgba(125,211,252,0.13)" stroke-width="2"/>
    <path d="M0 ${bannerHeight + 130}H176L222 ${bannerHeight + 178}H430L482 ${bannerHeight + 226}H902L960 ${bannerHeight + 264}H1200" fill="none" stroke="rgba(147,197,253,0.09)" stroke-width="2"/>
    <circle cx="1038" cy="${bannerHeight + 108}" r="74" fill="none" stroke="rgba(125,211,252,0.08)" stroke-width="2"/>
    <circle cx="1038" cy="${bannerHeight + 108}" r="46" fill="none" stroke="rgba(125,211,252,0.08)" stroke-width="1.5"/>
    <path d="M996 ${bannerHeight + 108}H1080M1038 ${bannerHeight + 66}V${bannerHeight + 150}" fill="none" stroke="rgba(125,211,252,0.08)" stroke-width="1.5"/>
    <rect x="0" y="${bannerHeight}" width="${cardWidth}" height="${cardHeight - bannerHeight}" fill="url(#bottom-fade)"/>
    <text x="${bodyX}" y="${metaY}" fill="#93C5FD" font-size="22" font-family="League Spartan" font-weight="600" letter-spacing="0.6">${escapeXml(metaLabel)}</text>
    ${titleLines.map((line, index) => `<text x="${bodyX}" y="${titleY + index * titleLineHeight}" fill="#F8FAFC" font-size="62" font-family="League Spartan" font-weight="700">${escapeXml(line)}</text>`).join("")}
    <rect x="${bannerX}" y="${bannerY}" width="${bannerWidth}" height="${bannerHeight}" rx="26" fill="rgba(15,23,42,0.44)" stroke="rgba(148,163,184,0.14)"/>
      <g clip-path="url(#banner-clip)">
        ${
          bannerImage
            ? `<image href="${bannerImage}" x="${bannerX}" y="${bannerY}" width="${bannerWidth}" height="${bannerHeight}" preserveAspectRatio="xMidYMid slice"/>`
            : `<rect x="${bannerX}" y="${bannerY}" width="${bannerWidth}" height="${bannerHeight}" fill="url(#banner-fallback)"/>`
        }
      </g>
      ${tagsSvg}
      ${
        statsLabel
          ? `<text x="${bodyX}" y="${footerY - 28}" fill="#94A3B8" font-size="24" font-family="League Spartan" font-weight="500">${escapeXml(statsLabel)}</text>`
          : ""
      }
  </svg>`;

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: {
      fontFiles: [path.join(socialFontDir, "LeagueSpartan-SemiBold.otf")],
      loadSystemFonts: false,
      defaultFontFamily: "League Spartan",
    },
  });
  const png = resvg.render().asPng();
  const outputPath = path.join(socialDir, outputName);
  fs.writeFileSync(outputPath, png);
  const finalSize = await compressSocialPng(outputPath);
  if (finalSize > socialImageMaxBytes) {
    throw new Error(
      `Social image ${outputName} exceeds 600 KB after compression (${finalSize} bytes).`,
    );
  }
}

const postFiles = fs
  .readdirSync(postsDir)
  .filter((file) => file.endsWith(".md") && file !== "index.md")
  .sort();

const postEntries = postFiles.map((file) => {
  const fullPath = path.join(postsDir, file);
  const raw = fs.readFileSync(fullPath, "utf8");
  const parsed = matter(raw);
  const slug = file.replace(/\.md$/, "");
  return { fullPath, file, slug, parsed };
});

let nextId =
  postEntries.reduce((maxId, entry) => {
    const id = Number(entry.parsed.data.id);
    return Number.isInteger(id) && id > maxId ? id : maxId;
  }, 0) + 1;

const posts = postEntries
  .map((entry) => {
    const { fullPath, slug, parsed } = entry;
    const tags = Array.isArray(parsed.data.tags)
      ? parsed.data.tags.map(String)
      : [];
    const title = parsed.data.title || slugToTitle(slug);
    const description =
      parsed.data.description || summarize(parsed.content, 140);

    let id = Number(parsed.data.id);
    if (!Number.isInteger(id) || id <= 0) {
      id = nextId;
      nextId += 1;
    }

    const today = new Date().toISOString().slice(0, 10);
    const createdSource = parsed.data.createdAt ?? parsed.data.date ?? today;
    const updatedSource = parsed.data.updatedAt ?? createdSource;
    const createdAt = parseFrontmatterDate(createdSource, "createdAt", slug);
    const updatedAt = parseFrontmatterDate(updatedSource, "updatedAt", slug);

    return {
      fullPath,
      slug,
      id,
      title,
      description,
      createdAt: createdAt.display,
      createdAtRaw: createdAt.raw,
      createdAtSort: createdAt.sortValue,
      updatedAt: updatedAt.display,
      updatedAtRaw: updatedAt.raw,
      updatedAtSort: updatedAt.sortValue,
      category: parsed.data.category || "Post",
      banner: parsed.data.banner || "",
      bannerAlt: parsed.data.bannerAlt || "",
      socialImage: parsed.data.socialImage || `/social/${slug}.png`,
      tags,
      commentCount: 0,
      reactionCount: 0,
    };
  })
  .sort(
    (a, b) =>
      b.createdAtSort - a.createdAtSort ||
      b.id - a.id ||
      a.slug.localeCompare(b.slug),
  );

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

for (const post of posts) {
  await renderCard(
    {
      title: post.title,
      tags: post.tags,
      eyebrow: post.category || "Post",
      banner: post.banner,
      date: post.createdAt,
      category: post.category,
      reactionCount: post.reactionCount,
      commentCount: post.commentCount,
    },
    `${post.slug}.png`,
  );
}

for (const post of posts) {
  const filePath = path.join(postsDir, `${post.slug}.md`);
  updateMarkdownFile(filePath, ({ data, content }) => {
    const nextData = {
      ...data,
      socialImage: data.socialImage || post.socialImage,
      head: buildHead({
        title: post.title,
        description: post.description,
        image: absoluteUrl(data.socialImage || post.socialImage),
        url: `${siteUrl}/posts/${post.slug}`,
      }),
      id: post.id,
      createdAt: post.createdAtRaw,
      updatedAt: post.updatedAtRaw,
    };
    delete nextData.date;
    return {
      data: nextData,
      content,
    };
  });
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
  "# Tags\n\nBrowse posts by topic.\n\n<TagDirectory />\n",
  {
    title: "Tags",
    description: "Browse posts by topic on Jairus' blog.",
    head: buildHead({
      title: "Tags | Jairus' Blog",
      description: "Browse posts by topic on Jairus' blog.",
      image: absoluteUrl(defaultSocialImage),
      url: `${siteUrl}/tags/`,
      type: "website",
    }),
  },
);
fs.writeFileSync(path.join(tagsDir, "index.md"), tagsIndex);

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
        type: "website",
      }),
    },
  );
  fs.writeFileSync(path.join(tagsDir, `${tag.slug}.md`), content);
}

const archive = matter.stringify(
  '<PostCards title="All Posts" intro="Every post in one place. Add a new markdown file under `posts/`, and `npm run posts:sync` will assign the next `id`, preserve `createdAt`, and set missing `updatedAt` metadata." />\n',
  {
    title: "Archive",
    description: "Browse every post on Jairus' blog.",
    head: buildHead({
      title: "Archive | Jairus' Blog",
      description: "Browse every post on Jairus' blog.",
      image: absoluteUrl(defaultSocialImage),
      url: `${siteUrl}/posts/`,
      type: "website",
    }),
  },
);
fs.writeFileSync(archivePath, archive);

const config = fs.readFileSync(configPath, "utf8");
const sidebarItems = posts
  .map(
    (post) =>
      `            { text: ${JSON.stringify(post.title)}, link: "/posts/${post.slug}" },`,
  )
  .join("\n");
const postsSidebarStart = config.indexOf('"/posts/": [');
let nextConfig = config;
if (postsSidebarStart !== -1) {
  const itemsStart = config.indexOf("items: [", postsSidebarStart);
  const itemsEnd = config.indexOf("\n          ],", itemsStart);
  if (itemsStart !== -1 && itemsEnd !== -1) {
    const before = config.slice(0, itemsStart + "items: [".length);
    const after = config.slice(itemsEnd);
    nextConfig = `${before}\n            { text: "Archive", link: "/posts/" },\n${sidebarItems}${after}`;
  }
}
nextConfig = nextConfig.replace(
  /giscus: \{([\s\S]*?)loading: "lazy",\n\s*tagColors:/,
  'giscus: {$1loading: "lazy",\n    },\n    tagColors:',
);
fs.writeFileSync(configPath, nextConfig);

const latest = posts[0];
if (latest) {
  updateMarkdownFile(homePath, ({ data, content }) => ({
    data: {
      ...data,
      description:
        data.description ||
        "Build notes, release notes, and opinions with receipts.",
      head: buildHead({
        title: `${data.hero?.name || "Jairus' Blog"}`,
        description:
          data.description ||
          "Build notes, release notes, and opinions with receipts.",
        image: absoluteUrl(defaultSocialImage),
        url: `${siteUrl}/`,
        type: "website",
      }),
    },
    content: content.replace(
      /link: \/posts\/[A-Za-z0-9-]+/,
      `link: /posts/${latest.slug}`,
    ),
  }));
}

updateMarkdownFile(aboutPath, ({ data, content }) => ({
  data: {
    ...data,
    title: data.title || "About",
    description:
      data.description || "About Jairus Tanaka and the work behind this blog.",
    head: buildHead({
      title: "About | Jairus' Blog",
      description:
        data.description ||
        "About Jairus Tanaka and the work behind this blog.",
      image: absoluteUrl(defaultSocialImage),
      url: `${siteUrl}/about`,
      type: "website",
    }),
  },
  content,
}));

console.log(`Synced ${posts.length} posts and ${tags.length} tags.`);
