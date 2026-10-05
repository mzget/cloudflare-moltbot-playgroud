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

function checkAndInstallWasiFallbacks() {
  // Only execute on Windows machines
  if (process.platform !== 'win32') {
    return;
  }

  // If native bindings load without issues (e.g. Smart App Control is off), do nothing
  if (!isNativeBlocked()) {
    return;
  }

  const root = path.resolve(__dirname, '..');
  const satteriDir = path.join(root, 'node_modules', 'satteri');
  const compilerDir = path.join(root, 'node_modules', '@astrojs', 'compiler-binding');

  if (!fs.existsSync(satteriDir) || !fs.existsSync(compilerDir)) {
    return;
  }

  const satteriWasi = path.join(satteriDir, 'satteri_napi.wasi.cjs');
  const compilerWasi = path.join(compilerDir, 'astro.wasi.cjs');

  if (fs.existsSync(satteriWasi) && fs.existsSync(compilerWasi)) {
    return;
  }

  console.log('[setup-wasi] Windows Smart App Control detected: setting up WASI fallbacks for Astro...');

  try {
    const satteriPkg = require(path.join(satteriDir, 'package.json'));
    const compilerPkg = require(path.join(compilerDir, 'package.json'));

    const satteriVersion = satteriPkg.version;
    const compilerVersion = compilerPkg.version;

    const satteriTarball = execSync(`npm pack @bruits/satteri-wasm32-wasi@${satteriVersion}`, {
      cwd: root,
      encoding: 'utf8',
    }).trim().split('\n').pop().trim();

    const compilerTarball = execSync(`npm pack @astrojs/compiler-binding-wasm32-wasi@${compilerVersion}`, {
      cwd: root,
      encoding: 'utf8',
    }).trim().split('\n').pop().trim();

    execSync(`tar -xzf "${satteriTarball}" package/satteri_napi.wasi.cjs package/satteri_napi.wasm32-wasi.wasm`, { cwd: root });
    fs.copyFileSync(path.join(root, 'package', 'satteri_napi.wasi.cjs'), satteriWasi);
    fs.copyFileSync(path.join(root, 'package', 'satteri_napi.wasm32-wasi.wasm'), path.join(satteriDir, 'satteri_napi.wasm32-wasi.wasm'));

    execSync(`tar -xzf "${compilerTarball}" package/astro.wasi.cjs package/astro.wasm32-wasi.wasm`, { cwd: root });
    fs.copyFileSync(path.join(root, 'package', 'astro.wasi.cjs'), compilerWasi);
    fs.copyFileSync(path.join(root, 'package', 'astro.wasm32-wasi.wasm'), path.join(compilerDir, 'astro.wasm32-wasi.wasm'));

    fs.rmSync(path.join(root, 'package'), { recursive: true, force: true });
    fs.rmSync(path.join(root, satteriTarball), { force: true });
    fs.rmSync(path.join(root, compilerTarball), { force: true });

    console.log('[setup-wasi] WASI fallbacks configured successfully.');
  } catch (err) {
    console.warn('[setup-wasi] Warning: Failed to configure WASI fallbacks:', err?.message || err);
  }
}

checkAndInstallWasiFallbacks();
