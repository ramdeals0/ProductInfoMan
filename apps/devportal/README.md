# Developer Portal

API documentation for ProductInfoMan.

## Run locally

```bash
pnpm install
pnpm dev:devportal
```

Open http://localhost:3003 — redirects to `/docs/overview`.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.yourpim.com/api/v1` | Production API base for examples |
| `NEXT_PUBLIC_API_SANDBOX_URL` | `https://sandbox-api.yourpim.com/api/v1` | Sandbox API base |
| `NEXT_PUBLIC_ADMIN_URL` | `http://localhost:3000` | Admin UI link |
| `NEXT_PUBLIC_STOREFRONT_URL` | `http://localhost:3002` | Storefront link |
| `NEXT_PUBLIC_DEFAULT_ORG_SLUG` | `demo` | Default org in examples |

## Structure

- `src/app/docs/*/page.mdx` — documentation pages
- `src/config/docs-nav.ts` — sidebar navigation config
- `src/components/docs/` — layout, MDX components (`CodeBlock`, `Endpoint`, …)
