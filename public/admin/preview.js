(function () {
  const h = window.h;
  const createClass = window.createClass;

  function value(entry, key, fallback) {
    const result = entry.getIn(["data", key]);
    return result == null || result === "" ? fallback : result;
  }

  function list(entry, key) {
    const result = entry.getIn(["data", key]);
    return result && typeof result.toJS === "function" ? result.toJS() : [];
  }

  function slugify(input) {
    return String(input || "untitled-post")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  const PostPreview = createClass({
    render: function () {
      const entry = this.props.entry;
      const title = value(entry, "title", "Untitled post");
      const description = value(entry, "description", "Add a description to preview search and social metadata.");
      const category = value(entry, "category", "Post");
      const date = value(entry, "createdAt", new Date().toISOString().slice(0, 10));
      const tags = list(entry, "tags");
      const slug = slugify(title);
      const canonical = `https://blog.jairus.dev/posts/${slug}`;
      const socialImage = `https://blog.jairus.dev/social/${slug}.png`;
      const banner = value(entry, "banner", "");
      const bannerAsset = banner ? this.props.getAsset(banner) : null;
      const bannerUrl = bannerAsset ? bannerAsset.toString() : "";
      const metadata = {
        title,
        description,
        canonical,
        socialImage,
        type: "article",
        published: date,
        category,
        tags,
      };

      return h("main", { className: "editor-preview" },
        h("section", { className: "preview-section" },
          h("div", { className: "preview-kicker" }, "SOCIAL PREVIEW · 1200 × 630"),
          h("div", { className: "og-card" },
            h("div", {
              className: `og-banner${bannerUrl ? " has-image" : ""}`,
              style: bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : {},
              role: "img",
              "aria-label": value(entry, "bannerAlt", "Post banner preview"),
            }),
            h("div", { className: "og-content" },
              h("div", { className: "og-meta" }, `${date} · ${category}`),
              h("h1", {}, title),
              h("div", { className: "og-tags" }, tags.slice(0, 4).map((tag) => h("span", { key: tag }, tag))),
            ),
          ),
          h("p", { className: "preview-note" }, "The production build recreates this card as a compressed PNG using the selected banner."),
        ),
        h("section", { className: "preview-section" },
          h("div", { className: "preview-kicker" }, "SEARCH & OPEN GRAPH DATA"),
          h("div", { className: "search-card" },
            h("div", { className: "search-url" }, canonical),
            h("div", { className: "search-title" }, title),
            h("p", {}, description),
          ),
          h("dl", { className: "metadata-grid" }, Object.entries(metadata).flatMap(([key, val]) => [
            h("dt", { key: `${key}-label` }, key),
            h("dd", { key }, Array.isArray(val) ? val.join(", ") : String(val)),
          ])),
        ),
        h("article", { className: "post-preview preview-section" },
          bannerUrl ? h("img", { className: "post-banner-preview", src: bannerUrl, alt: value(entry, "bannerAlt", "") }) : null,
          h("div", { className: "post-category" }, `${date} · ${category}`),
          h("h1", {}, title),
          h("p", { className: "post-description" }, description),
          h("div", { className: "post-tags-preview" }, tags.map((tag) => h("span", { key: tag }, tag))),
          h("hr"),
          this.props.widgetFor("body"),
        ),
      );
    },
  });

  window.CMS.registerPreviewTemplate("posts", PostPreview);
  window.CMS.registerPreviewStyle("/admin/preview.css");
})();
