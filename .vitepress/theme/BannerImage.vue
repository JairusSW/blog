<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";

const { frontmatter, page } = useData();

const isPost = computed(() => {
  const path = page.value.relativePath || "";
  return path.startsWith("posts/") && path !== "posts/index.md";
});

const bannerSrc = computed(() => frontmatter.value.banner as string | undefined);
const bannerVersion = computed(() => (frontmatter.value.updatedAt as string | undefined) || (frontmatter.value.createdAt as string | undefined));
const bannerSrcVersioned = computed(() => {
  if (!bannerSrc.value) return undefined;
  if (!bannerVersion.value) return bannerSrc.value;
  const separator = bannerSrc.value.includes("?") ? "&" : "?";
  return `${bannerSrc.value}${separator}v=${encodeURIComponent(bannerVersion.value)}`;
});
const bannerAlt = computed(() => (frontmatter.value.bannerAlt as string | undefined) || "Post banner");
const bannerCredit = computed(() => frontmatter.value.bannerCredit as string | undefined);
</script>

<template>
  <figure v-if="isPost && bannerSrcVersioned" class="post-banner">
    <img :src="bannerSrcVersioned" :alt="bannerAlt" loading="eager" />
    <figcaption v-if="bannerCredit">{{ bannerCredit }}</figcaption>
  </figure>
</template>
