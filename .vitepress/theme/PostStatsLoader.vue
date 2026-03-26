<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useData } from "vitepress";

const props = defineProps<{
  posts: Array<{ slug: string }>;
}>();

const { isDark, theme } = useData();
const container = ref<HTMLElement | null>(null);
const queue = computed(() => props.posts ?? []);
const giscus = computed(() => theme.value.giscus ?? {});
const CACHE_KEY = "post-stats:v2";
const STALE_AFTER_MS = 1000 * 60 * 60 * 6;

type PostStatRecord = {
  comments: number;
  reactions: number;
  fetchedAt?: number;
};

function getStore(): Record<string, PostStatRecord> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as Record<
      string,
      PostStatRecord
    >;
  } catch {
    return {};
  }
}

function setStore(slug: string, data: PostStatRecord) {
  const store = getStore();
  store[slug] = {
    comments: Number(data.comments || 0),
    reactions: Number(data.reactions || 0),
    fetchedAt: Date.now(),
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("post-stats-updated"));
}

function readDiscussionStats(payload: any): { comments: number; reactions: number } {
  const discussion = payload?.discussion;
  if (!discussion) return { comments: 0, reactions: 0 };

  const totalCommentCount = Number(discussion.totalCommentCount || 0);
  const totalReplyCount = Number(discussion.totalReplyCount || 0);

  const reactions = Number(
    discussion.reactions?.totalCount ||
      discussion.reactionCount ||
      (Array.isArray(discussion.reactionGroups)
        ? discussion.reactionGroups.reduce(
            (sum: number, group: any) =>
              sum + Number(group?.users?.totalCount || group?.count || 0),
            0,
          )
        : 0),
  );

  return {
    comments: totalCommentCount + totalReplyCount,
    reactions,
  };
}

async function queryDiscussionStats(term: string): Promise<{ comments: number; reactions: number } | null> {
  if (!container.value) return null;
  container.value.innerHTML = "";

  return await new Promise((resolve) => {
    let finished = false;

    const done = (value: { comments: number; reactions: number } | null) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("message", onMessage);
      resolve(value);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://giscus.app") return;
      if (!(typeof event.data === "object" && event.data?.giscus)) return;

      const payload = event.data.giscus;
      if (payload.error) {
        done(null);
        return;
      }

      if (payload.discussion) {
        done(readDiscussionStats(payload));
      }
    };

    window.addEventListener("message", onMessage);

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-repo", giscus.value.repo);
    script.setAttribute("data-repo-id", giscus.value.repoId);
    script.setAttribute("data-category", giscus.value.category);
    script.setAttribute("data-category-id", giscus.value.categoryId);
    script.setAttribute("data-mapping", "specific");
    script.setAttribute("data-term", term);
    script.setAttribute("data-strict", "1");
    script.setAttribute("data-reactions-enabled", giscus.value.reactionsEnabled ?? "1");
    script.setAttribute("data-emit-metadata", "1");
    script.setAttribute("data-input-position", giscus.value.inputPosition ?? "bottom");
    script.setAttribute("data-theme", isDark.value ? "dark" : "light");
    script.setAttribute("data-lang", giscus.value.lang ?? "en");
    script.setAttribute("data-loading", "eager");
    container.value?.appendChild(script);

    window.setTimeout(() => {
      done(null);
    }, 3000);
  });
}

function buildTerms(slug: string): string[] {
  return [`/posts/${slug}`, `/posts/${slug}/`, `posts/${slug}`];
}

function isFresh(record?: PostStatRecord): boolean {
  if (!record) return false;
  if (!record.fetchedAt) return false;
  return Date.now() - record.fetchedAt < STALE_AFTER_MS;
}

async function loadStats(slug: string) {
  for (const term of buildTerms(slug)) {
    const result = await queryDiscussionStats(term);
    if (result) {
      setStore(slug, result);
      return;
    }
  }
  const existing = getStore()[slug];
  setStore(slug, {
    comments: existing?.comments || 0,
    reactions: existing?.reactions || 0,
  });
}

onMounted(async () => {
  const store = getStore();
  for (const post of queue.value) {
    const current = store[post.slug];
    if (isFresh(current)) continue;
    await loadStats(post.slug);
  }
  if (container.value) container.value.innerHTML = "";
});
</script>

<template>
  <div ref="container" class="post-stats-loader" aria-hidden="true" />
</template>
