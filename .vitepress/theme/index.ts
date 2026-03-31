import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import Layout from "./Layout.vue";
import PostCards from "./PostCards.vue";
import TagDirectory from "./TagDirectory.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component("PostCards", PostCards);
    app.component("TagDirectory", TagDirectory);
  }
} satisfies Theme;
