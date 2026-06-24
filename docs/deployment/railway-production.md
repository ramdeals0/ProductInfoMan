# Production deployment — Railway

**Project:** `productinfoman-production`  
**Public API domain:** https://pim-api.up.railway.app

Use this document when configuring the live Railway environment. The monorepo normally runs as **separate services** (API, Admin, Storefront). If you only have one public domain so far, assign it to the **API** service first.

---

## Service layout

| Service | Config path | Suggested domain |
|---------|-------------|------------------|
| **API** | `/apps/api/railway.toml` | `pim-api.up.railway.app` |
| **Admin** | `/apps/admin/railway.toml` | Generate a second domain in Railway |
| **Storefront** | `/apps/storefront/railway.toml` | Generate a third domain (optional) |
| **Postgres** | Railway plugin | Internal only |

---

## API service variables

In Railway → **API service** → **Variables**:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
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

After Admin has a public domain, add:

```env
CORS_ORIGINS=https://<your-admin-domain>.up.railway.app
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

Create a **second** Railway service from the same repo with config `/apps/admin/railway.toml`.

```env
API_URL=https://pim-api.up.railway.app
JWT_SECRET=<same value as API>
NEXT_PUBLIC_DEFAULT_ORG_SLUG=demo
```

Do **not** set `NEXT_PUBLIC_ADMIN_EMAIL` in production — the login form must not pre-fill credentials.

**Important:** Set `API_URL` before the first Admin build. Redeploy Admin after changing it.

Sign in at: `https://<admin-domain>/login`

---

## Storefront service variables (optional)

Config: `/apps/storefront/railway.toml`

```env
API_URL=https://pim-api.up.railway.app
NEXT_PUBLIC_ORG_SLUG=demo
NEXT_PUBLIC_SITE_URL=https://<storefront-domain>.up.railway.app
```

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
| Admin | `https://<admin-domain>/login` (after Admin service is created) |
| Storefront | `https://<storefront-domain>/` (optional) |

See also: [railway.md](./railway.md) (general guide), [user-guide.md](../user-guide.md) (end users).
