// @ts-nocheck
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

function isNativeBlocked() {
  try {
    require('@bruits/satteri-win32-x64-msvc');
    require('@astrojs/compiler-binding-win32-x64-msvc');
    return false;
  } catch {
    return true;
  }
}

const frontendRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(frontendRoot, '..');

function resolvePackageDir(pkgName) {
  const candidateDirs = [
    path.join(frontendRoot, 'node_modules', ...pkgName.split('/')),
    path.join(monorepoRoot, 'node_modules', ...pkgName.split('/')),
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
  }

  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`, {
      paths: [frontendRoot, monorepoRoot],
    });
    return path.dirname(pkgJsonPath);
  } catch {
    return null;
  }
}

function checkAndInstallWasiFallbacks() {
  // Only execute on Windows machines
  if (process.platform !== 'win32') {
    return;
  }

  // If native bindings load without issues (e.g. Smart App Control is off), do nothing
  if (!isNativeBlocked()) {
    return;
  }

  const satteriDir = resolvePackageDir('satteri');
  const compilerDir = resolvePackageDir('@astrojs/compiler-binding');

  if (!satteriDir || !compilerDir) {
    return;
  }

  const satteriWasi = path.join(satteriDir, 'satteri_napi.wasi.cjs');
  const compilerWasi = path.join(compilerDir, 'astro.wasi.cjs');

  if (fs.existsSync(satteriWasi) && fs.existsSync(compilerWasi)) {
    return;
  }

  console.log('[setup-wasi] Windows Smart App Control detected: setting up WASI fallbacks for Astro...');

  const workDir = frontendRoot;

  try {
    const satteriPkg = require(path.join(satteriDir, 'package.json'));
    const compilerPkg = require(path.join(compilerDir, 'package.json'));

    const satteriVersion = satteriPkg.version;
    const compilerVersion = compilerPkg.version;

    const satteriTarball = execSync(`npm pack @bruits/satteri-wasm32-wasi@${satteriVersion}`, {
      cwd: workDir,
      encoding: 'utf8',
    }).trim().split('\n').pop().trim();

    const compilerTarball = execSync(`npm pack @astrojs/compiler-binding-wasm32-wasi@${compilerVersion}`, {
      cwd: workDir,
      encoding: 'utf8',
    }).trim().split('\n').pop().trim();

    execSync(`tar -xzf "${satteriTarball}" package/satteri_napi.wasi.cjs package/satteri_napi.wasm32-wasi.wasm`, { cwd: workDir });
    fs.copyFileSync(path.join(workDir, 'package', 'satteri_napi.wasi.cjs'), satteriWasi);
    fs.copyFileSync(path.join(workDir, 'package', 'satteri_napi.wasm32-wasi.wasm'), path.join(satteriDir, 'satteri_napi.wasm32-wasi.wasm'));

    execSync(`tar -xzf "${compilerTarball}" package/astro.wasi.cjs package/astro.wasm32-wasi.wasm`, { cwd: workDir });
    fs.copyFileSync(path.join(workDir, 'package', 'astro.wasi.cjs'), compilerWasi);
    fs.copyFileSync(path.join(workDir, 'package', 'astro.wasm32-wasi.wasm'), path.join(compilerDir, 'astro.wasm32-wasi.wasm'));

    fs.rmSync(path.join(workDir, 'package'), { recursive: true, force: true });
    fs.rmSync(path.join(workDir, satteriTarball), { force: true });
    fs.rmSync(path.join(workDir, compilerTarball), { force: true });

    console.log('[setup-wasi] WASI fallbacks configured successfully.');
  } catch (err) {
    console.warn('[setup-wasi] Warning: Failed to configure WASI fallbacks:', err?.message || err);
  }
}

checkAndInstallWasiFallbacks();
