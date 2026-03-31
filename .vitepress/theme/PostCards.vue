<script setup lang="ts">
import { computed } from "vue";
import posts from "./posts.data.json";
import PostTags from "./PostTags.vue";

const props = withDefaults(defineProps<{
  limit?: number;
  compact?: boolean;
  title?: string;
  intro?: string;
  tag?: string;
}>(), {
  compact: false,
});

const normalizedTag = computed(() => props.tag?.trim().toLowerCase() || "");
const filteredPosts = computed(() => normalizedTag.value
  ? posts.filter((post) => (post.tags || []).some((tag) => tag.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") === normalizedTag.value))
  : posts);
const visiblePosts = computed(() => props.limit ? filteredPosts.value.slice(0, props.limit) : filteredPosts.value);

function bannerWithVersion(post: { banner?: string; updatedAtRaw?: string; createdAtRaw?: string }) {
  if (!post.banner) return "";
  const version = post.updatedAtRaw || post.createdAtRaw;
  if (!version) return post.banner;
  const separator = post.banner.includes("?") ? "&" : "?";
  return `${post.banner}${separator}v=${encodeURIComponent(version)}`;
}
</script>

<template>
  <section class="post-collection" :class="{ 'post-collection-compact': compact }">
    <div v-if="title || intro" class="post-collection-head">
      <h2 v-if="title">{{ title }}</h2>
      <p v-if="intro">{{ intro }}</p>
    </div>

    <div class="post-collection-grid">
      <a v-for="post in visiblePosts" :key="post.slug" class="post-card" :href="`/posts/${post.slug}`">
        <img v-if="post.banner" class="post-card-banner" :src="bannerWithVersion(post)" :alt="post.bannerAlt || post.title" loading="lazy" />
        <div v-else class="post-card-banner post-card-banner-placeholder" aria-hidden="true"></div>
        <div class="post-card-body">
          <span class="post-meta">{{ post.createdAt }} · {{ post.category }}</span>
          <strong>{{ post.title }}</strong>
          <p>{{ post.description }}</p>
          <div class="post-card-footer">
            <PostTags :tags="post.tags" :links="false" />
            <div class="post-stats">
              <span>{{ post.reactionCount || 0 }} reactions</span>
              <span>{{ post.commentCount || 0 }} comments</span>
            </div>
          </div>
        </div>
      </a>
    </div>
  </section>
</template>
