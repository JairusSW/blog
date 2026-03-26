<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";
import { tagStyle } from "./tagStyles";

const props = defineProps<{
  tags?: string[];
}>();

const { theme } = useData();
const tagColors = computed(() => theme.value.tagColors ?? {});

function tagSlug(tag: string) {
  return tag.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
</script>

<template>
  <div v-if="tags?.length" class="post-tags">
    <a
      v-for="tag in tags"
      :key="tag"
      class="post-tag"
      :href="`/tags/${tagSlug(tag)}`"
      :style="tagStyle(tag, tagColors)"
    >
      {{ tag }}
    </a>
  </div>
</template>
