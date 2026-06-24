# Production deployment — Railway

**Project:** `PIM`  
**Public API domain:** https://pim-api.up.railway.app  
**Public Admin domain:** https://pim-admin.up.railway.app  
**Public Storefront domain:** https://pim-store.up.railway.app  
**Public Developer Portal domain:** https://pmi-developer.up.railway.app

Use this document when configuring the live Railway environment. The monorepo normally runs as **separate services** (API, Admin, Storefront). If you only have one public domain so far, assign it to the **API** service first.

---

## Service layout

| Service | Config path | Suggested domain |
|---------|-------------|------------------|
| **API** | `/apps/api/railway.toml` | `pim-api.up.railway.app` |
| **Admin** | `/apps/admin/railway.toml` | `pim-admin.up.railway.app` |
| **Storefront** | `/apps/storefront/railway.toml` | `pim-store.up.railway.app` |
| **Developer Portal** | `/apps/devportal/railway.toml` | `pmi-developer.up.railway.app` |
| **Postgres** | Railway plugin | Internal only |

---

## API service — Railway dashboard checklist

1. **New service** from GitHub repo `ProductInfoMan` (or redeploy existing API service).
2. **Settings → Root Directory:** leave **empty** (monorepo root).
3. **Settings → Config-as-code:** `/apps/api/railway.toml`
4. **Variables** (see below). Generate `JWT_SECRET`: `openssl rand -base64 48`
5. **Networking → Public domain:** `pim-api.up.railway.app` (or generate and alias).
6. **Deploy** and watch logs. Pre-deploy runs `pnpm db:push` to sync schema.
7. When healthy, **Shell** → `bash scripts/railway-seed.sh`

Or with CLI after `railway login`: `bash scripts/railway-deploy-api.sh`

---

## API service variables

In Railway → **API service** → **Variables**:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
HOST=0.0.0.0
JWT_SECRET=<generate with: openssl rand -base64 48>
IMPORT_SYNC=true
SEARCH_SYNC=true
PUBLISH_SYNC=true
EVENT_SYNC=true
METRICS_ENABLED=true
ADMIN_EMAIL=admin@demo.local
ADMIN_PASSWORD=<strong password, min 12 chars>
```

```env
CORS_ORIGINS=https://pim-admin.up.railway.app,https://pim-store.up.railway.app
```

### Verify API (after deploy)

```bash
curl https://pim-api.up.railway.app/health
curl https://pim-api.up.railway.app/health/ready
curl -H "X-Organization-Slug: demo" \
  https://pim-api.up.railway.app/api/v1/products
```

Expected:

- `/health` → `{"status":"ok"}`
- `/health/ready` → `{"status":"ok"}` (subsystem details only with `X-Health-Token` header when `HEALTH_INTERNAL_TOKEN` is set)
- `/api/v1/products` → JSON list (may be empty before seed)

---

## Admin service variables

Railway service **PIM-ADMIN** → `pim-admin.up.railway.app`. Config: `/apps/admin/railway.toml`.

```env
API_URL=https://pim-api.up.railway.app
JWT_SECRET=<same value as API>
NEXT_PUBLIC_DEFAULT_ORG_SLUG=demo
NODE_ENV=production
```

If not using config-as-code, set Railpack commands:

```env
RAILPACK_INSTALL_CMD=corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install --frozen-lockfile
RAILPACK_BUILD_CMD=pnpm --filter @productinfoman/admin build
RAILPACK_START_CMD=pnpm --filter @productinfoman/admin start
```

Do **not** set `NEXT_PUBLIC_ADMIN_EMAIL` in production — the login form must not pre-fill credentials.

**Important:** Set `API_URL` before the first Admin build. Redeploy Admin after changing it.

Sign in at: https://pim-admin.up.railway.app/login

---

## Storefront service variables

Railway service **PIM-STORE** → `pim-store.up.railway.app`. Config: `/apps/storefront/railway.toml`.

```env
API_URL=https://pim-api.up.railway.app
NEXT_PUBLIC_API_URL=https://pim-api.up.railway.app
NEXT_PUBLIC_ORG_SLUG=demo
NEXT_PUBLIC_SITE_URL=https://pim-store.up.railway.app
NODE_ENV=production
```

If not using config-as-code, set Railpack commands:

```env
RAILPACK_INSTALL_CMD=corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install --frozen-lockfile
RAILPACK_BUILD_CMD=pnpm --filter @productinfoman/storefront build
RAILPACK_START_CMD=pnpm --filter @productinfoman/storefront start
```

Set `API_URL` and `NEXT_PUBLIC_*` before the first build.

---

## Developer Portal service variables

Railway service **dev portal** → `pmi-developer.up.railway.app`. Config: `/apps/devportal/railway.toml`.

```env
NEXT_PUBLIC_API_BASE_URL=https://pim-api.up.railway.app/api/v1
NEXT_PUBLIC_API_SANDBOX_URL=https://pim-api.up.railway.app/api/v1
NEXT_PUBLIC_ADMIN_URL=https://pim-admin.up.railway.app
NEXT_PUBLIC_STOREFRONT_URL=https://pim-store.up.railway.app
NEXT_PUBLIC_DEFAULT_ORG_SLUG=demo
NODE_ENV=production
```

If not using config-as-code, set Railpack commands:

```env
RAILPACK_INSTALL_CMD=corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install --frozen-lockfile
RAILPACK_BUILD_CMD=pnpm --filter @productinfoman/devportal build
RAILPACK_START_CMD=pnpm --filter @productinfoman/devportal start
```

Set `NEXT_PUBLIC_*` before the first build so docs examples use production URLs.

---

## One-time seed (API shell)

After `/health/ready` succeeds:

```bash
bash scripts/railway-seed.sh
```

Or:

```bash
pnpm db:seed
pnpm seed:attributes-facets
pnpm seed:demo-catalog
```

Then sign in to Admin with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Application not found` (404) | Service not deployed, wrong domain, or deployment failed. Check Railway **Deployments** tab and logs. |
| API crash on start | Set `JWT_SECRET` (min 32 characters). |
| Admin **Unauthorized** | `JWT_SECRET` must match on API and Admin. |
| Admin API calls fail | `API_URL=https://pim-api.up.railway.app` on Admin; rebuild. |
| Empty catalog | Run seed script in API shell. |

---

## Quick reference URLs

| Surface | URL |
|---------|-----|
| API health | https://pim-api.up.railway.app/health |
| API ready | https://pim-api.up.railway.app/health/ready |
| API products | https://pim-api.up.railway.app/api/v1/products |
| Admin login | https://pim-admin.up.railway.app/login |
| Storefront | https://pim-store.up.railway.app |
| Developer Portal | https://pmi-developer.up.railway.app |

See also: [railway.md](./railway.md) (general guide), [user-guide.md](../user-guide.md) (end users).
