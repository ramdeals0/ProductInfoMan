#!/usr/bin/env bash
set -euo pipefail

# One-time bootstrap for a fresh Railway deployment.
# Run inside the API service shell (Railway → API → Shell) after first deploy.

echo "==> Seeding demo organization, admin user, taxonomy..."
pnpm db:seed

echo "==> Seeding attributes and facets..."
pnpm seed:attributes-facets

echo "==> Seeding demo catalog (search sync inline when SEARCH_SYNC=true)..."
pnpm seed:demo-catalog --no-reindex || pnpm seed:demo-catalog

echo ""
echo "Done. Sign in to Admin with ADMIN_EMAIL / ADMIN_PASSWORD from Railway variables."
echo "Admin URL: https://pim-admin.up.railway.app/login"
