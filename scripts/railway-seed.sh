#!/usr/bin/env bash
set -euo pipefail

# Bootstrap or refresh demo data on Railway (API service shell).
# Removes Fleet Farm catalog data and seeds the base apparel demo only.

echo "==> Removing Fleet Farm data and reseeding demo catalog..."
pnpm reseed:demo

echo ""
echo "Done. Sign in to Admin with ADMIN_EMAIL / ADMIN_PASSWORD from Railway variables."
echo "Admin URL: https://pim-admin.up.railway.app/login"
echo "Storefront: https://pim-store.up.railway.app"
