# Moltbot - AI Stock News Crawler

Moltbot is a Cloudflare Worker application that:
1.  Tracks your stock watchlist using Cloudflare D1.
2.  Crawls news daily using Cloudflare Browser Rendering.
3.  Analyzes and summarizes news using Cloudflare Workers AI.
4.  Displays a dashboard for managing stocks and viewing news.

## Prerequisites

**Node.js is required** to run this project. Please install it from [nodejs.org](https://nodejs.org/).

## Setup Instructions

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Database Setup**:
    - Login to Cloudflare:
      ```bash
      npx wrangler login
      ```
    - Create the D1 database:
      ```bash
      npx wrangler d1 create moltbot-db
      ```
    - Copy the `database_id` from the output and update `wrangler.toml` in the `[d1_databases]` section.
    - Initialize the schema locally:
      ```bash
      npx wrangler d1 execute moltbot-db --local --file=./schema.sql
      ```

3.  **Run Locally**:
    ```bash
    npx wrangler dev
    ```
    - Open your browser at `http://localhost:8787`.

## Features
- **Add Stock**: Enter a symbol (e.g., AAPL). The AI will automatically find related stocks.
- **Crawler**: Runs automatically every day (cron). You can trigger it manually in `wrangler dev` (hit `L` key to toggle local scheduled event testing, or use curl).
- **News Feed**: Semantic analysis of news with sentiment.

## Deployment
To deploy to Cloudflare global network:
```bash
npm run deploy
```

### Automated Deployment (CI/CD)

This project uses GitHub Actions for automated deployment:

- **Backend**: Automatically deploys to Cloudflare Workers when changes are pushed to `main` branch in the `backend/` directory
- **Frontend**: Automatically deploys to Cloudflare Pages when changes are pushed to `main` branch in the `frontend/` directory
- **CI Checks**: Runs build verification on all pull requests

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Git Setup

### Initial Setup

If you're setting up the repository for the first time:

```bash
# Initialize Git (if not already done)
git init

# Add the remote repository
git remote add origin https://github.com/mzget/cloudflare-moltbot-playgroud.git

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Push to GitHub
git push -u origin main
```

### Contributing

1. **Clone the repository**:
   ```bash
   git clone https://github.com/mzget/cloudflare-moltbot-playgroud.git
   cd cloudflare-moltbot-playgroud
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** and commit:
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

4. **Push to GitHub**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request** on GitHub

6. **Wait for CI checks** to pass before merging

## Environment Variables

### Required Secrets (for CI/CD)

Configure these in GitHub repository settings (**Settings** → **Secrets and variables** → **Actions**):

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token with Workers and Pages permissions
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID (`xxx`)

### Local Development

For local development, you can use `.dev.vars` file in the backend directory (not committed to Git):

```bash
# backend/.dev.vars
# Add any local environment variables here
```

## Project Structure

```
moltbot/
├── backend/              # Cloudflare Worker (API, crawler, AI)
│   ├── src/
│   │   └── index.ts     # Main worker entry point
│   ├── schema.sql       # D1 database schema
│   ├── wrangler.toml    # Worker configuration
│   └── package.json
├── frontend/            # Astro frontend (UI)
│   ├── src/
│   │   ├── pages/       # Astro pages
│   │   ├── components/  # UI components
│   │   └── layouts/     # Page layouts
│   ├── wrangler.toml    # Pages configuration
│   └── package.json
├── .github/
│   └── workflows/       # GitHub Actions CI/CD
├── DEPLOYMENT.md        # Detailed deployment guide
└── README.md           # This file
```

## Troubleshooting

### Common Issues

- **Database not found**: Ensure you've created the D1 database and updated the `database_id` in `wrangler.toml`
- **Authentication errors**: Check your Cloudflare API token and account ID
- **Build failures**: Clear `node_modules` and reinstall dependencies with `npm install`
- **Deployment issues**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed troubleshooting

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Astro Documentation](https://docs.astro.build/)
- [Deployment Guide](./DEPLOYMENT.md)

