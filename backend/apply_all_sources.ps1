$ErrorActionPreference = "Stop"
npx wrangler d1 execute oaktree-db --remote --file=setup_all_sources.sql --yes
