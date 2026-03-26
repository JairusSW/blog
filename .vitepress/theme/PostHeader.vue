<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";
import PostTags from "./PostTags.vue";

const { frontmatter, page } = useData();
const isPost = computed(() => {
  const path = page.value.relativePath || "";
  return path.startsWith("posts/") && path !== "posts/index.md";
});
const title = computed(() => frontmatter.value.title as string | undefined);
const description = computed(() => frontmatter.value.description as string | undefined);
const tags = computed(() => (frontmatter.value.tags as string[] | undefined) || []);
</script>

<template>
  <header v-if="isPost && title" class="post-header">
    <h1>{{ title }}</h1>
    <p v-if="description" class="post-header-description">{{ description }}</p>
    <PostTags :tags="tags" />
  </header>
</template>
