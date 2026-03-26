<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import posts from "./posts.data.json";
import PostStatsLoader from "./PostStatsLoader.vue";
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
const stats = ref<Record<string, { comments: number; reactions: number }>>({});

function getPostStats(slug: string) {
  return stats.value[slug] || { comments: 0, reactions: 0 };
}

function loadStats() {
  try {
    stats.value = JSON.parse(
      localStorage.getItem("post-stats:v2")
        || localStorage.getItem("post-stats:v1")
        || "{}",
    );
  } catch {
    stats.value = {};
  }
}

onMounted(() => {
  loadStats();
  window.addEventListener("post-stats-updated", loadStats);
});
</script>

<template>
  <section class="post-collection" :class="{ 'post-collection-compact': compact }">
    <PostStatsLoader :posts="visiblePosts" />

    <div v-if="title || intro" class="post-collection-head">
      <h2 v-if="title">{{ title }}</h2>
      <p v-if="intro">{{ intro }}</p>
    </div>

    <div class="post-collection-grid">
      <a v-for="post in visiblePosts" :key="post.slug" class="post-card" :href="`/posts/${post.slug}`">
        <img v-if="post.banner" class="post-card-banner" :src="post.banner" :alt="post.bannerAlt || post.title" loading="lazy" />
        <div v-else class="post-card-banner post-card-banner-placeholder" aria-hidden="true"></div>
        <div class="post-card-body">
          <span class="post-meta">{{ post.date }} · {{ post.category }}</span>
          <strong>{{ post.title }}</strong>
          <p>{{ post.description }}</p>
          <div class="post-card-footer">
            <PostTags :tags="post.tags" />
            <div class="post-stats">
              <span>{{ getPostStats(post.slug).reactions }} reactions</span>
              <span>{{ getPostStats(post.slug).comments }} comments</span>
            </div>
          </div>
        </div>
      </a>
    </div>
  </section>
</template>
