<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { getPostViewCount, incrementPostViewCount, subscribeToPostViewCount } from "./viewCounts";

const props = withDefaults(defineProps<{
  slug?: string;
  increment?: boolean;
}>(), {
  slug: "",
  increment: false,
});

const count = ref(0);
let unsubscribe = () => {};

const label = computed(() => {
  const value = count.value;
  return `${value} ${value === 1 ? "view" : "views"}`;
});

onMounted(() => {
  if (!props.slug) return;

  count.value = props.increment
    ? incrementPostViewCount(props.slug)
    : getPostViewCount(props.slug);

  unsubscribe = subscribeToPostViewCount(props.slug, (nextCount) => {
    count.value = nextCount;
  });
});

onUnmounted(() => {
  unsubscribe();
});
</script>

<template>
  <span class="view-count">{{ label }}</span>
</template>
