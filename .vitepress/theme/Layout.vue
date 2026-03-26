<script setup lang="ts">
import DefaultTheme from "vitepress/theme";
import BannerImage from "./BannerImage.vue";
import GiscusComments from "./GiscusComments.vue";
import PostHeader from "./PostHeader.vue";

const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #doc-before>
      <BannerImage />
      <PostHeader />
    </template>
    <template #doc-after>
      <GiscusComments />
    </template>
  </Layout>
</template>
