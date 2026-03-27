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
const createdAt = computed(() => frontmatter.value.createdAt as string | undefined);
const updatedAt = computed(() => frontmatter.value.updatedAt as string | undefined);
const metaLine = computed(() => {
  const parts = [] as string[];
  if (createdAt.value) parts.push(`Published ${createdAt.value}`);
  if (updatedAt.value && updatedAt.value !== createdAt.value) parts.push(`Updated ${updatedAt.value}`);
  return parts.join(" · ");
});
</script>

<template>
  <header v-if="isPost && title" class="post-header">
    <h1>{{ title }}</h1>
    <p v-if="metaLine" class="post-meta">{{ metaLine }}</p>
    <p v-if="description" class="post-header-description">{{ description }}</p>
    <PostTags :tags="tags" />
  </header>
</template>
