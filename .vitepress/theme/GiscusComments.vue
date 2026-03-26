<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useData, useRoute } from "vitepress";

const route = useRoute();
const { isDark, page, theme } = useData();
const container = ref<HTMLElement | null>(null);

const giscus = computed(() => theme.value.giscus ?? {});
const isPost = computed(() => {
  const path = page.value.relativePath || "";
  return path.startsWith("posts/") && path !== "posts/index.md";
});
const isConfigured = computed(() => {
  return Boolean(giscus.value.repoId && giscus.value.categoryId)
    && giscus.value.repoId !== "PASTE_REPO_ID_HERE"
    && giscus.value.categoryId !== "PASTE_CATEGORY_ID_HERE";
});
const activeTheme = computed(() => (isDark.value ? "dark" : "light"));

function syncTheme() {
  const iframe = container.value?.querySelector<HTMLIFrameElement>("iframe.giscus-frame");
  if (!iframe?.contentWindow) return;

  iframe.contentWindow.postMessage(
    {
      giscus: {
        setConfig: {
          theme: activeTheme.value,
        },
      },
    },
    "https://giscus.app",
  );
}

function mountGiscus() {
  if (!container.value || !isPost.value || !isConfigured.value) return;
  container.value.innerHTML = "";

  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.setAttribute("data-repo", giscus.value.repo);
  script.setAttribute("data-repo-id", giscus.value.repoId);
  script.setAttribute("data-category", giscus.value.category);
  script.setAttribute("data-category-id", giscus.value.categoryId);
  script.setAttribute("data-mapping", giscus.value.mapping ?? "pathname");
  script.setAttribute("data-strict", giscus.value.strict ?? "0");
  script.setAttribute("data-reactions-enabled", giscus.value.reactionsEnabled ?? "1");
  script.setAttribute("data-emit-metadata", giscus.value.emitMetadata ?? "0");
  script.setAttribute("data-input-position", giscus.value.inputPosition ?? "bottom");
  script.setAttribute("data-theme", activeTheme.value);
  script.setAttribute("data-lang", giscus.value.lang ?? "en");
  script.setAttribute("data-loading", giscus.value.loading ?? "lazy");
  container.value.appendChild(script);
}

onMounted(mountGiscus);
watch(() => route.path, async () => {
  await nextTick();
  mountGiscus();
});
watch(isDark, async () => {
  await nextTick();
  syncTheme();
});
</script>

<template>
  <section v-if="isPost" class="comments-wrap">
    <h2>Comments</h2>
    <p v-if="!isConfigured" class="comments-note">
      Enable GitHub Discussions for <code>JairusSW/blog</code>, install giscus, then replace
      <code>repoId</code> and <code>categoryId</code> in <code>.vitepress/config.mts</code>.
    </p>
    <div v-else ref="container" />
  </section>
</template>
