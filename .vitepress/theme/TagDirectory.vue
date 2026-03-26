<script setup lang="ts">
import tags from "./tags.data.json";
import { useData } from "vitepress";
import { computed } from "vue";
import { tagStyle } from "./tagStyles";

const { theme } = useData();
const tagColors = computed(() => theme.value.tagColors ?? {});
</script>

<template>
  <div class="tag-directory">
    <a
      v-for="tag in tags"
      :key="tag.slug"
      class="tag-directory-item"
      :href="`/tags/${tag.slug}`"
      :style="tagStyle(tag.name, tagColors)"
    >
      <span>{{ tag.name }}</span>
      <strong>{{ tag.count }}</strong>
    </a>
  </div>
</template>
