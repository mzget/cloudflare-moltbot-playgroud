# Deployment Guide - Moltbot

This document provides detailed instructions for deploying the Moltbot application to Cloudflare's global network using GitHub Actions CI/CD.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Cloudflare Setup](#cloudflare-setup)
- [GitHub Repository Setup](#github-repository-setup)
- [Automated Deployment](#automated-deployment)
- [Manual Deployment](#manual-deployment)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)

## Prerequisites

Before deploying, ensure you have:

1. **Node.js** installed (v18 or later)
2. **Cloudflare Account** with Workers and Pages enabled
3. **GitHub Account** with access to the repository
4. **Wrangler CLI** installed globally or via npx

## Cloudflare Setup

### 1. Create Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **My Profile** → **API Tokens**
3. Click **Create Token**
4. Use the **Edit Cloudflare Workers** template or create a custom token with these permissions:
   - **Account** → **Workers Scripts** → **Edit**
   - **Account** → **Cloudflare Pages** → **Edit**
   - **Account** → **D1** → **Edit**
5. Copy the generated token (you won't be able to see it again!)

### 2. Get Your Account ID

Your Cloudflare Account ID is: `xxx`

You can also find it:
- In the Cloudflare dashboard URL when viewing Workers & Pages
- By running: `npx wrangler whoami`

### 3. Create Production D1 Database

If you haven't created the production database yet:

```bash
# Create the database
npx wrangler d1 create moltbot-db

# Copy the database_id from the output
# Update backend/wrangler.toml and frontend/wrangler.toml with the actual database_id

# Initialize the schema
npx wrangler d1 execute moltbot-db --file=./backend/schema.sql
```

**Important:** Update the `database_id` in both `backend/wrangler.toml` and `frontend/wrangler.toml` with the actual production database ID.

## GitHub Repository Setup

### 1. Configure GitHub Secrets

Go to your GitHub repository: `https://github.com/mzget/cloudflare-moltbot-playgroud`

Navigate to **Settings** → **Secrets and variables** → **Actions**

Add the following **Repository Secrets**:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `CLOUDFLARE_API_TOKEN` | Your API token from step 1 | API token with Workers/Pages permissions |
| `CLOUDFLARE_ACCOUNT_ID` | `b66e3465f1453412df32adf063fc8388` | Your Cloudflare account ID |

### 2. Configure GitHub Variables (Optional)

If you want to use GitHub Variables for the database ID:

Add a **Repository Variable**:
- Name: `D1_DATABASE_ID`
- Value: Your production D1 database ID

> **Note:** Currently, the database ID is configured directly in `wrangler.toml` files. Using GitHub Variables is optional for future flexibility.

### 3. Enable GitHub Actions

Ensure GitHub Actions is enabled for your repository:
- Go to **Settings** → **Actions** → **General**
- Under **Actions permissions**, select **Allow all actions and reusable workflows**

## Automated Deployment

The repository includes three GitHub Actions workflows:

### 1. Backend Deployment (`deploy-backend.yml`)

**Triggers:**
- Push to `main` branch with changes in `backend/` directory
- Manual trigger via workflow dispatch

**What it does:**
- Installs dependencies
- Deploys the Cloudflare Worker to production
- Updates the scheduled cron job

### 2. Frontend Deployment (`deploy-frontend.yml`)

**Triggers:**
- Push to `main` branch with changes in `frontend/` directory
- Manual trigger via workflow dispatch

**What it does:**
- Installs dependencies
- Builds the Astro application
- Deploys to Cloudflare Pages

### 3. Continuous Integration (`ci.yml`)

**Triggers:**
- Pull requests to `main` branch
- Push to `main` branch

**What it does:**
- Runs type checking
- Builds both backend and frontend
- Verifies no build errors

### Deployment Workflow

1. **Make changes** to your code locally
2. **Commit and push** to a feature branch
3. **Create a pull request** to `main`
4. **CI workflow runs** automatically to verify builds
5. **Merge the PR** after review and CI passes
6. **Deployment workflows run** automatically based on changed files
7. **Monitor deployment** in the Actions tab

### Manual Trigger

You can manually trigger deployments:

1. Go to **Actions** tab in GitHub
2. Select the workflow (`Deploy Backend` or `Deploy Frontend`)
3. Click **Run workflow**
4. Select the branch and click **Run workflow**

## Manual Deployment

If you need to deploy manually from your local machine:

### Backend Deployment

```bash
cd backend
npm install
npx wrangler deploy
```

### Frontend Deployment

```bash
cd frontend
npm install
npm run build
npx wrangler pages deploy dist --project-name=moltbot-frontend
```

### Deploy Both

From the root directory:

```bash
# Backend
cd backend && npx wrangler deploy && cd ..

# Frontend
cd frontend && npm run build && npx wrangler pages deploy dist --project-name=moltbot-frontend && cd ..
```

## Troubleshooting

### Common Issues

#### 1. Authentication Failed

**Error:** `Authentication error` or `Invalid API token`

**Solution:**
- Verify your `CLOUDFLARE_API_TOKEN` secret is correct
- Ensure the token has the required permissions
- Check if the token has expired

#### 2. Database Not Found

**Error:** `D1 database not found` or `Database binding error`

**Solution:**
- Verify the `database_id` in `wrangler.toml` matches your production database
- Ensure the database exists: `npx wrangler d1 list`
- Check the database binding name is `DB` in both configurations

#### 3. Build Failures

**Error:** Build fails during CI or deployment

**Solution:**
- Check the GitHub Actions logs for specific error messages
- Verify all dependencies are listed in `package.json`
- Test the build locally: `npm run build`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

#### 4. Deployment Timeout

**Error:** Deployment times out or hangs

**Solution:**
- Check Cloudflare status page for outages
- Retry the deployment
- Use manual deployment as a fallback

#### 5. Cron Job Not Running

**Error:** Scheduled crawler doesn't execute

**Solution:**
- Verify the cron schedule in `backend/wrangler.toml`
- Check Cloudflare Workers dashboard for cron job logs
- Trigger manually to test: Use Wrangler dev mode and press `L`

### Viewing Logs

**GitHub Actions Logs:**
1. Go to **Actions** tab
2. Click on the workflow run
3. Click on the job name to see detailed logs

**Cloudflare Workers Logs:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages**
3. Click on your worker (`moltbot` or `moltbot-frontend`)
4. View **Logs** tab for real-time logs

**Wrangler Logs:**
```bash
# View recent logs
npx wrangler tail moltbot

# View frontend logs
npx wrangler pages deployment tail
```

## Rollback Procedures

### Rollback Backend Worker

#### Option 1: Via Cloudflare Dashboard
1. Go to **Workers & Pages** → **moltbot**
2. Click **Deployments** tab
3. Find the previous working deployment
4. Click **Rollback** or **Promote to Production**

#### Option 2: Via Wrangler CLI
```bash
# List recent deployments
npx wrangler deployments list

# Rollback to a specific deployment
npx wrangler rollback [deployment-id]
```

#### Option 3: Redeploy Previous Version
```bash
# Checkout the previous working commit
git checkout <previous-commit-sha>

# Deploy manually
cd backend
npx wrangler deploy

# Return to main branch
git checkout main
```

### Rollback Frontend (Cloudflare Pages)

#### Via Cloudflare Dashboard
1. Go to **Workers & Pages** → **moltbot-frontend**
2. Click **Deployments** tab
3. Find the previous working deployment
4. Click **Rollback to this deployment**

### Emergency Rollback

If you need to quickly rollback both services:

```bash
# 1. Identify the last working commit
git log --oneline

# 2. Checkout that commit
git checkout <commit-sha>

# 3. Deploy both services
cd backend && npx wrangler deploy && cd ..
cd frontend && npm run build && npx wrangler pages deploy dist --project-name=moltbot-frontend && cd ..

# 4. Return to main
git checkout main
```

## Monitoring and Alerts

### Set Up Monitoring

1. **Cloudflare Analytics:**
   - View request metrics in Workers dashboard
   - Monitor error rates and response times

2. **GitHub Actions Notifications:**
   - Go to **Settings** → **Notifications**
   - Enable email notifications for workflow failures

3. **Cloudflare Email Alerts:**
   - Set up alerts for Worker errors
   - Configure notifications for high error rates

### Health Checks

Regularly verify:
- ✅ Backend Worker is responding
- ✅ Frontend is accessible
- ✅ D1 database connectivity
- ✅ Cron jobs are executing
- ✅ Workers AI integration is working

## Best Practices

1. **Always test locally** before pushing to production
2. **Use pull requests** for code review
3. **Monitor deployments** in the Actions tab
4. **Keep secrets secure** - never commit API tokens
5. **Document changes** in commit messages
6. **Test rollback procedures** periodically
7. **Keep dependencies updated** regularly
8. **Review logs** after each deployment

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Astro Documentation](https://docs.astro.build/)

## Support

If you encounter issues not covered in this guide:
1. Check the [Cloudflare Community](https://community.cloudflare.com/)
2. Review [GitHub Actions logs](https://github.com/mzget/cloudflare-moltbot-playgroud/actions)
3. Create an issue in the repository
