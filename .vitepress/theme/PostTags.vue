<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";
import { tagStyle } from "./tagStyles";

const props = withDefaults(defineProps<{
  tags?: string[];
  links?: boolean;
}>(), {
  links: true,
});

const { theme } = useData();
const tagColors = computed(() => theme.value.tagColors ?? {});

function tagSlug(tag: string) {
  return tag.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
</script>

<template>
  <div v-if="props.tags?.length" class="post-tags">
    <component
      v-for="tag in props.tags"
      :key="tag"
      class="post-tag"
      :is="props.links === false ? 'span' : 'a'"
      :href="props.links === false ? undefined : `/tags/${tagSlug(tag)}`"
      :style="tagStyle(tag, tagColors)"
    >
      {{ tag }}
    </component>
  </div>
</template>
