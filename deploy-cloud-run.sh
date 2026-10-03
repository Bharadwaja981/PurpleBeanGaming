#!/usr/bin/env bash
# ==============================================================================
# Production Cloud Run Deployment Script
# Service Name: purplebeangaming-api
#
# Enables unauthenticated HTTP invocation at infrastructure level so Vercel can proxy
# all /api/* requests without Google AI Studio cookie challenges (__cookie_check.html).
# Protected endpoints continue to enforce Firebase Bearer tokens, Discord OAuth
# constraints, and referee/admin permissions.
# ==============================================================================
set -euo pipefail

SERVICE_NAME="purplebeangaming-api"
REGION="${GCP_REGION:-europe-west1}"
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo '')}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GCP Project ID is not set. Run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "==> Deploying $SERVICE_NAME to Google Cloud Run..."
echo "    Project: $PROJECT_ID"
echo "    Region:  $REGION"

# Deploy container to Cloud Run with public invocation enabled
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,PORT=8080,DISCORD_REDIRECT_URI=https://www.purplebeangaming.com/api/auth/discord/callback,DISCORD_UNLINK_REVOKES_ROLE=true,STEAM_OPENID_REALM=https://www.purplebeangaming.com,DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID:-},DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET:-},DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN:-},DISCORD_GUILD_ID=${DISCORD_GUILD_ID:-},DISCORD_PBG_MEMBER_ROLE_ID=${DISCORD_PBG_MEMBER_ROLE_ID:-},STEAM_WEB_API_KEY=${STEAM_WEB_API_KEY:-},OPENDOTA_API_KEY=${OPENDOTA_API_KEY:-},FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID:-},FIREBASE_SERVICE_ACCOUNT_JSON=${FIREBASE_SERVICE_ACCOUNT_JSON:-}"

# Explicitly ensure allUsers has roles/run.invoker to guarantee unauthenticated access
gcloud run services add-iam-policy-binding "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --member="allUsers" \
  --role="roles/run.invoker"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format="value(status.url)")

echo "=============================================================================="
echo "Successfully deployed $SERVICE_NAME!"
echo "Production Cloud Run URL: $SERVICE_URL"
echo ""
echo "Now update vercel.json rewrite destination to:"
echo "  $SERVICE_URL/api/:path*"
echo "=============================================================================="
