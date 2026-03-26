<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";

const { frontmatter, page } = useData();

const isPost = computed(() => {
  const path = page.value.relativePath || "";
  return path.startsWith("posts/") && path !== "posts/index.md";
});

const bannerSrc = computed(() => frontmatter.value.banner as string | undefined);
const bannerAlt = computed(() => (frontmatter.value.bannerAlt as string | undefined) || "Post banner");
const bannerCredit = computed(() => frontmatter.value.bannerCredit as string | undefined);
</script>

<template>
  <figure v-if="isPost && bannerSrc" class="post-banner">
    <img :src="bannerSrc" :alt="bannerAlt" loading="eager" />
    <figcaption v-if="bannerCredit">{{ bannerCredit }}</figcaption>
  </figure>
</template>
