# Browser authoring setup

The blog editor lives at `https://blog.jairus.dev/admin/`. It edits Markdown in
`posts/` through GitHub, uploads banners to `public/images/`, and uses the normal
GitHub Pages workflow to publish. The preview pane includes the article, Google
search snippet, canonical URL, Open Graph fields, and generated social-card
layout.

GitHub sign-in needs the small OAuth worker in `oauth-worker/` because GitHub
OAuth client secrets cannot be shipped in a static GitHub Pages site.

## One-time setup

1. In GitHub, create an OAuth app at <https://github.com/settings/applications/new>.
   Use:

   - Homepage URL: `https://blog.jairus.dev/admin/`
   - Authorization callback URL: `https://auth.jairus.dev/callback`

2. Authenticate Wrangler and deploy the Worker code once. This creates the
   `jairus-blog-auth` Worker and attaches the `auth.jairus.dev` custom
   domain:

   ```sh
   npx wrangler@4 login
   npx wrangler@4 deploy --config oauth-worker/wrangler.jsonc
   ```

   The custom domain requires `jairus.dev` to be active in the same Cloudflare
   account.

3. Create the two encrypted Worker variables. The word after `secret put` is
   the variable name; enter the corresponding GitHub value only when Wrangler
   prompts for the secret value:

   ```sh
   npx wrangler@4 secret put GITHUB_OAUTH_ID --config oauth-worker/wrangler.jsonc
   # At the prompt, paste the GitHub OAuth Client ID.

   npx wrangler@4 secret put GITHUB_OAUTH_SECRET --config oauth-worker/wrangler.jsonc
   # At the prompt, paste the GitHub OAuth Client Secret.

   npx wrangler@4 secret list --config oauth-worker/wrangler.jsonc
   curl https://auth.jairus.dev/health
   ```

4. Push the site changes and open `https://blog.jairus.dev/admin/`. Sign in with
   the GitHub account that has write access to `JairusSW/blog`.

If the repository becomes private, set `GITHUB_REPO_PRIVATE` to `"true"` in
`oauth-worker/wrangler.jsonc` and redeploy so the OAuth app requests the `repo`
scope.

## Publishing behavior

The editor uses an editorial workflow: drafts live on GitHub branches and become
pull requests when marked ready. Merging to `main` starts the Pages build. That
build regenerates post indexes, tag pages, structured data, the compressed OG
PNG, and `sitemap.xml`.

The deployment workflow also runs every day at 05:17 UTC. This refreshes
`lastmod` values and deploys the sitemap even when there has not been a new
commit. CI fails early if the sitemap, structured data, or robots sitemap
directive is missing.
