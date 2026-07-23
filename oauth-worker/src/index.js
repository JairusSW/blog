const githubAuthorizeUrl = "https://github.com/login/oauth/authorize";
const githubTokenUrl = "https://github.com/login/oauth/access_token";
const stateCookieName = "blog_oauth_state";

function randomState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  for (const cookie of cookies.split(";")) {
    const [key, ...parts] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return "";
}

function securityHeaders() {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function popupResponse(origin, status, payload) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const safeOrigin = JSON.stringify(origin).replace(/</g, "\\u003c");
  const safeMessage = JSON.stringify(message).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>GitHub authorization</title></head>
  <body style="font:16px system-ui;padding:2rem;background:#07111a;color:#e5edf7">
    <p id="status">Finishing GitHub authorization…</p>
    <script>
      const targetOrigin = ${safeOrigin};
      const result = ${safeMessage};
      function receiveMessage(event) {
        if (event.source !== window.opener || event.origin !== targetOrigin) return;
        window.opener.postMessage(result, targetOrigin);
        window.removeEventListener("message", receiveMessage);
        document.getElementById("status").textContent = "Authorized. You can close this window.";
        window.close();
      }
      window.addEventListener("message", receiveMessage);
      if (window.opener) window.opener.postMessage("authorizing:github", targetOrigin);
    </script>
  </body>
</html>`;
  return new Response(html, {
    headers: { ...securityHeaders(), "Content-Type": "text/html; charset=utf-8" },
  });
}

async function authorize(request, env) {
  const requestUrl = new URL(request.url);
  if (requestUrl.searchParams.get("provider") !== "github") {
    return new Response("Unsupported OAuth provider", { status: 400, headers: securityHeaders() });
  }

  const state = randomState();
  const callbackUrl = `${requestUrl.origin}/callback`;
  const authorizeUrl = new URL(githubAuthorizeUrl);
  authorizeUrl.searchParams.set("client_id", env.GITHUB_OAUTH_ID);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("scope", env.GITHUB_REPO_PRIVATE === "true" ? "repo,user" : "public_repo,user");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      ...securityHeaders(),
      Location: authorizeUrl.toString(),
      "Set-Cookie": `${stateCookieName}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}

async function callback(request, env) {
  const requestUrl = new URL(request.url);
  const expectedState = cookieValue(request, stateCookieName);
  const receivedState = requestUrl.searchParams.get("state") || "";
  const cmsOrigin = env.CMS_ORIGIN || "https://blog.jairus.dev";

  if (!expectedState || expectedState !== receivedState) {
    return popupResponse(cmsOrigin, "error", { message: "The OAuth state did not match. Please try signing in again." });
  }

  const githubError = requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error");
  const code = requestUrl.searchParams.get("code");
  if (githubError || !code) {
    return popupResponse(cmsOrigin, "error", { message: githubError || "GitHub did not return an authorization code." });
  }

  const tokenResponse = await fetch(githubTokenUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "jairus-blog-authoring" },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_ID,
      client_secret: env.GITHUB_OAUTH_SECRET,
      code,
      redirect_uri: `${requestUrl.origin}/callback`,
    }),
  });
  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    return popupResponse(cmsOrigin, "error", { message: tokenPayload.error_description || "GitHub token exchange failed." });
  }

  const response = popupResponse(cmsOrigin, "success", { token: tokenPayload.access_token });
  response.headers.append("Set-Cookie", `${stateCookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  return response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!env.GITHUB_OAUTH_ID || !env.GITHUB_OAUTH_SECRET) {
      return new Response("OAuth worker is not configured", { status: 503, headers: securityHeaders() });
    }
    if (url.pathname === "/auth") return authorize(request, env);
    if (url.pathname === "/callback") return callback(request, env);
    if (url.pathname === "/health") {
      return Response.json({ ok: true }, { headers: securityHeaders() });
    }
    return new Response("Not found", { status: 404, headers: securityHeaders() });
  },
};
