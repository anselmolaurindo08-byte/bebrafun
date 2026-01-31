# Railway Deployment Guide

## Prerequisites
- GitHub account with repository access
- Railway account (https://railway.app)
- Twitter Developer Portal credentials

## Step 1: Create Railway Project

1. Go to https://railway.app/new
2. Select "Deploy from GitHub repo"
3. Connect your GitHub account
4. Select the `prediction-market` repository

## Step 2: Add PostgreSQL Database

1. In Railway dashboard, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway auto-provisions the database
3. The `DATABASE_URL` variable is auto-added to your service

## Step 3: Set Environment Variables

In Railway dashboard → your service → **Variables** tab, add:

### Required Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | (auto-provided) | Auto-set by Railway PostgreSQL |
| `JWT_SECRET` | `openssl rand -hex 32` | Generate a unique secret |
| `TWITTER_CONSUMER_KEY` | From Twitter Dev Portal | OAuth API Key |
| `TWITTER_CONSUMER_SECRET` | From Twitter Dev Portal | OAuth API Secret |
| `TWITTER_CALLBACK_URL` | `https://YOUR-RAILWAY-URL.railway.app/auth/callback` | Update after first deploy |
| `SERVER_PORT` | `8080` | Default port |

### Optional Variables

| Variable | Default | Notes |
|----------|---------|-------|
| `INITIAL_VIRTUAL_BALANCE` | `1000.00` | Starting balance for new users |
| `INVITE_CODES_PER_USER` | `5` | Invite codes per user |
| `FRONTEND_URL` | - | Frontend URL for CORS |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `SOLANA_NETWORK` | `devnet` | Solana network |

## Step 4: Deploy

Railway auto-deploys on push to `main` branch. To deploy manually:

```bash
npm install -g @railway/cli
railway login
railway link
railway up
```

## Step 5: Post-Deployment

1. Get your Railway URL from the dashboard (Settings → Domains)
2. Update `TWITTER_CALLBACK_URL` to: `https://YOUR-URL.railway.app/auth/callback`
3. Update Twitter Developer Portal callback URL to match
4. Verify: `curl https://YOUR-URL.railway.app/health`

## Troubleshooting

**Build fails:**
- Check Dockerfile syntax
- Verify go.mod dependencies

**Database connection fails:**
- Ensure PostgreSQL service is linked
- Check `DATABASE_URL` is set

**Twitter OAuth fails:**
- Verify callback URL matches in both Railway vars and Twitter Dev Portal
- Ensure HTTPS is used (Railway provides SSL)

**CORS errors:**
- Set `FRONTEND_URL` to your frontend domain

## Useful Commands

```bash
# View logs
railway logs

# Open shell in container
railway shell

# View environment variables
railway variables

# Redeploy
railway up --detach
```
