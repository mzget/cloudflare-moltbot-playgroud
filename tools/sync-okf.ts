#!/usr/bin/env npx tsx
/**
 * sync-okf.ts — Upload local OKF knowledge bundle to Cloudflare R2
 *
 * Usage: npm run sync-knowledge
 *    or: npx tsx tools/sync-okf.ts [--dry-run]
 *
 * Scans the okf-knowledge-bundle/ directory and uploads every .md file
 * to the `oaktree-knowledge` R2 bucket via `wrangler r2 object put`.
 *
 * Idempotent: running multiple times is safe (overwrites existing objects).
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

const BUNDLE_DIR = join(__dirname, '..', 'okf-knowledge-bundle');
const R2_BUCKET = 'oaktree-knowledge';
const DRY_RUN = process.argv.includes('--dry-run');

function collectMdFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectMdFiles(fullPath));
    } else if (entry.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  console.log(`\n🗂️  OKF Knowledge Bundle Sync`);
  console.log(`   Bundle: ${BUNDLE_DIR}`);
  console.log(`   Bucket: ${R2_BUCKET}`);
  if (DRY_RUN) console.log(`   Mode:   DRY RUN (no actual upload)\n`);
  else console.log(`   Mode:   LIVE\n`);

  const files = collectMdFiles(BUNDLE_DIR);
  console.log(`Found ${files.length} Markdown files to sync\n`);

  let uploaded = 0;
  let failed = 0;

  for (const filePath of files) {
    // R2 key = relative path from bundle dir (e.g. frameworks/peter_lynch.md)
    const key = relative(BUNDLE_DIR, filePath).replace(/\\/g, '/');

    console.log(`  → Uploading: ${key}`);

    if (!DRY_RUN) {
      try {
        execSync(
          `npx wrangler r2 object put "${R2_BUCKET}/${key}" --file="${filePath}" --content-type="text/markdown"`,
          { stdio: 'pipe', cwd: join(__dirname, '..', 'backend') }
        );
        console.log(`     ✅ OK`);
        uploaded++;
      } catch (err: any) {
        console.error(`     ❌ FAILED: ${err.stderr?.toString() || err.message}`);
        failed++;
      }
    } else {
      console.log(`     ✅ (dry run)`);
      uploaded++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Uploaded: ${uploaded}`);
  if (failed > 0) console.log(`   Failed:   ${failed}`);
  console.log(`\n${DRY_RUN ? 'Dry run complete.' : '✅ Sync complete. R2 bucket is up to date.'}\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
