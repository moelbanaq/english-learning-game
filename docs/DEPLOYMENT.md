# Deployment

The app is static files. There is nothing to build and nothing to configure at runtime.

## GitHub Pages (recommended, free)

1. Push to `main`.
2. Repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. `.github/workflows/deploy.yml` validates the content and publishes the repository.

The site appears at `https://<user>.github.io/<repo>/`. All paths are relative and routing
is hash-based, so a sub-path deployment works with no configuration.

### Why GitHub Pages
Free for public repositories, HTTPS included, custom domains free, no build minutes needed
beyond the test run, and the repo is the artifact. Cloudflare Pages or Netlify would work
identically (point them at the repo root, leave the build command empty) if you ever want
edge caching or preview deployments.

## Any other static host

Copy the repository contents. Required files: `index.html`, `assets/`, `src/`, `content/`,
`manifest.webmanifest`. Serve over HTTP(S) — opening `index.html` from disk fails because
modules and content are fetched.

## Custom domain (when you want one)

1. Add a `CNAME` file at the repository root containing e.g. `learn.yourdomain.com`.
2. At your DNS provider, add `CNAME learn → <user>.github.io`.
3. Repository → Settings → Pages → Custom domain → enter it → tick **Enforce HTTPS**.

Nothing in the code changes. `mydomain.com/learn` is also possible by putting the site
behind a reverse proxy, but the subdomain is simpler and free.

## Linking from an EasyOrder site

The game is intentionally independent of EasyOrder — it does not read from it, write to
it, or depend on it being online. Integration is a link:

```html
<a href="https://<user>.github.io/<repo>/"
   target="_blank" rel="noopener"
   style="display:inline-block;padding:14px 26px;border-radius:12px;
          background:#4f46e5;color:#fff;font-weight:700;text-decoration:none">
  تعلّم الإنجليزية · Learn English
</a>
```

Add that button anywhere EasyOrder allows custom HTML (a page, a banner, the menu).

If you would rather keep visitors on your domain, embed it:

```html
<iframe src="https://<user>.github.io/<repo>/"
        style="width:100%;height:85vh;border:0" loading="lazy"
        title="Masar English"></iframe>
```

An iframe is the weaker option: progress is stored per-origin, some mobile browsers
restrict storage inside frames, and the app cannot be installed to the home screen from
there. Prefer the link or a subdomain.

## Where learner data lives

In the learner's own browser (`localStorage`, key prefix `masar.v1.`). Nothing is sent
anywhere — there is no backend, no analytics and no third-party script. Settings offers
export/import so a learner can move progress between devices manually.

Consequences worth knowing:
- Clearing site data clears progress.
- Private-browsing mode falls back to in-memory storage; a warning is shown in Settings.
- Different browsers on the same device keep separate progress.

Cloud sync is the fix, and the storage adapter is already shaped for it — see
[ARCHITECTURE.md](ARCHITECTURE.md).
