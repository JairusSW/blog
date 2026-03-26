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

function getStore() {
  try {
    return JSON.parse(localStorage.getItem("post-stats:v1") || "{}");
  } catch {
    return {};
  }
}

function setStore(slug: string, data: { comments: number; reactions: number }) {
  const store = getStore();
  store[slug] = data;
  localStorage.setItem("post-stats:v1", JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("post-stats-updated"));
}

function readDiscussionStats(payload: any) {
  const discussion = payload?.discussion;
  if (!discussion) return { comments: 0, reactions: 0 };

  const totalCommentCount = Number(discussion.totalCommentCount || 0);
  const totalReplyCount = Number(discussion.totalReplyCount || 0);

  const reactions = Number(
    discussion.reactions?.totalCount
    || discussion.reactionCount
    || (Array.isArray(discussion.reactionGroups)
      ? discussion.reactionGroups.reduce((sum: number, group: any) => sum + Number(group?.users?.totalCount || group?.count || 0), 0)
      : 0)
  );

  return {
    comments: totalCommentCount + totalReplyCount,
    reactions,
  };
}

async function loadStats(slug: string) {
  if (!container.value) return;
  container.value.innerHTML = "";

  await new Promise<void>((resolve) => {
    let finished = false;

    const done = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener("message", onMessage);
      resolve();
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://giscus.app") return;
      if (!(typeof event.data === "object" && event.data?.giscus)) return;

      const payload = event.data.giscus;
      if (payload.error) {
        setStore(slug, { comments: 0, reactions: 0 });
        done();
        return;
      }

      if (payload.discussion) {
        setStore(slug, readDiscussionStats(payload));
        done();
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
    script.setAttribute("data-term", `/posts/${slug}`);
    script.setAttribute("data-strict", "1");
    script.setAttribute("data-reactions-enabled", giscus.value.reactionsEnabled ?? "1");
    script.setAttribute("data-emit-metadata", "1");
    script.setAttribute("data-input-position", giscus.value.inputPosition ?? "bottom");
    script.setAttribute("data-theme", isDark.value ? "dark" : "light");
    script.setAttribute("data-lang", giscus.value.lang ?? "en");
    script.setAttribute("data-loading", "eager");
    container.value?.appendChild(script);

    window.setTimeout(() => {
      setStore(slug, getStore()[slug] || { comments: 0, reactions: 0 });
      done();
    }, 3000);
  });
}

onMounted(async () => {
  const store = getStore();
  for (const post of queue.value) {
    if (store[post.slug]) continue;
    await loadStats(post.slug);
  }
  if (container.value) container.value.innerHTML = "";
});
</script>

<template>
  <div ref="container" class="post-stats-loader" aria-hidden="true" />
</template>
