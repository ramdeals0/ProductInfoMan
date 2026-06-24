#!/usr/bin/env bash
set -euo pipefail

# Deploy / redeploy the API service on Railway.
#
# Dashboard deploy (recommended): see docs/deployment/railway-production.md
#
# CLI (after `railway login` and `railway link` to API service):
#   bash scripts/railway-deploy-api.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v railway >/dev/null 2>&1; then
  echo "Installing Railway CLI..."
  curl -fsSL https://railway.app/install.sh | sh
  export PATH="$HOME/.railway/bin:$PATH"
fi

if ! railway whoami >/dev/null 2>&1; then
  cat <<'EOF'

Not logged in to Railway.

Dashboard deploy:
  1. railway.app → productinfoman-production
  2. API service → Settings → Root Directory = empty (repo root)
  3. Config-as-code → /apps/api/railway.toml
  4. Variables → copy from .env.railway.production (set JWT_SECRET, ADMIN_PASSWORD)
  5. Networking → pim-api.up.railway.app
  6. Deploy → curl https://pim-api.up.railway.app/health/ready
  7. Shell → bash scripts/railway-seed.sh

CLI: railway login && railway link && bash scripts/railway-deploy-api.sh

EOF
  exit 1
fi

echo "==> Deploying API to Railway..."
railway up --detach

echo ""
echo "Verify: curl https://pim-api.up.railway.app/health/ready"
echo "Seed:   railway shell → bash scripts/railway-seed.sh"
